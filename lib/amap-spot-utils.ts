import { sampleSpots, type Spot } from "@/lib/travel-context"
import type {
  AMapGeocodeResult,
  AMapNamespace,
  AMapPlaceSearchResult,
  AMapServiceStatus,
  LngLatTuple,
} from "@/lib/amap-types"

type CoordinateSource = "spot" | "geocode" | "place-search" | "local-dataset"

export interface ResolvedSpotCoordinate {
  spot: Spot
  lngLat: LngLatTuple
  source: CoordinateSource
}

export interface UnresolvedSpotCoordinate {
  spot: Spot
  reason: string
}

export interface ResolveSpotCoordinatesResult {
  resolved: ResolvedSpotCoordinate[]
  unresolved: UnresolvedSpotCoordinate[]
}

const coordinateCache = new Map<string, LngLatTuple | null>()

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function isValidLongitude(value: number) {
  return value >= -180 && value <= 180
}

function isValidLatitude(value: number) {
  return value >= -90 && value <= 90
}

function normalizeLngLat(
  firstValue: unknown,
  secondValue: unknown
): LngLatTuple | null {
  const first = parseNumber(firstValue)
  const second = parseNumber(secondValue)
  if (first === null || second === null) return null

  const normalPair: LngLatTuple | null =
    isValidLongitude(first) && isValidLatitude(second)
      ? [first, second]
      : null

  const swappedPair: LngLatTuple | null =
    isValidLongitude(second) && isValidLatitude(first)
      ? [second, first]
      : null

  if (normalPair && !swappedPair) return normalPair
  if (!normalPair && swappedPair) return swappedPair
  if (!normalPair && !swappedPair) return null

  // 双向都合法时，优先保留“经度绝对值更大”的顺序，降低经纬度写反风险。
  if (Math.abs(first) < 90 && Math.abs(second) > 90) {
    return swappedPair
  }
  return normalPair
}

function parseLngLatFromText(text: string): LngLatTuple | null {
  const normalizedText = text.trim()
  if (!normalizedText) return null

  const lngMatch = normalizedText.match(
    /(?:lng|lon|longitude|经度)\s*[:：=]?\s*(-?\d+(?:\.\d+)?)/i
  )
  const latMatch = normalizedText.match(
    /(?:lat|latitude|纬度)\s*[:：=]?\s*(-?\d+(?:\.\d+)?)/i
  )
  if (lngMatch?.[1] && latMatch?.[1]) {
    const fromKeyword = normalizeLngLat(lngMatch[1], latMatch[1])
    if (fromKeyword) return fromKeyword
  }

  const compact = normalizedText
    .replace(/[，]/g, ",")
    .replace(/[；;]/g, ",")
    .replace(/\s+/g, " ")
  const pairMatch = compact.match(
    /(-?\d{1,3}(?:\.\d+)?)[,\s|/]+(-?\d{1,3}(?:\.\d+)?)/
  )
  if (pairMatch?.[1] && pairMatch?.[2]) {
    return normalizeLngLat(pairMatch[1], pairMatch[2])
  }

  return null
}

