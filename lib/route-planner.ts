import { loadAMap } from "@/lib/amap-loader"
import { analyzeAmapError } from "@/lib/amap-error-utils"
import {
  formatDistance,
  formatDuration,
  getSpotLngLat,
  resolveSpotCoordinates,
} from "@/lib/amap-spot-utils"
import type {
  AMapDrivingInstance,
  AMapNamespace,
  AMapRouteResult,
  AMapWalkingInstance,
  LngLatTuple,
} from "@/lib/amap-types"
import type {
  ItineraryDay,
  PlanGenerationStatus,
  RouteTransportMode,
  Spot,
  TravelLeg,
} from "@/lib/travel-context"
import {
  estimatePlayMinutes,
  formatClock,
  formatStayDuration,
  getDayTheme,
  getDefaultDayStartMinutes,
  resolveDayCount,
  splitSpotsByDay,
} from "@/lib/itinerary-utils"

interface BuildItineraryInput {
  spots: Spot[]
  startDate: string
  endDate: string
  pace: string
  departure: string
  transportMode?: RouteTransportMode
}

export interface BuildItineraryOutput {
  days: ItineraryDay[]
  totalDays: number
  totalSpots: number
  totalDistanceMeters: number
  totalTravelSeconds: number
  totalPlayMinutes: number
  totalEstimatedCost: number
  status: PlanGenerationStatus
  notices: string[]
}

interface RouteContext {
  AMap: AMapNamespace | null
  driving: AMapDrivingInstance | null
  walking: AMapWalkingInstance | null
  notices: string[]
}

interface CalculatedLeg {
  distanceMeters: number
  durationSeconds: number
  isEstimated: boolean
  estimateReason?: string
}

