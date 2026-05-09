import { getSpotLngLat } from "@/lib/amap-spot-utils"
import { estimatePlayMinutes } from "@/lib/itinerary-utils"
import type { PacePreference, TravelRequirement } from "@/lib/planner-types"
import type { Spot } from "@/lib/travel-context"

type LngLatTuple = [number, number]

interface PlannerPoint {
  spot: Spot
  lngLat: LngLatTuple | null
  district: string
  isRemote: boolean
  visitMinutes: number
  closingMinutes: number | null
}

interface PlannerGroup {
  key: string
  district: string
  isRemote: boolean
  points: PlannerPoint[]
  center: LngLatTuple | null
  estimatedMinutes: number
}

interface PlannerDayBucket {
  district: string
  points: PlannerPoint[]
  estimatedMinutes: number
  warnings: string[]
}

export interface PlannerEngineDay {
  day: number
  title: string
  theme: string
  districtSummary: string
  spots: Spot[]
  warnings: string[]
}

export interface PlannerEngineResult {
  days: PlannerEngineDay[]
  unplanned: Spot[]
  notices: string[]
  usedDayCount: number
}

interface PlannerEngineInput {
  spots: Spot[]
  requirement?: TravelRequirement
  pace: string
  targetDayCount: number
}

const REMOTE_KEYWORDS = [
  "延庆",
  "怀柔",
  "密云",
  "平谷",
  "门头沟",
  "昌平",
  "郊区",
  "景区",
  "古镇",
  "长城",
]

const CITY_CENTER_MAP: Record<string, LngLatTuple> = {
  北京: [116.4074, 39.9042],
  北京市: [116.4074, 39.9042],
  杭州: [120.1551, 30.2741],
  成都: [104.0668, 30.5728],
  厦门: [118.0894, 24.4798],
  广州: [113.2644, 23.1291],
}

const DAY_THEMES = [
  "城市地标串联",
  "人文与风味路线",
  "自然与慢游体验",
  "深度探索日",
  "轻松收官路线",
]

function parseDistrict(address: string) {
  if (!address) return ""
  const match = address.match(/([\u4e00-\u9fa5]{1,8}(?:区|县|市))/)
  return match?.[1] ?? ""
}

