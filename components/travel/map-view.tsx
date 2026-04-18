"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, LocateFixed, MapPin } from "lucide-react"
import { Spot } from "@/lib/travel-context"
import { loadAMap } from "@/lib/amap-loader"
import {
  formatDistance,
  formatDuration,
  getSpotLngLat,
  resolveSpotCoordinates,
} from "@/lib/amap-spot-utils"
import { analyzeAmapError } from "@/lib/amap-error-utils"
import { buildAmapRouteUrl } from "@/lib/open-map-route"
import type {
  AMapDrivingInstance,
  AMapMapInstance,
  AMapMarkerInstance,
  AMapNamespace,
  AMapPolylineInstance,
  AMapRoute,
  AMapRouteResult,
  AMapTransferInstance,
  AMapTransferResult,
  AMapWalkingInstance,
  LngLatTuple,
} from "@/lib/amap-types"
import type { NavigationMode } from "@/lib/navigation"

export type TransportMode = NavigationMode
export type RouteMode = "trip" | "fromMe"
export type RouteSummaryStatus =
  | "idle"
  | "loading"
  | "empty"
  | "single"
  | "success"
  | "partial-error"
  | "route-error"
  | "map-error"
  | "transit-degraded"

export interface RouteSummaryInfo {
  mode: TransportMode
  status: RouteSummaryStatus
  distance: number
  duration: number
  distanceText: string
  durationText: string
  startName: string
  endName: string
  waypointCount: number
  resolvedCount: number
  message: string
  partialErrors: string[]
  fallbackRouteUrl?: string
}

interface MapViewProps {
  spots: Spot[]
  transportMode: TransportMode
  routeMode: RouteMode
  fromMeTarget?: Spot | null
  fromMeOrigin?: LngLatTuple | null
  fromMeRequestId?: string
  onSummaryChange?: (summary: RouteSummaryInfo) => void
}

const CENTER_BEIJING: LngLatTuple = [116.397428, 39.90923]
const DEFAULT_DISTANCE_TEXT = "--"
const DEFAULT_DURATION_TEXT = "--"

const MARKER_COLORS = {
  start: "#2D8C59",
  end: "#EF4444",
  waypoint: "#2D5A47",
}

type UserLocationStatus =
  | "idle"
  | "locating"
  | "active"
  | "approximate"
  | "denied"
  | "unsupported"
  | "error"

function getAMapErrorMessage(errorEvent: unknown) {
  if (!errorEvent || typeof errorEvent !== "object") return ""
  const eventRecord = errorEvent as Record<string, unknown>
  const candidates = [
    eventRecord.info,
    eventRecord.message,
    eventRecord.error,
    eventRecord.errmsg,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }
  return ""
}

function createSummary(
  mode: TransportMode,
  partial: Partial<RouteSummaryInfo> = {}
): RouteSummaryInfo {
  return {
    mode,
    status: "idle",
    distance: 0,
    duration: 0,
    distanceText: DEFAULT_DISTANCE_TEXT,
    durationText: DEFAULT_DURATION_TEXT,
    startName: "--",
    endName: "--",
    waypointCount: 0,
    resolvedCount: 0,
    message: "请选择行程点并开始路线规划",
    partialErrors: [],
    fallbackRouteUrl: "",
    ...partial,
  }
}

function toRoutePath(route: AMapRoute): LngLatTuple[] {
  const points: LngLatTuple[] = []
  const steps = route.steps ?? []

  for (const step of steps) {
    const stepPath = step.path ?? []
    for (const point of stepPath) {
      const lng = Number(
        typeof point.getLng === "function" ? point.getLng() : point.lng
      )
      const lat = Number(
        typeof point.getLat === "function" ? point.getLat() : point.lat
      )
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        points.push([lng, lat])
      }
    }
  }
  return points
}

function getRouteSummary(route: AMapRoute) {
  const distance = Number(route.distance ?? 0)
  const duration = Number(route.time ?? route.duration ?? 0)

  return {
    distance: Number.isFinite(distance) ? distance : 0,
    duration: Number.isFinite(duration) ? duration : 0,
  }
}

function createMarkerIcon(
  AMap: AMapNamespace,
  label: string,
  color: string
): unknown {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <path d="M17 41c-1 0-2-.4-2.7-1.2C6 31 1 23.8 1 16.5 1 7.9 8 1 17 1s16 6.9 16 15.5c0 7.3-5 14.5-13.3 23.3-.7.8-1.7 1.2-2.7 1.2z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="17" cy="16" r="9" fill="#ffffff" />
      <text x="17" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="${color}">${label}</text>
    </svg>
  `.trim()

  return new AMap.Icon({
    size: new AMap.Size(34, 42),
    image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  })
}

function createUserLocationIcon(AMap: AMapNamespace): unknown {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="#2563EB" fill-opacity="0.25" />
      <circle cx="10" cy="10" r="5" fill="#2563EB" stroke="#ffffff" stroke-width="2" />
    </svg>
  `.trim()

  return new AMap.Icon({
    size: new AMap.Size(20, 20),
    image: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  })
}

function getUserLocationStatusText(
  status: UserLocationStatus,
  errorText: string
) {
  if (status === "locating") return "正在获取当前位置..."
  if (status === "active") return "已开启实时定位"
  if (status === "approximate") return "已获取网络定位（精度较低）"
  if (status === "denied") return "定位权限已拒绝，请在浏览器允许定位"
  if (status === "unsupported") return "当前浏览器不支持定位"
  if (status === "error") return errorText || "定位失败，请稍后重试"
  return "未开启定位"
}