interface AmapDrivingRestResponse {
  status?: string
  info?: string
  infocode?: string
  route?: {
    paths?: Array<{
      distance?: string
      duration?: string
    }>
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getDistanceByHaversine(from: LngLatTuple, to: LngLatTuple) {
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
  return Math.max(300, Math.round(earthRadius * c))
}

function estimateDurationByMode(
  distanceMeters: number,
  mode: RouteTransportMode
) {
  const speedMeterPerSecond =
    mode === "walking" ? 1.35 : mode === "transit" ? 6.5 : 11.5
  const base = Math.round(distanceMeters / speedMeterPerSecond)
  return Math.max(5 * 60, base)
}

async function requestDrivingByRestApi(start: LngLatTuple, end: LngLatTuple) {
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY?.trim()
  if (!amapKey) {
    throw new Error("未配置有效的高德地图 Key")
  }

  const query = new URLSearchParams({
    key: amapKey,
    origin: `${start[0]},${start[1]}`,
    destination: `${end[0]},${end[1]}`,
    strategy: "0",
    extensions: "base",
  })

  const response = await fetch(
    `https://restapi.amap.com/v3/direction/driving?${query.toString()}`
  )
  if (!response.ok) {
    throw new Error("高德网络路线服务请求失败")
  }

  const payload = (await response.json()) as AmapDrivingRestResponse
  if (payload.status !== "1" || !payload.route?.paths?.length) {
    const analysis = analyzeAmapError(
      `${payload.info || ""} ${payload.infocode || ""}`,
      payload.info || "高德驾车路线规划失败"
    )
    throw new Error(analysis.userMessage)
  }

  const path = payload.route.paths[0]
  return {
    distanceMeters: toNumber(path.distance),
    durationSeconds: toNumber(path.duration),
  }
}

async function prepareRouteContext(): Promise<RouteContext> {
  try {
    const AMap = await loadAMap(["AMap.Driving", "AMap.Walking", "AMap.Geocoder", "AMap.PlaceSearch"])
    return {
      AMap,
      driving: new AMap.Driving({
        hideMarkers: true,
        policy: AMap.DrivingPolicy.LEAST_TIME,
      }),
      walking: new AMap.Walking({ hideMarkers: true }),
      notices: [],
    }
  } catch (error) {
    const analysis = analyzeAmapError(error, "高德路线服务暂不可用，将改为预估通勤时间")
    return {
      AMap: null,
      driving: null,
      walking: null,
      notices: [analysis.userMessage],
    }
  }
}

async function runDrivingRoute(
  context: RouteContext,
  from: LngLatTuple,
  to: LngLatTuple
) {
  if (!context.driving) {
    throw new Error("高德驾车服务不可用")
  }

  const pluginResult = await new Promise<{ distanceMeters: number; durationSeconds: number }>(
    (resolve, reject) => {
      context.driving?.search(from, to, (status: string, result: AMapRouteResult) => {
        if (status === "complete" && result.routes?.length) {
          const route = result.routes[0]
          resolve({
            distanceMeters: toNumber(route.distance),
            durationSeconds: toNumber(route.time ?? route.duration),
          })
          return
        }
        const analysis = analyzeAmapError(
          `${status} ${result?.info || ""} ${result?.message || ""} ${result?.infocode || ""}`,
          "高德驾车路线规划失败"
        )
        reject(new Error(analysis.userMessage))
      })
    }
  )

  if (pluginResult.distanceMeters > 0 && pluginResult.durationSeconds > 0) {
    return pluginResult
  }

  return requestDrivingByRestApi(from, to)
}

async function runWalkingRoute(
  context: RouteContext,
  from: LngLatTuple,
  to: LngLatTuple
) {
  if (!context.walking) {
    throw new Error("高德步行服务不可用")
  }

  return new Promise<{ distanceMeters: number; durationSeconds: number }>((resolve, reject) => {
    context.walking?.search(from, to, (status: string, result: AMapRouteResult) => {
      if (status === "complete" && result.routes?.length) {
        const route = result.routes[0]
        resolve({
          distanceMeters: toNumber(route.distance),
          durationSeconds: toNumber(route.time ?? route.duration),
        })
        return
      }
      const analysis = analyzeAmapError(
        `${status} ${result?.info || ""} ${result?.message || ""} ${result?.infocode || ""}`,
        "高德步行路线规划失败"
      )
      reject(new Error(analysis.userMessage))
    })
  })
}

async function resolveTextLocation(
  AMap: AMapNamespace,
  text: string,
  cityHint?: string
): Promise<LngLatTuple | null> {
  const keyword = text.trim()
  if (!keyword) return null

  const geocodeResult = await new Promise<LngLatTuple | null>((resolve) => {
    const geocoder = new AMap.Geocoder({ city: cityHint })
    geocoder.getLocation(keyword, (status, result) => {
      if (status !== "complete" || !result.geocodes?.length) {
        resolve(null)
        return
      }
      const location = result.geocodes[0]?.location
      const lng = Number(location?.lng ?? location?.getLng?.())
      const lat = Number(location?.lat ?? location?.getLat?.())
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        resolve([lng, lat])
        return
      }
      resolve(null)
    })
  })
  if (geocodeResult) return geocodeResult

  const searchResult = await new Promise<LngLatTuple | null>((resolve) => {
    const placeSearch = new AMap.PlaceSearch({
      city: cityHint,
      citylimit: false,
      pageSize: 1,
      pageIndex: 1,
    })
    placeSearch.search(keyword, (status, result) => {
      if (status !== "complete") {
        resolve(null)
        return
      }
      const location = result.poiList?.pois?.[0]?.location
      const lng = Number(location?.lng ?? location?.getLng?.())
      const lat = Number(location?.lat ?? location?.getLat?.())
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        resolve([lng, lat])
        return
      }
      resolve(null)
    })
  })

  return searchResult
}

