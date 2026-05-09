import "server-only"

import { analyzeAmapError } from "@/lib/amap-error-utils"
import type { RouteLegResult, RouteTransportMode, TransitStep } from "@/lib/amap-route-utils"
import { normalizeTransitCity } from "@/lib/amap-route-utils"
import type { LngLatTuple } from "@/lib/amap-types"

interface AmapWebServiceBaseResponse {
  status?: string
  info?: string
  infocode?: string
}

interface AmapDrivingWalkingStep {
  polyline?: string
}

interface AmapDrivingWalkingPath {
  distance?: string
  duration?: string
  steps?: AmapDrivingWalkingStep[]
}

interface AmapDrivingResponse extends AmapWebServiceBaseResponse {
  route?: { paths?: AmapDrivingWalkingPath[] }
}

interface AmapWalkingResponse extends AmapWebServiceBaseResponse {
  route?: { paths?: AmapDrivingWalkingPath[] }
}

interface AmapTransitResponse extends AmapWebServiceBaseResponse {
  route?: {
    transits?: Array<{
      distance?: string
      duration?: string
      segments?: Array<Record<string, unknown>>
    }>
  }
}

type AmapTransitPlan = NonNullable<
  NonNullable<AmapTransitResponse["route"]>["transits"]
>[number]

interface RouteLegRequest {
  origin: LngLatTuple
  destination: LngLatTuple
  fromName: string
  toName: string
  city?: string
  cityd?: string
  waypoints?: LngLatTuple[]
}

export interface AmapWebRouteResponse {
  leg: RouteLegResult
  upstreamInfo?: string
}

const AMAP_REST_BASE = "https://restapi.amap.com"
const WALKING_MAX_DISTANCE_METERS = 100_000
const REQUEST_TIMEOUT_MS = 12_000
const CACHE_TTL_MS = 3 * 60 * 1000

const ROUTE_CACHE = new Map<string, { expireAt: number; value: AmapWebRouteResponse }>()

function buildCacheKey(mode: RouteTransportMode, request: RouteLegRequest) {
  return `${mode}:${JSON.stringify(request)}`
}

function getCache(mode: RouteTransportMode, request: RouteLegRequest) {
  const key = buildCacheKey(mode, request)
  const cached = ROUTE_CACHE.get(key)
  if (!cached) return null
  if (Date.now() > cached.expireAt) {
    ROUTE_CACHE.delete(key)
    return null
  }
  return cached.value
}

function setCache(mode: RouteTransportMode, request: RouteLegRequest, value: AmapWebRouteResponse) {
  const key = buildCacheKey(mode, request)
  ROUTE_CACHE.set(key, {
    expireAt: Date.now() + CACHE_TTL_MS,
    value,
  })
}

function formatDistance(distanceInMeter: number) {
  if (!Number.isFinite(distanceInMeter) || distanceInMeter <= 0) return "0 米"
  if (distanceInMeter < 1000) return `${Math.round(distanceInMeter)} 米`
  return `${(distanceInMeter / 1000).toFixed(1)} 公里`
}

function formatDuration(durationInSecond: number) {
  if (!Number.isFinite(durationInSecond) || durationInSecond <= 0) return "0 分钟"
  const hours = Math.floor(durationInSecond / 3600)
  const minutes = Math.max(1, Math.round((durationInSecond % 3600) / 60))
  if (hours <= 0) return `${minutes} 分钟`
  return `${hours} 小时 ${minutes} 分钟`
}

function parseNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function parseText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function parseStopName(value: unknown) {
  const record = parseRecord(value)
  if (record) {
    const name = parseText(record.name)
    if (name) return name
  }
  return parseText(value)
}

function normalizeLineName(name: string) {
  return name.replace(/\s+/g, " ").trim()
}

function isSubwayLine(name: string, lineType: string) {
  const sample = `${name} ${lineType}`.toLowerCase()
  return /地铁|轨道|轻轨|tram|subway|metro/.test(sample)
}

function getWebServiceKey() {
  return process.env.AMAP_WEB_SERVICE_KEY?.trim() || ""
}

function toCoordText(value: LngLatTuple) {
  return `${value[0]},${value[1]}`
}

