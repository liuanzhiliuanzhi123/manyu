import type { LngLatTuple } from "@/lib/amap-types"
import type { PoiEntityType, PoiProviderItem } from "@/lib/poi-normalizer"

interface ApiResponse<T> {
  ok: boolean
  data?: T
  message?: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE = new Map<string, { expireAt: number; value: PoiProviderItem[] }>()
const IN_FLIGHT = new Map<string, Promise<PoiProviderItem[]>>()

function normalizeNumber(value: unknown, precision = 6) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return Number(parsed.toFixed(precision))
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
  if (typeof value === "number") return normalizeNumber(value)
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

async function postJson<T>(url: string, payload: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    const result = (await response.json()) as ApiResponse<T>
    if (!result.ok || !result.data) return null
    return result.data
  } catch {
    return null
  }
}

async function getCachedOrFetch(
  scope: string,
  payload: Record<string, unknown>,
  url: string
): Promise<PoiProviderItem[]> {
  const cacheKey = buildCacheKey(scope, payload)
  const cached = getCached(cacheKey)
  if (cached) return cached

  const existingRequest = IN_FLIGHT.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = (async () => {
    const data = await postJson<PoiProviderItem[]>(url, payload)
    const result = data || []
    setCached(cacheKey, result)
    return result
  })().finally(() => {
    IN_FLIGHT.delete(cacheKey)
  })

  IN_FLIGHT.set(cacheKey, request)
  return request
}

export async function getNearbyPoiCandidates(input: {
  city: string
  type: PoiEntityType
  anchor: LngLatTuple
  radius?: number
  limit?: number
}): Promise<PoiProviderItem[]> {
  const payload = {
    city: input.city,
    type: input.type,
    anchor: [normalizeNumber(input.anchor[0]), normalizeNumber(input.anchor[1])] as LngLatTuple,
    radius: input.radius ?? 1600,
    limit: input.limit ?? 12,
  }
  return getCachedOrFetch("nearby", payload, "/api/amap/poi/nearby")
}

export async function searchCityPoiCandidates(input: {
  city: string
  type: PoiEntityType
  keyword: string
  limit?: number
}): Promise<PoiProviderItem[]> {
  const payload = {
    city: input.city,
    type: input.type,
    keyword: input.keyword.trim(),
    limit: input.limit ?? 12,
  }
  return getCachedOrFetch("search", payload, "/api/amap/poi/search")
}
