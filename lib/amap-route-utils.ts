import type { LngLatTuple } from "@/lib/amap-types"

export type RouteTransportMode = "driving" | "walking" | "transit"
export type RouteLegStatus = "success" | "fallback" | "failed"
export type TransitStepType = "walk" | "bus" | "subway" | "transfer"

export interface TransitStep {
  type: TransitStepType
  instruction: string
  lineName?: string
  departureStop?: string
  arrivalStop?: string
  stopCount?: number
  durationSeconds?: number
  distanceMeters?: number
}

export interface RouteLegResult {
  fromName: string
  toName: string
  mode: RouteTransportMode
  status: RouteLegStatus
  distanceMeters: number
  durationSeconds: number
  readableDistance: string
  readableDuration: string
  polylinePaths?: Array<LngLatTuple[]>
  message?: string
  isEstimated?: boolean
  transitLineSummary?: string[]
  transitTransferCount?: number
  transitSteps?: TransitStep[]
}

export type RouteAggregateState = "success" | "partial-success" | "fallback" | "error"

export interface RoutePlanResult {
  mode: RouteTransportMode
  legs: RouteLegResult[]
  totalDistanceMeters: number
  totalDurationSeconds: number
  hasFallback: boolean
  hasFailure: boolean
  state: RouteAggregateState
  summaryMessage?: string
}

const WALKING_SPEED_METER_PER_SECOND = 1.25
const TRANSIT_SPEED_METER_PER_SECOND = 5.6
const DRIVING_SPEED_METER_PER_SECOND = 10

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

export function haversineDistanceMeters(from: LngLatTuple, to: LngLatTuple) {
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

function getEstimatedDuration(distanceMeters: number, mode: RouteTransportMode) {
  const speed =
    mode === "walking"
      ? WALKING_SPEED_METER_PER_SECOND
      : mode === "transit"
      ? TRANSIT_SPEED_METER_PER_SECOND
      : DRIVING_SPEED_METER_PER_SECOND
  return Math.max(60, Math.round(distanceMeters / speed))
}

export function createEstimatedLeg(params: {
  fromName: string
  toName: string
  mode: RouteTransportMode
  directDistanceMeters: number
  message: string
  multiplier?: number
  status?: RouteLegStatus
}) {
  const multipliedDistance = Math.max(
    300,
    Math.round(params.directDistanceMeters * (params.multiplier ?? 1.18))
  )
  const durationSeconds = getEstimatedDuration(multipliedDistance, params.mode)
  return {
    fromName: params.fromName,
    toName: params.toName,
    mode: params.mode,
    status: params.status ?? "fallback",
    distanceMeters: multipliedDistance,
    durationSeconds,
    readableDistance: formatDistance(multipliedDistance),
    readableDuration: formatDuration(durationSeconds),
    message: params.message,
    isEstimated: true,
  } satisfies RouteLegResult
}

export function aggregateRouteLegs(
  mode: RouteTransportMode,
  legs: RouteLegResult[]
): RoutePlanResult {
  const totalDistanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0)
  const totalDurationSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0)
  const hasFallback = legs.some((leg) => leg.status === "fallback")
  const hasFailure = legs.some((leg) => leg.status === "failed")
  const allFallback = legs.length > 0 && legs.every((leg) => leg.status === "fallback")
  const allFailed = legs.length > 0 && legs.every((leg) => leg.status === "failed")

  let state: RouteAggregateState = "success"
  if (allFailed) state = "error"
  else if (allFallback) state = "fallback"
  else if (hasFallback || hasFailure) state = "partial-success"

  return {
    mode,
    legs,
    totalDistanceMeters,
    totalDurationSeconds,
    hasFallback,
    hasFailure,
    state,
  }
}

export function normalizeTransitCity(city?: string) {
  const text = (city || "").trim()
  if (!text) return "北京市"
  if (text.endsWith("市")) return text
  return `${text}市`
}