function parsePolyline(polyline: string): LngLatTuple[] {
  if (!polyline.trim()) return []
  const points: LngLatTuple[] = []
  const chunks = polyline.split(";")
  for (const chunk of chunks) {
    const [lngText, latText] = chunk.split(",")
    const lng = Number(lngText)
    const lat = Number(latText)
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      points.push([lng, lat])
    }
  }
  return points
}

function dedupePath(path: LngLatTuple[]) {
  if (path.length <= 1) return path
  const deduped: LngLatTuple[] = [path[0]]
  for (let i = 1; i < path.length; i += 1) {
    const prev = deduped[deduped.length - 1]
    const current = path[i]
    if (prev[0] === current[0] && prev[1] === current[1]) continue
    deduped.push(current)
  }
  return deduped
}

function collectTransitPolylines(value: unknown, output: Array<LngLatTuple[]>) {
  if (!value) return
  if (typeof value === "string") {
    const path = dedupePath(parsePolyline(value))
    if (path.length >= 2) output.push(path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTransitPolylines(item, output))
    return
  }
  if (typeof value !== "object") return
  const record = value as Record<string, unknown>
  for (const [key, nested] of Object.entries(record)) {
    if (key.toLowerCase() === "polyline" && typeof nested === "string") {
      const path = dedupePath(parsePolyline(nested))
      if (path.length >= 2) output.push(path)
      continue
    }
    collectTransitPolylines(nested, output)
  }
}

function buildBaseLeg(
  mode: RouteTransportMode,
  request: RouteLegRequest
): Omit<RouteLegResult, "status" | "distanceMeters" | "durationSeconds" | "readableDistance" | "readableDuration"> {
  return {
    mode,
    fromName: request.fromName,
    toName: request.toName,
  }
}

function createFailedLeg(mode: RouteTransportMode, request: RouteLegRequest, message: string): RouteLegResult {
  return {
    ...buildBaseLeg(mode, request),
    status: "failed",
    distanceMeters: 0,
    durationSeconds: 0,
    readableDistance: "--",
    readableDuration: "--",
    message,
  }
}

function getDrivingWalkingPolylinePaths(path?: AmapDrivingWalkingPath): Array<LngLatTuple[]> {
  if (!path) return []
  const merged = (path.steps ?? []).flatMap((step) => parsePolyline(step.polyline || ""))
  const deduped = dedupePath(merged)
  if (deduped.length >= 2) return [deduped]
  return []
}

function parseTransitDetails(transit?: AmapTransitPlan) {
  const segments = Array.isArray(transit?.segments) ? transit.segments : []
  const lineSummary: string[] = []
  const steps: TransitStep[] = []

  for (const segment of segments) {
    const record = parseRecord(segment)
    if (!record) continue

    const walking = parseRecord(record.walking)
    if (walking) {
      const distance = parseNumber(walking.distance)
      const duration = parseNumber(walking.duration)
      const walkSteps = Array.isArray(walking.steps)
        ? (walking.steps as Array<Record<string, unknown>>)
        : []
      const instruction = parseText(walkSteps[0]?.instruction) || `步行 ${formatDistance(distance)} 到下一站`
      steps.push({
        type: "walk",
        instruction,
        distanceMeters: distance > 0 ? distance : undefined,
        durationSeconds: duration > 0 ? duration : undefined,
      })
    }

    const bus = parseRecord(record.bus)
    const buslines = Array.isArray(bus?.buslines) ? (bus?.buslines as Array<Record<string, unknown>>) : []
    for (const busline of buslines) {
      const rawName = normalizeLineName(parseText(busline.name))
      if (!rawName) continue
      const lineType = parseText(busline.type)
      const departureStop = parseStopName(busline.departure_stop)
      const arrivalStop = parseStopName(busline.arrival_stop)
      const stopCount = parseNumber(busline.via_num)
      const lineDuration = parseNumber(busline.duration)
      const lineDistance = parseNumber(busline.distance)
      const compactName = rawName.replace(/\s*\(.+\)\s*$/, "")

      if (lineSummary.length > 0) {
        steps.push({
          type: "transfer",
          instruction: departureStop
            ? `在 ${departureStop} 换乘 ${compactName}`
            : `换乘 ${compactName}`,
          lineName: compactName,
          departureStop: departureStop || undefined,
        })
      }

      lineSummary.push(compactName)
      steps.push({
        type: isSubwayLine(rawName, lineType) ? "subway" : "bus",
        instruction:
          `乘坐 ${compactName}` +
          (departureStop ? `，从 ${departureStop} 上车` : "") +
          (arrivalStop ? `，到 ${arrivalStop} 下车` : "") +
          (stopCount > 0 ? `，约 ${stopCount} 站` : ""),
        lineName: compactName,
        departureStop: departureStop || undefined,
        arrivalStop: arrivalStop || undefined,
        stopCount: stopCount > 0 ? stopCount : undefined,
        durationSeconds: lineDuration > 0 ? lineDuration : undefined,
        distanceMeters: lineDistance > 0 ? lineDistance : undefined,
      })
    }
  }

  const uniqueSummary = Array.from(new Set(lineSummary.filter((item) => item.trim().length > 0)))
  const transferCount = uniqueSummary.length > 1 ? uniqueSummary.length - 1 : 0
  return {
    transitLineSummary: uniqueSummary,
    transitTransferCount: transferCount,
    transitSteps: steps,
  }
}

