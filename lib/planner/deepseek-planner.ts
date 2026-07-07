import "server-only"

import type { ZodError } from "zod"
import { requestDeepSeekJson } from "@/lib/planner/deepseek-client"
import type { DeepSeekGeneratedPlan } from "@/lib/planner/plan-schema"
import { parseDeepSeekPlanJson } from "@/lib/planner/plan-validator"
import { generatedPlanSchema, type PlannerDecisionRequestInput } from "@/lib/planner-json-schema"
import {
  buildPlannerRepairPrompt,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
} from "@/lib/planner-prompts"
import { buildPreferencePolicyFromRequest, type PreferencePolicy } from "@/lib/planner/preference-policy"
import {
  repairGeneratedPlanWithPolicy,
  validateGeneratedPlanAgainstPolicy,
} from "@/lib/planner/plan-repair"
import {
  getRootCategoryFromPlannerItem,
  isMainActivityItem,
  normalizePlannerItemType,
} from "@/lib/planner/main-activity"
import {
  assertDaysPlanMatchesRequest,
  buildMissingDayIndexes,
} from "@/lib/planner/days-policy"
import type {
  GeneratedPlan,
  GeneratedPlanDay,
  GeneratedPlanSuggestion,
  PlannerDayCountDiagnostic,
  PlannerDiagnostics,
  PlannerDroppedItemReasons,
  PlannerCandidate,
} from "@/lib/planner-types"

interface LlmPlannerResult {
  plan: GeneratedPlan
  warnings: string[]
  repairApplied: boolean
  diagnostics: PlannerDiagnostics
}

type DeepSeekPlanItem = DeepSeekGeneratedPlan["daysPlan"][number]["items"][number]
type CandidateType = "attraction" | "restaurant" | "hotel"

interface CandidateLookup {
  byId: Record<CandidateType, Map<string, PlannerCandidate>>
  byName: Record<CandidateType, Map<string, PlannerCandidate>>
}

function normalizeText(input?: string) {
  return (input || "").trim().replace(/\s+/g, " ")
}

function normalizedName(input?: string) {
  return normalizeText(input).toLocaleLowerCase("zh-CN")
}

function zodIssueToText(error: ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
}

function createDroppedItemReasons(): PlannerDroppedItemReasons {
  return {
    missingIdentity: 0,
    invalidType: 0,
    unmatchedCandidate: 0,
    duplicate: 0,
    nonMain: 0,
  }
}

function mergeDroppedItemReasons(
  a: PlannerDroppedItemReasons | undefined,
  b: PlannerDroppedItemReasons | undefined
): PlannerDroppedItemReasons {
  return {
    missingIdentity: (a?.missingIdentity || 0) + (b?.missingIdentity || 0),
    invalidType: (a?.invalidType || 0) + (b?.invalidType || 0),
    unmatchedCandidate: (a?.unmatchedCandidate || 0) + (b?.unmatchedCandidate || 0),
    duplicate: (a?.duplicate || 0) + (b?.duplicate || 0),
    nonMain: (a?.nonMain || 0) + (b?.nonMain || 0),
  }
}

function countRawModelDay(
  day: DeepSeekGeneratedPlan["daysPlan"][number]
): PlannerDayCountDiagnostic {
  const counts: PlannerDayCountDiagnostic = {
    day: day.dayIndex,
    dayIndex: day.dayIndex,
    items: day.items.length,
    totalItems: day.items.length,
    mainActivities: 0,
    food: 0,
    foodItems: 0,
    hotel: 0,
    hotelItems: 0,
    transit: 0,
    rest: 0,
    note: 0,
    unknown: 0,
  }

  day.items.forEach((item) => {
    const rootCategory = getRootCategoryFromPlannerItem(item)
    const normalizedType = normalizePlannerItemType(item)
    if (rootCategory === "scenic") counts.mainActivities += 1
    else if (rootCategory === "food") {
      counts.food += 1
      counts.foodItems = (counts.foodItems || 0) + 1
    } else if (rootCategory === "hotel") {
      counts.hotel += 1
      counts.hotelItems = (counts.hotelItems || 0) + 1
    } else if (normalizedType === "transit" || normalizedType === "transport") counts.transit += 1
    else if (normalizedType === "rest") counts.rest += 1
    else if (normalizedType === "note" || normalizedType === "weather") counts.note += 1
    else counts.unknown += 1
  })

  return counts
}

