import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

interface PoiRecord {
  id: string
  slug?: string
  name: string
  province?: string
  city?: string
  district?: string
  category?: string
  sales?: number
  rating?: number
  lng?: number
  lat?: number
  coverImage?: string
}

interface PlaceImageMapItem {
  src?: string
  source?: string
  confidence?: "exact" | "city_related" | "fallback"
  exactQualified?: boolean
}

interface NearbyApiResponse {
  status?: string
  info?: string
  infocode?: string
  pois?: Array<Record<string, unknown>>
}

interface ScriptOptions {
  top: number
  foodRadius: number
  hotelRadius: number
  output: string
}

interface ImageAssessment {
  placeId: string
  placeName: string
  level: "exact" | "city_related" | "fallback"
  source: string
  image: string
}

interface NearbyAssessment {
  placeId: string
  placeName: string
  foodCount: number
  hotelCount: number
  pass: boolean
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const NORMALIZED_DIR = path.join(ROOT_DIR, "data", "normalized")
const POIS_PATH = path.join(NORMALIZED_DIR, "pois.json")
const PLACE_IMAGE_MAP_PATH = path.join(NORMALIZED_DIR, "place-image-map.json")
const BEIJING_IMAGE_MAP_PATH = path.join(NORMALIZED_DIR, "beijing-image-map.json")
const DEFAULT_OUTPUT = path.join(NORMALIZED_DIR, "beijing-quality-report.json")
const DEFAULT_PLACEHOLDER = "/images/placeholders/poi-default.jpg"
const AMAP_REST_BASE = "https://restapi.amap.com"

function toText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

function isPlaceholder(src?: string) {
  const text = (src || "").trim()
  return !text || text.includes("/images/placeholders/")
}

function normalizeCityText(input?: string) {
  return (input || "")
    .trim()
    .replace(/\u5e02$/u, "")
    .replace(/\u7701$/u, "")
    .replace(/\s+/g, "")
}

function isBeijingPoi(poi: PoiRecord) {
  const city = normalizeCityText(poi.city)
  const province = normalizeCityText(poi.province)
  return city === "\u5317\u4eac" || province === "\u5317\u4eac"
}

function parseArgs(argv: string[]): ScriptOptions {
  const args = new Map<string, string>()
  for (const token of argv) {
    if (!token.startsWith("--")) continue
    const [key, value = "true"] = token.slice(2).split("=")
    args.set(key, value)
  }

  const top = Math.max(1, Number(args.get("top") || 100))
  const foodRadius = Math.max(200, Number(args.get("food-radius") || 2000))
  const hotelRadius = Math.max(200, Number(args.get("hotel-radius") || 3000))
  const output = args.get("output")
    ? path.resolve(ROOT_DIR, args.get("output") || "")
    : DEFAULT_OUTPUT

  return { top, foodRadius, hotelRadius, output }
}

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, ".env.local")
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, "utf8")
  for (const line of content.split(/\r?\n/u)) {
    const text = line.trim()
    if (!text || text.startsWith("#")) continue
    const index = text.indexOf("=")
    if (index < 1) continue
    const key = text.slice(0, index).trim()
    const value = text.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")
    if (!key || process.env[key]) continue
    process.env[key] = value
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T
  } catch {
    return fallback
  }
}

function normalizeMapConfidence(item: PlaceImageMapItem) {
  const source = (item.source || "").toLowerCase()
  if (item.confidence === "exact") {
    if (source === "pexels" && item.exactQualified !== true) return "city_related" as const
    return "exact" as const
  }
  if (item.confidence === "city_related") return "city_related" as const
  if (item.confidence === "fallback") return "fallback" as const
  if (source === "pexels") return "city_related" as const
  return "fallback" as const
}