function getUnknownMessage(error: unknown) {
  if (!error) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object") {
    const payload = error as Record<string, unknown>
    const candidates = [payload.message, payload.info, payload.error]
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim()
      }
    }
  }
  return ""
}

function normalizeLocationError(error: unknown): {
  status: UserLocationStatus
  message: string
} {
  const rawMessage = getUnknownMessage(error)
  const normalized = rawMessage.toLowerCase()
  const code =
    typeof error === "object" && error
      ? Number((error as Record<string, unknown>).code)
      : NaN

  if (
    code === 1 ||
    normalized.includes("permission denied") ||
    normalized.includes("user denied") ||
    normalized.includes("denied geolocation")
  ) {
    return {
      status: "denied",
      message: "定位权限被拒绝，请在浏览器地址栏开启定位权限后重试",
    }
  }

  if (
    normalized.includes("secure origins") ||
    normalized.includes("only secure") ||
    normalized.includes("insecure")
  ) {
    return {
      status: "error",
      message: "定位仅支持 HTTPS 或 localhost，请检查访问地址",
    }
  }

  if (
    code === 3 ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return {
      status: "error",
      message: "定位超时，请检查网络或稍后重试",
    }
  }

  if (
    code === 2 ||
    normalized.includes("network service") ||
    normalized.includes("position unavailable") ||
    normalized.includes("network")
  ) {
    return {
      status: "error",
      message: "定位服务连接失败，请检查网络与系统定位服务",
    }
  }

  if (normalized.includes("not support") || normalized.includes("unsupported")) {
    return {
      status: "unsupported",
      message: "当前浏览器不支持定位",
    }
  }

  return {
    status: "error",
    message: "定位失败，请稍后重试",
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function extractLngLatFromUnknown(payload: unknown): LngLatTuple | null {
  if (!payload) return null

  if (Array.isArray(payload) && payload.length >= 2) {
    const lng = toNumber(payload[0])
    const lat = toNumber(payload[1])
    if (lng !== null && lat !== null) return [lng, lat]
  }

  if (typeof payload === "string") {
    const [lngText, latText] = payload.split(",")
    const lng = toNumber(lngText)
    const lat = toNumber(latText)
    if (lng !== null && lat !== null) return [lng, lat]
  }

  if (typeof payload !== "object") return null
  const record = payload as Record<string, unknown>

  const directLng =
    toNumber(record.lng) ??
    toNumber(record.longitude) ??
    toNumber(
      typeof record.getLng === "function"
        ? (record.getLng as () => number)()
        : undefined
    )
  const directLat =
    toNumber(record.lat) ??
    toNumber(record.latitude) ??
    toNumber(
      typeof record.getLat === "function"
        ? (record.getLat as () => number)()
        : undefined
    )
  if (directLng !== null && directLat !== null) return [directLng, directLat]

  const nestedCandidates = [
    record.position,
    record.location,
    record.lnglat,
    record.center,
  ]
  for (const candidate of nestedCandidates) {
    const parsed = extractLngLatFromUnknown(candidate)
    if (parsed) return parsed
  }

  return null
}

interface DrivingSearchOutcome {
  distance: number
  duration: number
  path: LngLatTuple[]
  source: "plugin" | "rest"
  message?: string
}

interface AmapDrivingRestStep {
  polyline?: string
}

interface AmapDrivingRestPath {
  distance?: string
  duration?: string
  steps?: AmapDrivingRestStep[]
}

interface AmapDrivingRestResponse {
  status?: string
  info?: string
  infocode?: string
  route?: {
    paths?: AmapDrivingRestPath[]
  }
}

function getServiceInfoText(result: unknown) {
  if (!result) return ""
  if (typeof result === "string") return result
  if (typeof result !== "object") return ""
  const payload = result as Record<string, unknown>
  return String(payload.info || payload.message || payload.error || "").trim()
}

function parsePolylineText(polylineText: string): LngLatTuple[] {
  if (!polylineText.trim()) return []
  const points: LngLatTuple[] = []
  const chunks = polylineText.split(";")
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
    const previous = deduped[deduped.length - 1]
    const current = path[i]
    if (previous[0] === current[0] && previous[1] === current[1]) continue
    deduped.push(current)
  }
  return deduped
}

function buildFromMeFallbackUrl(
  mode: TransportMode,
  destination: LngLatTuple,
  destinationName: string,
  origin?: LngLatTuple | null
) {
  return buildAmapRouteUrl({
    mode,
    destination,
    destinationName,
    origin: origin ?? undefined,
    originName: "我的位置",
  })
}

function buildTripFallbackUrl(mode: TransportMode, spots: Spot[]) {
  if (spots.length === 0) return ""
  const first = getSpotLngLat(spots[0])
  const last = getSpotLngLat(spots[spots.length - 1])
  if (!last) return ""

  return buildAmapRouteUrl({
    mode,
    destination: last,
    destinationName: spots[spots.length - 1]?.name || "终点",
    origin: first ?? undefined,
    originName: spots[0]?.name || "起点",
  })
}

async function requestDrivingByRestApi(
  start: LngLatTuple,
  end: LngLatTuple,
  waypoints: LngLatTuple[]
): Promise<DrivingSearchOutcome> {
  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY?.trim()
  if (!amapKey) {
    throw new Error("未配置有效的高德地图 Key（NEXT_PUBLIC_AMAP_KEY）")
  }

  const query = new URLSearchParams({
    key: amapKey,
    origin: `${start[0]},${start[1]}`,
    destination: `${end[0]},${end[1]}`,
    strategy: "0",
    extensions: "base",
  })
  if (waypoints.length > 0) {
    query.set(
      "waypoints",
      waypoints.map((item) => `${item[0]},${item[1]}`).join("|")
    )
  }

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
      payload.info || "高德网络路线规划失败"
    )
    throw new Error(analysis.userMessage)
  }

  const pathResult = payload.route.paths[0]
  const distance = Number(pathResult.distance || 0)
  const duration = Number(pathResult.duration || 0)

  const rawPath =
    pathResult.steps?.flatMap((step) => parsePolylineText(step.polyline || "")) || []
  const dedupedPath = dedupePath(rawPath)

  return {
    distance: Number.isFinite(distance) ? distance : 0,
    duration: Number.isFinite(duration) ? duration : 0,
    path: dedupedPath.length >= 2 ? dedupedPath : [start, end],
    source: "rest",
  }
}

