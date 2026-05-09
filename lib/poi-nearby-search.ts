import "server-only"

import {
  normalizeAmapPoiToProviderItem,
  type PoiEntityType,
  type PoiProviderItem,
} from "@/lib/poi-normalizer"
import type { LngLatTuple } from "@/lib/amap-types"

interface AmapPlaceResponse {
  status?: string
  info?: string
  infocode?: string
  pois?: Array<Record<string, unknown>>
}

const AMAP_REST_BASE = "https://restapi.amap.com"
const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10000
const CACHE = new Map<string, { expireAt: number; value: PoiProviderItem[] }>()
const IN_FLIGHT = new Map<string, Promise<PoiProviderItem[]>>()

function getWebServiceKey() {
  return process.env.AMAP_WEB_SERVICE_KEY?.trim() || ""
}

function getTypeCodeByEntity(entity: PoiEntityType) {
  if (entity === "food") return "050000"
  if (entity === "hotel") return "100000"
  return "110000"
}

function normalizeCoord(value: number) {
  return Number(value.toFixed(6))
}

function toCoordText(coord: LngLatTuple) {
  return `${coord[0]},${coord[1]}`
}

function normalizeForCache(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCache(item))
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const normalized: Record<string, unknown> = {}
    for (const key of keys) {
      normalized[key] = normalizeForCache(record[key])
    }
    return normalized
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(6))
  }
  return value
}

function buildCacheKey(scope: string, payload: Record<string, unknown>) {
  return `${scope}:${JSON.stringify(normalizeForCache(payload))}`
}

function getCached(key: string) {
  const cached = CACHE.get(key)
  if (!cached) return null
  if (Date.now() > cached.expireAt) {
    CACHE.delete(key)
    return null
  }
  return cached.value
}

function setCached(key: string, value: PoiProviderItem[]) {
  CACHE.set(key, {
    expireAt: Date.now() + CACHE_TTL_MS,
    value,
  })
}

async function requestAmap(pathname: string, params: URLSearchParams) {
  const key = getWebServiceKey()
  if (!key) return null
  params.set("key", key)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${AMAP_REST_BASE}${pathname}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as AmapPlaceResponse
    if (payload.status !== "1") return null
    return payload
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function normalizeCity(city?: string) {
  const text = (city || "").trim().replace(/\u5e02$/u, "")
  return text || "\u5317\u4eac"
}

async function getCachedOrFetch(
  scope: "nearby" | "text",
  payload: Record<string, unknown>,
  fetcher: () => Promise<PoiProviderItem[]>
) {
  const cacheKey = buildCacheKey(scope, payload)
  const cached = getCached(cacheKey)
  if (cached) return cached

  const existing = IN_FLIGHT.get(cacheKey)
  if (existing) return existing

  const request = fetcher().then((result) => {
    setCached(cacheKey, result)
    return result
  }).finally(() => {
    IN_FLIGHT.delete(cacheKey)
  })

  IN_FLIGHT.set(cacheKey, request)
  return request
}

export async function searchNearbyFromAmap(input: {
  anchor: LngLatTuple
  city?: string
  type: PoiEntityType
  radius: number
  limit: number
}): Promise<PoiProviderItem[]> {
  const city = normalizeCity(input.city)
  if (city !== "\u5317\u4eac") return []

  const payload = {
    city,
    type: input.type,
    anchor: [normalizeCoord(input.anchor[0]), normalizeCoord(input.anchor[1])],
    radius: Math.max(200, Math.min(5000, input.radius)),
    limit: Math.max(1, Math.min(30, input.limit)),
  }

  return getCachedOrFetch("nearby", payload, async () => {
    const params = new URLSearchParams({
      location: toCoordText(payload.anchor as LngLatTuple),
      radius: String(payload.radius),
      city,
      sortrule: "distance",
      offset: String(payload.limit),
      page: "1",
      extensions: "all",
      types: getTypeCodeByEntity(input.type),
    })

    const response = await requestAmap("/v3/place/around", params)
    const items =
      response?.pois
        ?.map((raw) =>
          normalizeAmapPoiToProviderItem({
            raw: raw as Record<string, unknown>,
            source: "amap_nearby",
            defaultType: input.type,
          })
        )
        .filter((item): item is PoiProviderItem => Boolean(item)) || []

    return items
  })
}

export async function searchTextFromAmap(input: {
  city?: string
  type: PoiEntityType
  keyword: string
  limit: number
}): Promise<PoiProviderItem[]> {
  const city = normalizeCity(input.city)
  if (city !== "\u5317\u4eac") return []
  const keyword = input.keyword.trim()
  if (!keyword) return []

  const payload = {
    city,
    type: input.type,
    keyword,
    limit: Math.max(1, Math.min(30, input.limit)),
  }

  return getCachedOrFetch("text", payload, async () => {
    const params = new URLSearchParams({
      city,
      citylimit: "true",
      keywords: keyword,
      offset: String(payload.limit),
      page: "1",
      extensions: "all",
      types: getTypeCodeByEntity(input.type),
    })

    const response = await requestAmap("/v3/place/text", params)
    const items =
      response?.pois
        ?.map((raw) =>
          normalizeAmapPoiToProviderItem({
            raw: raw as Record<string, unknown>,
            source: "amap_text",
            defaultType: input.type,
          })
        )
        .filter((item): item is PoiProviderItem => Boolean(item)) || []

    return items
  })
}