async function calculateLeg(
  context: RouteContext,
  fromName: string,
  toName: string,
  fromLngLat: LngLatTuple | null,
  toLngLat: LngLatTuple | null,
  mode: RouteTransportMode
): Promise<CalculatedLeg> {
  if (!fromLngLat || !toLngLat) {
    const guessedDistance = 6000
    return {
      distanceMeters: guessedDistance,
      durationSeconds: estimateDurationByMode(guessedDistance, mode),
      isEstimated: true,
      estimateReason: "起点或终点缺少坐标，已按城市通勤经验预估",
    }
  }

  try {
    if (mode === "walking") {
      const walking = await runWalkingRoute(context, fromLngLat, toLngLat)
      return {
        distanceMeters: walking.distanceMeters,
        durationSeconds: walking.durationSeconds,
        isEstimated: false,
      }
    }

    if (mode === "transit") {
      const estimatedDistance = getDistanceByHaversine(fromLngLat, toLngLat)
      return {
        distanceMeters: estimatedDistance,
        durationSeconds: estimateDurationByMode(estimatedDistance, mode),
        isEstimated: true,
        estimateReason: "当前版本公交在 AI 日程中暂采用预估时长",
      }
    }

    const driving = await runDrivingRoute(context, fromLngLat, toLngLat)
    return {
      distanceMeters: driving.distanceMeters,
      durationSeconds: driving.durationSeconds,
      isEstimated: false,
    }
  } catch (error) {
    const analysis = analyzeAmapError(error, "路线规划失败，已自动降级为预估")
    const estimatedDistance = getDistanceByHaversine(fromLngLat, toLngLat)
    return {
      distanceMeters: estimatedDistance,
      durationSeconds: estimateDurationByMode(estimatedDistance, mode),
      isEstimated: true,
      estimateReason: analysis.userMessage,
    }
  }
}

function buildBasicDays(spots: Spot[], pace: string, departure: string) {
  const dayCount = resolveDayCount("", "", spots.length, pace)
  const chunks = splitSpotsByDay(spots, dayCount)
  return chunks.map((daySpots, index) => {
    const startMinutes = getDefaultDayStartMinutes(pace, index)
    let cursor = startMinutes
    const normalizedSpots = daySpots.map((spot) => {
      const stay = estimatePlayMinutes(spot, pace)
      const arrivalTime = formatClock(cursor)
      cursor += stay
      const leaveTime = formatClock(cursor)
      return {
        ...spot,
        arrivalTime,
        leaveTime,
        suggestedDurationMinutes: stay,
        suggestedDurationText: formatStayDuration(stay),
      }
    })
    const totalPlayMinutes = normalizedSpots.reduce(
      (sum, spot) => sum + (spot.suggestedDurationMinutes || 0),
      0
    )
    return {
      day: index + 1,
      title: `第${index + 1}天`,
      theme: getDayTheme(index + 1),
      startTime: formatClock(startMinutes),
      endTime: formatClock(startMinutes + totalPlayMinutes),
      spots: normalizedSpots,
      routeLegs: [],
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes,
      totalEstimatedCost: daySpots.reduce((sum, spot) => sum + spot.ticketPrice, 0),
      startsFromDeparture: Boolean(departure.trim()),
      returnsToDeparture: Boolean(departure.trim()),
      departureName: departure.trim() || undefined,
    } as ItineraryDay
  })
}