function getValueFromRecord(
  record: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

function extractFromCoordinateObject(
  coordinateObject: Record<string, unknown>
): LngLatTuple | null {
  return normalizeLngLat(
    getValueFromRecord(coordinateObject, ["lng", "longitude"]),
    getValueFromRecord(coordinateObject, ["lat", "latitude"])
  )
}

function extractFromUnknownCoordinateValue(value: unknown): LngLatTuple | null {
  if (!value) return null

  if (typeof value === "string") {
    return parseLngLatFromText(value)
  }

  if (Array.isArray(value) && value.length >= 2) {
    return normalizeLngLat(value[0], value[1])
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const directPair = extractFromCoordinateObject(record)
    if (directPair) return directPair

    const nestedValue = getValueFromRecord(record, [
      "coordinates",
      "lnglat",
      "center",
      "location",
      "position",
      "point",
    ])
    if (nestedValue && nestedValue !== value) {
      const nestedPair = extractFromUnknownCoordinateValue(nestedValue)
      if (nestedPair) return nestedPair
    }

    const textValue = normalizeText(
      getValueFromRecord(record, [
        "text",
        "value",
        "address",
        "formattedAddress",
        "location",
      ])
    )
    if (textValue) {
      const fromText = parseLngLatFromText(textValue)
      if (fromText) return fromText
    }
  }

  return null
}

export function getSpotLngLat(spot: Spot): LngLatTuple | null {
  const source = spot as unknown as Record<string, unknown>

  const fromLocation = extractFromUnknownCoordinateValue(source.location)
  if (fromLocation) return fromLocation

  const directPair = normalizeLngLat(
    getValueFromRecord(source, ["lng", "longitude"]),
    getValueFromRecord(source, ["lat", "latitude"])
  )
  if (directPair) return directPair

  const fromCoordinates = extractFromUnknownCoordinateValue(source.coordinates)
  if (fromCoordinates) return fromCoordinates

  const fromLngLatField = extractFromUnknownCoordinateValue(source.lnglat)
  if (fromLngLatField) return fromLngLatField

  const fromPositionField = extractFromUnknownCoordinateValue(source.position)
  if (fromPositionField) return fromPositionField

  const textCandidates = [
    normalizeText(source.address),
    normalizeText(source.location),
    normalizeText(source.coordinates),
    normalizeText(source.description),
  ]
  for (const candidate of textCandidates) {
    if (!candidate) continue
    const fromText = parseLngLatFromText(candidate)
    if (fromText) return fromText
  }

  return null
}

function toLngLatTupleFromAMapLocation(location: unknown): LngLatTuple | null {
  if (!location || typeof location !== "object") return null
  const locationRecord = location as Record<string, unknown>

  const lng =
    parseNumber(locationRecord.lng) ??
    parseNumber(
      typeof locationRecord.getLng === "function"
        ? (locationRecord.getLng as () => unknown)()
        : undefined
    )
  const lat =
    parseNumber(locationRecord.lat) ??
    parseNumber(
      typeof locationRecord.getLat === "function"
        ? (locationRecord.getLat as () => unknown)()
        : undefined
    )

  return normalizeLngLat(lng, lat)
}

function buildCacheKey(spot: Spot) {
  const source = spot as unknown as Record<string, unknown>
  const city =
    typeof source.city === "string" ? source.city.trim().toLowerCase() : ""
  const name = typeof spot.name === "string" ? spot.name.trim().toLowerCase() : ""
  const address =
    typeof spot.address === "string" ? spot.address.trim().toLowerCase() : ""
  return [spot.id, city, name, address].join("|")
}

function getQueryCandidates(spot: Spot) {
  const source = spot as unknown as Record<string, unknown>
  const city = normalizeText(source.city)
  const address = normalizeText(source.address)
  const name = normalizeText(source.name)
  const candidates = new Set<string>()

  if (address) candidates.add(address)
  if (city && address) candidates.add(`${city}${address}`)
  if (city && address) candidates.add(`${city} ${address}`)
  if (name) candidates.add(name)
  if (city && name) candidates.add(`${city}${name}`)
  if (city && name) candidates.add(`${city} ${name}`)

  return [...candidates]
}

function formatSpotLabel(spot: Spot) {
  const source = spot as unknown as Record<string, unknown>
  return (
    normalizeText(source.name) ||
    normalizeText(source.address) ||
    `景点(${spot.id})`
  )
}

function normalizeLookupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•\-_,，。；;:：'"`~!@#$%^&*()（）【】[\]{}<>《》/\\|]/g, "")
}

const localDatasetCoordinates = sampleSpots
  .map((sampleSpot) => {
    const lngLat = getSpotLngLat(sampleSpot)
    if (!lngLat) return null
    const keys = [
      normalizeLookupText(sampleSpot.name || ""),
      normalizeLookupText(sampleSpot.address || ""),
    ].filter((item) => item.length >= 2)
    return {
      keys,
      lngLat,
    }
  })
  .filter((item): item is { keys: string[]; lngLat: LngLatTuple } => Boolean(item))

function resolveFromLocalDataset(spot: Spot): LngLatTuple | null {
  const candidates = [
    normalizeLookupText(normalizeText((spot as unknown as Record<string, unknown>).name)),
    normalizeLookupText(
      normalizeText((spot as unknown as Record<string, unknown>).address)
    ),
  ].filter((item) => item.length >= 2)

  if (candidates.length === 0) return null

  for (const entry of localDatasetCoordinates) {
    for (const candidate of candidates) {
      if (
        entry.keys.some(
          (key) =>
            key === candidate || key.includes(candidate) || candidate.includes(key)
        )
      ) {
        return entry.lngLat
      }
    }
  }

  return null
}

function geocodeAddress(
  AMap: AMapNamespace,
  address: string,
  city?: string
): Promise<LngLatTuple | null> {
  const geocoder = new AMap.Geocoder({ city })
  return new Promise((resolve) => {
    geocoder.getLocation(
      address,
      (status: AMapServiceStatus, result: AMapGeocodeResult) => {
        if (status !== "complete" || !result.geocodes?.length) {
          resolve(null)
          return
        }
        resolve(toLngLatTupleFromAMapLocation(result.geocodes[0]?.location))
      }
    )
  })
}

