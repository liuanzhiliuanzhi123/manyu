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
import {
  aggregateRouteLegs,
  createEstimatedLeg,
  haversineDistanceMeters,
  type RouteLegResult,
} from "@/lib/amap-route-utils"
import { analyzeAmapError } from "@/lib/amap-error-utils"
import { buildAmapRouteUrl } from "@/lib/open-map-route"
import { requestRouteLegByWebService } from "@/lib/amap-webservice-client"
import {
  createMapLabelHtml,
  createMapMarkerHtml,
  getRouteStrokeStyle,
  shouldRenderMarkerLabel,
} from "@/lib/map-layout-utils"
import type {
  AMapMapInstance,
  AMapMarkerInstance,
  AMapNamespace,
  AMapPolylineInstance,
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
  | "partial-success"
  | "fallback"
  | "error"
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
  routeSegmentIds?: string[]
  highlightedSpotId?: string | null
  highlightedSegmentId?: string | null
  onSpotClick?: (spotId: string) => void
  onSegmentClick?: (segmentId: string) => void
  onSummaryChange?: (summary: RouteSummaryInfo) => void
  onRouteLegsChange?: (legs: RouteLegResult[]) => void
}

const CENTER_BEIJING: LngLatTuple = [116.397428, 39.90923]
const DEFAULT_DISTANCE_TEXT = "--"
const DEFAULT_DURATION_TEXT = "--"
const EMPTY_ROUTE_SEGMENT_IDS: string[] = []
const AMAP_LOAD_TIMEOUT_MS = 12000

interface MarkerMeta {
  spotId: string
  marker: AMapMarkerInstance
  index: number
  total: number
  name: string
  type: Spot["type"]
  isStart: boolean
  isEnd: boolean
  isKeyStop: boolean
}