export async function buildAiItinerary({
  spots,
  startDate,
  endDate,
  pace,
  departure,
  transportMode = "driving",
}: BuildItineraryInput): Promise<BuildItineraryOutput> {
  if (spots.length === 0) {
    return {
      days: [],
      totalDays: 0,
      totalSpots: 0,
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes: 0,
      totalEstimatedCost: 0,
      status: "error",
      notices: ["没有可规划的景点，请先添加景点后再试"],
    }
  }

  try {
    const context = await prepareRouteContext()
    const dayCount = resolveDayCount(startDate, endDate, spots.length, pace)
    const dayChunks = splitSpotsByDay(spots, dayCount)
    const notices = [...context.notices]

    const coordinateMap = new Map<string, LngLatTuple | null>()
    if (context.AMap) {
      const resolvedResult = await resolveSpotCoordinates(context.AMap, spots)
      for (const resolved of resolvedResult.resolved) {
        coordinateMap.set(resolved.spot.id, resolved.lngLat)
      }
      for (const unresolved of resolvedResult.unresolved) {
        coordinateMap.set(unresolved.spot.id, null)
      }
      if (resolvedResult.unresolved.length > 0) {
        notices.push("部分景点未获取到精确坐标，相关路段已自动预估")
      }
    } else {
      for (const spot of spots) {
        coordinateMap.set(spot.id, getSpotLngLat(spot))
      }
    }

    const cityHint = spots.find((spot) => spot.city)?.city
    let departureCoordinate: LngLatTuple | null = null
    const departureName = departure.trim()
    if (departureName && context.AMap) {
      departureCoordinate = await resolveTextLocation(context.AMap, departureName, cityHint)
      if (!departureCoordinate) {
        notices.push("未能解析出发地坐标，出发与返程路段已按预估处理")
      }
    }

    const days: ItineraryDay[] = []
    let estimatedLegCount = 0
    let totalLegCount = 0

    for (let dayIndex = 0; dayIndex < dayChunks.length; dayIndex += 1) {
      const daySpots = dayChunks[dayIndex]
      const dayStartMinutes = getDefaultDayStartMinutes(pace, dayIndex)
      let cursorMinutes = dayStartMinutes
      const startsFromDeparture = Boolean(departureName)
      const returnsToDeparture = Boolean(departureName)

      const enrichedSpots: Spot[] = []
      const routeLegs: TravelLeg[] = []

      if (startsFromDeparture && daySpots.length > 0) {
        const firstSpot = daySpots[0]
        const firstLeg = await calculateLeg(
          context,
          departureName,
          firstSpot.name,
          departureCoordinate,
          coordinateMap.get(firstSpot.id) ?? null,
          transportMode
        )
        const startTime = formatClock(cursorMinutes)
        cursorMinutes += Math.max(1, Math.round(firstLeg.durationSeconds / 60))
        const arrivalTime = formatClock(cursorMinutes)
        routeLegs.push({
          id: `d${dayIndex + 1}-start`,
          fromName: departureName,
          toName: firstSpot.name,
          transportMode,
          distanceMeters: firstLeg.distanceMeters,
          durationSeconds: firstLeg.durationSeconds,
          startTime,
          arrivalTime,
          readableDistance: formatDistance(firstLeg.distanceMeters),
          readableDuration: formatDuration(firstLeg.durationSeconds),
          isEstimated: firstLeg.isEstimated,
          estimateReason: firstLeg.estimateReason,
        })
      }

      for (let index = 0; index < daySpots.length; index += 1) {
        const currentSpot = daySpots[index]
        const suggestedDurationMinutes = estimatePlayMinutes(currentSpot, pace)
        const arrivalTime = formatClock(cursorMinutes)
        cursorMinutes += suggestedDurationMinutes
        const leaveTime = formatClock(cursorMinutes)
        enrichedSpots.push({
          ...currentSpot,
          arrivalTime,
          leaveTime,
          suggestedDurationMinutes,
          suggestedDurationText: formatStayDuration(suggestedDurationMinutes),
        })

        const hasNextSpot = index < daySpots.length - 1
        if (hasNextSpot) {
          const nextSpot = daySpots[index + 1]
          const legResult = await calculateLeg(
            context,
            currentSpot.name,
            nextSpot.name,
            coordinateMap.get(currentSpot.id) ?? null,
            coordinateMap.get(nextSpot.id) ?? null,
            transportMode
          )
          const startTime = formatClock(cursorMinutes)
          cursorMinutes += Math.max(1, Math.round(legResult.durationSeconds / 60))
          const arrivalTimeForLeg = formatClock(cursorMinutes)
          routeLegs.push({
            id: `d${dayIndex + 1}-${currentSpot.id}-${nextSpot.id}`,
            fromName: currentSpot.name,
            toName: nextSpot.name,
            transportMode,
            distanceMeters: legResult.distanceMeters,
            durationSeconds: legResult.durationSeconds,
            startTime,
            arrivalTime: arrivalTimeForLeg,
            readableDistance: formatDistance(legResult.distanceMeters),
            readableDuration: formatDuration(legResult.durationSeconds),
            isEstimated: legResult.isEstimated,
            estimateReason: legResult.estimateReason,
          })
        }
      }

      if (returnsToDeparture && daySpots.length > 0) {
        const lastSpot = daySpots[daySpots.length - 1]
        const returnLeg = await calculateLeg(
          context,
          lastSpot.name,
          departureName,
          coordinateMap.get(lastSpot.id) ?? null,
          departureCoordinate,
          transportMode
        )
        const startTime = formatClock(cursorMinutes)
        cursorMinutes += Math.max(1, Math.round(returnLeg.durationSeconds / 60))
        const arrivalTime = formatClock(cursorMinutes)
        routeLegs.push({
          id: `d${dayIndex + 1}-end`,
          fromName: lastSpot.name,
          toName: departureName,
          transportMode,
          distanceMeters: returnLeg.distanceMeters,
          durationSeconds: returnLeg.durationSeconds,
          startTime,
          arrivalTime,
          readableDistance: formatDistance(returnLeg.distanceMeters),
          readableDuration: formatDuration(returnLeg.durationSeconds),
          isEstimated: returnLeg.isEstimated,
          estimateReason: returnLeg.estimateReason,
        })
      }

      totalLegCount += routeLegs.length
      estimatedLegCount += routeLegs.filter((leg) => leg.isEstimated).length

      const totalDistanceMeters = routeLegs.reduce(
        (sum, leg) => sum + leg.distanceMeters,
        0
      )
      const totalTravelSeconds = routeLegs.reduce(
        (sum, leg) => sum + leg.durationSeconds,
        0
      )
      const totalPlayMinutes = enrichedSpots.reduce(
        (sum, spot) => sum + (spot.suggestedDurationMinutes || 0),
        0
      )
      const totalEstimatedCost = enrichedSpots.reduce(
        (sum, spot) => sum + spot.ticketPrice,
        0
      )

      days.push({
        day: dayIndex + 1,
        title: `第${dayIndex + 1}天`,
        theme: getDayTheme(dayIndex + 1),
        startTime: routeLegs[0]?.startTime || formatClock(dayStartMinutes),
        endTime:
          routeLegs[routeLegs.length - 1]?.arrivalTime ||
          enrichedSpots[enrichedSpots.length - 1]?.leaveTime ||
          formatClock(dayStartMinutes),
        spots: enrichedSpots,
        routeLegs,
        totalDistanceMeters,
        totalTravelSeconds,
        totalPlayMinutes,
        totalEstimatedCost,
        startsFromDeparture,
        returnsToDeparture,
        departureName: departureName || undefined,
      })
    }

    const totalDistanceMeters = days.reduce(
      (sum, day) => sum + day.totalDistanceMeters,
      0
    )
    const totalTravelSeconds = days.reduce(
      (sum, day) => sum + day.totalTravelSeconds,
      0
    )
    const totalPlayMinutes = days.reduce((sum, day) => sum + day.totalPlayMinutes, 0)
    const totalEstimatedCost = days.reduce(
      (sum, day) => sum + day.totalEstimatedCost,
      0
    )

    const status: PlanGenerationStatus =
      estimatedLegCount > 0 || notices.length > 0 ? "partial" : "success"

    return {
      days,
      totalDays: days.length,
      totalSpots: spots.length,
      totalDistanceMeters,
      totalTravelSeconds,
      totalPlayMinutes,
      totalEstimatedCost,
      status,
      notices: Array.from(new Set(notices)),
    }
  } catch (error) {
    const basicDays = buildBasicDays(spots, pace, departure)
    const analysis = analyzeAmapError(error, "路线生成失败，已降级为基础时间安排")
    return {
      days: basicDays,
      totalDays: basicDays.length,
      totalSpots: spots.length,
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes: basicDays.reduce((sum, day) => sum + day.totalPlayMinutes, 0),
      totalEstimatedCost: basicDays.reduce((sum, day) => sum + day.totalEstimatedCost, 0),
      status: "error",
      notices: [analysis.userMessage],
    }
  }
}