function countGeneratedPlanDay(day: GeneratedPlanDay): PlannerDayCountDiagnostic {
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

function countGeneratedPlanDays(plan: GeneratedPlan): PlannerDayCountDiagnostic[] {
  return plan.days.map(countGeneratedPlanDay)
}

function buildLookup(input: PlannerDecisionRequestInput): CandidateLookup {
  const createMaps = (candidates: PlannerCandidate[]) => {
    const byId = new Map<string, PlannerCandidate>()
    const byName = new Map<string, PlannerCandidate>()
    candidates.forEach((candidate) => {
      byId.set(candidate.placeId, candidate)
      byName.set(normalizedName(candidate.name), candidate)
    })
    return { byId, byName }
  }

  const attractions = createMaps(input.attractions)
  const restaurants = createMaps(input.restaurants)
  const hotels = createMaps(input.hotels)

  return {
    byId: {
      attraction: attractions.byId,
      restaurant: restaurants.byId,
      hotel: hotels.byId,
    },
    byName: {
      attraction: attractions.byName,
      restaurant: restaurants.byName,
      hotel: hotels.byName,
    },
  }
}

function findCandidate(
  item: DeepSeekPlanItem,
  type: CandidateType,
  lookup: CandidateLookup
) {
  const placeId = normalizeText(item.placeId)
  if (placeId) {
    const byId = lookup.byId[type].get(placeId)
    if (byId) return byId
  }

  const name = normalizedName(item.name)
  if (!name) return undefined
  return lookup.byName[type].get(name)
}

function toSuggestion(
  item: DeepSeekPlanItem | undefined,
  type: "restaurant" | "hotel",
  lookup: CandidateLookup
): GeneratedPlanSuggestion | undefined {
  if (!item) return undefined
  const candidate = findCandidate(item, type, lookup)
  if (!candidate) return undefined
  return {
    placeId: candidate.placeId,
    area: candidate.district || candidate.city,
    reason: normalizeText(item.reason) || undefined,
  }
}

function getDistrictSummary(candidates: Array<PlannerCandidate | undefined>) {
  return Array.from(
    new Set(candidates.map((candidate) => normalizeText(candidate?.district)).filter(Boolean))
  )
    .slice(0, 2)
    .join(" / ")
}

function getDayBudget(items: DeepSeekPlanItem[]) {
  const total = items.reduce((sum, item) => {
    if (!Number.isFinite(item.estimatedCost)) return sum
    return sum + (item.estimatedCost as number)
  }, 0)
  return total > 0 ? total : undefined
}

function mapDeepSeekPlanToGeneratedPlan(
  rawPlan: DeepSeekGeneratedPlan,
  input: PlannerDecisionRequestInput,
  policy: PreferencePolicy
): { plan: GeneratedPlan; warnings: string[]; diagnostics: PlannerDiagnostics } {
  const lookup = buildLookup(input)
  const warnings: string[] = []
  const droppedItemReasons = createDroppedItemReasons()
  const usedSpotIds = new Set<string>()
  const maxPerDay = policy.hardConstraints.maxMainActivitiesPerDay
  const rawModelDayCounts = rawPlan.daysPlan.map(countRawModelDay)
  const missingDaysRepaired = buildMissingDayIndexes({ daysPlan: rawPlan.daysPlan }, input.totalDays)

  const dayMap = new Map(rawPlan.daysPlan.map((day) => [day.dayIndex, day]))
  const days: GeneratedPlanDay[] = Array.from({ length: input.totalDays }, (_, index) => {
    const dayNumber = index + 1
    const sourceDay = dayMap.get(dayNumber)
    if (!sourceDay) {
      warnings.push(`模型未返回第 ${dayNumber} 天，已交由偏好补齐器处理。`)
    }

    const sourceItems = sourceDay?.items || []
    sourceItems.forEach((item) => {
      const rootCategory = getRootCategoryFromPlannerItem(item)
      const normalizedType = normalizePlannerItemType(item)
      if (!normalizeText(item.placeId) && !normalizeText(item.name)) {
        droppedItemReasons.missingIdentity += 1
      }
      if (!rootCategory && normalizedType === "unknown") {
        droppedItemReasons.invalidType += 1
      }
      if (rootCategory !== "scenic") {
        droppedItemReasons.nonMain += 1
      }
    })

    const scenicItems = sourceItems.filter((item) => isMainActivityItem(item))
    const seen = new Set<string>()
    const scenicPairs = scenicItems
      .map((item) => ({ item, candidate: findCandidate(item, "attraction", lookup) }))
      .filter((pair): pair is { item: DeepSeekPlanItem; candidate: PlannerCandidate } => {
        if (!pair.candidate) {
          droppedItemReasons.unmatchedCandidate += 1
          warnings.push(`已过滤未知或非北京景点：${normalizeText(pair.item.name) || "未命名地点"}`)
          return false
        }
        if (seen.has(pair.candidate.placeId)) {
          droppedItemReasons.duplicate += 1
          return false
        }
        seen.add(pair.candidate.placeId)
        return true
      })

    if (scenicPairs.length > maxPerDay) {
      warnings.push(`第 ${dayNumber} 天超过节奏限制，已截断到 ${maxPerDay} 个景点。`)
    }

    const selectedScenicPairs = scenicPairs.slice(0, maxPerDay)
    selectedScenicPairs.forEach((pair) => usedSpotIds.add(pair.candidate.placeId))

    const foodItems = sourceItems.filter(
      (item) => getRootCategoryFromPlannerItem(item) === "food"
    )
    const hotelItem = sourceItems.find(
      (item) => getRootCategoryFromPlannerItem(item) === "hotel"
    )
    const lunch = toSuggestion(foodItems[0], "restaurant", lookup)
    const dinner = toSuggestion(foodItems[1] || foodItems[0], "restaurant", lookup)
    const hotel = toSuggestion(hotelItem, "hotel", lookup)
    const dayWeather = input.weatherContext?.dayWeather[index]
    const districtSummary = getDistrictSummary([
      ...selectedScenicPairs.map((pair) => pair.candidate),
      lunch?.placeId ? lookup.byId.restaurant.get(lunch.placeId) : undefined,
      dinner?.placeId ? lookup.byId.restaurant.get(dinner.placeId) : undefined,
      hotel?.placeId ? lookup.byId.hotel.get(hotel.placeId) : undefined,
    ])

    const dayWarnings: string[] = []
    if (selectedScenicPairs.length === 0) {
      dayWarnings.push("模型未返回有效北京景点，已触发兜底检查。")
    }

    return {
      day: dayNumber,
      theme: normalizeText(sourceDay?.title) || `第${dayNumber}天`,
      districtSummary: districtSummary || undefined,
      weather: dayWeather,
      weatherAdvice:
        normalizeText(sourceDay?.weather?.advice) ||
        dayWeather?.advice ||
        normalizeText(rawPlan.weatherAdvice?.summary) ||
        undefined,
      weatherTags: rawPlan.weatherAdvice?.tags,
      spots: selectedScenicPairs.map(({ item, candidate }) => ({
        placeId: candidate.placeId,
        arrivalTime: normalizeText(item.startTime) || undefined,
        departureTime: normalizeText(item.endTime) || undefined,
        stayMinutes: item.durationMinutes || candidate.stayMinutes,
        reason: normalizeText(item.reason) || undefined,
      })),
      lunch,
      dinner,
      hotel,
      dayBudget: getDayBudget(sourceItems),
      warnings: dayWarnings.length > 0 ? dayWarnings : undefined,
    }
  })

  if (days.some((day) => day.spots.length === 0)) {
    warnings.push("模型部分日期未返回有效北京景点，已交由偏好补齐器处理。")
  }

  const droppedPlaceIds = input.attractions
    .map((candidate) => candidate.placeId)
    .filter((placeId) => !usedSpotIds.has(placeId))

  const explanations = [
    normalizeText(rawPlan.summary),
    normalizeText(rawPlan.budgetEstimate.notes),
    normalizeText(rawPlan.weatherAdvice?.summary),
    ...(rawPlan.weatherAdvice?.suggestions || []).map((item) => normalizeText(item)),
  ].filter(Boolean)

  const generated = generatedPlanSchema.parse({
    destination: normalizeText(rawPlan.title) || input.destination,
    totalDays: input.totalDays,
    totalBudget: rawPlan.budgetEstimate.total,
    weatherSummary: input.weatherContext?.summary,
    days,
    droppedPlaceIds,
    explanations,
  })

  return {
    plan: generated,
    warnings,
    diagnostics: {
      rawModelDayCounts,
      modelReturnedDays: rawPlan.daysPlan.length,
      normalizedDayCounts: countGeneratedPlanDays(generated),
      droppedItemReasons,
      missingDaysRepaired,
      dayRepairApplied: missingDaysRepaired.length > 0,
    },
  }
}

function sanitizePlanAgainstCandidates(
  plan: GeneratedPlan,
  input: PlannerDecisionRequestInput,
  policy: PreferencePolicy
): { plan: GeneratedPlan; warnings: string[] } {
  const warnings: string[] = []

  const attractionIdSet = new Set(input.attractions.map((item) => item.placeId))
  const restaurantIdSet = new Set(input.restaurants.map((item) => item.placeId))
  const hotelIdSet = new Set(input.hotels.map((item) => item.placeId))

  const maxPerDay = policy.hardConstraints.maxMainActivitiesPerDay
  const days = plan.days.map((sourceDay) => {
    const seenSpotIds = new Set<string>()
    const spots = sourceDay.spots
      .filter((item) => {
        if (!attractionIdSet.has(item.placeId)) {
          warnings.push(`已过滤未知景点 placeId：${item.placeId}`)
          return false
        }
        if (seenSpotIds.has(item.placeId)) return false
        seenSpotIds.add(item.placeId)
        return true
      })
      .slice(0, maxPerDay)

    const lunch = sourceDay.lunch?.placeId
      ? restaurantIdSet.has(sourceDay.lunch.placeId)
        ? sourceDay.lunch
        : undefined
      : sourceDay.lunch
    const dinner = sourceDay.dinner?.placeId
      ? restaurantIdSet.has(sourceDay.dinner.placeId)
        ? sourceDay.dinner
        : undefined
      : sourceDay.dinner
    const hotel = sourceDay.hotel?.placeId
      ? hotelIdSet.has(sourceDay.hotel.placeId)
        ? sourceDay.hotel
        : undefined
      : sourceDay.hotel

    return {
      ...sourceDay,
      spots,
      lunch,
      dinner,
      hotel,
    }
  })

  return {
    plan: {
      ...plan,
      destination: input.destination,
      totalDays: input.totalDays,
      weatherSummary: plan.weatherSummary || input.weatherContext?.summary,
      days,
      droppedPlaceIds: (plan.droppedPlaceIds || []).filter((id) => attractionIdSet.has(id)),
    },
    warnings,
  }
}

function finalizePlanAgainstPolicy(
  plan: GeneratedPlan,
  input: PlannerDecisionRequestInput,
  policy: PreferencePolicy,
  warnings: string[],
  repairApplied: boolean,
  diagnostics: PlannerDiagnostics
): LlmPlannerResult {
  const sanitized = sanitizePlanAgainstCandidates(plan, input, policy)
  const repaired = repairGeneratedPlanWithPolicy(sanitized.plan, input, policy)
  assertDaysPlanMatchesRequest(repaired.plan, input.totalDays)
  const issues = validateGeneratedPlanAgainstPolicy(repaired.plan, input, policy)
  const blockingIssues = issues.filter((issue) => issue.level === "error")

  if (blockingIssues.length > 0) {
    throw new Error(
      `Preference policy validation failed: ${blockingIssues
        .map((issue) => issue.message)
        .join("；")}`
    )
  }

  const finalRepairApplied = repairApplied || repaired.repairApplied
  const repairReason = finalRepairApplied
    ? Array.from(new Set(repaired.warnings)).slice(0, 8).join(" | ") || "policy_repair"
    : diagnostics.repairReason

  return {
    plan: repaired.plan,
    warnings: [
      ...warnings,
      ...sanitized.warnings,
      ...repaired.warnings,
      ...issues.filter((issue) => issue.level === "warning").map((issue) => issue.message),
    ],
    repairApplied: finalRepairApplied,
    diagnostics: {
      ...diagnostics,
      droppedItemReasons: mergeDroppedItemReasons(
        diagnostics.droppedItemReasons,
        createDroppedItemReasons()
      ),
      finalDayCounts: countGeneratedPlanDays(repaired.plan),
      repairApplied: finalRepairApplied,
      repairReason,
      finalDays: repaired.plan.days.length,
      missingDaysRepaired:
        repaired.missingDaysRepaired.length > 0
          ? repaired.missingDaysRepaired
          : diagnostics.missingDaysRepaired,
      dayRepairApplied:
        repaired.missingDaysRepaired.length > 0 ||
        diagnostics.dayRepairApplied ||
        finalRepairApplied,
    },
  }
}

export async function generatePlanByDeepSeek(
  input: PlannerDecisionRequestInput
): Promise<LlmPlannerResult> {
  const policy = buildPreferencePolicyFromRequest(input)
  const systemPrompt = buildPlannerSystemPrompt()
  const userPrompt = buildPlannerUserPrompt(input)

  const firstResponse = await requestDeepSeekJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    maxTokens: 4200,
    timeoutMs: 60_000,
  })

  try {
    const parsed = parseDeepSeekPlanJson(firstResponse.text)
    const mapped = mapDeepSeekPlanToGeneratedPlan(parsed, input, policy)
    return finalizePlanAgainstPolicy(
      mapped.plan,
      input,
      policy,
      mapped.warnings,
      false,
      mapped.diagnostics
    )
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    const validationIssues: string[] = []
    if (error.name === "ZodError") {
      validationIssues.push(...zodIssueToText(error as ZodError))
    } else {
      validationIssues.push(error.message)
    }

    const repairPrompt = buildPlannerRepairPrompt(firstResponse.text, validationIssues)
    const repairedResponse = await requestDeepSeekJson({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n${repairPrompt}` },
      ],
      temperature: 0.2,
      maxTokens: 4200,
      timeoutMs: 60_000,
    })

    const repairedParsed = parseDeepSeekPlanJson(repairedResponse.text)
    const mapped = mapDeepSeekPlanToGeneratedPlan(repairedParsed, input, policy)
    return finalizePlanAgainstPolicy(
      mapped.plan,
      input,
      policy,
      ["模型输出已修复一次后通过校验。", ...mapped.warnings],
      true,
      {
        ...mapped.diagnostics,
        repairApplied: true,
        repairReason: "model_json_repair",
      }
    )
  }
}
