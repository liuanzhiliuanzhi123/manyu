import type { TravelRequirement } from "@/lib/planner-types"
import type { Spot } from "@/lib/travel-context"
import { getSpotLngLat } from "@/lib/amap-spot-utils"

interface MealRecommendationInput {
  candidates: Spot[]
  daySpots: Spot[]
  mealType: "lunch" | "dinner"
  budgetUpper: number
  usedIds: Set<string>
  requirement?: TravelRequirement
}

function haversineMeters(from: [number, number], to: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const [lng1, lat1] = from
  const [lng2, lat2] = to
  const earthRadius = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

function getAnchor(daySpots: Spot[], mealType: "lunch" | "dinner") {
  const attractions = daySpots.filter((spot) => spot.type === "attraction")
  if (attractions.length === 0) return daySpots[0] || null
  if (mealType === "lunch") {
    return attractions[Math.max(0, Math.floor((attractions.length - 1) / 2))]
  }
  return attractions[attractions.length - 1]
}

function scoreByDistance(distanceMeters: number) {
  if (distanceMeters <= 800) return 24
  if (distanceMeters <= 1800) return 18
  if (distanceMeters <= 3500) return 12
  if (distanceMeters <= 5500) return 6
  if (distanceMeters <= 9000) return 1
  return -6
}

export function recommendBeijingMealCandidate({
  candidates,
  daySpots,
  mealType,
  budgetUpper,
  usedIds,
  requirement,
}: MealRecommendationInput): Spot | null {
  const anchor = getAnchor(daySpots, mealType)
  const anchorLngLat = anchor ? getSpotLngLat(anchor) : null

  const ranked = candidates
    .filter((candidate) => !usedIds.has(candidate.id))
    .map((candidate) => {
      let score = 0
      const lngLat = getSpotLngLat(candidate)
      if (anchorLngLat && lngLat) {
        score += scoreByDistance(haversineMeters(anchorLngLat, lngLat))
      }
      if (candidate.rating > 0) score += candidate.rating * 7
      if (candidate.heat > 0) score += candidate.heat * 0.18

      if (budgetUpper !== Number.POSITIVE_INFINITY) {
        const ratio = candidate.ticketPrice / Math.max(1, budgetUpper)
        if (ratio <= 0.06) score += 12
        else if (ratio <= 0.12) score += 7
        else score -= 8
      }

      if (requirement?.interests.includes("美食打卡")) score += 10
      if (requirement?.pace === "slow" && candidate.tags.some((tag) => /老字号|京味/u.test(tag))) {
        score += 4
      }
      if (requirement?.companions === "family" || requirement?.companions === "elderly") {
        if (candidate.tags.some((tag) => /家庭|亲子|安静/u.test(tag))) score += 6
      }
      if (mealType === "dinner" && candidate.tags.some((tag) => /烤鸭|火锅|京菜/u.test(tag))) {
        score += 5
      }
      if (mealType === "lunch" && candidate.tags.some((tag) => /小吃|面馆|简餐/u.test(tag))) {
        score += 4
      }

      return { candidate, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.candidate || null
}