interface SegmentMeta {
  id: string
  mode: TransportMode
  status: RouteLegResult["status"]
  fromSpotId: string
  toSpotId: string
  polylines: AMapPolylineInstance[]
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

function createUserLocationIcon(AMap: AMapNamespace): unknown {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="#5d6f2f" fill-opacity="0.26" />
      <circle cx="10" cy="10" r="5" fill="#5d6f2f" stroke="#ffffff" stroke-width="2" />
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
  if (status === "denied") return "定位权限已拒绝，请在浏览器中允许定位"
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

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })
    return await Promise.race([task, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
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

const WALKING_MAX_DIRECT_METERS = 12000

function createLegPolylines(
  AMap: AMapNamespace,
  mode: TransportMode,
  leg: RouteLegResult,
  highlighted = false
) {
  const stroke = getRouteStrokeStyle(mode, leg.status, highlighted)
  const paths = leg.polylinePaths ?? []
  return paths
    .filter((path) => path.length >= 2)
    .map(
      (path) =>
        new AMap.Polyline({
          path,
          strokeColor: stroke.strokeColor,
          strokeWeight: stroke.strokeWeight,
          strokeOpacity: stroke.strokeOpacity,
          strokeStyle: stroke.strokeStyle,
          lineJoin: "round",
          showDir: true,
          zIndex: highlighted ? 130 : 100,
        })
    )
}

function applyMarkerVisual(meta: MarkerMeta, selectedSpotId: string | null) {
  const isSelected = meta.spotId === selectedSpotId
  meta.marker.setContent?.(
    createMapMarkerHtml({
      order: meta.index + 1,
      type: meta.type,
      isStart: meta.isStart,
      isEnd: meta.isEnd,
      isSelected,
      isKeyStop: meta.isKeyStop,
    })
  )

  const shouldShowLabel = shouldRenderMarkerLabel({
    index: meta.index,
    total: meta.total,
    isSelected,
    isStart: meta.isStart,
    isEnd: meta.isEnd,
    isKeyStop: meta.isKeyStop,
  })

  if (shouldShowLabel) {
    meta.marker.setLabel?.({
      content: createMapLabelHtml({
        name: meta.name,
        type: meta.type,
        isSelected,
      }),
      direction: "top",
      offset: { x: 0, y: -8 },
    })
  } else {
    meta.marker.setLabel?.({ content: "" })
  }

  meta.marker.setzIndex?.(isSelected ? 180 : meta.isStart || meta.isEnd ? 150 : 120)
}

function ensureLngLat(payload: unknown): LngLatTuple | null {
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  const lng = Number(record.lng ?? (typeof record.getLng === "function" ? record.getLng() : NaN))
  const lat = Number(record.lat ?? (typeof record.getLat === "function" ? record.getLat() : NaN))
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

function getAggregateMessage(mode: TransportMode, aggregate: ReturnType<typeof aggregateRouteLegs>) {
  if (aggregate.state === "success") {
    if (mode === "walking") return "步行路线规划完成"
    if (mode === "transit") return "公交换乘路线规划完成"
    return "驾车路线规划完成"
  }
  if (aggregate.state === "partial-success") {
    if (mode === "walking") return "部分步行路段为预估，已合并展示总距离和用时"
    if (mode === "transit") return "部分路段暂无公交方案，已按预估通勤时间展示"
    return "部分驾车路段规划失败，已按预估通勤时间展示"
  }
  if (aggregate.state === "fallback") {
    if (mode === "walking") return "步行路段距离较远或无可用方案，已按预估时间展示"
    if (mode === "transit") return "当前路线暂无稳定公交方案，已按预估通勤时间展示"
    return "驾车路线接口异常，已按预估通勤时间展示"
  }
  if (mode === "transit") return "公交路线规划失败，请尝试切换驾车或步行"
  return "路线规划失败，请稍后重试"
}

function getSummaryStatusFromAggregate(
  aggregate: ReturnType<typeof aggregateRouteLegs>
): RouteSummaryStatus {
  if (aggregate.state === "success") return "success"
  if (aggregate.state === "partial-success") return "partial-success"
  if (aggregate.state === "fallback") return "fallback"
  return "error"
}

async function planDrivingLeg(
  start: LngLatTuple,
  end: LngLatTuple,
  fromName: string,
  toName: string
): Promise<RouteLegResult> {
  const directDistance = haversineDistanceMeters(start, end)
  try {
    const result = await requestRouteLegByWebService("driving", {
      origin: start,
      destination: end,
      fromName,
      toName,
    })
    if (result.status === "success") {
      return result
    }
    throw new Error(result.message || "驾车路线规划失败")
  } catch (error) {
    const analysis = analyzeAmapError(error, "驾车路段规划失败，已自动预估")
    const fallbackLeg = createEstimatedLeg({
      fromName,
      toName,
      mode: "driving",
      directDistanceMeters: directDistance,
      message: analysis.userMessage,
      multiplier: 1.25,
    })
    return {
      ...fallbackLeg,
      polylinePaths: [[start, end]],
    }
  }
}

async function planWalkingLeg(
  start: LngLatTuple,
  end: LngLatTuple,
  fromName: string,
  toName: string
): Promise<RouteLegResult> {
  const directDistance = haversineDistanceMeters(start, end)
  if (directDistance > WALKING_MAX_DIRECT_METERS) {
    const fallbackLeg = createEstimatedLeg({
      fromName,
      toName,
      mode: "walking",
      directDistanceMeters: directDistance,
      message: "该路段距离较远，不适合步行，已按预估步行时间展示",
      multiplier: 1.1,
    })
    return {
      ...fallbackLeg,
      polylinePaths: [[start, end]],
    }
  }

  try {
    const result = await requestRouteLegByWebService("walking", {
      origin: start,
      destination: end,
      fromName,
      toName,
    })
    if (result.status === "success") {
      return result
    }
    throw new Error(result.message || "步行路线规划失败")
  } catch (error) {
    const analysis = analyzeAmapError(error, "该步行路段规划失败，已自动预估")
    const fallbackLeg = createEstimatedLeg({
      fromName,
      toName,
      mode: "walking",
      directDistanceMeters: directDistance,
      message: analysis.userMessage,
      multiplier: 1.15,
    })
    return {
      ...fallbackLeg,
      polylinePaths: [[start, end]],
    }
  }
}

async function planTransitLeg(
  start: LngLatTuple,
  end: LngLatTuple,
  fromName: string,
  toName: string,
  cityHint?: string,
  cityDestinationHint?: string
): Promise<RouteLegResult> {
  const directDistance = haversineDistanceMeters(start, end)
  try {
    const result = await requestRouteLegByWebService("transit", {
      origin: start,
      destination: end,
      fromName,
      toName,
      city: cityHint,
      cityd: cityDestinationHint,
    })
    if (result.status === "success") {
      return result
    }
    throw new Error(result.message || "当前路段暂无可用公交换乘方案")
  } catch (error) {
    const analysis = analyzeAmapError(
      error,
      "当前路段暂无可用公交换乘方案，已按预估通勤时间展示"
    )
    const fallbackLeg = createEstimatedLeg({
      fromName,
      toName,
      mode: "transit",
      directDistanceMeters: directDistance,
      message: analysis.userMessage,
      multiplier: 1.28,
    })
    return {
      ...fallbackLeg,
      polylinePaths: [[start, end]],
    }
  }
}

export function MapView({
  spots,
  transportMode,
  routeMode,
  fromMeTarget,
  fromMeOrigin = null,
  fromMeRequestId,
  routeSegmentIds: routeSegmentIdsProp,
  highlightedSpotId = null,
  highlightedSegmentId = null,
  onSpotClick,
  onSegmentClick,
  onSummaryChange,
  onRouteLegsChange,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapMapInstance | null>(null)
  const amapRef = useRef<AMapNamespace | null>(null)
  const markerRefs = useRef<unknown[]>([])
  const polylineRefs = useRef<AMapPolylineInstance[]>([])
  const markerMetaRef = useRef<MarkerMeta[]>([])
  const segmentMetaRef = useRef<SegmentMeta[]>([])
  const userMarkerRef = useRef<AMapMarkerInstance | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const routeTaskIdRef = useRef(0)
  const locationWatchIdRef = useRef<number | null>(null)
  const latestUserLocationRef = useRef<LngLatTuple | null>(null)
  const hasCenteredUserRef = useRef(false)
  const spotsCountRef = useRef(spots.length)
  const locationFallbackTriedRef = useRef(false)
  const onSummaryChangeRef = useRef(onSummaryChange)
  const onRouteLegsChangeRef = useRef(onRouteLegsChange)

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
  const [userLocationReady, setUserLocationReady] = useState(false)

  const isFromMeMode = routeMode === "fromMe"
  const routeSegmentIds = routeSegmentIdsProp ?? EMPTY_ROUTE_SEGMENT_IDS
  const fromMeLocationSignal = isFromMeMode
    ? `${userLocationStatus}:${userLocationReady ? "ready" : "none"}`
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
    onSummaryChangeRef.current = onSummaryChange
  }, [onSummaryChange])

  useEffect(() => {
    onRouteLegsChangeRef.current = onRouteLegsChange
  }, [onRouteLegsChange])

  useEffect(() => {
    onSummaryChangeRef.current?.(summary)
  }, [summary])

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

    if (markerRefs.current.length > 0) {
      map.remove(markerRefs.current)
      markerRefs.current = []
    }
    markerMetaRef.current = []

    if (polylineRefs.current.length > 0) {
      map.remove(polylineRefs.current)
      polylineRefs.current.forEach((polyline) => polyline.setMap(null))
      polylineRefs.current = []
    }
    segmentMetaRef.current = []
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
    setUserLocationReady(false)
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
      setUserLocationReady(true)
      return
    }

    userMarkerRef.current.setPosition(lngLat)
    setUserLocationReady(true)
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
        const AMap = await withTimeout(
          loadAMap([
            "AMap.ToolBar",
            "AMap.Scale",
            "AMap.Geocoder",
            "AMap.PlaceSearch",
          ]),
          AMAP_LOAD_TIMEOUT_MS,
          "高德地图加载超时，请检查网络或 Key 配置"
        )
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
          if (!rawError) return
          const analysis = analyzeAmapError(
            rawError,
            "地图瓦片加载异常，请检查 Key 白名单或安全配置"
          )
          const knownFatal = new Set([
            "INVALID_USER_SCODE",
            "USERKEY_PLAT_NOMATCH",
            "INVALID_USER_KEY",
          ])
          if (!analysis.code || !knownFatal.has(analysis.code)) return
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

        if (AMap.ToolBar) {
          map.addControl(
            new AMap.ToolBar({
              locate: false,
              direction: false,
            })
          )
        }
        if (AMap.Scale) {
          map.addControl(new AMap.Scale())
        }
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
    if (!map || !AMap || mapError) {
      setIsRouteLoading(false)
      return
    }

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
      onRouteLegsChangeRef.current?.([])
      let runtimeAMap = AMap

      try {
        runtimeAMap = await loadAMap(["AMap.Geocoder", "AMap.PlaceSearch"])
        amapRef.current = runtimeAMap
      } catch {
        // 保留底图可用性：扩展插件失败不阻塞地图展示。
      }

      if (isFromMeMode) {
        if (!fromMeTarget) {
          onRouteLegsChangeRef.current?.([])
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
          const { resolved, unresolved } = await resolveSpotCoordinates(runtimeAMap, [
            fromMeTarget,
          ])
          if (routeTaskIdRef.current !== currentTaskId) return

          if (resolved.length === 0) {
            onRouteLegsChangeRef.current?.([])
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
          const destinationMarker = new runtimeAMap.Marker({
            position: destination.lngLat,
            title: destination.spot.name,
            content: createMapMarkerHtml({
              order: 1,
              type: destination.spot.type,
              isStart: false,
              isEnd: true,
              isSelected:
                highlightedSpotId !== null
                  ? highlightedSpotId === destination.spot.id
                  : true,
              isKeyStop: destination.spot.type !== "attraction",
            }),
            offset: new runtimeAMap.Pixel(-18, -18),
            zIndex: 160,
          })
          if (typeof destinationMarker.on === "function") {
            destinationMarker.on("click", () => onSpotClick?.(destination.spot.id))
          }
          markerRefs.current = [destinationMarker]
          markerMetaRef.current = [
            {
              spotId: destination.spot.id,
              marker: destinationMarker,
              index: 0,
              total: 1,
              name: destination.spot.name,
              type: destination.spot.type,
              isStart: false,
              isEnd: true,
              isKeyStop: destination.spot.type !== "attraction",
            },
          ]
          applyMarkerVisual(
            markerMetaRef.current[0],
            highlightedSpotId ?? destination.spot.id
          )
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
            onRouteLegsChangeRef.current?.([])
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

          const leg =
            transportMode === "driving"
              ? await planDrivingLeg(
                  startPoint,
                  destination.lngLat,
                  "我的位置",
                  destination.spot.name
                )
              : transportMode === "walking"
              ? await planWalkingLeg(
                  startPoint,
                  destination.lngLat,
                  "我的位置",
                  destination.spot.name
                )
              : await planTransitLeg(
                  startPoint,
                  destination.lngLat,
                  "我的位置",
                  destination.spot.name,
                  fromMeTarget.city,
                  destination.spot.city
                )

          if (routeTaskIdRef.current !== currentTaskId) return

          const aggregate = aggregateRouteLegs(transportMode, [leg])
          onRouteLegsChangeRef.current?.([leg])
          const singleSegmentId = routeSegmentIds[0] || `${destination.spot.id}-from-me`
          const segmentPolylines = createLegPolylines(
            runtimeAMap,
            transportMode,
            leg,
            highlightedSegmentId === singleSegmentId
          )
          if (segmentPolylines.length > 0) {
            segmentPolylines.forEach((polyline) => {
              if (typeof polyline.on === "function") {
                polyline.on("click", () => onSegmentClick?.(singleSegmentId))
              }
            })
            map.add(segmentPolylines)
            polylineRefs.current = segmentPolylines
            segmentMetaRef.current = [
              {
                id: singleSegmentId,
                mode: transportMode,
                status: leg.status,
                fromSpotId: "from-me-origin",
                toSpotId: destination.spot.id,
                polylines: segmentPolylines,
              },
            ]
          } else {
            segmentMetaRef.current = []
          }

          const overlays: unknown[] = [...viewOverlays, ...segmentPolylines]
          map.setFitView(overlays)
          requestAnimationFrame(() => map.resize())

          const legMessages =
            leg.status === "success" || !leg.message
              ? []
              : [`${leg.fromName} → ${leg.toName}：${leg.message}`]
          updateSummary(
            createSummary(transportMode, {
              ...resolvedBase,
              status: getSummaryStatusFromAggregate(aggregate),
              distance: aggregate.totalDistanceMeters,
              duration: aggregate.totalDurationSeconds,
              distanceText: formatDistance(aggregate.totalDistanceMeters),
              durationText: formatDuration(aggregate.totalDurationSeconds),
              message: getAggregateMessage(transportMode, aggregate),
              partialErrors: [...partialErrors, ...legMessages],
              fallbackRouteUrl:
                aggregate.state === "success" ? "" : fallbackRouteUrl,
            })
          )
          return
        } catch (error) {
          onRouteLegsChangeRef.current?.([])
          if (routeTaskIdRef.current !== currentTaskId) return
          const analysis = analyzeAmapError(error, "路线规划失败，请稍后重试")
          updateSummary(
            createSummary(transportMode, {
              ...baseNames,
              status: "error",
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
        onRouteLegsChangeRef.current?.([])
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
        const { resolved, unresolved } = await resolveSpotCoordinates(runtimeAMap, spots)
        if (routeTaskIdRef.current !== currentTaskId) return

        if (resolved.length === 0) {
          onRouteLegsChangeRef.current?.([])
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

        const markerMeta: MarkerMeta[] = []
        const markers = resolved.map((item, index) => {
          const isStart = index === 0
          const isEnd = index === resolved.length - 1
          const isKeyStop = item.spot.type === "restaurant" || item.spot.type === "hotel"
          const marker = new runtimeAMap.Marker({
            position: item.lngLat,
            title: item.spot.name,
            content: createMapMarkerHtml({
              order: index + 1,
              type: item.spot.type,
              isStart,
              isEnd,
              isSelected: highlightedSpotId === item.spot.id,
              isKeyStop,
            }),
            offset: new runtimeAMap.Pixel(-18, -18),
            zIndex: highlightedSpotId === item.spot.id ? 180 : isStart || isEnd ? 150 : 120,
          })
          if (typeof marker.on === "function") {
            marker.on("click", () => onSpotClick?.(item.spot.id))
          }
          markerMeta.push({
            spotId: item.spot.id,
            marker,
            index,
            total: resolved.length,
            name: item.spot.name,
            type: item.spot.type,
            isStart,
            isEnd,
            isKeyStop,
          })
          return marker
        })

        markerRefs.current = markers
        markerMetaRef.current = markerMeta
        markerMeta.forEach((meta) => applyMarkerVisual(meta, highlightedSpotId))
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
          onRouteLegsChangeRef.current?.([])
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

        const legs: RouteLegResult[] = []
        const legIssues: string[] = []
        const legPolylines: AMapPolylineInstance[] = []
        const segmentMetas: SegmentMeta[] = []
        for (let index = 0; index < resolved.length - 1; index += 1) {
          const current = resolved[index]
          const next = resolved[index + 1]

          const leg =
            transportMode === "driving"
              ? await planDrivingLeg(
                  current.lngLat,
                  next.lngLat,
                  current.spot.name,
                  next.spot.name
                )
              : transportMode === "walking"
              ? await planWalkingLeg(
                  current.lngLat,
                  next.lngLat,
                  current.spot.name,
                  next.spot.name
                )
              : await planTransitLeg(
                  current.lngLat,
                  next.lngLat,
                  current.spot.name,
                  next.spot.name,
                  current.spot.city || resolved[0]?.spot.city,
                  next.spot.city || current.spot.city || resolved[0]?.spot.city
                )

          if (routeTaskIdRef.current !== currentTaskId) return

          legs.push(leg)
          if (leg.status !== "success" && leg.message) {
            legIssues.push(`${leg.fromName} → ${leg.toName}：${leg.message}`)
          }
          const segmentId =
            routeSegmentIds[index] || `d-${current.spot.id}-${next.spot.id}`
          const segmentPolylines = createLegPolylines(
            runtimeAMap,
            transportMode,
            leg,
            highlightedSegmentId === segmentId
          )
          segmentPolylines.forEach((polyline) => {
            if (typeof polyline.on === "function") {
              polyline.on("click", () => onSegmentClick?.(segmentId))
            }
          })
          segmentMetas.push({
            id: segmentId,
            mode: transportMode,
            status: leg.status,
            fromSpotId: current.spot.id,
            toSpotId: next.spot.id,
            polylines: segmentPolylines,
          })
          legPolylines.push(...segmentPolylines)
        }

        const aggregate = aggregateRouteLegs(transportMode, legs)
        onRouteLegsChangeRef.current?.(legs)
        if (legPolylines.length > 0) {
          map.add(legPolylines)
          polylineRefs.current = legPolylines
          segmentMetaRef.current = segmentMetas
          map.setFitView([...markers, ...legPolylines])
        } else {
          segmentMetaRef.current = []
          map.setFitView(markers)
        }
        requestAnimationFrame(() => map.resize())

        const totalPartialErrors = [...partialErrors, ...legIssues]
        let summaryStatus = getSummaryStatusFromAggregate(aggregate)
        if (summaryStatus === "success" && totalPartialErrors.length > 0) {
          summaryStatus = "partial-success"
        }

        updateSummary(
          createSummary(transportMode, {
            ...resolvedBase,
            status: summaryStatus,
            distance: aggregate.totalDistanceMeters,
            duration: aggregate.totalDurationSeconds,
            distanceText: formatDistance(aggregate.totalDistanceMeters),
            durationText: formatDuration(aggregate.totalDurationSeconds),
            message: getAggregateMessage(transportMode, aggregate),
            partialErrors: totalPartialErrors,
            fallbackRouteUrl:
              aggregate.state === "success" ? "" : fallbackRouteUrl,
          })
        )
      } catch (error) {
        onRouteLegsChangeRef.current?.([])
        if (routeTaskIdRef.current !== currentTaskId) return
        const analysis = analyzeAmapError(error, "路线规划失败，请稍后重试")
        updateSummary(
          createSummary(transportMode, {
            ...baseNames,
            status: "error",
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
    routeSegmentIds,
    spots,
    transportMode,
    upsertUserLocationMarker,
    updateSummary,
  ])

  useEffect(() => {
    if (!mapError) return
    setIsMapLoading(false)
    setIsRouteLoading(false)
  }, [mapError])

  useEffect(() => {
    if (!isMapLoading && !isRouteLoading) return

    const timeoutId = window.setTimeout(() => {
      if (mapError) return

      setIsMapLoading(false)
      setIsRouteLoading(false)

      if (!mapRef.current) {
        setMapError("地图加载超时，请检查网络与高德配置后重试")
        setSummary((prev) => ({
          ...prev,
          mode: transportModeRef.current,
          status: "map-error",
          message: "地图加载超时，请检查网络与高德配置后重试",
        }))
        return
      }

      setSummary((prev) => {
        if (prev.status !== "loading") return prev
        return {
          ...prev,
          mode: transportModeRef.current,
          status: "route-error",
          message: "路线规划超时，请稍后重试或切换出行方式",
        }
      })
    }, 15000)

    return () => window.clearTimeout(timeoutId)
  }, [isMapLoading, isRouteLoading, mapError])

  useEffect(() => {
    if (markerMetaRef.current.length === 0) return
    for (const meta of markerMetaRef.current) {
      applyMarkerVisual(meta, highlightedSpotId)
    }

    if (!highlightedSpotId) return
    const target = markerMetaRef.current.find((item) => item.spotId === highlightedSpotId)
    const map = mapRef.current
    if (!target || !map) return

    const position = ensureLngLat(target.marker.getPosition?.())
    if (position) {
      map.setCenter(position)
    }
  }, [highlightedSpotId])

  useEffect(() => {
    if (segmentMetaRef.current.length === 0) return
    const map = mapRef.current
    let focusOverlays: unknown[] = []

    for (const segment of segmentMetaRef.current) {
      const isHighlighted = Boolean(
        highlightedSegmentId && segment.id === highlightedSegmentId
      )
      const style = getRouteStrokeStyle(segment.mode, segment.status, isHighlighted)
      segment.polylines.forEach((polyline) => {
        polyline.setOptions?.(style)
      })
      if (isHighlighted) {
        focusOverlays = [...focusOverlays, ...segment.polylines]
      }
    }

    if (focusOverlays.length > 0 && map) {
      const selected = segmentMetaRef.current.find((item) => item.id === highlightedSegmentId)
      const startMarker = markerMetaRef.current.find((item) => item.spotId === selected?.fromSpotId)?.marker
      const endMarker = markerMetaRef.current.find((item) => item.spotId === selected?.toSpotId)?.marker
      if (startMarker) focusOverlays.push(startMarker)
      if (endMarker) focusOverlays.push(endMarker)
      map.setFitView(focusOverlays)
    }
  }, [highlightedSegmentId])

  return (
    <div className="relative w-full h-[360px] rounded-2xl overflow-hidden bg-secondary">
      <div ref={mapContainerRef} className="w-full h-full" />

      {!isMapLoading && !mapError && (
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div className="max-w-[70%] truncate rounded-full border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-2.5 py-1.5 text-[11px] text-[var(--app-text-secondary)] shadow-sm">
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
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-line)] bg-[var(--app-surface-elevated)] text-[var(--app-text-primary)] shadow-sm disabled:opacity-40"
            title="定位到当前位置"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>
      )}

      {(isMapLoading || isRouteLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[color:rgba(243,241,235,0.72)] backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-2 text-sm text-[var(--app-text-secondary)]">
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
        <div className="absolute inset-0 flex items-center justify-center bg-[color:rgba(245,233,231,0.95)] px-5">
          <div className="text-center text-sm leading-6 text-[var(--app-error)]">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>地图加载失败</p>
            <p className="mt-1 text-xs opacity-90">当前无法加载地图，请检查高德配置或稍后重试。</p>
            {mapError && <p className="mt-1 text-xs opacity-90">详细原因：{mapError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