function toMinutesFromClock(clockText: string) {
  const match = clockText.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function parseClosingMinutes(openTime?: string) {
  if (!openTime) return null
  if (openTime.includes("全天")) return null
  const rawRange = openTime.replace(/\s+/g, "")
  const parts = rawRange.split("-")
  if (parts.length < 2) return null
  return toMinutesFromClock(parts[1])
}

function haversineDistanceMeters(from: LngLatTuple, to: LngLatTuple) {
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

function meanCenter(points: PlannerPoint[]): LngLatTuple | null {
  const valid = points.map((item) => item.lngLat).filter((item): item is LngLatTuple => Boolean(item))
  if (valid.length === 0) return null
  const total = valid.reduce(
    (acc, current) => {
      acc[0] += current[0]
      acc[1] += current[1]
      return acc
    },
    [0, 0] as [number, number]
  )
  return [total[0] / valid.length, total[1] / valid.length]
}

function normalizePace(pace: string, requirementPace?: PacePreference) {
  const input = (requirementPace || pace || "").toLowerCase()
  if (input === "fast" || input === "intensive") return "fast" as const
  if (input === "slow" || input === "relaxed") return "slow" as const
  return "balanced" as const
}

function getDayCapacityByPace(pace: ReturnType<typeof normalizePace>) {
  if (pace === "fast") {
    return { maxPoiCount: 6, maxMinutes: 11 * 60 }
  }
  if (pace === "slow") {
    return { maxPoiCount: 3, maxMinutes: 7 * 60 + 30 }
  }
  return { maxPoiCount: 4, maxMinutes: 9 * 60 }
}

function buildPoint(spot: Spot, pace: string, cityHint: string) {
  const lngLat = getSpotLngLat(spot)
  const district = parseDistrict(spot.address)
  const keywordRemote = REMOTE_KEYWORDS.some((keyword) =>
    `${spot.name}${spot.address}`.includes(keyword)
  )
  const cityCenter = CITY_CENTER_MAP[spot.city || cityHint]
  const remoteByDistance =
    Boolean(cityCenter && lngLat && haversineDistanceMeters(cityCenter, lngLat) > 26000)

  return {
    spot,
    lngLat,
    district,
    isRemote: keywordRemote || remoteByDistance,
    visitMinutes: Math.max(30, spot.suggestedDurationMinutes || estimatePlayMinutes(spot, pace)),
    closingMinutes: parseClosingMinutes(spot.openTime),
  } satisfies PlannerPoint
}

function distanceBetweenPoints(a: PlannerPoint, b: PlannerPoint) {
  if (a.lngLat && b.lngLat) {
    return haversineDistanceMeters(a.lngLat, b.lngLat)
  }
  if (a.district && b.district && a.district === b.district) {
    return 1500
  }
  return 8000
}

function getGroupKey(point: PlannerPoint) {
  if (point.isRemote) {
    return `remote:${point.district || point.spot.id}`
  }

  if (point.district) {
    return `district:${point.district}`
  }

  if (point.lngLat) {
    const lngBucket = Math.round(point.lngLat[0] * 10)
    const latBucket = Math.round(point.lngLat[1] * 10)
    return `geo:${lngBucket}:${latBucket}`
  }

  return `misc:${point.spot.city || "unknown"}`
}

function nearestGroupForFood(food: PlannerPoint, groups: PlannerGroup[]) {
  let candidate: PlannerGroup | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const group of groups) {
    if (group.points.length === 0) continue
    if (group.district && food.district && group.district === food.district) {
      return group
    }
    if (!group.center || !food.lngLat) continue
    const distance = haversineDistanceMeters(group.center, food.lngLat)
    if (distance < bestDistance) {
      bestDistance = distance
      candidate = group
    }
  }

  if (candidate && bestDistance <= 8000) return candidate
  return null
}

function createGroupFromPoint(point: PlannerPoint): PlannerGroup {
  return {
    key: getGroupKey(point),
    district: point.district,
    isRemote: point.isRemote,
    points: [point],
    center: point.lngLat,
    estimatedMinutes: point.visitMinutes,
  }
}

function finalizeGroup(group: PlannerGroup): PlannerGroup {
  const center = meanCenter(group.points)
  const estimatedMinutes = group.points.reduce(
    (sum, point) => sum + point.visitMinutes,
    0
  )
  return {
    ...group,
    center,
    estimatedMinutes,
  }
}

function sortGroups(groups: PlannerGroup[]) {
  return [...groups].sort((a, b) => {
    if (a.isRemote !== b.isRemote) {
      return Number(a.isRemote) - Number(b.isRemote)
    }
    if (a.district && b.district && a.district !== b.district) {
      return a.district.localeCompare(b.district, "zh-CN")
    }
    return b.estimatedMinutes - a.estimatedMinutes
  })
}

function orderPoints(points: PlannerPoint[]) {
  if (points.length <= 2) {
    return [...points]
  }

  const restaurants = points.filter((point) => point.spot.type === "restaurant")
  const nonRestaurants = points.filter((point) => point.spot.type !== "restaurant")

  if (nonRestaurants.length === 0) {
    return [...points]
  }

  const sortedByCloseTime = [...nonRestaurants].sort((a, b) => {
    if (a.closingMinutes === null && b.closingMinutes === null) return 0
    if (a.closingMinutes === null) return 1
    if (b.closingMinutes === null) return -1
    return a.closingMinutes - b.closingMinutes
  })

  const ordered: PlannerPoint[] = [sortedByCloseTime[0]]
  const remaining = new Set(sortedByCloseTime.slice(1))

  while (remaining.size > 0) {
    const anchor = ordered[ordered.length - 1]
    let nextPoint: PlannerPoint | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const point of remaining) {
      const distance = distanceBetweenPoints(anchor, point)
      const closePenalty = point.closingMinutes ? point.closingMinutes / 8 : 9999
      const score = distance + closePenalty
      if (score < bestScore) {
        bestScore = score
        nextPoint = point
      }
    }

    if (!nextPoint) {
      break
    }

    ordered.push(nextPoint)
    remaining.delete(nextPoint)
  }

  if (restaurants.length === 0) return ordered

  const foodQueue = [...restaurants]
  for (const foodPoint of foodQueue) {
    if (ordered.length === 0) {
      ordered.push(foodPoint)
      continue
    }

    let insertIndex = ordered.length
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < ordered.length; index += 1) {
      const anchor = ordered[index]
      if (anchor.spot.type === "restaurant") continue
      const distance = distanceBetweenPoints(anchor, foodPoint)
      if (distance < bestDistance) {
        bestDistance = distance
        insertIndex = index + 1
      }
    }

    ordered.splice(insertIndex, 0, foodPoint)
  }

  return ordered
}

function splitPointsToChunks(points: PlannerPoint[], maxPoiCount: number, maxMinutes: number) {
  const result: PlannerPoint[][] = []
  let cursor: PlannerPoint[] = []
  let totalMinutes = 0

  for (const point of points) {
    const nextMinutes = totalMinutes + point.visitMinutes
    const shouldSplit =
      cursor.length > 0 && (cursor.length >= maxPoiCount || nextMinutes > maxMinutes)

    if (shouldSplit) {
      result.push(cursor)
      cursor = [point]
      totalMinutes = point.visitMinutes
    } else {
      cursor.push(point)
      totalMinutes = nextMinutes
    }
  }

  if (cursor.length > 0) {
    result.push(cursor)
  }

  return result
}

