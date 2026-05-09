import type { DaySuggestionItem, ItineraryDay, Spot, TripPlan } from "@/lib/travel-context"

export interface PlanReplaceCandidate {
  spot: Spot
  score: number
  reason: string
  distanceMeters?: number
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getLngLat(spot: Spot): [number, number] | null {
  const lng = toNumber(spot.lng)
  const lat = toNumber(spot.lat)
  if (lng === null || lat === null) return null
  return [lng, lat]
}

function getDistanceMeters(a: Spot, b: Spot) {
  const p1 = getLngLat(a)
  const p2 = getLngLat(b)
  if (!p1 || !p2) return Number.POSITIVE_INFINITY
  const [lng1, lat1] = p1
  const [lng2, lat2] = p2
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const rLat1 = toRad(lat1)
  const rLat2 = toRad(lat2)
  const k =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.max(0, 6371000 * 2 * Math.atan2(Math.sqrt(k), Math.sqrt(1 - k)))
}

function districtOf(spot: Spot) {
  const district = (spot.district || "").trim()
  if (district) return district
  const address = spot.address || ""
  const matched = address.match(/[\u4e00-\u9fa5]{1,8}(?:区|县|市)/)
  return matched?.[0] || ""
}

function buildScore(current: Spot, candidate: Spot) {
  let score = 0
  if (candidate.type === current.type) score += 40
  if (districtOf(candidate) && districtOf(candidate) === districtOf(current)) score += 18
  const distance = getDistanceMeters(current, candidate)
  if (Number.isFinite(distance)) {
    if (distance <= 1500) score += 24
    else if (distance <= 3000) score += 16
    else if (distance <= 5000) score += 10
    else score += 2
  }
  score += (candidate.rating || 0) * 3
  score += (candidate.heat || 0) * 0.08
  return { score, distance }
}

function buildCandidateReason(current: Spot, candidate: Spot, distance: number) {
  const reasons: string[] = []
  if (candidate.type === current.type) reasons.push("同类型替换")
  if (districtOf(candidate) && districtOf(candidate) === districtOf(current)) reasons.push("同片区")
  if (Number.isFinite(distance)) {
    reasons.push(distance <= 3000 ? "距离较近" : "可达性可接受")
  }
  if ((candidate.rating || 0) >= 4.5) reasons.push("评分较高")
  return reasons.join(" · ") || "综合条件匹配"
}

export function getSpotReplacementCandidates(input: {
  day: ItineraryDay
  spotId: string
  pool: Spot[]
  lockedSpotIds?: string[]
  max?: number
}) {
  const { day, spotId, pool, lockedSpotIds = [], max = 8 } = input
  const current = day.spots.find((item) => item.id === spotId)
  if (!current) return []
  const dayIds = new Set(day.spots.map((item) => item.id))
  const lockSet = new Set(lockedSpotIds)

  const candidates = pool
    .filter((item) => item.id !== current.id)
    .filter((item) => item.type === current.type)
    .filter((item) => !dayIds.has(item.id) || lockSet.has(item.id))
    .map((item) => {
      const { score, distance } = buildScore(current, item)
      return {
        spot: item,
        score,
        distanceMeters: distance,
        reason: buildCandidateReason(current, item, distance),
      } satisfies PlanReplaceCandidate
    })
    .sort((a, b) => b.score - a.score)

  return candidates.slice(0, max)
}

function getMealAnchor(day: ItineraryDay, mealType: "lunch" | "dinner") {
  const attractions = day.spots.filter((spot) => spot.type === "attraction")
  if (attractions.length === 0) return day.spots[0] || null
  if (mealType === "lunch") {
    return attractions[Math.max(0, Math.floor((attractions.length - 1) / 2))]
  }
  return attractions[attractions.length - 1]
}

export function getMealReplacementCandidates(input: {
  day: ItineraryDay
  mealType: "lunch" | "dinner"
  pool: Spot[]
  max?: number
}) {
  const { day, mealType, pool, max = 8 } = input
  const anchor = getMealAnchor(day, mealType)
  if (!anchor) return []
  const usedIds = new Set(
    [day.lunchSuggestion?.id, day.dinnerSuggestion?.id]
      .filter(Boolean)
      .map((id) => (id || "").replace(/^food-/, ""))
  )

  return pool
    .filter((item) => item.type === "restaurant")
    .filter((item) => !usedIds.has(item.id))
    .map((item) => {
      const { score, distance } = buildScore(anchor, item)
      return {
        spot: item,
        score,
        distanceMeters: distance,
        reason: buildCandidateReason(anchor, item, distance),
      } satisfies PlanReplaceCandidate
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
}

export function getHotelReplacementCandidates(input: {
  day: ItineraryDay
  nextDay?: ItineraryDay | null
  pool: Spot[]
  max?: number
}) {
  const { day, nextDay, pool, max = 8 } = input
  const endSpot = day.spots[day.spots.length - 1] || null
  const nextStart = nextDay?.spots[0] || null

  return pool
    .filter((item) => item.type === "hotel")
    .map((item) => {
      let score = 0
      let distanceMeters = Number.POSITIVE_INFINITY
      if (endSpot) {
        const d1 = getDistanceMeters(endSpot, item)
        distanceMeters = Math.min(distanceMeters, d1)
        if (d1 <= 2500) score += 28
        else if (d1 <= 5000) score += 18
        else score += 8
      }
      if (nextStart) {
        const d2 = getDistanceMeters(nextStart, item)
        distanceMeters = Math.min(distanceMeters, d2)
        if (d2 <= 2500) score += 22
        else if (d2 <= 5000) score += 14
        else score += 6
      }
      score += (item.rating || 0) * 4
      if (item.ticketPrice > 0 && item.ticketPrice <= 500) score += 10
      return {
        spot: item,
        score,
        distanceMeters,
        reason: "靠近当日终点/次日起点 · 住宿便利性优先",
      } satisfies PlanReplaceCandidate
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
}

function recalculateDayCost(day: ItineraryDay) {
  const ticketCost = day.spots.reduce((sum, spot) => sum + (spot.ticketPrice || 0), 0)
  const mealCost = (day.lunchSuggestion?.price || 0) + (day.dinnerSuggestion?.price || 0)
  const hotelCost = day.hotelSuggestion?.price || 0
  return {
    totalMealCost: mealCost,
    totalHotelCost: hotelCost,
    totalEstimatedCost: ticketCost + mealCost + hotelCost,
  }
}

export function toSuggestionFromSpot(
  spot: Spot,
  type: DaySuggestionItem["type"],
  reason: string
): DaySuggestionItem {
  const price = Number(spot.ticketPrice)
  return {
    id: `${type}-${spot.id}`,
    name: spot.name,
    type,
    address: spot.address || `${spot.city || "北京"}${spot.name}`,
    price: Number.isFinite(price) && price > 0 ? Math.round(price) : type === "hotel" ? 380 : 88,
    rating: Number.isFinite(spot.rating) && spot.rating > 0 ? spot.rating : 4.5,
    image: spot.image,
    reason,
    tags: spot.tags,
  }
}

export function updateDayMeal(
  day: ItineraryDay,
  mealType: "lunch" | "dinner",
  suggestion: DaySuggestionItem
) {
  const next = {
    ...day,
    lunchSuggestion: mealType === "lunch" ? suggestion : day.lunchSuggestion,
    dinnerSuggestion: mealType === "dinner" ? suggestion : day.dinnerSuggestion,
  }
  return {
    ...next,
    ...recalculateDayCost(next),
  }
}

export function updateDayHotel(day: ItineraryDay, suggestion: DaySuggestionItem) {
  const next = {
    ...day,
    hotelSuggestion: suggestion,
  }
  return {
    ...next,
    ...recalculateDayCost(next),
  }
}

export function toggleLockedSpot(lockedSpotIds: string[], spotId: string) {
  const set = new Set(lockedSpotIds)
  if (set.has(spotId)) set.delete(spotId)
  else set.add(spotId)
  return Array.from(set)
}

export function moveSpotIdInMatrix(
  matrix: string[][],
  dayIndex: number,
  spotId: string,
  direction: "up" | "down"
) {
  const day = [...(matrix[dayIndex] || [])]
  const index = day.findIndex((id) => id === spotId)
  if (index < 0) return matrix
  const targetIndex = direction === "up" ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= day.length) return matrix
  ;[day[index], day[targetIndex]] = [day[targetIndex], day[index]]
  const next = [...matrix]
  next[dayIndex] = day
  return next
}

export function replaceSpotIdInMatrix(
  matrix: string[][],
  dayIndex: number,
  spotId: string,
  replacementId: string
) {
  const day = [...(matrix[dayIndex] || [])]
  const index = day.findIndex((id) => id === spotId)
  if (index < 0) return matrix
  day[index] = replacementId
  const next = [...matrix]
  next[dayIndex] = Array.from(new Set(day))
  return next
}

export function toDaySpotIdMatrix(days: ItineraryDay[]) {
  return days.map((day) => day.spots.map((spot) => spot.id))
}

export function applyDayPatch(
  plan: TripPlan,
  dayNumber: number,
  patcher: (day: ItineraryDay) => ItineraryDay
) {
  const days = (plan.days || []).map((day) =>
    day.day === dayNumber ? patcher(day) : day
  )
  const totalEstimatedCost = days.reduce((sum, day) => sum + day.totalEstimatedCost, 0)
  const totalDistanceMeters = days.reduce((sum, day) => sum + day.totalDistanceMeters, 0)
  const totalTravelSeconds = days.reduce((sum, day) => sum + day.totalTravelSeconds, 0)
  const totalPlayMinutes = days.reduce((sum, day) => sum + day.totalPlayMinutes, 0)
  return {
    ...plan,
    days,
    totalDays: days.length,
    totalDistanceMeters,
    totalTravelSeconds,
    totalPlayMinutes,
    totalEstimatedCost,
    lastEditedAt: new Date().toISOString(),
    planMode: "user_edited" as const,
  }
}