function runDrivingSearch(
  driving: AMapDrivingInstance,
  start: LngLatTuple,
  end: LngLatTuple,
  waypoints: LngLatTuple[]
) {
  const buildFailureMessage = (status: string, result: unknown) => {
    const info = `${status} ${getServiceInfoText(result)}`
    const analysis = analyzeAmapError(info, "高德驾车路线规划失败")
    return analysis.userMessage
  }

  const runDrivingByPlugin = () =>
    new Promise<DrivingSearchOutcome>((resolve, reject) => {
      const callback = (status: string, result: unknown) => {
        const typedResult =
          result && typeof result === "object"
            ? (result as AMapRouteResult)
            : undefined
        if (status === "complete" && typedResult?.routes?.length) {
          const route = typedResult.routes[0]
          const summary = getRouteSummary(route)
          const path = dedupePath(toRoutePath(route))
          resolve({
            distance: summary.distance,
            duration: summary.duration,
            path,
            source: "plugin",
          })
          return
        }
        reject(new Error(buildFailureMessage(status, result)))
      }

      if (waypoints.length > 0) {
        driving.search(start, end, { waypoints }, callback)
        return
      }

      driving.search(start, end, callback)
    })

  return runDrivingByPlugin().catch(async (pluginError) => {
    try {
      const restResult = await requestDrivingByRestApi(start, end, waypoints)
      return {
        ...restResult,
        message:
          pluginError instanceof Error
            ? `JS 规划失败，已自动切换网络规划：${pluginError.message}`
            : "JS 规划失败，已自动切换网络规划",
      }
    } catch (restError) {
      const pluginMessage =
        pluginError instanceof Error ? pluginError.message : "JS 规划失败"
      const restMessage =
        restError instanceof Error ? restError.message : "网络规划失败"
      throw new Error(`${pluginMessage}；备用网络规划也失败：${restMessage}`)
    }
  })
}

function runWalkingSearch(
  walking: AMapWalkingInstance,
  start: LngLatTuple,
  end: LngLatTuple
) {
  return new Promise<AMapRouteResult>((resolve, reject) => {
    walking.search(start, end, (status, result: AMapRouteResult) => {
      if (status === "complete" && result.routes?.length) {
        resolve(result)
        return
      }
      const analysis = analyzeAmapError(
        `${status} ${result?.info || ""} ${result?.message || ""} ${
          result?.infocode || ""
        }`,
        "高德步行路线规划失败"
      )
      reject(new Error(analysis.userMessage))
    })
  })
}

function runTransferSearch(
  transfer: AMapTransferInstance,
  start: LngLatTuple,
  end: LngLatTuple
) {
  return new Promise<AMapTransferResult>((resolve, reject) => {
    transfer.search(start, end, (status, result) => {
      if (status === "complete" && result.plans?.length) {
        resolve(result)
        return
      }
      const analysis = analyzeAmapError(
        `${status} ${result?.info || ""} ${result?.message || ""} ${
          result?.infocode || ""
        }`,
        "高德公交路线规划失败"
      )
      reject(new Error(analysis.userMessage))
    })
  })
}

