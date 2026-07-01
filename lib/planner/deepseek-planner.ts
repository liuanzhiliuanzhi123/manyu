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
import type {
  GeneratedPlan,
  GeneratedPlanDay,
  GeneratedPlanSuggestion,
  PlannerCandidate,
} from "@/lib/planner-types"

interface LlmPlannerResult {
  plan: GeneratedPlan
  warnings: string[]
}

type DeepSeekPlanItem = DeepSeekGeneratedPlan["daysPlan"][number]["items"][number]
type CandidateType = "attraction" | "restaurant" | "hotel"

interface CandidateLookup {
  byId: Record<CandidateType, Map<string, PlannerCandidate>>
  byName: Record<CandidateType, Map<string, PlannerCandidate>>
}

function getPaceMaxPerDay(pace: PlannerDecisionRequestInput["pace"]) {
  if (pace === "fast") return 6
  if (pace === "slow") return 3
  return 4
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
  input: PlannerDecisionRequestInput
): { plan: GeneratedPlan; warnings: string[] } {
  const lookup = buildLookup(input)
  const warnings: string[] = []
  const usedSpotIds = new Set<string>()
  const maxPerDay = getPaceMaxPerDay(input.pace)

  const dayMap = new Map(rawPlan.daysPlan.map((day) => [day.dayIndex, day]))
  const days: GeneratedPlanDay[] = Array.from({ length: input.totalDays }, (_, index) => {
    const dayNumber = index + 1
    const sourceDay = dayMap.get(dayNumber)
    if (!sourceDay) {
      throw new Error(`DeepSeek output missing day ${dayNumber}.`)
    }

    const scenicItems = sourceDay.items.filter((item) => item.type === "scenic")
    const seen = new Set<string>()
    const scenicPairs = scenicItems
      .map((item) => ({ item, candidate: findCandidate(item, "attraction", lookup) }))
      .filter((pair): pair is { item: DeepSeekPlanItem; candidate: PlannerCandidate } => {
        if (!pair.candidate) {
          warnings.push(`已过滤未知或非北京景点：${normalizeText(pair.item.name) || "未命名地点"}`)
          return false
        }
        if (seen.has(pair.candidate.placeId)) return false
        seen.add(pair.candidate.placeId)
        return true
      })

    if (scenicPairs.length > maxPerDay) {
      warnings.push(`第 ${dayNumber} 天超过节奏限制，已截断到 ${maxPerDay} 个景点。`)
    }

    const selectedScenicPairs = scenicPairs.slice(0, maxPerDay)
    selectedScenicPairs.forEach((pair) => usedSpotIds.add(pair.candidate.placeId))

    const foodItems = sourceDay.items.filter((item) => item.type === "food")
    const hotelItem = sourceDay.items.find((item) => item.type === "hotel")
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
      theme: normalizeText(sourceDay.title) || `第${dayNumber}天`,
      districtSummary: districtSummary || undefined,
      weather: dayWeather,
      weatherAdvice:
        normalizeText(sourceDay.weather?.advice) ||
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
      dayBudget: getDayBudget(sourceDay.items),
      warnings: dayWarnings.length > 0 ? dayWarnings : undefined,
    }
  })

  if (days.some((day) => day.spots.length === 0)) {
    throw new Error("DeepSeek output did not include valid Beijing attractions for every day.")
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
  }
}

function sanitizePlanAgainstCandidates(
  plan: GeneratedPlan,
  input: PlannerDecisionRequestInput
): { plan: GeneratedPlan; warnings: string[] } {
  const warnings: string[] = []

  const attractionIdSet = new Set(input.attractions.map((item) => item.placeId))
  const restaurantIdSet = new Set(input.restaurants.map((item) => item.placeId))
  const hotelIdSet = new Set(input.hotels.map((item) => item.placeId))

  const maxPerDay = getPaceMaxPerDay(input.pace)
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

export async function generatePlanByDeepSeek(
  input: PlannerDecisionRequestInput
): Promise<LlmPlannerResult> {
  const systemPrompt = buildPlannerSystemPrompt()
  const userPrompt = buildPlannerUserPrompt(input)

  const firstResponse = await requestDeepSeekJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    maxTokens: 3000,
    timeoutMs: 30_000,
  })

  try {
    const parsed = parseDeepSeekPlanJson(firstResponse.text)
    const mapped = mapDeepSeekPlanToGeneratedPlan(parsed, input)
    const sanitized = sanitizePlanAgainstCandidates(mapped.plan, input)
    return {
      plan: sanitized.plan,
      warnings: [...mapped.warnings, ...sanitized.warnings],
    }
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
      maxTokens: 3000,
      timeoutMs: 30_000,
    })

    const repairedParsed = parseDeepSeekPlanJson(repairedResponse.text)
    const mapped = mapDeepSeekPlanToGeneratedPlan(repairedParsed, input)
    const sanitized = sanitizePlanAgainstCandidates(mapped.plan, input)

    return {
      plan: sanitized.plan,
      warnings: ["模型输出已修复一次后通过校验。", ...mapped.warnings, ...sanitized.warnings],
    }
  }
}
