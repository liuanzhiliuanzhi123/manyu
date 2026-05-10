import "server-only"

import type { ZodError } from "zod"
import { requestQwenJson } from "@/lib/aliyun-qwen-client"
import {
  generatedPlanSchema,
  type PlannerDecisionRequestInput,
} from "@/lib/planner-json-schema"
import {
  buildPlannerRepairPrompt,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
} from "@/lib/planner-prompts"
import type { GeneratedPlan } from "@/lib/planner-types"

interface LlmPlannerResult {
  plan: GeneratedPlan
  warnings: string[]
  modelOutput: string
}

function getPaceMaxPerDay(pace: PlannerDecisionRequestInput["pace"]) {
  if (pace === "fast") return 6
  if (pace === "slow") return 3
  return 4
}

function extractJsonObject(raw: string) {
  const text = raw.trim()
  if (!text) return ""

  if (text.startsWith("{") && text.endsWith("}")) {
    return text
  }

  const first = text.indexOf("{")
  if (first < 0) return ""

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = first; i < text.length; i += 1) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === "\\") {
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === "{") depth += 1
    if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        return text.slice(first, i + 1)
      }
    }
  }

  return ""
}

function parseGeneratedPlan(raw: string) {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) {
    throw new Error("LLM did not return valid JSON object text")
  }

  let payload: unknown
  try {
    payload = JSON.parse(jsonText)
  } catch {
    throw new Error("LLM JSON parse failed")
  }

  return generatedPlanSchema.parse(payload)
}

function zodIssueToText(error: ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
}

function sanitizePlanAgainstCandidates(
  plan: GeneratedPlan,
  input: PlannerDecisionRequestInput
): { plan: GeneratedPlan; warnings: string[] } {
  const warnings: string[] = []

  const attractionIdSet = new Set(input.attractions.map((item) => item.placeId))
  const restaurantIdSet = new Set(input.restaurants.map((item) => item.placeId))
  const hotelIdSet = new Set(input.hotels.map((item) => item.placeId))

  const dayMap = new Map(plan.days.map((day) => [day.day, day]))
  const maxPerDay = getPaceMaxPerDay(input.pace)

  const days = Array.from({ length: input.totalDays }, (_, index) => {
    const dayNumber = index + 1
    const sourceDay = dayMap.get(dayNumber)

    if (!sourceDay) {
      warnings.push(`LLM output missing day ${dayNumber}, fallback-filled with empty day.`)
      return {
        day: dayNumber,
        theme: `第${dayNumber}天`,
        districtSummary: undefined,
        startTime: undefined,
        endTime: undefined,
        spots: [],
        lunch: undefined,
        dinner: undefined,
        hotel: undefined,
        routeLegIds: [],
        dayBudget: undefined,
        warnings: ["候选不足，需手动补充景点"],
      }
    }

    const seenSpotIds = new Set<string>()
    const spots = sourceDay.spots
      .filter((item) => {
        if (!attractionIdSet.has(item.placeId)) {
          warnings.push(`Removed unknown attraction placeId: ${item.placeId}`)
          return false
        }
        if (seenSpotIds.has(item.placeId)) return false
        seenSpotIds.add(item.placeId)
        return true
      })
      .slice(0, maxPerDay)

    if (sourceDay.spots.length > maxPerDay) {
      warnings.push(`Day ${dayNumber} exceeded pace limit and was truncated to ${maxPerDay} spots`)
    }

    const lunch = sourceDay.lunch?.placeId
      ? restaurantIdSet.has(sourceDay.lunch.placeId)
        ? sourceDay.lunch
        : (warnings.push(`Removed unknown lunch placeId: ${sourceDay.lunch.placeId}`), undefined)
      : sourceDay.lunch

    const dinner = sourceDay.dinner?.placeId
      ? restaurantIdSet.has(sourceDay.dinner.placeId)
        ? sourceDay.dinner
        : (warnings.push(`Removed unknown dinner placeId: ${sourceDay.dinner.placeId}`), undefined)
      : sourceDay.dinner

    const hotel = sourceDay.hotel?.placeId
      ? hotelIdSet.has(sourceDay.hotel.placeId)
        ? sourceDay.hotel
        : (warnings.push(`Removed unknown hotel placeId: ${sourceDay.hotel.placeId}`), undefined)
      : sourceDay.hotel
    const dayWeather = sourceDay.weather || input.weatherContext?.dayWeather[dayNumber - 1]

    return {
      ...sourceDay,
      day: dayNumber,
      weather: dayWeather,
      weatherAdvice: sourceDay.weatherAdvice || dayWeather?.advice,
      weatherTags: sourceDay.weatherTags || dayWeather?.tags,
      spots,
      lunch,
      dinner,
      hotel,
    }
  })

  const droppedPlaceIds = (plan.droppedPlaceIds || []).filter((id) => attractionIdSet.has(id))

  return {
    plan: {
      ...plan,
      destination: input.destination,
      totalDays: input.totalDays,
      weatherSummary: plan.weatherSummary || input.weatherContext?.summary,
      days,
      droppedPlaceIds,
    },
    warnings,
  }
}

export async function generatePlanByQwen(input: PlannerDecisionRequestInput): Promise<LlmPlannerResult> {
  const systemPrompt = buildPlannerSystemPrompt()
  const userPrompt = buildPlannerUserPrompt(input)

  const firstResponse = await requestQwenJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.15,
    maxTokens: 2200,
  })

  try {
    const parsed = parseGeneratedPlan(firstResponse.text)
    const sanitized = sanitizePlanAgainstCandidates(parsed, input)
    return {
      plan: sanitized.plan,
      warnings: sanitized.warnings,
      modelOutput: firstResponse.text,
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    const validationIssues: string[] = []
    if ((error as Error).name === "ZodError") {
      const zodError = error as ZodError
      validationIssues.push(...zodIssueToText(zodError))
    } else {
      validationIssues.push(error.message)
    }

    const repairPrompt = buildPlannerRepairPrompt(firstResponse.text, validationIssues)

    const repairedResponse = await requestQwenJson({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n${repairPrompt}` },
      ],
      temperature: 0.15,
      maxTokens: 2200,
    })

    const repairedParsed = parseGeneratedPlan(repairedResponse.text)
    const sanitized = sanitizePlanAgainstCandidates(repairedParsed, input)
    sanitized.warnings.unshift("LLM output was repaired once before accepted")

    return {
      plan: sanitized.plan,
      warnings: sanitized.warnings,
      modelOutput: repairedResponse.text,
    }
  }
}
