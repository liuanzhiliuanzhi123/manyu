import type { LngLatTuple } from "@/lib/amap-types"
import type { RouteLegResult, RouteTransportMode } from "@/lib/amap-route-utils"

interface RouteLegRequestPayload {
  origin: LngLatTuple
  destination: LngLatTuple
  fromName: string
  toName: string
  city?: string
  cityd?: string
  waypoints?: LngLatTuple[]
}

interface RouteLegResponsePayload {
  ok: boolean
  data?: RouteLegResult
  message?: string
}

const ROUTE_REQUEST_TIMEOUT_MS = 10000
const CACHE_TTL_MS = 3 * 60 * 1000
const ROUTE_CACHE = new Map<string, { expireAt: number; value: RouteLegResult }>()
const IN_FLIGHT = new Map<string, Promise<RouteLegResult>>()

function getRouteApiPath(mode: RouteTransportMode) {
  if (mode === "driving") return "/api/amap/route/driving"
  if (mode === "walking") return "/api/amap/route/walking"
  return "/api/amap/route/transit"
}

function normalizeCoord(value: LngLatTuple): LngLatTuple {
  return [Number(value[0].toFixed(6)), Number(value[1].toFixed(6))]
}

function normalizePayload(payload: RouteLegRequestPayload) {
  return {
    ...payload,
    origin: normalizeCoord(payload.origin),
    destination: normalizeCoord(payload.destination),
    waypoints: payload.waypoints?.map((point) => normalizeCoord(point)),
    city: payload.city?.trim() || "",
    cityd: payload.cityd?.trim() || "",
  }
}

function buildCacheKey(mode: RouteTransportMode, payload: RouteLegRequestPayload) {
  return `${mode}:${JSON.stringify(normalizePayload(payload))}`
}

function getCached(cacheKey: string) {
  const cached = ROUTE_CACHE.get(cacheKey)
  if (!cached) return null
  if (Date.now() > cached.expireAt) {
    ROUTE_CACHE.delete(cacheKey)
    return null
  }
  return cached.value
}

function setCached(cacheKey: string, value: RouteLegResult) {
  ROUTE_CACHE.set(cacheKey, {
    expireAt: Date.now() + CACHE_TTL_MS,
    value,
  })
}

export async function requestRouteLegByWebService(
  mode: RouteTransportMode,
  payload: RouteLegRequestPayload
): Promise<RouteLegResult> {
  const normalizedPayload = normalizePayload(payload)
  const cacheKey = buildCacheKey(mode, normalizedPayload)
  const cached = getCached(cacheKey)
  if (cached) return cached

  const existing = IN_FLIGHT.get(cacheKey)
  if (existing) return existing

  const request = (async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), ROUTE_REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(getRouteApiPath(mode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedPayload),
        signal: controller.signal,
      })
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === "AbortError"
      if (isAbort) {
        const modeText = mode === "walking" ? "步行" : mode === "transit" ? "公交" : "驾车"
        throw new Error(`${modeText}路线请求超时，请稍后重试`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }

    let result: RouteLegResponsePayload | null = null
    try {
      result = (await response.json()) as RouteLegResponsePayload
    } catch {
      result = null
    }

    if (!response.ok || !result?.ok || !result.data) {
      const message =
        result?.message ||
        (mode === "walking"
          ? "步行路线服务暂不可用"
          : mode === "transit"
          ? "公交路线服务暂不可用"
          : "驾车路线服务暂不可用")
      throw new Error(message)
    }

    setCached(cacheKey, result.data)
    return result.data
  })().finally(() => {
    IN_FLIGHT.delete(cacheKey)
  })

  IN_FLIGHT.set(cacheKey, request)
  return request
}
