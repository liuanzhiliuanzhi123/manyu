import "server-only"

import { hasDashscopeApiKey } from "@/lib/aliyun-qwen-client"
import { generatePlanByQwen } from "@/lib/llm-planner"
import { buildFallbackGeneratedPlan } from "@/lib/planner-fallback"
import { buildWeatherPlanContext, getWeatherByCity } from "@/lib/weather-service"
import {
  plannerDecisionRequestSchema,
  plannerDecisionResultSchema,
  type PlannerDecisionRequestInput,
  type PlannerDecisionResultOutput,
} from "@/lib/planner-json-schema"

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

function paceSpotLimit(pace: PlannerDecisionRequestInput["pace"]) {
  if (pace === "fast") return 6
  if (pace === "slow") return 3
  return 4
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
  preferredSet: Set<string>
) {
  let score = 0
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

function applyHardRules(input: PlannerDecisionRequestInput) {
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

  const maxAttractions = Math.max(input.totalDays * paceSpotLimit(input.pace), input.totalDays * 2)
  const rankedAttractions = [...budgetFilteredAttractions]
    .sort((a, b) => scoreAttraction(b, input, preferredSet) - scoreAttraction(a, input, preferredSet))
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

  const routeFilteredAttractions = rankedAttractions.filter((item) => {
    if (manualKept.includes(item.placeId)) return true
    if (routeFeasibleSet.size === 0) return true
    return routeFeasibleSet.has(item.placeId)
  })

  if (routeFilteredAttractions.length < rankedAttractions.length) {
    warnings.push("已剔除部分公交可达性极差的景点候选。")
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

  if (filteredRestaurants.length === 0) {
    warnings.push("餐饮候选不足，后续将使用基础规则兜底。")
  }
  if (filteredHotels.length === 0) {
    warnings.push("酒店候选不足，后续将使用基础规则兜底。")
  }

  if (input.pace === "fast" && input.specialNeeds.includes("少走路")) {
    warnings.push("你选择了特种兵式和少走路，系统会自动平衡日程密度。")
  }
  if (
    input.specialNeeds.includes("低预算优先") &&
    input.specialNeeds.includes("酒店舒适优先")
  ) {
    warnings.push("你选择了低预算优先和酒店舒适优先，系统会做折中优化。")
  }

  return {
    input: {
      ...input,
      attractions: routeFilteredAttractions,
      restaurants: filteredRestaurants,
      hotels: filteredHotels,
      manualPreferredPlaceIds: manualKept,
    },
    warnings,
  }
}

function buildFallbackDecision(input: PlannerDecisionRequestInput, warnings: string[]) {
  const fallback = buildFallbackGeneratedPlan(input)
  const result: PlannerDecisionResultOutput = {
    source: "fallback",
    plan: fallback.plan,
    warnings: [...warnings, ...fallback.warnings],
  }
  return plannerDecisionResultSchema.parse(result)
}

export async function runPlannerDecision(
  payload: unknown
): Promise<PlannerDecisionResultOutput> {
  const parsed = plannerDecisionRequestSchema.parse(payload)
  const weatherSummary = await getWeatherByCity(parsed.city || parsed.destination)
  const parsedWithWeather: PlannerDecisionRequestInput = {
    ...parsed,
    weatherContext: buildWeatherPlanContext(weatherSummary, parsed.totalDays, parsed.startDate),
  }

  if (!isBeijingInput(parsedWithWeather)) {
    return buildFallbackDecision(parsedWithWeather, ["第三阶段当前仅支持北京，已降级为规则方案。"])
  }

  const prepared = applyHardRules(parsedWithWeather)
  if (weatherSummary.source === "fallback") {
    prepared.warnings.unshift("天气数据暂不可用，本方案按常规出行条件生成。")
  } else {
    prepared.warnings.unshift(`已接入${weatherSummary.city}天气：${weatherSummary.travelAdvice.summary}`)
  }

  if (prepared.input.attractions.length === 0) {
    return buildFallbackDecision(prepared.input, [...prepared.warnings, "可用景点候选不足，已使用规则兜底。"])
  }

  if (!hasDashscopeApiKey()) {
    return buildFallbackDecision(prepared.input, [...prepared.warnings, "未配置 DASHSCOPE_API_KEY，已使用基础规划方案。"])
  }

  try {
    const qwen = await generatePlanByQwen(prepared.input)
    const result: PlannerDecisionResultOutput = {
      source: "qwen",
      plan: qwen.plan,
      warnings: [...prepared.warnings, ...qwen.warnings],
    }
    return plannerDecisionResultSchema.parse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Qwen planner failed"
    return buildFallbackDecision(prepared.input, [
      ...prepared.warnings,
      `Qwen 规划异常，已降级为基础规划方案：${message}`,
    ])
  }
}