function assessImageQuality(
  poi: PoiRecord,
  mergedMap: Record<string, PlaceImageMapItem>
): ImageAssessment {
  const explicit = toText(poi.coverImage)
  if (explicit && !isPlaceholder(explicit)) {
    const explicitLower = explicit.toLowerCase()
    const level = explicitLower.includes("pexels.com") ? "city_related" : "exact"
    return {
      placeId: poi.id,
      placeName: poi.name,
      level,
      source: "data",
      image: explicit,
    }
  }

  const mapItem = mergedMap[poi.id]
  if (mapItem?.src && !isPlaceholder(mapItem.src)) {
    return {
      placeId: poi.id,
      placeName: poi.name,
      level: normalizeMapConfidence(mapItem),
      source: mapItem.source || "map",
      image: mapItem.src,
    }
  }

  return {
    placeId: poi.id,
    placeName: poi.name,
    level: "fallback",
    source: "placeholder",
    image: DEFAULT_PLACEHOLDER,
  }
}

function toLocationText(lng: number, lat: number) {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`
}

async function requestNearbyCount(params: {
  key: string
  lng: number
  lat: number
  radius: number
  typeCode: string
}): Promise<number> {
  const url = new URL(`${AMAP_REST_BASE}/v3/place/around`)
  url.searchParams.set("key", params.key)
  url.searchParams.set("location", toLocationText(params.lng, params.lat))
  url.searchParams.set("radius", String(params.radius))
  url.searchParams.set("city", "\u5317\u4eac")
  url.searchParams.set("sortrule", "distance")
  url.searchParams.set("offset", "20")
  url.searchParams.set("page", "1")
  url.searchParams.set("extensions", "all")
  url.searchParams.set("types", params.typeCode)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return 0
    const payload = (await response.json()) as NearbyApiResponse
    if (payload.status !== "1") return 0
    const pois = Array.isArray(payload.pois) ? payload.pois : []
    return pois.filter((poi) => toText(poi.name)).length
  } catch {
    return 0
  } finally {
    clearTimeout(timeoutId)
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.floor(concurrency))
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function runNext() {
    while (true) {
      const current = cursor
      cursor += 1
      if (current >= items.length) return
      results[current] = await worker(items[current], current)
    }
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, runNext))
  return results
}

async function main() {
  loadDotEnv()
  const options = parseArgs(process.argv.slice(2))
  const amapKey = (process.env.AMAP_WEB_SERVICE_KEY || "").trim()

  const pois = readJson<PoiRecord[]>(POIS_PATH, [])
  const placeImageMap = readJson<Record<string, PlaceImageMapItem>>(PLACE_IMAGE_MAP_PATH, {})
  const beijingImageMap = readJson<Record<string, PlaceImageMapItem>>(BEIJING_IMAGE_MAP_PATH, {})
  const mergedImageMap = { ...placeImageMap, ...beijingImageMap }

  const beijingAttractions = pois
    .filter((poi) => poi && poi.id && poi.name)
    .filter((poi) => (poi.category || "attraction") === "attraction")
    .filter(isBeijingPoi)
    .filter((poi) => Number.isFinite(toNumber(poi.lng)) && Number.isFinite(toNumber(poi.lat)))
    .sort((a, b) => {
      const salesDiff = toNumber(b.sales) - toNumber(a.sales)
      if (Number.isFinite(salesDiff) && salesDiff !== 0) return salesDiff
      const ratingDiff = toNumber(b.rating) - toNumber(a.rating)
      if (Number.isFinite(ratingDiff) && ratingDiff !== 0) return ratingDiff
      return a.name.localeCompare(b.name, "zh-CN")
    })
    .slice(0, options.top)

  const imageAssessments = beijingAttractions.map((poi) =>
    assessImageQuality(poi, mergedImageMap)
  )
  const imageSummary = {
    exact: imageAssessments.filter((item) => item.level === "exact").length,
    cityRelated: imageAssessments.filter((item) => item.level === "city_related").length,
    fallback: imageAssessments.filter((item) => item.level === "fallback").length,
    nonFallbackRatio:
      beijingAttractions.length > 0
        ? Number(
            (
              imageAssessments.filter((item) => item.level !== "fallback").length /
              beijingAttractions.length
            ).toFixed(4)
          )
        : 0,
  }

  let nearbyStatus: "ok" | "skipped_missing_key" = "ok"
  let nearbyAssessments: NearbyAssessment[] = []
  if (!amapKey) {
    nearbyStatus = "skipped_missing_key"
  } else {
    const requestCache = new Map<string, Promise<number>>()
    const getNearbyCountCached = (
      poi: PoiRecord,
      typeCode: "050000" | "100000",
      radius: number
    ) => {
      const lng = Number(poi.lng)
      const lat = Number(poi.lat)
      const key = `${typeCode}:${toLocationText(lng, lat)}:${radius}`
      const existing = requestCache.get(key)
      if (existing) return existing
      const request = requestNearbyCount({
        key: amapKey,
        lng,
        lat,
        radius,
        typeCode,
      })
      requestCache.set(key, request)
      return request
    }

    nearbyAssessments = await runWithConcurrency(
      beijingAttractions,
      5,
      async (poi): Promise<NearbyAssessment> => {
        const [foodCount, hotelCount] = await Promise.all([
          getNearbyCountCached(poi, "050000", options.foodRadius),
          getNearbyCountCached(poi, "100000", options.hotelRadius),
        ])

        return {
          placeId: poi.id,
          placeName: poi.name,
          foodCount,
          hotelCount,
          pass: foodCount >= 5 && hotelCount >= 3,
        }
      }
    )
  }

  const nearbySummary =
    nearbyStatus === "ok"
      ? {
          status: nearbyStatus,
          evaluated: nearbyAssessments.length,
          passCount: nearbyAssessments.filter((item) => item.pass).length,
          passRatio:
            nearbyAssessments.length > 0
              ? Number(
                  (
                    nearbyAssessments.filter((item) => item.pass).length /
                    nearbyAssessments.length
                  ).toFixed(4)
                )
              : 0,
          avgFoodCount:
            nearbyAssessments.length > 0
              ? Number(
                  (
                    nearbyAssessments.reduce((sum, item) => sum + item.foodCount, 0) /
                    nearbyAssessments.length
                  ).toFixed(2)
                )
              : 0,
          avgHotelCount:
            nearbyAssessments.length > 0
              ? Number(
                  (
                    nearbyAssessments.reduce((sum, item) => sum + item.hotelCount, 0) /
                    nearbyAssessments.length
                  ).toFixed(2)
                )
              : 0,
        }
      : {
          status: nearbyStatus,
          evaluated: 0,
          passCount: 0,
          passRatio: 0,
          avgFoodCount: 0,
          avgHotelCount: 0,
        }

  const report = {
    generatedAt: new Date().toISOString(),
    selection: {
      top: options.top,
      selectedCount: beijingAttractions.length,
      source: path.relative(ROOT_DIR, POIS_PATH),
      city: "\u5317\u4eac",
      category: "attraction",
    },
    image: {
      ...imageSummary,
      samplesFallback: imageAssessments
        .filter((item) => item.level === "fallback")
        .slice(0, 12),
    },
    nearby: {
      ...nearbySummary,
      foodRadius: options.foodRadius,
      hotelRadius: options.hotelRadius,
      samplesFailed:
        nearbyStatus === "ok"
          ? nearbyAssessments.filter((item) => !item.pass).slice(0, 12)
          : [],
    },
  }

  mkdirSync(path.dirname(options.output), { recursive: true })
  writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log("[verify-beijing-quality] done")
  console.log(`selected: ${beijingAttractions.length}`)
  console.log(
    `image exact/city/fallback: ${imageSummary.exact}/${imageSummary.cityRelated}/${imageSummary.fallback}`
  )
  if (nearbyStatus === "ok") {
    console.log(
      `nearby pass ratio: ${nearbySummary.passCount}/${nearbySummary.evaluated} (${nearbySummary.passRatio})`
    )
    console.log(
      `nearby avg food/hotel: ${nearbySummary.avgFoodCount}/${nearbySummary.avgHotelCount}`
    )
  } else {
    console.log("nearby skipped: missing AMAP_WEB_SERVICE_KEY")
  }
  console.log(`report: ${path.relative(ROOT_DIR, options.output)}`)
}

main().catch((error) => {
  console.error("[verify-beijing-quality] failed:", error)
  process.exit(1)
})
