import type { ItineraryDay, Spot } from "@/lib/travel-context"

export interface DayMapPoint {
  id: string
  order: number
  spot: Spot
  isStart: boolean
  isEnd: boolean
  isKeyStop: boolean
}

export interface DayMapSegment {
  id: string
  fromSpotId: string
  toSpotId: string
  fromName: string
  toName: string
  order: number
}

export function buildDayMapPoints(day: ItineraryDay): DayMapPoint[] {
  return day.spots.map((spot, index) => ({
    id: spot.id,
    order: index + 1,
    spot,
    isStart: index === 0,
    isEnd: index === day.spots.length - 1,
    isKeyStop: spot.type === "restaurant" || spot.type === "hotel",
  }))
}

export function buildDayMapSegments(day: ItineraryDay): DayMapSegment[] {
  if (day.spots.length <= 1) return []

  const segments: DayMapSegment[] = []
  for (let index = 0; index < day.spots.length - 1; index += 1) {
    const from = day.spots[index]
    const to = day.spots[index + 1]
    const matchedLeg = day.routeLegs.find(
      (leg) => leg.fromName === from.name && leg.toName === to.name
    )

    segments.push({
      id: matchedLeg?.id || `d${day.day}-${from.id}-${to.id}`,
      fromSpotId: from.id,
      toSpotId: to.id,
      fromName: from.name,
      toName: to.name,
      order: index + 1,
    })
  }
  return segments
}

export function getMapSegmentIds(day: ItineraryDay) {
  return buildDayMapSegments(day).map((item) => item.id)
}

