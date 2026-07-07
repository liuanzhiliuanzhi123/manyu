import "server-only"

import {
  DeepSeekPlannerError,
  getDeepSeekRuntimeConfig,
  hasDeepSeekApiKey,
} from "@/lib/planner/deepseek-client"
import { classifyPlannerError } from "@/lib/observability/planner-error-taxonomy"
import { generatePlanByDeepSeek } from "@/lib/planner/deepseek-planner"
import { buildFallbackGeneratedPlan } from "@/lib/planner-fallback"
import {
  buildBeijingPlannerCandidates,
  filterBeijingPlannerCandidates,
} from "@/lib/planner/beijing-planner-context"
import { buildWeatherPlanContext, getWeatherByCity } from "@/lib/weather-service"
import {
  plannerDecisionRequestSchema,
  plannerDecisionResultSchema,
  type PlannerDecisionRequestInput,
  type PlannerDecisionResultOutput,
} from "@/lib/planner-json-schema"
import {
  buildPreferencePolicyFromRequest,
  getCandidatePolicyScore,
  getLegacyFieldsFromPolicy,
  type PreferencePolicy,
} from "@/lib/planner/preference-policy"
import { normalizeRequestedDays } from "@/lib/planner/days-policy"
import type {
  GeneratedPlan,
  PlannerDayCountDiagnostic,
  PlannerDiagnostics,
} from "@/lib/planner-types"

const REMOTE_DISTRICT_KEYWORDS = ["延庆", "怀柔", "密云", "平谷", "门头沟"]

