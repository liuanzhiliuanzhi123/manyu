import type { TravelRequirement } from "@/lib/planner-types"
import type { Spot } from "@/lib/travel-context"
import { getSpotLngLat } from "@/lib/amap-spot-utils"

interface HotelRecommendationInput {
  candidates: Spot[]
  daySpots: Spot[]
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

function scoreByDistance(distanceMeters: number) {
  if (distanceMeters <= 1200) return 22
  if (distanceMeters <= 2500) return 16
  if (distanceMeters <= 4000) return 10
  if (distanceMeters <= 7000) return 4
  return -5
}

export function recommendBeijingHotelCandidate({
  candidates,
  daySpots,
  budgetUpper,
  usedIds,
  requirement,
}: HotelRecommendationInput): Spot | null {
  const anchor =
    [...daySpots].reverse().find((spot) => spot.type !== "restaurant") ||
    daySpots[daySpots.length - 1]
  const anchorLngLat = anchor ? getSpotLngLat(anchor) : null

  const ranked = candidates
    .filter((candidate) => !usedIds.has(candidate.id))
    .map((candidate) => {
      let score = 0
      const lngLat = getSpotLngLat(candidate)
      if (anchorLngLat && lngLat) {
        score += scoreByDistance(haversineMeters(anchorLngLat, lngLat))
      }

      if (candidate.rating > 0) score += candidate.rating * 8
      if (candidate.heat > 0) score += candidate.heat * 0.12

      if (budgetUpper !== Number.POSITIVE_INFINITY) {
        const ratio = candidate.ticketPrice / Math.max(1, budgetUpper)
        if (ratio <= 0.25) score += 14
        else if (ratio <= 0.4) score += 6
        else score -= 10
      }

      const tagText = candidate.tags.join(" ")
      if (/交通便利|位置中心/u.test(tagText)) score += 6
      if (/干净卫生|服务好/u.test(tagText)) score += 6
      if (requirement?.companions === "family" && /亲子|家庭/u.test(tagText)) score += 7
      if (requirement?.companions === "elderly" && /适合老人|安静/u.test(tagText)) score += 7
      if (requirement?.specialNeeds?.includes("酒店舒适优先")) score += 8
      if (requirement?.specialNeeds?.includes("低预算优先") && candidate.ticketPrice <= 600) {
        score += 6
      }

      return { candidate, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.candidate || null
}