async function requestAmap<T extends AmapWebServiceBaseResponse>(path: string, params: URLSearchParams) {
  const key = getWebServiceKey()
  if (!key) {
    return null
  }
  params.set("key", key)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${AMAP_REST_BASE}${path}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return null
    const data = (await response.json()) as T
    return data
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function noServiceKeyResponse(mode: RouteTransportMode, request: RouteLegRequest): AmapWebRouteResponse {
  const modeText = mode === "walking" ? "步行" : mode === "transit" ? "公交" : "驾车"
  return {
    leg: createFailedLeg(mode, request, `未配置 AMAP_WEB_SERVICE_KEY，${modeText}路线暂不可用`),
  }
}

export async function planDrivingByWebService(request: RouteLegRequest): Promise<AmapWebRouteResponse> {
  const cached = getCache("driving", request)
  if (cached) return cached
  if (!getWebServiceKey()) return noServiceKeyResponse("driving", request)

  const params = new URLSearchParams({
    origin: toCoordText(request.origin),
    destination: toCoordText(request.destination),
    strategy: "0",
    extensions: "base",
  })
  if (request.waypoints?.length) {
    params.set("waypoints", request.waypoints.map((item) => toCoordText(item)).join("|"))
  }

  const payload = await requestAmap<AmapDrivingResponse>("/v3/direction/driving", params)
  if (!payload || payload.status !== "1") {
    const analysis = analyzeAmapError(
      `${payload?.info || ""} ${payload?.infocode || ""}`.trim(),
      "高德驾车路线规划失败"
    )
    return { leg: createFailedLeg("driving", request, analysis.userMessage), upstreamInfo: payload?.info }
  }

  const path = payload.route?.paths?.[0]
  const distanceMeters = parseNumber(path?.distance)
  const durationSeconds = parseNumber(path?.duration)
  if (distanceMeters <= 0 || durationSeconds <= 0) {
    return { leg: createFailedLeg("driving", request, "驾车路线结果为空"), upstreamInfo: payload.info }
  }
  const polylinePaths = getDrivingWalkingPolylinePaths(path)
  const result: AmapWebRouteResponse = {
    leg: {
      ...buildBaseLeg("driving", request),
      status: "success",
      distanceMeters,
      durationSeconds,
      readableDistance: formatDistance(distanceMeters),
      readableDuration: formatDuration(durationSeconds),
      polylinePaths: polylinePaths.length > 0 ? polylinePaths : [[request.origin, request.destination]],
    },
    upstreamInfo: payload.info,
  }
  setCache("driving", request, result)
  return result
}

function haversineDistanceMeters(from: LngLatTuple, to: LngLatTuple) {
  const [lng1, lat1] = from
  const [lng2, lat2] = to
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const lat1Rad = toRad(lat1)
  const lat2Rad = toRad(lat2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.max(0, 6371000 * c)
}

export async function planWalkingByWebService(request: RouteLegRequest): Promise<AmapWebRouteResponse> {
  const cached = getCache("walking", request)
  if (cached) return cached
  if (!getWebServiceKey()) return noServiceKeyResponse("walking", request)

  const directDistance = haversineDistanceMeters(request.origin, request.destination)
  if (directDistance > WALKING_MAX_DISTANCE_METERS) {
    return {
      leg: createFailedLeg("walking", request, "该路段直线距离超过 100 公里，超出步行规划范围"),
    }
  }

  const params = new URLSearchParams({
    origin: toCoordText(request.origin),
    destination: toCoordText(request.destination),
  })
  const payload = await requestAmap<AmapWalkingResponse>("/v3/direction/walking", params)
  if (!payload || payload.status !== "1") {
    const analysis = analyzeAmapError(
      `${payload?.info || ""} ${payload?.infocode || ""}`.trim(),
      "高德步行路线规划失败"
    )
    return { leg: createFailedLeg("walking", request, analysis.userMessage), upstreamInfo: payload?.info }
  }

  const path = payload.route?.paths?.[0]
  const distanceMeters = parseNumber(path?.distance)
  const durationSeconds = parseNumber(path?.duration)
  if (distanceMeters <= 0 || durationSeconds <= 0) {
    return { leg: createFailedLeg("walking", request, "步行路线结果为空"), upstreamInfo: payload.info }
  }
  const polylinePaths = getDrivingWalkingPolylinePaths(path)
  const result: AmapWebRouteResponse = {
    leg: {
      ...buildBaseLeg("walking", request),
      status: "success",
      distanceMeters,
      durationSeconds,
      readableDistance: formatDistance(distanceMeters),
      readableDuration: formatDuration(durationSeconds),
      polylinePaths: polylinePaths.length > 0 ? polylinePaths : [[request.origin, request.destination]],
    },
    upstreamInfo: payload.info,
  }
  setCache("walking", request, result)
  return result
}

export async function planTransitByWebService(request: RouteLegRequest): Promise<AmapWebRouteResponse> {
  const cached = getCache("transit", request)
  if (cached) return cached
  if (!getWebServiceKey()) return noServiceKeyResponse("transit", request)

  const city = normalizeTransitCity(request.city)
  const cityd = request.cityd ? normalizeTransitCity(request.cityd) : undefined
  const params = new URLSearchParams({
    origin: toCoordText(request.origin),
    destination: toCoordText(request.destination),
    city,
    extensions: "all",
  })
  if (cityd) {
    params.set("cityd", cityd)
  }

  const payload = await requestAmap<AmapTransitResponse>("/v3/direction/transit/integrated", params)
  if (!payload || payload.status !== "1") {
    const analysis = analyzeAmapError(
      `${payload?.info || ""} ${payload?.infocode || ""}`.trim(),
      "高德公交路线规划失败"
    )
    return { leg: createFailedLeg("transit", request, analysis.userMessage), upstreamInfo: payload?.info }
  }

  const transit = payload.route?.transits?.[0]
  const distanceMeters = parseNumber(transit?.distance)
  const durationSeconds = parseNumber(transit?.duration)
  if (distanceMeters <= 0 || durationSeconds <= 0) {
    return { leg: createFailedLeg("transit", request, "当前路段暂无可用公交换乘方案"), upstreamInfo: payload.info }
  }

  const polylinePaths: Array<LngLatTuple[]> = []
  collectTransitPolylines(transit, polylinePaths)
  const transitDetails = parseTransitDetails(transit)

  const result: AmapWebRouteResponse = {
    leg: {
      ...buildBaseLeg("transit", request),
      status: "success",
      distanceMeters,
      durationSeconds,
      readableDistance: formatDistance(distanceMeters),
      readableDuration: formatDuration(durationSeconds),
      polylinePaths: polylinePaths.length > 0 ? polylinePaths : [[request.origin, request.destination]],
      transitLineSummary: transitDetails.transitLineSummary,
      transitTransferCount: transitDetails.transitTransferCount,
      transitSteps: transitDetails.transitSteps,
    },
    upstreamInfo: payload.info,
  }
  setCache("transit", request, result)
  return result
}