function parseBudgetUpperBound(budgetRange: string) {
  if (!budgetRange) return Number.POSITIVE_INFINITY
  if (budgetRange.includes("以内")) {
    const value = Number(budgetRange.replace(/[^\d]/g, ""))
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  if (budgetRange.includes("以上")) return Number.POSITIVE_INFINITY
  const [minText, maxText] = budgetRange.split("-")
  const maxValue = Number((maxText || minText || "").replace(/[^\d]/g, ""))
  return Number.isFinite(maxValue) ? maxValue : Number.POSITIVE_INFINITY
}

function normalizeText(input?: string) {
  return (input || "").trim()
}

function isBeijingInput(input: PlannerDecisionRequestInput) {
  const city = normalizeText(input.city)
  const province = normalizeText(input.province)
  const destination = normalizeText(input.destination)
  return [city, province, destination].some((text) => text.includes("北京"))
}

function isRemoteDistrict(district?: string) {
  const text = normalizeText(district)
  if (!text) return false
  return REMOTE_DISTRICT_KEYWORDS.some((keyword) => text.includes(keyword))
}

function getWeatherRuleText(input: PlannerDecisionRequestInput) {
  const advice = input.weatherContext?.summary.travelAdvice
  const dayAdvice = input.weatherContext?.dayWeather
    .flatMap((item) => [item.weather, item.advice, ...item.tags, ...item.suggestions])
    .join(" ")
  return [
    advice?.summary,
    ...(advice?.tags || []),
    ...(advice?.suggestions || []),
    ...(advice?.itineraryRules || []),
    dayAdvice,
  ]
    .filter(Boolean)
    .join(" ")
}

function isIndoorCandidate(item: PlannerDecisionRequestInput["attractions"][number]) {
  const text = `${item.name} ${(item.tags || []).join(" ")} ${item.address || ""}`
  return /博物馆|美术馆|展馆|展览|商场|购物|剧院|演出|书店|室内|餐厅|文化中心|艺术/u.test(text)
}

function isExposedCandidate(item: PlannerDecisionRequestInput["attractions"][number]) {
  const text = `${item.name} ${(item.tags || []).join(" ")} ${item.address || ""}`
  return /公园|山|湖|河|海|峡谷|草原|徒步|登高|露天|广场|城墙|长城|观景|自然|户外/u.test(text)
}

function distanceMeters(
  a: { lng?: number; lat?: number; district?: string },
  b: { lng?: number; lat?: number; district?: string }
) {
  if (
    !Number.isFinite(a.lng) ||
    !Number.isFinite(a.lat) ||
    !Number.isFinite(b.lng) ||
    !Number.isFinite(b.lat)
  ) {
    if (a.district && b.district && a.district === b.district) return 1500
    return Number.POSITIVE_INFINITY
  }

  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad((b.lat as number) - (a.lat as number))
  const dLng = toRad((b.lng as number) - (a.lng as number))
  const lat1 = toRad(a.lat as number)
  const lat2 = toRad(b.lat as number)
  const k =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.max(0, 6371000 * 2 * Math.atan2(Math.sqrt(k), Math.sqrt(1 - k)))
}

function scoreAttraction(
  item: PlannerDecisionRequestInput["attractions"][number],
  input: PlannerDecisionRequestInput,
  preferredSet: Set<string>,
  policy: PreferencePolicy
) {
  let score = getCandidatePolicyScore(item, policy)
  if (preferredSet.has(item.placeId)) score += 100
  if (Number.isFinite(item.rating)) score += (item.rating as number) * 10
  const text = `${item.name} ${(item.tags || []).join(" ")}`

  for (const interest of input.interests) {
    if (text.includes(interest)) score += 12
  }

  if (input.companions === "family" || input.specialNeeds.includes("适合小孩")) {
    if (/亲子|儿童|动物|科技|互动/u.test(text)) score += 16
  }

  if (input.companions === "elderly" || input.specialNeeds.includes("适合老人")) {
    if (/文化|公园|博物馆|寺庙|古建/u.test(text)) score += 10
    if (isRemoteDistrict(item.district)) score -= 14
  }

  if (input.specialNeeds.includes("少走路") && isRemoteDistrict(item.district)) {
    score -= 16
  }

  if (input.pace === "fast") score += 6
  if (input.pace === "slow" && isRemoteDistrict(item.district)) score -= 6

  const weatherText = getWeatherRuleText(input)
  if (weatherText) {
    const indoor = isIndoorCandidate(item)
    const exposed = isExposedCandidate(item)
    if (/雨|雷阵雨|雨雪|室内优先/u.test(weatherText)) {
      if (indoor) score += 18
      if (exposed) score -= 18
    }
    if (/高温|避晒|12:00-15:00/u.test(weatherText)) {
      if (indoor) score += 10
      if (exposed) score -= 12
    }
    if (/大风|沙尘|开阔|登高|湖边/u.test(weatherText)) {
      if (indoor) score += 8
      if (exposed) score -= 14
    }
    if (/晴|适合户外/u.test(weatherText) && exposed) {
      score += 8
    }
  }

  return score
}

function withPolicyNormalizedFields(
  input: PlannerDecisionRequestInput,
  policy: PreferencePolicy
): PlannerDecisionRequestInput {
  const legacyFields = getLegacyFieldsFromPolicy(policy)
  return {
    ...input,
    budgetRange: legacyFields.budgetRange,
    companions: legacyFields.companions as PlannerDecisionRequestInput["companions"],
    interests: legacyFields.interests,
    pace: legacyFields.pace as PlannerDecisionRequestInput["pace"],
    specialNeeds: legacyFields.specialNeeds,
    structuredPreferences: {
      travelerGroup: policy.normalizedPreferences.travelerGroup,
      interestTags: policy.normalizedPreferences.interestTags,
      pace: policy.normalizedPreferences.effectivePace,
      specialNeeds: policy.normalizedPreferences.specialNeeds,
      days: policy.normalizedPreferences.days,
      budgetTier: policy.normalizedPreferences.budgetTier,
    },
  }
}

function withPreferenceTrace(policy: PreferencePolicy, repairApplied: boolean) {
  return {
    ...policy.preferenceTrace,
    repairApplied,
  }
}

function countFinalPlanDay(day: GeneratedPlan["days"][number]): PlannerDayCountDiagnostic {
  const food = Number(Boolean(day.lunch?.placeId)) + Number(Boolean(day.dinner?.placeId))
  const hotel = Number(Boolean(day.hotel?.placeId))
  return {
    day: day.day,
    dayIndex: day.day,
    spots: day.spots.length,
    totalItems: day.spots.length + food + hotel,
    mainActivities: day.spots.length,
    food,
    foodItems: food,
    hotel,
    hotelItems: hotel,
    transit: 0,
    rest: 0,
    note: 0,
    unknown: 0,
  }
}

function buildCatalogStats(input: PlannerDecisionRequestInput) {
  return {
    attractions: input.attractions.length,
    restaurants: input.restaurants.length,
    hotels: input.hotels.length,
  }
}

function buildRequestedPreferences(input: PlannerDecisionRequestInput) {
  return {
    city: input.city,
    totalDays: input.totalDays,
    budgetRange: input.budgetRange,
    companions: input.companions,
    interests: input.interests,
    pace: input.pace,
    specialNeeds: input.specialNeeds,
    structuredPreferences: input.structuredPreferences,
  }
}

function withPlannerDiagnostics(
  input: PlannerDecisionRequestInput,
  policy: PreferencePolicy,
  plan: GeneratedPlan,
  repairApplied: boolean,
  diagnostics?: PlannerDiagnostics
): PlannerDiagnostics {
  const normalizedPreferences = withPreferenceTrace(policy, repairApplied)
  return {
    ...diagnostics,
    requestedDays: diagnostics?.requestedDays ?? input.totalDays,
    normalizedDays: input.totalDays,
    finalDays: plan.days.length,
    requestedPace: input.pace,
    normalizedPace: policy.normalizedPreferences.effectivePace,
    targetTotalItemsPerDay: policy.hardConstraints.targetTotalItemsPerDay,
    minMainActivitiesPerDay: policy.hardConstraints.minMainActivitiesPerDay,
    dayRepairApplied:
      diagnostics?.dayRepairApplied ||
      Boolean(diagnostics?.missingDaysRepaired?.length) ||
      repairApplied,
    missingDaysRepaired: diagnostics?.missingDaysRepaired || [],
    requestedPreferences: buildRequestedPreferences(input),
    normalizedPreferences,
    poiCatalogStats: buildCatalogStats(input),
    finalDayCounts: plan.days.map(countFinalPlanDay),
    repairApplied,
  }
}

function withBeijingCandidateBackfill(
  input: PlannerDecisionRequestInput,
  policy: PreferencePolicy
): PlannerDecisionRequestInput {
  const attractionLimit = Math.max(
    32,
    Math.min(40, input.totalDays * policy.hardConstraints.maxMainActivitiesPerDay + 8)
  )
  const context = buildBeijingPlannerCandidates({
    selectedPlaceIds: input.manualPreferredPlaceIds || [],
    attractionLimit,
    restaurantLimit: 80,
    hotelLimit: 60,
  })

  const attractions = filterBeijingPlannerCandidates([
    ...input.attractions,
    ...context.attractions,
  ]).slice(0, 40)
  const restaurants = filterBeijingPlannerCandidates([
    ...input.restaurants,
    ...context.restaurants,
  ]).slice(0, 80)
  const hotels = filterBeijingPlannerCandidates([
    ...input.hotels,
    ...context.hotels,
  ]).slice(0, 60)

  return {
    ...input,
    attractions,
    restaurants,
    hotels,
  }
}

function applyHardRules(input: PlannerDecisionRequestInput, policy: PreferencePolicy) {
  const warnings: string[] = []
  const budgetUpper = parseBudgetUpperBound(input.budgetRange)
  const preferredSet = new Set(input.manualPreferredPlaceIds || [])

  const rawAttractions = input.attractions.filter((item) => item.type === "attraction")
  const rawRestaurants = input.restaurants.filter((item) => item.type === "restaurant")
  const rawHotels = input.hotels.filter((item) => item.type === "hotel")

  const budgetFilteredAttractions = rawAttractions.filter((item) => {
    if (!input.specialNeeds.includes("低预算优先")) return true
    if (!Number.isFinite(item.price) || (item.price as number) <= 0) return true
    return (item.price as number) <= Math.max(120, budgetUpper * 0.12)
  })
  const minimumAttractions = input.totalDays * policy.hardConstraints.minMainActivitiesPerDay
  const attractionPool =
    budgetFilteredAttractions.length >= minimumAttractions ||
    rawAttractions.length < minimumAttractions
      ? budgetFilteredAttractions
      : rawAttractions
  if (attractionPool !== budgetFilteredAttractions) {
    warnings.push("预算过滤会导致每日主活动不足，已放宽景点候选保留规则。")
  }

  const maxAttractions = Math.max(
    input.totalDays * policy.hardConstraints.maxMainActivitiesPerDay,
    input.totalDays * policy.hardConstraints.minMainActivitiesPerDay
  )
  const rankedAttractions = [...attractionPool]
    .sort(
      (a, b) =>
        scoreAttraction(b, input, preferredSet, policy) -
        scoreAttraction(a, input, preferredSet, policy)
    )
    .slice(0, maxAttractions)

  if (rawAttractions.length > rankedAttractions.length) {
    warnings.push(
      `规则过滤后保留 ${rankedAttractions.length}/${rawAttractions.length} 个景点候选。`
    )
  }

  const attractionIdSet = new Set(rankedAttractions.map((item) => item.placeId))
  const manualKept = (input.manualPreferredPlaceIds || []).filter((id) => attractionIdSet.has(id))

  const hintPairs = input.routeHints || []
  const routeFeasibleSet = new Set<string>()
  for (const hint of hintPairs) {
    if (!attractionIdSet.has(hint.fromPlaceId) || !attractionIdSet.has(hint.toPlaceId)) continue
    const extremeTransit =
      hint.mode === "transit" && hint.durationSeconds > 2 * 3600 && hint.distanceMeters > 30000
    if (extremeTransit) continue
    routeFeasibleSet.add(hint.fromPlaceId)
    routeFeasibleSet.add(hint.toPlaceId)
  }

  const routeCandidateAttractions = rankedAttractions.filter((item) => {
    if (manualKept.includes(item.placeId)) return true
    if (routeFeasibleSet.size === 0) return true
    return routeFeasibleSet.has(item.placeId)
  })
  const routeFilteredAttractions =
    routeCandidateAttractions.length >= minimumAttractions ||
    rankedAttractions.length < minimumAttractions
      ? routeCandidateAttractions
      : rankedAttractions

  if (routeFilteredAttractions.length < rankedAttractions.length) {
    warnings.push("已剔除部分公交可达性极差的景点候选。")
  } else if (routeCandidateAttractions.length < rankedAttractions.length) {
    warnings.push("路线过滤会导致每日主活动不足，已放宽公交可达性过滤。")
  }

  const anchors = routeFilteredAttractions

  const filteredRestaurants = rawRestaurants.filter((item) => {
    if (input.specialNeeds.includes("低预算优先") && Number.isFinite(item.price)) {
      if ((item.price as number) > Math.max(180, budgetUpper * 0.15)) return false
    }

    if (anchors.length === 0) return true
    const minDistance = anchors.reduce((min, anchor) => {
      const distance = distanceMeters(item, anchor)
      return distance < min ? distance : min
    }, Number.POSITIVE_INFINITY)

    if (Number.isFinite(minDistance)) return minDistance <= 8000

    return anchors.some((anchor) => normalizeText(anchor.district) === normalizeText(item.district))
  })

  const filteredHotels = rawHotels.filter((item) => {
    if (input.specialNeeds.includes("低预算优先") && Number.isFinite(item.price)) {
      if ((item.price as number) > Math.max(700, budgetUpper * 0.45)) return false
    }

    if (anchors.length === 0) return true
    const minDistance = anchors.reduce((min, anchor) => {
      const distance = distanceMeters(item, anchor)
      return distance < min ? distance : min
    }, Number.POSITIVE_INFINITY)

    if (Number.isFinite(minDistance)) return minDistance <= 12000

    return anchors.some((anchor) => normalizeText(anchor.district) === normalizeText(item.district))
  })

  if (filteredRestaurants.length < rawRestaurants.length) {
    warnings.push("已剔除离景点锚点过远或明显超预算的餐饮候选。")
  }
  if (filteredHotels.length < rawHotels.length) {
    warnings.push("已剔除离景点锚点过远或明显超预算的酒店候选。")
  }

  const restaurants = filteredRestaurants.length > 0 ? filteredRestaurants : rawRestaurants
  const hotels = filteredHotels.length > 0 ? filteredHotels : rawHotels
  const restaurantLimit = Math.max(16, input.totalDays * 6)
  const hotelLimit = Math.max(8, input.totalDays * 3)
  const limitedRestaurants = restaurants.slice(0, restaurantLimit)
  const limitedHotels = hotels.slice(0, hotelLimit)

  if (limitedRestaurants.length === 0) {
    warnings.push("餐饮候选不足，后续将使用基础规则兜底。")
  }
  if (limitedHotels.length === 0) {
    warnings.push("酒店候选不足，后续将使用基础规则兜底。")
  }
  if (limitedRestaurants.length < restaurants.length) {
    warnings.push(`已为模型提示保留 ${limitedRestaurants.length}/${restaurants.length} 个餐饮候选。`)
  }
  if (limitedHotels.length < hotels.length) {
    warnings.push(`已为模型提示保留 ${limitedHotels.length}/${hotels.length} 个酒店候选。`)
  }

  warnings.push(...policy.conflictWarnings)

  return {
    input: {
      ...input,
      attractions: routeFilteredAttractions,
      restaurants: limitedRestaurants,
      hotels: limitedHotels,
      manualPreferredPlaceIds: manualKept,
    },
    warnings,
  }
}

function buildFallbackDecision(
  input: PlannerDecisionRequestInput,
  warnings: string[],
  policy: PreferencePolicy,
  diagnostics?: PlannerDiagnostics
) {
  const fallback = buildFallbackGeneratedPlan(input)
  const repairApplied = true
  const result: PlannerDecisionResultOutput = {
    source: "fallback",
    plan: fallback.plan,
    warnings: [...warnings, ...fallback.warnings],
    preferenceTrace: withPreferenceTrace(policy, repairApplied),
    diagnostics: withPlannerDiagnostics(input, policy, fallback.plan, repairApplied, {
      ...diagnostics,
      repairApplied,
      repairReason: diagnostics?.repairReason || "fallback_planner",
    }),
  }
  return plannerDecisionResultSchema.parse(result)
}

function getSafeDeepSeekErrorDetails(error: unknown) {
  const runtime = getDeepSeekRuntimeConfig()
  const base = {
    hasApiKey: runtime.hasApiKey,
    baseUrl: runtime.baseUrl,
    model: runtime.model,
    providerModel: runtime.model,
  }

  if (error instanceof DeepSeekPlannerError) {
    return {
      ...base,
      errorType: classifyPlannerError(error, error.statusCode),
      statusCode: error.statusCode,
      requestId: error.requestId,
      durationMs: error.durationMs,
      timeoutMs: error.timeoutMs,
      providerModel: error.providerModel || runtime.model,
    }
  }

  if (error instanceof Error) {
    return {
      ...base,
      errorType: classifyPlannerError(error),
    }
  }

  return {
    ...base,
    errorType: "unknown",
  }
}

export async function runPlannerDecision(
  payload: unknown
): Promise<PlannerDecisionResultOutput> {
  const parsed = plannerDecisionRequestSchema.parse(payload)
  const dayPolicy = normalizeRequestedDays(parsed)
  const parsedWithDays: PlannerDecisionRequestInput = {
    ...parsed,
    totalDays: dayPolicy.normalizedDays,
    structuredPreferences: {
      ...parsed.structuredPreferences,
      days: dayPolicy.normalizedDays,
    },
  }
  const baseDiagnostics: PlannerDiagnostics = {
    requestedDays: dayPolicy.requestedDays,
    normalizedDays: dayPolicy.normalizedDays,
  }
  const weatherSummary = await getWeatherByCity(parsedWithDays.city || parsedWithDays.destination)
  const parsedWithWeather: PlannerDecisionRequestInput = {
    ...parsedWithDays,
    weatherContext: buildWeatherPlanContext(weatherSummary, parsedWithDays.totalDays, parsedWithDays.startDate),
  }

  if (!isBeijingInput(parsedWithWeather)) {
    const policy = buildPreferencePolicyFromRequest(parsedWithWeather)
    return buildFallbackDecision(
      withPolicyNormalizedFields(parsedWithWeather, policy),
      ["第四阶段当前仅支持北京，已降级为规则方案。"],
      policy,
      baseDiagnostics
    )
  }

  const beijingOnlyInput: PlannerDecisionRequestInput = {
    ...parsedWithWeather,
    city: "北京",
    province: "北京",
    attractions: filterBeijingPlannerCandidates(parsedWithWeather.attractions),
    restaurants: filterBeijingPlannerCandidates(parsedWithWeather.restaurants),
    hotels: filterBeijingPlannerCandidates(parsedWithWeather.hotels),
  }

  const policy = buildPreferencePolicyFromRequest(beijingOnlyInput)
  const policyInput = withBeijingCandidateBackfill(
    withPolicyNormalizedFields(beijingOnlyInput, policy),
    policy
  )
  const prepared = applyHardRules(policyInput, policy)
  if (weatherSummary.source === "fallback") {
    prepared.warnings.unshift("天气数据暂不可用，本方案按常规出行条件生成。")
  } else {
    prepared.warnings.unshift(`已接入${weatherSummary.city}天气：${weatherSummary.travelAdvice.summary}`)
  }

  if (prepared.input.attractions.length === 0) {
    return buildFallbackDecision(
      prepared.input,
      [...prepared.warnings, "可用景点候选不足，已使用规则兜底。"],
      policy,
      baseDiagnostics
    )
  }

  if (!hasDeepSeekApiKey()) {
    const runtime = getDeepSeekRuntimeConfig()
    return buildFallbackDecision(
      prepared.input,
      [...prepared.warnings, "未配置智能规划密钥，已使用基础规划方案。"],
      policy,
      {
        ...baseDiagnostics,
        deepseekError: {
          hasApiKey: false,
          baseUrl: runtime.baseUrl,
          model: runtime.model,
          providerModel: runtime.model,
          errorType: "env_missing",
        },
      }
    )
  }

  try {
    const deepseek = await generatePlanByDeepSeek(prepared.input)
    const result: PlannerDecisionResultOutput = {
      source: "deepseek",
      plan: deepseek.plan,
      warnings: [...prepared.warnings, ...deepseek.warnings],
      preferenceTrace: withPreferenceTrace(policy, deepseek.repairApplied),
      diagnostics: withPlannerDiagnostics(
        prepared.input,
        policy,
        deepseek.plan,
        deepseek.repairApplied,
        {
          ...baseDiagnostics,
          ...deepseek.diagnostics,
        }
      ),
    }
    return plannerDecisionResultSchema.parse(result)
  } catch (error) {
    const deepseekError = getSafeDeepSeekErrorDetails(error)
    console.warn("[planner] DeepSeek fallback", deepseekError)
    return buildFallbackDecision(prepared.input, [
      ...prepared.warnings,
      "智能规划暂时不可用，已为你生成基础北京行程。",
    ], policy, {
      ...baseDiagnostics,
      deepseekError,
      repairApplied: true,
      repairReason: "deepseek_error_fallback",
    })
  }
}
