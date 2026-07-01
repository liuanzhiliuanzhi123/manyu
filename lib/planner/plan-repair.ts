import { generatedPlanSchema } from "@/lib/planner-json-schema"
import type {
  GeneratedPlan,
  GeneratedPlanDay,
  GeneratedPlanSuggestion,
  GeneratedPlanSpot,
  PlannerCandidate,
  PlannerDecisionRequest,
} from "@/lib/planner-types"
import {
  getCandidatePolicyScore,
  hasMainActivityKeyword,
  type PreferencePolicy,
} from "@/lib/planner/preference-policy"

export interface PlanPolicyIssue {
  id: string
  level: "warning" | "error"
  message: string
  day?: number
}

export interface PlanRepairResult {
  plan: GeneratedPlan
  warnings: string[]
  issues: PlanPolicyIssue[]
  repairApplied: boolean
}

const REMOTE_DISTRICT_KEYWORDS = ["延庆", "怀柔", "密云", "平谷", "门头沟"]

function normalizeText(input?: string) {
  return (input || "").trim()
}

function isRemoteDistrict(district?: string) {
  const text = normalizeText(district)
  if (!text) return false
  return REMOTE_DISTRICT_KEYWORDS.some((keyword) => text.includes(keyword))
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
    if (a.district && b.district && normalizeText(a.district) === normalizeText(b.district)) {
      return 1500
    }
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

function candidateMaps(candidates: PlannerCandidate[]) {
  return new Map(candidates.map((candidate) => [candidate.placeId, candidate]))
}

function scoreCandidateForDay(
  candidate: PlannerCandidate,
  daySpots: GeneratedPlanSpot[],
  attractionMap: Map<string, PlannerCandidate>,
  request: PlannerDecisionRequest,
  policy: PreferencePolicy
) {
  let score = getCandidatePolicyScore(candidate, policy)
  if ((request.manualPreferredPlaceIds || []).includes(candidate.placeId)) score += 120
  if (Number.isFinite(candidate.rating)) score += (candidate.rating as number) * 10
  if (policy.normalizedPreferences.effectivePace === "intensive") score += 8

  const anchors = daySpots
    .map((spot) => attractionMap.get(spot.placeId))
    .filter((item): item is PlannerCandidate => Boolean(item))
  if (anchors.length > 0) {
    const sameDistrict = anchors.some(
      (anchor) => normalizeText(anchor.district) === normalizeText(candidate.district)
    )
    if (sameDistrict) score += 24
    const minDistance = anchors.reduce((min, anchor) => {
      const distance = distanceMeters(anchor, candidate)
      return distance < min ? distance : min
    }, Number.POSITIVE_INFINITY)
    if (Number.isFinite(minDistance)) {
      if (minDistance <= 3000) score += 18
      else if (minDistance <= 8000) score += 8
      else score -= 10
    }
  }

  if (
    policy.normalizedPreferences.specialNeeds.includes("lessWalking") &&
    isRemoteDistrict(candidate.district)
  ) {
    score -= 30
  }

  return score
}

function pickSupplementSpot(
  request: PlannerDecisionRequest,
  policy: PreferencePolicy,
  daySpots: GeneratedPlanSpot[],
  attractionMap: Map<string, PlannerCandidate>,
  usedSpotIds: Set<string>
) {
  return [...request.attractions]
    .filter((candidate) => candidate.type === "attraction" && !usedSpotIds.has(candidate.placeId))
    .sort(
      (a, b) =>
        scoreCandidateForDay(b, daySpots, attractionMap, request, policy) -
        scoreCandidateForDay(a, daySpots, attractionMap, request, policy)
    )[0]
}

function pickSuggestion(
  candidates: PlannerCandidate[],
  anchor: PlannerCandidate | undefined,
  policy: PreferencePolicy,
  excludePlaceId?: string
): GeneratedPlanSuggestion | undefined {
  const ranked = [...candidates]
    .filter((candidate) => candidate.placeId !== excludePlaceId)
    .sort((a, b) => {
      const distanceA = anchor ? distanceMeters(a, anchor) : Number.POSITIVE_INFINITY
      const distanceB = anchor ? distanceMeters(b, anchor) : Number.POSITIVE_INFINITY
      let scoreA = getCandidatePolicyScore(a, policy)
      let scoreB = getCandidatePolicyScore(b, policy)
      if (Number.isFinite(a.rating)) scoreA += (a.rating as number) * 8
      if (Number.isFinite(b.rating)) scoreB += (b.rating as number) * 8
      if (Number.isFinite(distanceA)) scoreA -= distanceA / 1000
      if (Number.isFinite(distanceB)) scoreB -= distanceB / 1000
      return scoreB - scoreA
    })

  const selected = ranked[0] || candidates[0]
  if (!selected) return undefined
  return {
    placeId: selected.placeId,
    area: selected.district || selected.city,
    reason: anchor
      ? "按偏好策略补齐，并优先贴近当天路线锚点。"
      : "按偏好策略从北京候选池补齐。",
  }
}

function mainActivityCount(day: GeneratedPlanDay, attractionMap: Map<string, PlannerCandidate>) {
  return day.spots.filter((spot) => {
    const candidate = attractionMap.get(spot.placeId)
    return candidate?.type === "attraction" || (candidate ? hasMainActivityKeyword(candidate) : false)
  }).length
}

export function validateGeneratedPlanAgainstPolicy(
  plan: GeneratedPlan,
  request: PlannerDecisionRequest,
  policy: PreferencePolicy
) {
  const issues: PlanPolicyIssue[] = []
  const attractionMap = candidateMaps(request.attractions)
  const restaurantMap = candidateMaps(request.restaurants)
  const hotelMap = candidateMaps(request.hotels)

  if (plan.totalDays !== request.totalDays || plan.days.length !== request.totalDays) {
    issues.push({
      id: "day_count_mismatch",
      level: "error",
      message: "行程天数与请求天数不一致。",
    })
  }

  for (const day of plan.days) {
    const validSpots = day.spots.filter((spot) => attractionMap.has(spot.placeId))
    if (validSpots.length !== day.spots.length) {
      issues.push({
        id: "invalid_place_id",
        level: "error",
        day: day.day,
        message: "存在不在北京候选池内的景点 placeId。",
      })
    }

    const mainCount = mainActivityCount({ ...day, spots: validSpots }, attractionMap)
    if (mainCount < policy.hardConstraints.minMainActivitiesPerDay) {
      issues.push({
        id: "insufficient_main_activities",
        level: "error",
        day: day.day,
        message: `第 ${day.day} 天主活动点不足，至少需要 ${policy.hardConstraints.minMainActivitiesPerDay} 个。`,
      })
    }

    if (validSpots.length > policy.hardConstraints.maxMainActivitiesPerDay) {
      issues.push({
        id: "too_many_main_activities",
        level: "warning",
        day: day.day,
        message: `第 ${day.day} 天点位超过当前节奏建议上限。`,
      })
    }

    if (policy.hardConstraints.requireLunchAndDinner) {
      if (!day.lunch?.placeId || !restaurantMap.has(day.lunch.placeId)) {
        issues.push({
          id: "missing_lunch",
          level: "error",
          day: day.day,
          message: "缺少有效午餐候选。",
        })
      }
      if (!day.dinner?.placeId || !restaurantMap.has(day.dinner.placeId)) {
        issues.push({
          id: "missing_dinner",
          level: "error",
          day: day.day,
          message: "缺少有效晚餐候选。",
        })
      }
    }

    if (policy.hardConstraints.requireHotelSuggestion) {
      if (!day.hotel?.placeId || !hotelMap.has(day.hotel.placeId)) {
        issues.push({
          id: "missing_hotel",
          level: "error",
          day: day.day,
          message: "缺少有效酒店候选。",
        })
      }
    }

    if (policy.normalizedPreferences.specialNeeds.includes("lessWalking")) {
      const districts = new Set(
        validSpots
          .map((spot) => normalizeText(attractionMap.get(spot.placeId)?.district))
          .filter(Boolean)
      )
      if (districts.size > 2) {
        issues.push({
          id: "too_many_districts",
          level: "warning",
          day: day.day,
          message: "少走路偏好下，当天跨区数量偏多。",
        })
      }
    }
  }

  return issues
}

export function repairGeneratedPlanWithPolicy(
  plan: GeneratedPlan,
  request: PlannerDecisionRequest,
  policy: PreferencePolicy
): PlanRepairResult {
  const warnings: string[] = []
  let repairApplied = false
  const attractionMap = candidateMaps(request.attractions)
  const restaurantCandidates = request.restaurants.filter((candidate) => candidate.type === "restaurant")
  const hotelCandidates = request.hotels.filter((candidate) => candidate.type === "hotel")
  const usedSpotIds = new Set<string>()

  const days = plan.days.map((sourceDay, index) => {
    const dayNumber = index + 1
    const seen = new Set<string>()
    let spots = sourceDay.spots.filter((spot) => {
      if (!attractionMap.has(spot.placeId)) {
        warnings.push(`第 ${dayNumber} 天已移除非北京候选景点：${spot.placeId}`)
        repairApplied = true
        return false
      }
      if (seen.has(spot.placeId)) {
        repairApplied = true
        return false
      }
      seen.add(spot.placeId)
      usedSpotIds.add(spot.placeId)
      return true
    })

    if (spots.length > policy.hardConstraints.maxMainActivitiesPerDay) {
      spots = spots.slice(0, policy.hardConstraints.maxMainActivitiesPerDay)
      repairApplied = true
      warnings.push(`第 ${dayNumber} 天已按节奏上限截断点位。`)
    }

    while (spots.length < policy.hardConstraints.minMainActivitiesPerDay) {
      const supplement = pickSupplementSpot(request, policy, spots, attractionMap, usedSpotIds)
      if (!supplement) break
      spots.push({
        placeId: supplement.placeId,
        stayMinutes: supplement.stayMinutes,
        reason: `按${policy.normalizedPreferences.labels.pace}与${policy.normalizedPreferences.labels.interestTags.join("、") || "综合"}偏好补齐。`,
      })
      usedSpotIds.add(supplement.placeId)
      repairApplied = true
      warnings.push(`第 ${dayNumber} 天已按偏好策略补齐景点：${supplement.name}`)
    }

    const anchor = spots
      .map((spot) => attractionMap.get(spot.placeId))
      .filter((candidate): candidate is PlannerCandidate => Boolean(candidate))
      .at(-1)
    let lunch = sourceDay.lunch
    let dinner = sourceDay.dinner
    let hotel = sourceDay.hotel

    if (!lunch?.placeId || !restaurantCandidates.some((candidate) => candidate.placeId === lunch?.placeId)) {
      lunch = pickSuggestion(restaurantCandidates, anchor, policy)
      if (lunch) {
        repairApplied = true
        warnings.push(`第 ${dayNumber} 天已补齐午餐候选。`)
      }
    }
    if (!dinner?.placeId || !restaurantCandidates.some((candidate) => candidate.placeId === dinner?.placeId)) {
      dinner = pickSuggestion(restaurantCandidates, anchor, policy, lunch?.placeId)
      if (dinner) {
        repairApplied = true
        warnings.push(`第 ${dayNumber} 天已补齐晚餐候选。`)
      }
    }
    if (!hotel?.placeId || !hotelCandidates.some((candidate) => candidate.placeId === hotel?.placeId)) {
      hotel = pickSuggestion(hotelCandidates, anchor, policy)
      if (hotel) {
        repairApplied = true
        warnings.push(`第 ${dayNumber} 天已补齐酒店候选。`)
      }
    }

    return {
      ...sourceDay,
      day: dayNumber,
      weather: sourceDay.weather || request.weatherContext?.dayWeather[index],
      weatherAdvice: sourceDay.weatherAdvice || request.weatherContext?.dayWeather[index]?.advice,
      weatherTags: sourceDay.weatherTags || request.weatherContext?.dayWeather[index]?.tags,
      spots,
      lunch,
      dinner,
      hotel,
    }
  })

  const repairedPlan = generatedPlanSchema.parse({
    ...plan,
    destination: request.destination,
    totalDays: request.totalDays,
    weatherSummary: plan.weatherSummary || request.weatherContext?.summary,
    days,
    droppedPlaceIds: request.attractions
      .map((candidate) => candidate.placeId)
      .filter((placeId) => !usedSpotIds.has(placeId)),
  })
  const issues = validateGeneratedPlanAgainstPolicy(repairedPlan, request, policy)

  return {
    plan: repairedPlan,
    warnings,
    issues,
    repairApplied,
  }
}