function pickTargetDay(
  days: PlannerDayBucket[],
  chunk: PlannerPoint[],
  maxPoiCount: number,
  maxMinutes: number
) {
  const chunkDistrict = chunk.find((item) => item.district)?.district || ""
  const chunkMinutes = chunk.reduce((sum, item) => sum + item.visitMinutes, 0)

  const sameDistrict = days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => day.district && chunkDistrict && day.district === chunkDistrict)
    .find(({ day }) =>
      day.points.length + chunk.length <= maxPoiCount &&
      day.estimatedMinutes + chunkMinutes <= maxMinutes
    )
  if (sameDistrict) return sameDistrict.index

  const emptyDay = days.findIndex((day) => day.points.length === 0)
  if (emptyDay >= 0) return emptyDay

  const fitDay = days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) =>
      day.points.length + chunk.length <= maxPoiCount &&
      day.estimatedMinutes + chunkMinutes <= maxMinutes + 45
    )
    .sort((a, b) => a.day.estimatedMinutes - b.day.estimatedMinutes)[0]

  if (fitDay) return fitDay.index
  return -1
}

export function buildPlannerDayAssignments({
  spots,
  requirement,
  pace,
  targetDayCount,
}: PlannerEngineInput): PlannerEngineResult {
  if (spots.length === 0) {
    return {
      days: [],
      unplanned: [],
      notices: ["没有可规划的景点"],
      usedDayCount: 0,
    }
  }

  const normalizedPace = normalizePace(pace, requirement?.pace)
  const capacity = getDayCapacityByPace(normalizedPace)
  const cityHint = requirement?.city || spots[0]?.city || ""

  const points = spots.map((spot) => buildPoint(spot, normalizedPace, cityHint))
  const nonFood = points.filter((point) => point.spot.type !== "restaurant")
  const food = points.filter((point) => point.spot.type === "restaurant")

  const groupMap = new Map<string, PlannerGroup>()

  const seedPoints = nonFood.length > 0 ? nonFood : points
  for (const point of seedPoints) {
    const key = getGroupKey(point)
    const existing = groupMap.get(key)
    if (existing) {
      existing.points.push(point)
    } else {
      groupMap.set(key, createGroupFromPoint(point))
    }
  }

  const groups = Array.from(groupMap.values())

  for (const foodPoint of food) {
    const nearestGroup = nearestGroupForFood(foodPoint, groups)
    if (nearestGroup) {
      nearestGroup.points.push(foodPoint)
      continue
    }

    groups.push(createGroupFromPoint(foodPoint))
  }

  const finalizedGroups = sortGroups(groups.map((group) => finalizeGroup(group)))

  const dayCount = Math.max(1, targetDayCount)
  const dayBuckets: PlannerDayBucket[] = Array.from({ length: dayCount }, () => ({
    district: "",
    points: [],
    estimatedMinutes: 0,
    warnings: [],
  }))

  const unplanned: Spot[] = []

  for (const group of finalizedGroups) {
    const orderedPoints = orderPoints(group.points)
    const chunks = splitPointsToChunks(
      orderedPoints,
      capacity.maxPoiCount,
      capacity.maxMinutes
    )

    for (const chunk of chunks) {
      const targetIndex = pickTargetDay(
        dayBuckets,
        chunk,
        capacity.maxPoiCount,
        capacity.maxMinutes
      )

      if (targetIndex < 0) {
        chunk.forEach((point) => unplanned.push(point.spot))
        continue
      }

      const day = dayBuckets[targetIndex]
      day.points.push(...chunk)
      day.estimatedMinutes += chunk.reduce(
        (sum, point) => sum + point.visitMinutes,
        0
      )
      if (!day.district) {
        day.district = chunk.find((item) => item.district)?.district || group.district
      }
    }
  }

  const notices: string[] = []
  const nonEmptyDays = dayBuckets.filter((day) => day.points.length > 0)

  if (nonEmptyDays.length === 0) {
    return {
      days: [],
      unplanned,
      notices: ["未能生成有效日程，请调整筛选条件后重试"],
      usedDayCount: 0,
    }
  }

  if (unplanned.length > 0) {
    notices.push(
      `你选了 ${spots.length} 个地点，当前天数与节奏下仅合理安排 ${spots.length - unplanned.length} 个，其余建议顺延。`
    )
  }

  const outputDays: PlannerEngineDay[] = nonEmptyDays.map((day, index) => {
    const orderedPoints = orderPoints(day.points)
    const districts = Array.from(
      new Set(orderedPoints.map((item) => item.district).filter(Boolean))
    )
    const districtSummary =
      districts.length > 0 ? `${districts.slice(0, 2).join(" / ")}片区` : "城市核心片区"

    const hasRemote = orderedPoints.some((item) => item.isRemote)
    const dayWarnings = [...day.warnings]
    if (hasRemote && orderedPoints.length > 3) {
      dayWarnings.push("当日包含远距离点位，建议尽量早出发")
    }

    return {
      day: index + 1,
      title: `第${index + 1}天`,
      theme: DAY_THEMES[index % DAY_THEMES.length],
      districtSummary,
      spots: orderedPoints.map((item) => item.spot),
      warnings: dayWarnings,
    }
  })

  if (outputDays.length < targetDayCount) {
    notices.push(
      `已根据你选择的地点自动压缩为 ${outputDays.length} 天，避免出现跨区反复折返。`
    )
  }

  return {
    days: outputDays,
    unplanned,
    notices,
    usedDayCount: outputDays.length,
  }
}