export function MapView({
  spots,
  transportMode,
  routeMode,
  fromMeTarget,
  fromMeOrigin = null,
  fromMeRequestId,
  onSummaryChange,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapMapInstance | null>(null)
  const amapRef = useRef<AMapNamespace | null>(null)
  const drivingRef = useRef<AMapDrivingInstance | null>(null)
  const walkingRef = useRef<AMapWalkingInstance | null>(null)
  const transferRef = useRef<AMapTransferInstance | null>(null)
  const markerRefs = useRef<unknown[]>([])
  const polylineRefs = useRef<AMapPolylineInstance[]>([])
  const userMarkerRef = useRef<AMapMarkerInstance | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const routeTaskIdRef = useRef(0)
  const locationWatchIdRef = useRef<number | null>(null)
  const latestUserLocationRef = useRef<LngLatTuple | null>(null)
  const hasCenteredUserRef = useRef(false)
  const spotsCountRef = useRef(spots.length)
  const locationFallbackTriedRef = useRef(false)

  const [mapError, setMapError] = useState<string | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)
  const [summary, setSummary] = useState<RouteSummaryInfo>(() =>
    createSummary(transportMode)
  )
  const transportModeRef = useRef<TransportMode>(transportMode)
  const [userLocationStatus, setUserLocationStatus] =
    useState<UserLocationStatus>("idle")
  const [userLocationError, setUserLocationError] = useState("")
  const [userLocationTick, setUserLocationTick] = useState(0)

  const isFromMeMode = routeMode === "fromMe"
  const fromMeLocationSignal = isFromMeMode
    ? `${userLocationStatus}:${userLocationTick}`
    : "trip"
  const isEmpty = isFromMeMode ? !fromMeTarget : spots.length === 0

  const baseNames = useMemo(() => {
    if (isFromMeMode) {
      return {
        startName: "我的位置",
        endName: fromMeTarget?.name || "--",
        waypointCount: 0,
      }
    }
    const firstName = spots[0]?.name || "--"
    const lastName = spots[spots.length - 1]?.name || "--"
    return {
      startName: firstName,
      endName: lastName,
      waypointCount: Math.max(0, spots.length - 2),
    }
  }, [fromMeTarget?.name, isFromMeMode, spots])

  useEffect(() => {
    onSummaryChange?.(summary)
  }, [onSummaryChange, summary])

  useEffect(() => {
    transportModeRef.current = transportMode
  }, [transportMode])

  useEffect(() => {
    spotsCountRef.current = spots.length
  }, [spots.length])

  const updateSummary = useCallback(
    (partial: Partial<RouteSummaryInfo>) => {
      setSummary((prev) => ({
        ...prev,
        mode: transportMode,
        ...partial,
      }))
    },
    [transportMode]
  )

  const clearMapOverlays = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    drivingRef.current?.clear()
    walkingRef.current?.clear()
    transferRef.current?.clear()
    drivingRef.current = null
    walkingRef.current = null
    transferRef.current = null

    if (markerRefs.current.length > 0) {
      map.remove(markerRefs.current)
      markerRefs.current = []
    }

    if (polylineRefs.current.length > 0) {
      map.remove(polylineRefs.current)
      polylineRefs.current.forEach((polyline) => polyline.setMap(null))
      polylineRefs.current = []
    }
  }, [])

  const clearUserLocation = useCallback(() => {
    if (locationWatchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(locationWatchIdRef.current)
      locationWatchIdRef.current = null
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
      userMarkerRef.current = null
    }

    latestUserLocationRef.current = null
    hasCenteredUserRef.current = false
    locationFallbackTriedRef.current = false
  }, [])

  const upsertUserLocationMarker = useCallback((lngLat: LngLatTuple) => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap) return

    latestUserLocationRef.current = lngLat

    if (!userMarkerRef.current) {
      const marker = new AMap.Marker({
        position: lngLat,
        title: "我的位置",
        icon: createUserLocationIcon(AMap),
        offset: new AMap.Pixel(-10, -10),
        zIndex: 130,
      })
      userMarkerRef.current = marker
      map.add(marker)
      setUserLocationTick((prev) => prev + 1)
      return
    }

    userMarkerRef.current.setPosition(lngLat)
    setUserLocationTick((prev) => prev + 1)
  }, [])

  const centerToUserLocation = useCallback((zoom = 15) => {
    const map = mapRef.current
    const location = latestUserLocationRef.current
    if (!map || !location) return false
    map.setCenter(location)
    map.setZoom(zoom)
    return true
  }, [])

  const applyLocationError = useCallback((error: unknown) => {
    const normalized = normalizeLocationError(error)
    setUserLocationStatus(normalized.status)
    setUserLocationError(normalized.message)
  }, [])

  const requestBrowserPosition = useCallback(
    (options: PositionOptions) =>
      new Promise<LngLatTuple>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          reject(new Error("当前浏览器不支持定位"))
          return
        }

        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve([position.coords.longitude, position.coords.latitude]),
          reject,
          options
        )
      }),
    []
  )

  const requestAMapPosition = useCallback(async () => {
    const AMap = amapRef.current ?? (await loadAMap(["AMap.Geolocation"]))
    const GeolocationCtor = AMap.Geolocation
    if (!GeolocationCtor) {
      throw new Error("高德定位插件不可用")
    }

    return new Promise<LngLatTuple>((resolve, reject) => {
      const geolocation = new GeolocationCtor({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 30000,
        convert: true,
        showButton: false,
        showMarker: false,
        showCircle: false,
        panToLocation: false,
        zoomToAccuracy: false,
      })

      geolocation.getCurrentPosition((status, result) => {
        if (status === "complete") {
          const lngLat = extractLngLatFromUnknown(result)
          if (lngLat) {
            resolve(lngLat)
            return
          }
          reject(new Error("高德定位结果缺少坐标"))
          return
        }

        reject(new Error(getUnknownMessage(result) || "高德定位失败"))
      })
    })
  }, [])

  const cleanupMap = useCallback(() => {
    routeTaskIdRef.current += 1
    clearMapOverlays()
    clearUserLocation()
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    mapRef.current?.destroy()
    mapRef.current = null
    amapRef.current = null
    setIsMapReady(false)
  }, [clearMapOverlays, clearUserLocation])

  useEffect(() => {
    let disposed = false
    let currentMap: AMapMapInstance | null = null
    let handleMapError: ((event?: unknown) => void) | null = null

    const initMap = async () => {
      if (!mapContainerRef.current) return

      setIsMapLoading(true)
      setMapError(null)

      try {
        const AMap = await loadAMap()
        if (disposed || !mapContainerRef.current) return

        amapRef.current = AMap
        const map = new AMap.Map(mapContainerRef.current, {
          center: CENTER_BEIJING,
          zoom: 11,
          resizeEnable: true,
          viewMode: "2D",
        })
        currentMap = map
        mapRef.current = map

        handleMapError = (event?: unknown) => {
          const rawError = getAMapErrorMessage(event)
          const analysis = analyzeAmapError(
            rawError,
            "地图瓦片加载异常，请检查 Key 白名单或安全配置"
          )
          const message = analysis.userMessage
          setMapError(message)
          setSummary((prev) => ({
            ...prev,
            mode: transportModeRef.current,
            status: "map-error",
            message: `地图加载失败：${message}`,
          }))
        }
        map.on("error", handleMapError)

        map.addControl(
          new AMap.ToolBar({
            locate: false,
            direction: false,
          })
        )
        map.addControl(new AMap.Scale())
        requestAnimationFrame(() => map.resize())
        setIsMapReady(true)

        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(() => {
            map.resize()
          })
          observer.observe(mapContainerRef.current)
          resizeObserverRef.current = observer
        }
      } catch (error) {
        const analysis = analyzeAmapError(error, "地图加载失败，请检查高德配置")
        const message = analysis.userMessage
        setMapError(message)
        setSummary((prev) => ({
          ...prev,
          mode: transportModeRef.current,
          status: "map-error",
          message: `地图加载失败：${message}`,
        }))
      } finally {
        if (!disposed) {
          setIsMapLoading(false)
        }
      }
    }

    initMap()

    return () => {
      disposed = true
      if (currentMap && handleMapError) {
        currentMap.off("error", handleMapError)
      }
      cleanupMap()
    }
  }, [cleanupMap])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isMapReady || mapError) return

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUserLocationStatus("unsupported")
      setUserLocationError("当前浏览器不支持定位")
      return
    }

    locationFallbackTriedRef.current = false
    setUserLocationStatus("locating")
    setUserLocationError("")

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lngLat: LngLatTuple = [
          position.coords.longitude,
          position.coords.latitude,
        ]
        upsertUserLocationMarker(lngLat)

        if (!hasCenteredUserRef.current && spotsCountRef.current === 0) {
          map.setCenter(lngLat)
          map.setZoom(14)
          hasCenteredUserRef.current = true
        }

        setUserLocationStatus("active")
        setUserLocationError("")
      },
      async (error) => {
        const normalized = normalizeLocationError(error)
        if (normalized.status === "denied" || normalized.status === "unsupported") {
          setUserLocationStatus(normalized.status)
          setUserLocationError(normalized.message)
          return
        }

        if (!locationFallbackTriedRef.current) {
          locationFallbackTriedRef.current = true
          try {
            const fallbackLngLat = await requestAMapPosition()
            upsertUserLocationMarker(fallbackLngLat)
            if (!hasCenteredUserRef.current && spotsCountRef.current === 0) {
              map.setCenter(fallbackLngLat)
              map.setZoom(12)
              hasCenteredUserRef.current = true
            }
            setUserLocationStatus("approximate")
            setUserLocationError("")
            return
          } catch {
            applyLocationError(error)
            return
          }
        }

        applyLocationError(error)
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15000,
        timeout: 20000,
      }
    )

    locationWatchIdRef.current = watchId

    return () => {
      if (locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current)
        locationWatchIdRef.current = null
      }
    }
  }, [
    applyLocationError,
    isMapReady,
    mapError,
    requestAMapPosition,
    upsertUserLocationMarker,
  ])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap || mapError) return

    const currentTaskId = ++routeTaskIdRef.current
    const nextBaseSummary = createSummary(transportMode, {
      ...baseNames,
      status: "loading",
      message: "正在加载地图和路线...",
    })

    const plan = async () => {
      clearMapOverlays()
      setIsRouteLoading(false)
      updateSummary(nextBaseSummary)

      if (isFromMeMode) {
        if (!fromMeTarget) {
          updateSummary(
            createSummary(transportMode, {
              ...baseNames,
              status: "empty",
              message: "请先选择一个景点作为导航终点",
            })
          )
          if (latestUserLocationRef.current) {
            map.setCenter(latestUserLocationRef.current)
            map.setZoom(13)
          } else {
            map.setCenter(CENTER_BEIJING)
            map.setZoom(11)
          }
          return
        }

        setIsRouteLoading(true)
        let fallbackRouteUrl = ""

        try {
          const { resolved, unresolved } = await resolveSpotCoordinates(AMap, [
            fromMeTarget,
          ])
          if (routeTaskIdRef.current !== currentTaskId) return

          if (resolved.length === 0) {
            updateSummary(
              createSummary(transportMode, {
                ...baseNames,
                status: "route-error",
                partialErrors: unresolved.map((item) => item.reason),
                message: "当前景点缺少可用坐标，无法规划导航路线",
              })
            )
            return
          }

          const destination = resolved[0]
          const destinationMarker = new AMap.Marker({
            position: destination.lngLat,
            title: destination.spot.name,
            icon: createMarkerIcon(AMap, "终", MARKER_COLORS.end),
            offset: new AMap.Pixel(-17, -41),
          })
          markerRefs.current = [destinationMarker]
          map.add([destinationMarker])

          const partialErrors = unresolved.map((item) => item.reason)
          const resolvedBase = {
            startName: "我的位置",
            endName: destination.spot.name || baseNames.endName,
            waypointCount: 0,
            resolvedCount: 1,
            partialErrors,
          }

          if (fromMeOrigin && !latestUserLocationRef.current) {
            upsertUserLocationMarker(fromMeOrigin)
          }
          const startPoint = fromMeOrigin ?? latestUserLocationRef.current
          fallbackRouteUrl = buildFromMeFallbackUrl(
            transportMode,
            destination.lngLat,
            destination.spot.name || "目的地",
            startPoint
          )

          const viewOverlays: unknown[] = [destinationMarker]
          if (userMarkerRef.current) {
            viewOverlays.push(userMarkerRef.current)
          }

          if (!startPoint) {
            map.setCenter(destination.lngLat)
            map.setZoom(14)
            map.setFitView(viewOverlays)
            const waitingMessage =
              userLocationStatus === "locating" || userLocationStatus === "idle"
                ? "正在获取当前位置，获取成功后将自动规划路线"
                : "未能获取当前位置，已先展示目的地位置，可点击右上角重试定位"
            updateSummary(
              createSummary(transportMode, {
                ...resolvedBase,
                status:
                  userLocationStatus === "locating" || userLocationStatus === "idle"
                    ? "loading"
                    : "route-error",
                message: waitingMessage,
                fallbackRouteUrl,
              })
            )
            return
          }

          if (transportMode === "transit") {
            const cityName = fromMeTarget.city?.trim()
            if (!cityName || !AMap.Transfer) {
              map.setFitView(viewOverlays)
              updateSummary(
                createSummary(transportMode, {
                  ...resolvedBase,
                  status: "transit-degraded",
                  message: "当前景点缺少城市信息，暂不支持公交路线规划",
                  fallbackRouteUrl,
                })
              )
              return
            }

            try {
              const transfer = new AMap.Transfer({
                map,
                city: cityName,
                hideMarkers: true,
              })
              transferRef.current = transfer
              const transferResult = await runTransferSearch(
                transfer,
                startPoint,
                destination.lngLat
              )
              if (routeTaskIdRef.current !== currentTaskId) return

              const bestPlan = transferResult.plans?.[0]
              const distance = Number(bestPlan?.distance ?? 0)
              const duration = Number(bestPlan?.time ?? 0)
              map.setFitView(viewOverlays)
              requestAnimationFrame(() => map.resize())
              updateSummary(
                createSummary(transportMode, {
                  ...resolvedBase,
                  status: "success",
                  distance,
                  duration,
                  distanceText: formatDistance(distance),
                  durationText: formatDuration(duration),
                  message: "公交路线规划完成",
                  fallbackRouteUrl,
                })
              )
            } catch (error) {
              const analysis = analyzeAmapError(
                error,
                "当前版本暂不支持稳定的公交路线规划，请切换驾车或步行"
              )
              map.setFitView(viewOverlays)
              updateSummary(
                createSummary(transportMode, {
                  ...resolvedBase,
                  status: "transit-degraded",
                  message: analysis.userMessage,
                  fallbackRouteUrl,
                })
              )
            }
            return
          }

          if (transportMode === "driving") {
            const driving = new AMap.Driving({
              map,
              hideMarkers: true,
              policy: AMap.DrivingPolicy.LEAST_TIME,
            })
            drivingRef.current = driving

            const result = await runDrivingSearch(
              driving,
              startPoint,
              destination.lngLat,
              []
            )
            if (routeTaskIdRef.current !== currentTaskId) return

            const overlays: unknown[] = [...viewOverlays]
            if (result.source === "rest" && result.path.length >= 2) {
              const polyline = new AMap.Polyline({
                path: result.path,
                strokeColor: "#2D8C59",
                strokeWeight: 7,
                lineJoin: "round",
                showDir: true,
              })
              polylineRefs.current = [polyline]
              map.add([polyline])
              overlays.push(polyline)
              map.setFitView(overlays)
            } else {
              map.setFitView()
            }
            requestAnimationFrame(() => map.resize())
            updateSummary(
              createSummary(transportMode, {
                ...resolvedBase,
                status: "success",
                distance: result.distance,
                duration: result.duration,
                distanceText: formatDistance(result.distance),
                durationText: formatDuration(result.duration),
                message: result.message
                  ? `驾车路线规划完成。${result.message}`
                  : "驾车路线规划完成",
                fallbackRouteUrl,
              })
            )
            return
          }

          const walking = new AMap.Walking({ hideMarkers: true })
          walkingRef.current = walking
          const walkingResult = await runWalkingSearch(
            walking,
            startPoint,
            destination.lngLat
          )
          if (routeTaskIdRef.current !== currentTaskId) return

          const route = walkingResult.routes?.[0]
          if (!route) {
            throw new Error("步行路线规划结果为空")
          }

          const routeSummary = getRouteSummary(route)
          const path = toRoutePath(route)
          const overlays: unknown[] = [...viewOverlays]
          if (path.length >= 2) {
            const polyline = new AMap.Polyline({
              path,
              strokeColor: "#2D5A47",
              strokeWeight: 6,
              lineJoin: "round",
              showDir: true,
            })
            polylineRefs.current = [polyline]
            map.add([polyline])
            overlays.push(polyline)
          }

          map.setFitView(overlays)
          requestAnimationFrame(() => map.resize())
          updateSummary(
            createSummary(transportMode, {
              ...resolvedBase,
              status: "success",
              distance: routeSummary.distance,
              duration: routeSummary.duration,
              distanceText: formatDistance(routeSummary.distance),
              durationText: formatDuration(routeSummary.duration),
              message: "步行路线规划完成",
              fallbackRouteUrl,
            })
          )
          return
        } catch (error) {
          if (routeTaskIdRef.current !== currentTaskId) return
          const analysis = analyzeAmapError(error, "路线规划失败，请稍后重试")
          updateSummary(
            createSummary(transportMode, {
              ...baseNames,
              status: "route-error",
              message: `路线规划失败：${analysis.userMessage}`,
              fallbackRouteUrl: analysis.shouldShowExternalFallback
                ? fallbackRouteUrl
                : "",
            })
          )
        } finally {
          if (routeTaskIdRef.current === currentTaskId) {
            setIsRouteLoading(false)
          }
        }
        return
      }

      if (spots.length === 0) {
        updateSummary(
          createSummary(transportMode, {
            ...baseNames,
            status: "empty",
            message: "请先添加景点到行程",
          })
        )
        map.setCenter(CENTER_BEIJING)
        map.setZoom(11)
        return
      }

      setIsRouteLoading(true)
      let fallbackRouteUrl = buildTripFallbackUrl(transportMode, spots)

      try {
        const { resolved, unresolved } = await resolveSpotCoordinates(AMap, spots)
        if (routeTaskIdRef.current !== currentTaskId) return

        if (resolved.length === 0) {
          updateSummary(
            createSummary(transportMode, {
              ...baseNames,
              status: "route-error",
              partialErrors: unresolved.map((item) => item.reason),
              message: "当前景点都缺少可用坐标，无法规划路线",
              fallbackRouteUrl,
            })
          )
          return
        }

        const markers = resolved.map((item, index) => {
          const isStart = index === 0
          const isEnd = index === resolved.length - 1
          const color = isStart
            ? MARKER_COLORS.start
            : isEnd
            ? MARKER_COLORS.end
            : MARKER_COLORS.waypoint
          const label = isStart ? "起" : isEnd ? "终" : String(index)

          return new AMap.Marker({
            position: item.lngLat,
            title: item.spot.name,
            icon: createMarkerIcon(AMap, label, color),
            offset: new AMap.Pixel(-17, -41),
          })
        })

        markerRefs.current = markers
        map.add(markers)

        const partialErrors = unresolved.map((item) => item.reason)
        const resolvedBase = {
          startName: resolved[0]?.spot.name ?? baseNames.startName,
          endName:
            resolved[resolved.length - 1]?.spot.name ?? baseNames.endName,
          waypointCount: Math.max(0, resolved.length - 2),
          resolvedCount: resolved.length,
          partialErrors,
        }

        if (resolved.length === 1) {
          map.setCenter(resolved[0].lngLat)
          map.setZoom(14)
          map.setFitView(markers)
          updateSummary(
            createSummary(transportMode, {
              ...resolvedBase,
              status: partialErrors.length > 0 ? "partial-error" : "single",
              message: "至少添加两个景点才能规划路线",
            })
          )
          return
        }

        const coordinates = resolved.map((item) => item.lngLat)
        fallbackRouteUrl = buildAmapRouteUrl({
          mode: transportMode,
          destination: coordinates[coordinates.length - 1],
          destinationName: resolved[resolved.length - 1]?.spot.name || "终点",
          origin: coordinates[0],
          originName: resolved[0]?.spot.name || "起点",
        })

        if (transportMode === "transit") {
          const cityName =
            resolved[0]?.spot.city?.trim() ||
            resolved[resolved.length - 1]?.spot.city?.trim()
          if (!cityName || !AMap.Transfer) {
            map.setFitView(markers)
            updateSummary(
              createSummary(transportMode, {
                ...resolvedBase,
                status: "transit-degraded",
                message: "当前景点缺少城市信息，暂不支持公交路线规划",
                fallbackRouteUrl,
              })
            )
            return
          }

          try {
            const transfer = new AMap.Transfer({
              map,
              city: cityName,
              hideMarkers: true,
            })
            transferRef.current = transfer
            const transferResult = await runTransferSearch(
              transfer,
              coordinates[0],
              coordinates[coordinates.length - 1]
            )
            if (routeTaskIdRef.current !== currentTaskId) return

            const bestPlan = transferResult.plans?.[0]
            const distance = Number(bestPlan?.distance ?? 0)
            const duration = Number(bestPlan?.time ?? 0)
            map.setFitView()
            requestAnimationFrame(() => map.resize())
            updateSummary(
              createSummary(transportMode, {
                ...resolvedBase,
                status: partialErrors.length > 0 ? "partial-error" : "success",
                distance,
                duration,
                distanceText: formatDistance(distance),
                durationText: formatDuration(duration),
                message:
                  coordinates.length > 2
                    ? "公交路线已按起点和终点规划，途经点暂未纳入公交方案"
                    : "公交路线规划完成",
                fallbackRouteUrl,
              })
            )
          } catch (error) {
            const analysis = analyzeAmapError(
              error,
              "当前版本暂不支持稳定的公交路线规划，请切换驾车或步行"
            )
            map.setFitView(markers)
            updateSummary(
              createSummary(transportMode, {
                ...resolvedBase,
                status: "transit-degraded",
                message: analysis.userMessage,
                fallbackRouteUrl,
              })
            )
          }
          return
        }

        if (transportMode === "driving") {
          const driving = new AMap.Driving({
            map,
            hideMarkers: true,
            policy: AMap.DrivingPolicy.LEAST_TIME,
          })
          drivingRef.current = driving

          const drivingResult = await runDrivingSearch(
            driving,
            coordinates[0],
            coordinates[coordinates.length - 1],
            coordinates.slice(1, -1)
          )
          if (routeTaskIdRef.current !== currentTaskId) return

          if (drivingResult.source === "rest" && drivingResult.path.length >= 2) {
            const polyline = new AMap.Polyline({
              path: drivingResult.path,
              strokeColor: "#2D8C59",
              strokeWeight: 7,
              lineJoin: "round",
              showDir: true,
            })
            polylineRefs.current = [polyline]
            map.add([polyline])
            map.setFitView([...markers, polyline])
          } else {
            map.setFitView()
          }
          requestAnimationFrame(() => map.resize())

          updateSummary(
            createSummary(transportMode, {
              ...resolvedBase,
              status: partialErrors.length > 0 ? "partial-error" : "success",
              distance: drivingResult.distance,
              duration: drivingResult.duration,
              distanceText: formatDistance(drivingResult.distance),
              durationText: formatDuration(drivingResult.duration),
              message:
                partialErrors.length > 0
                  ? `驾车路线规划完成，部分景点因坐标缺失已跳过${
                      drivingResult.message ? `。${drivingResult.message}` : ""
                    }`
                  : drivingResult.message
                  ? `驾车路线规划完成。${drivingResult.message}`
                  : "驾车路线规划完成",
              fallbackRouteUrl,
            })
          )
          return
        }

        const walking = new AMap.Walking({ hideMarkers: true })
        walkingRef.current = walking

        let totalDistance = 0
        let totalDuration = 0
        const polylines: AMapPolylineInstance[] = []

        for (let i = 0; i < coordinates.length - 1; i += 1) {
          const walkingResult = await runWalkingSearch(
            walking,
            coordinates[i],
            coordinates[i + 1]
          )
          if (routeTaskIdRef.current !== currentTaskId) return

          const route = walkingResult.routes?.[0]
          if (!route) {
            throw new Error("步行路线规划结果为空")
          }

          const routeSummary = getRouteSummary(route)
          totalDistance += routeSummary.distance
          totalDuration += routeSummary.duration

          const path = toRoutePath(route)
          if (path.length >= 2) {
            const polyline = new AMap.Polyline({
              path,
              strokeColor: "#2D5A47",
              strokeWeight: 6,
              lineJoin: "round",
              showDir: true,
            })
            polylines.push(polyline)
          }
        }

        if (polylines.length > 0) {
          map.add(polylines)
          polylineRefs.current = polylines
          map.setFitView([...markers, ...polylines])
        } else {
          map.setFitView(markers)
        }
        requestAnimationFrame(() => map.resize())

        updateSummary(
          createSummary(transportMode, {
            ...resolvedBase,
            status: partialErrors.length > 0 ? "partial-error" : "success",
            distance: totalDistance,
            duration: totalDuration,
            distanceText: formatDistance(totalDistance),
            durationText: formatDuration(totalDuration),
            message:
              partialErrors.length > 0
                ? "步行路线规划完成，部分景点因坐标缺失已跳过"
                : "步行路线规划完成",
            fallbackRouteUrl,
          })
        )
      } catch (error) {
        if (routeTaskIdRef.current !== currentTaskId) return
        const analysis = analyzeAmapError(error, "路线规划失败，请稍后重试")
        updateSummary(
          createSummary(transportMode, {
            ...baseNames,
            status: "route-error",
            message: `路线规划失败：${analysis.userMessage}`,
            fallbackRouteUrl: analysis.shouldShowExternalFallback
              ? fallbackRouteUrl
              : "",
          })
        )
      } finally {
        if (routeTaskIdRef.current === currentTaskId) {
          setIsRouteLoading(false)
        }
      }
    }

    plan()
  }, [
    baseNames,
    clearMapOverlays,
    fromMeOrigin,
    fromMeRequestId,
    fromMeTarget,
    fromMeLocationSignal,
    isFromMeMode,
    mapError,
    spots,
    transportMode,
    upsertUserLocationMarker,
    updateSummary,
  ])

  return (
    <div className="relative w-full h-[360px] rounded-2xl overflow-hidden bg-secondary">
      <div ref={mapContainerRef} className="w-full h-full" />

      {!isMapLoading && !mapError && (
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div className="max-w-[70%] px-2.5 py-1.5 rounded-full bg-white/95 text-[11px] text-muted-foreground shadow-sm border border-border/40 truncate">
            {getUserLocationStatusText(userLocationStatus, userLocationError)}
          </div>
          <button
            type="button"
            onClick={() => {
              if (centerToUserLocation()) {
                return
              }
              void (async () => {
                setUserLocationStatus("locating")
                setUserLocationError("")

                try {
                  const precisePosition = await requestBrowserPosition({
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 0,
                  })
                  upsertUserLocationMarker(precisePosition)
                  centerToUserLocation()
                  hasCenteredUserRef.current = true
                  setUserLocationStatus("active")
                  return
                } catch (highAccuracyError) {
                  try {
                    const lowAccuracyPosition = await requestBrowserPosition({
                      enableHighAccuracy: false,
                      timeout: 18000,
                      maximumAge: 30000,
                    })
                    upsertUserLocationMarker(lowAccuracyPosition)
                    centerToUserLocation()
                    hasCenteredUserRef.current = true
                    setUserLocationStatus("approximate")
                    return
                  } catch {
                    try {
                      const amapPosition = await requestAMapPosition()
                      upsertUserLocationMarker(amapPosition)
                      centerToUserLocation(12)
                      hasCenteredUserRef.current = true
                      setUserLocationStatus("approximate")
                      return
                    } catch {
                      applyLocationError(highAccuracyError)
                    }
                  }
                }
              })()
            }}
            disabled={isMapLoading}
            className="pointer-events-auto h-8 w-8 rounded-full bg-white/95 border border-border/40 shadow-sm flex items-center justify-center text-foreground disabled:opacity-40"
            title="定位到当前位置"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>
      )}

      {(isMapLoading || isRouteLoading) && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-white/80 rounded-full px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isMapLoading ? "地图加载中..." : "路线规划中..."}</span>
          </div>
        </div>
      )}

      {!isMapLoading && !mapError && isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground text-sm">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{isFromMeMode ? "请先选择一个景点作为导航终点" : "请先添加景点到行程"}</p>
          </div>
        </div>
      )}

      {!isMapLoading && mapError && (
        <div className="absolute inset-0 bg-red-50/95 flex items-center justify-center px-5">
          <div className="text-center text-red-600 text-sm leading-6">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>地图加载失败</p>
            <p className="text-xs text-red-500 mt-1">{mapError}</p>
          </div>
        </div>
      )}
    </div>
  )
}