function placeSearchAddress(
  AMap: AMapNamespace,
  keyword: string,
  city?: string
): Promise<LngLatTuple | null> {
  const placeSearch = new AMap.PlaceSearch({
    city,
    citylimit: false,
    pageSize: 1,
    pageIndex: 1,
  })

  return new Promise((resolve) => {
    placeSearch.search(
      keyword,
      (status: AMapServiceStatus, result: AMapPlaceSearchResult) => {
        if (status !== "complete") {
          resolve(null)
          return
        }
        const poi = result.poiList?.pois?.[0]
        resolve(toLngLatTupleFromAMapLocation(poi?.location))
      }
    )
  })
}

async function resolveSpotCoordinateWithFallback(
  AMap: AMapNamespace,
  spot: Spot
): Promise<{ lngLat: LngLatTuple | null; source?: CoordinateSource }> {
  const cacheKey = buildCacheKey(spot)
  if (coordinateCache.has(cacheKey)) {
    return { lngLat: coordinateCache.get(cacheKey) ?? null }
  }

  const source = spot as unknown as Record<string, unknown>
  const city = typeof source.city === "string" ? source.city.trim() : undefined
  const queries = getQueryCandidates(spot)

  for (const query of queries) {
    const geocodeResult = await geocodeAddress(AMap, query, city)
    if (geocodeResult) {
      coordinateCache.set(cacheKey, geocodeResult)
      return { lngLat: geocodeResult, source: "geocode" }
    }
  }

  for (const query of queries) {
    const placeSearchResult = await placeSearchAddress(AMap, query, city)
    if (placeSearchResult) {
      coordinateCache.set(cacheKey, placeSearchResult)
      return { lngLat: placeSearchResult, source: "place-search" }
    }
  }

  const localDatasetResult = resolveFromLocalDataset(spot)
  if (localDatasetResult) {
    coordinateCache.set(cacheKey, localDatasetResult)
    return { lngLat: localDatasetResult, source: "local-dataset" }
  }

  coordinateCache.set(cacheKey, null)
  return { lngLat: null }
}

export async function resolveSpotCoordinates(
  AMap: AMapNamespace,
  spots: Spot[]
): Promise<ResolveSpotCoordinatesResult> {
  const resolved: ResolvedSpotCoordinate[] = []
  const unresolved: UnresolvedSpotCoordinate[] = []

  for (const spot of spots) {
    const directLngLat = getSpotLngLat(spot)
    if (directLngLat) {
      resolved.push({ spot, lngLat: directLngLat, source: "spot" })
      continue
    }

    const fallbackResult = await resolveSpotCoordinateWithFallback(AMap, spot)
    if (fallbackResult.lngLat) {
      resolved.push({
        spot,
        lngLat: fallbackResult.lngLat,
        source: fallbackResult.source ?? "geocode",
      })
      continue
    }

    unresolved.push({
      spot,
      reason: `无法解析“${formatSpotLabel(spot)}”的坐标，已自动跳过`,
    })
  }

  return { resolved, unresolved }
}

export async function resolveSingleSpotCoordinate(
  AMap: AMapNamespace,
  spot: Spot
) {
  const { resolved, unresolved } = await resolveSpotCoordinates(AMap, [spot])
  if (resolved.length > 0) {
    return {
      ok: true as const,
      lngLat: resolved[0].lngLat,
      source: resolved[0].source,
      reason: "",
    }
  }

  return {
    ok: false as const,
    lngLat: null,
    source: undefined,
    reason: unresolved[0]?.reason || "无法解析该景点坐标",
  }
}

export function formatDistance(distanceInMeter: number) {
  if (!Number.isFinite(distanceInMeter) || distanceInMeter <= 0) return "0 米"
  if (distanceInMeter < 1000) return `${Math.round(distanceInMeter)} 米`
  return `${(distanceInMeter / 1000).toFixed(1)} 公里`
}

export function formatDuration(durationInSecond: number) {
  if (!Number.isFinite(durationInSecond) || durationInSecond <= 0) return "0 分钟"
  const hours = Math.floor(durationInSecond / 3600)
  const minutes = Math.max(1, Math.round((durationInSecond % 3600) / 60))
  if (hours <= 0) return `${minutes} 分钟`
  return `${hours} 小时 ${minutes} 分钟`
}
