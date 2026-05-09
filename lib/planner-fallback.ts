import "server-only"

import type {
  GeneratedPlan,
  GeneratedPlanDay,
  PlannerCandidate,
  PlannerDecisionRequest,
} from "@/lib/planner-types"

interface PlannerFallbackResult {
  plan: GeneratedPlan
  warnings: string[]
}

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

function paceSpotLimit(pace: PlannerDecisionRequest["pace"]) {
  if (pace === "fast") return 5
  if (pace === "slow") return 3
  return 4
}

function normalizeDistrict(input?: string) {
  return (input || "").trim()
}

function isRemoteDistrict(district?: string) {
  const text = normalizeDistrict(district)
  if (!text) return false
  return REMOTE_DISTRICT_KEYWORDS.some((keyword) => text.includes(keyword))
}

function distanceMeters(a: PlannerCandidate, b: PlannerCandidate) {
  if (
    !Number.isFinite(a.lng) ||
    !Number.isFinite(a.lat) ||
    !Number.isFinite(b.lng) ||
    !Number.isFinite(b.lat)
  ) {
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

function containsAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function scoreAttraction(
  candidate: PlannerCandidate,
  request: PlannerDecisionRequest,
  budgetUpper: number,
  preferredSet: Set<string>
) {
  let score = 0
  if (preferredSet.has(candidate.placeId)) score += 90
  if (Number.isFinite(candidate.rating)) score += (candidate.rating as number) * 12

  const tagText = `${candidate.name} ${(candidate.tags || []).join(" ")}`

  if (request.interests.length > 0) {
    for (const interest of request.interests) {
      if (tagText.includes(interest)) score += 12
    }
  }

  if (request.specialNeeds.includes("低预算优先")) {
    if (Number.isFinite(candidate.price) && (candidate.price as number) > 0) {
      score -= (candidate.price as number) / 12
    }
  } else if (budgetUpper !== Number.POSITIVE_INFINITY && Number.isFinite(candidate.price)) {
    if ((candidate.price as number) > budgetUpper * 0.15) score -= 20
  }

  if (
    (request.specialNeeds.includes("少走路") ||
      request.specialNeeds.includes("适合老人") ||
      request.companions === "elderly") &&
    isRemoteDistrict(candidate.district)
  ) {
    score -= 24
  }

  if (request.companions === "family" || request.specialNeeds.includes("适合小孩")) {
    if (containsAny(tagText, [/亲子/u, /儿童/u, /动物/u, /科技/u, /互动/u])) score += 18
  }

  if (request.pace === "fast") score += 6
  if (request.pace === "slow" && isRemoteDistrict(candidate.district)) score -= 10

  return score
}

function scoreFoodOrHotel(
  candidate: PlannerCandidate,
  anchor: PlannerCandidate,
  request: PlannerDecisionRequest,
  budgetUpper: number,
  mode: "food" | "hotel"
) {
  let score = 0
  if (Number.isFinite(candidate.rating)) score += (candidate.rating as number) * 10

  const distance = distanceMeters(candidate, anchor)
  if (Number.isFinite(distance)) {
    if (distance <= (mode === "hotel" ? 3500 : 2500)) score += 24
    else if (distance <= (mode === "hotel" ? 6000 : 4500)) score += 12
    else score -= 20
  } else if (
    normalizeDistrict(candidate.district) &&
    normalizeDistrict(candidate.district) === normalizeDistrict(anchor.district)
  ) {
    score += 14
  }

  if (Number.isFinite(candidate.price) && (candidate.price as number) > 0) {
    if (request.specialNeeds.includes("低预算优先")) {
      score -= (candidate.price as number) / (mode === "hotel" ? 20 : 8)
    } else if (budgetUpper !== Number.POSITIVE_INFINITY) {
      const ratio =
        mode === "hotel"
          ? (candidate.price as number) / Math.max(1, budgetUpper * 0.35)
          : (candidate.price as number) / Math.max(1, budgetUpper * 0.12)
      if (ratio <= 1) score += 10
      else score -= ratio * 6
    }
  }

  if (mode === "hotel" && request.specialNeeds.includes("酒店舒适优先")) {
    score += 18
  }
  if (mode === "food" && request.specialNeeds.includes("美食优先")) {
    score += 14
  }

  const tagText = `${candidate.name} ${(candidate.tags || []).join(" ")}`
  if (
    (request.companions === "family" || request.specialNeeds.includes("适合小孩")) &&
    containsAny(tagText, [/亲子/u, /家庭/u, /儿童/u])
  ) {
    score += 8
  }
  if (
    (request.companions === "elderly" || request.specialNeeds.includes("适合老人")) &&
    containsAny(tagText, [/安静/u, /舒适/u, /老人/u])
  ) {
    score += 8
  }

  return score
}

function pickDayBuckets(
  rankedAttractions: PlannerCandidate[],
  dayCount: number,
  perDayLimit: number
) {
  const days: PlannerCandidate[][] = Array.from({ length: dayCount }, () => [])
  for (const candidate of rankedAttractions) {
    let bestIndex = -1
    let bestScore = Number.NEGATIVE_INFINITY
    for (let i = 0; i < days.length; i += 1) {
      const day = days[i]
      if (day.length >= perDayLimit) continue
      const last = day[day.length - 1]
      let score = 0
      if (!last) score += 8
      if (last && normalizeDistrict(last.district) === normalizeDistrict(candidate.district)) {
        score += 10
      }
      score -= day.length * 2
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    if (bestIndex >= 0) {
      days[bestIndex].push(candidate)
    }
  }
  return days
}

function makeDayTheme(pace: PlannerDecisionRequest["pace"]) {
  if (pace === "fast") return "高效串联路线"
  if (pace === "slow") return "慢节奏体验日"
  return "平衡体验路线"
}

export function buildFallbackGeneratedPlan(request: PlannerDecisionRequest): PlannerFallbackResult {
  const warnings: string[] = []
  const budgetUpper = parseBudgetUpperBound(request.budgetRange)
  const preferredSet = new Set(request.manualPreferredPlaceIds || [])
  const perDayLimit = paceSpotLimit(request.pace)
  const maxAttractions = Math.max(request.totalDays * perDayLimit, request.totalDays * 2)

  const rankedAttractions = [...request.attractions]
    .sort(
      (a, b) =>
        scoreAttraction(b, request, budgetUpper, preferredSet) -
        scoreAttraction(a, request, budgetUpper, preferredSet)
    )
    .slice(0, maxAttractions)

  if (rankedAttractions.length === 0) {
    warnings.push("景点候选不足，已返回可编辑的基础方案骨架。")
  }

  const dayBuckets = pickDayBuckets(rankedAttractions, request.totalDays, perDayLimit)
  const usedSpotIds = new Set<string>()
  const days: GeneratedPlanDay[] = dayBuckets.map((bucket, index) => {
    bucket.forEach((spot) => usedSpotIds.add(spot.placeId))
    const anchor = bucket[bucket.length - 1] || bucket[0]

    const rankedFood = anchor
      ? [...request.restaurants].sort(
          (a, b) =>
            scoreFoodOrHotel(b, anchor, request, budgetUpper, "food") -
            scoreFoodOrHotel(a, anchor, request, budgetUpper, "food")
        )
      : []
    const rankedHotel = anchor
      ? [...request.hotels].sort(
          (a, b) =>
            scoreFoodOrHotel(b, anchor, request, budgetUpper, "hotel") -
            scoreFoodOrHotel(a, anchor, request, budgetUpper, "hotel")
        )
      : []

    const lunch = rankedFood[0]
    const dinner = rankedFood[1] || rankedFood[0]
    const hotel = rankedHotel[0]

    const districtSummary = Array.from(
      new Set(bucket.map((item) => normalizeDistrict(item.district)).filter(Boolean))
    )
      .slice(0, 2)
      .join(" / ")

    const dayWarnings: string[] = []
    if (bucket.length === 0) dayWarnings.push("当天景点候选不足，建议手动补充。")
    if (!lunch || !dinner) dayWarnings.push("当天餐饮候选不足，已尽量就近补齐。")
    if (!hotel) dayWarnings.push("当天酒店候选不足，建议手动确认住宿。")

    return {
      day: index + 1,
      theme: makeDayTheme(request.pace),
      districtSummary: districtSummary || undefined,
      spots: bucket.map((spot) => ({
        placeId: spot.placeId,
        stayMinutes: spot.stayMinutes,
        reason: preferredSet.has(spot.placeId)
          ? "保留了你手动偏好的地点。"
          : "基于偏好、预算与同区串联效率入选。",
      })),
      lunch: lunch
        ? {
            placeId: lunch.placeId,
            area: lunch.district || lunch.city,
            reason: "优先选择与当日景点锚点更近且评分更稳的午餐候选。",
          }
        : undefined,
      dinner: dinner
        ? {
            placeId: dinner.placeId,
            area: dinner.district || dinner.city,
            reason: "结合晚间动线与预算空间安排晚餐。",
          }
        : undefined,
      hotel: hotel
        ? {
            placeId: hotel.placeId,
            area: hotel.district || hotel.city,
            reason: "优先选择接近当日终点且符合预算/舒适偏好的酒店。",
          }
        : undefined,
      warnings: dayWarnings.length > 0 ? dayWarnings : undefined,
    }
  })

  const droppedPlaceIds = request.attractions
    .map((item) => item.placeId)
    .filter((placeId) => !usedSpotIds.has(placeId))

  if (
    request.specialNeeds.includes("低预算优先") &&
    request.specialNeeds.includes("酒店舒适优先")
  ) {
    warnings.push("你同时选择了低预算优先和酒店舒适优先，系统会做折中分配。")
  }
  if (request.pace === "fast" && request.specialNeeds.includes("少走路")) {
    warnings.push("你选择了特种兵式和少走路，部分日期已自动降密度。")
  }

  const explanations = [
    "先执行规则约束过滤，再在候选内进行排序与取舍。",
    "同区串联优先，减少跨区折返。",
    "餐饮与酒店优先靠近当日锚点，并兼顾预算与偏好。",
  ]

  return {
    plan: {
      destination: request.destination,
      totalDays: request.totalDays,
      totalBudget: Number.isFinite(budgetUpper) ? budgetUpper : undefined,
      days,
      droppedPlaceIds,
      explanations,
    },
    warnings,
  }
}
