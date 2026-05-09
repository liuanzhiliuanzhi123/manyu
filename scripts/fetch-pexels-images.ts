import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

type PlaceType = "spot" | "hotel" | "food"
type Confidence = "exact" | "city_related" | "fallback"

interface PlaceRecord {
  id: string
  slug?: string
  name: string
  city?: string
  province?: string
  category?: string
  type?: string
  coverImage?: string
  sales?: number
  rating?: number
}

interface PlaceImageMapItem {
  src: string
  source: "pexels" | "fallback"
  confidence: Confidence
  exactQualified?: boolean
  query: string
  city?: string
  province?: string
  slug?: string
  placeType?: PlaceType
  photographer: string
  photographerUrl: string
  pexelsUrl: string
  updatedAt: string
}

interface ScriptOptions {
  limit: number
  type?: PlaceType
  city?: string
  onlyMissing: boolean
  refresh: boolean
  perPage: number
  delayMs: number
  full: boolean
}

interface SearchQuery {
  text: string
  level: "strict" | "city"
}

interface PexelsPhotoSource {
  original?: string
  large2x?: string
  large?: string
  medium?: string
  landscape?: string
}

interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string
  alt?: string
  photographer: string
  photographer_url: string
  src: PexelsPhotoSource
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const NORMALIZED_DIR = path.join(ROOT_DIR, "data", "normalized")
const PLACE_IMAGE_MAP_PATH = path.join(NORMALIZED_DIR, "place-image-map.json")
const POIS_PATH = path.join(NORMALIZED_DIR, "pois.json")
const CLIENT_POIS_PATH = path.join(NORMALIZED_DIR, "client-pois.json")
const PLACES_PATH = path.join(NORMALIZED_DIR, "places.json")
const DEFAULT_PLACEHOLDER = "/images/placeholders/poi-default.jpg"

const CITY_ENGLISH_MAP: Record<string, string> = {
  "\u5317\u4eac": "Beijing",
  "\u4e0a\u6d77": "Shanghai",
  "\u5e7f\u5dde": "Guangzhou",
  "\u6df1\u5733": "Shenzhen",
  "\u676d\u5dde": "Hangzhou",
  "\u6210\u90fd": "Chengdu",
  "\u91cd\u5e86": "Chongqing",
  "\u897f\u5b89": "Xi'an",
  "\u5357\u4eac": "Nanjing",
  "\u82cf\u5dde": "Suzhou",
  "\u5929\u6d25": "Tianjin",
  "\u9999\u6e2f": "Hong Kong",
  "\u6fb3\u95e8": "Macau",
}

const PLACE_ALIAS_RULES: Array<{ pattern: RegExp; alias: string }> = [
  { pattern: /\u6545\u5bab|\u6545\u5bab\u535a\u7269\u9662/u, alias: "Forbidden City" },
  { pattern: /\u957f\u57ce|\u516b\u8fbe\u5cad/u, alias: "Great Wall" },
  { pattern: /\u5929\u575b/u, alias: "Temple of Heaven" },
  { pattern: /\u9880\u548c\u56ed/u, alias: "Summer Palace" },
  { pattern: /\u4e1c\u65b9\u660e\u73e0/u, alias: "Oriental Pearl Tower" },
  { pattern: /\u5916\u6ee9/u, alias: "The Bund" },
  { pattern: /\u8fea\u58eb\u5c3c/u, alias: "Shanghai Disneyland" },
  { pattern: /\u5e7f\u5dde\u5854/u, alias: "Canton Tower" },
  { pattern: /\u6b66\u4faf\u7960/u, alias: "Wuhou Shrine" },
  { pattern: /\u5175\u9a6c\u4fd1/u, alias: "Terracotta Army" },
  { pattern: /\u5927\u718a\u732b/u, alias: "Chengdu Panda Base" },
  { pattern: /\u897f\u6e56/u, alias: "West Lake" },
  { pattern: /\u9ec4\u57d4\u6c5f/u, alias: "Huangpu River" },
  { pattern: /\u4e2d\u5fc3\u5927\u53a6/u, alias: "Shanghai Tower" },
]

const FOOD_ALT_HINTS = [
  "restaurant",
  "food",
  "dish",
  "meal",
  "dining",
  "cafe",
  "coffee",
  "kitchen",
]
const HOTEL_ALT_HINTS = [
  "hotel",
  "lobby",
  "resort",
  "suite",
  "room",
  "hospitality",
  "accommodation",
]
const SPOT_ALT_HINTS = [
  "tower",
  "landmark",
  "temple",
  "museum",
  "park",
  "bridge",
  "skyline",
  "historic",
]

function toText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function normalizeLocationText(value?: string) {
  return (value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/(?:省|市|自治区|特别行政区|地区|自治州|盟)$/u, "")
}

function normalizeBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue
  if (["1", "true", "yes", "y"].includes(value.toLowerCase())) return true
  if (["0", "false", "no", "n"].includes(value.toLowerCase())) return false
  return defaultValue
}

function parseArgs(argv: string[]): ScriptOptions {
  const args = new Map<string, string>()
  for (const item of argv) {
    if (!item.startsWith("--")) continue
    const [key, value = "true"] = item.slice(2).split("=")
    args.set(key, value)
  }

  const typeArg = args.get("type")
  const type =
    typeArg === "spot" || typeArg === "hotel" || typeArg === "food" ? typeArg : undefined
  const city = toText(args.get("city"))
  const limit = Math.max(1, Number(args.get("limit") || 120))
  const perPage = Math.min(20, Math.max(1, Number(args.get("per-page") || 8)))
  const delayMs = Math.max(0, Number(args.get("delay-ms") || 180))
  const onlyMissing = normalizeBool(args.get("only-missing"), true)
  const refresh = normalizeBool(args.get("refresh"), false)
  const full = normalizeBool(args.get("full"), false)

  return {
    limit,
    type,
    city: city || undefined,
    onlyMissing,
    refresh,
    perPage,
    delayMs,
    full,
  }
}

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, ".env.local")
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, "utf-8")
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
    return JSON.parse(readFileSync(filePath, "utf-8")) as T
  } catch {
    return fallback
  }
}

function writeJson(filePath: string, value: unknown) {
  const dir = path.dirname(filePath)
  mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8")
}

function getPlaceSourcePath(full: boolean) {
  if (!full && existsSync(CLIENT_POIS_PATH)) return CLIENT_POIS_PATH
  if (existsSync(PLACES_PATH)) return PLACES_PATH
  if (existsSync(POIS_PATH)) return POIS_PATH
  return CLIENT_POIS_PATH
}

function mapCategoryToType(place: PlaceRecord): PlaceType {
  const category = toText(place.category || place.type).toLowerCase()
  if (category === "hotel" || category === "浣忓") return "hotel"
  if (category === "restaurant" || category === "food" || category === "缇庨") return "food"
  return "spot"
}

function isPlaceholder(value?: string) {
  const text = toText(value)
  return !text || text.includes("/images/placeholders/")
}

function isExactResolved(item?: PlaceImageMapItem) {
  if (!item) return false
  if (item.source !== "pexels") return item.confidence === "exact" && !isPlaceholder(item.src)
  return item.confidence === "exact" && item.exactQualified === true && !isPlaceholder(item.src)
}

function toEnglishCity(city?: string, province?: string) {
  const normalizedCity = normalizeLocationText(city)
  const normalizedProvince = normalizeLocationText(province)
  return (
    CITY_ENGLISH_MAP[normalizedCity] ||
    CITY_ENGLISH_MAP[normalizedProvince] ||
    city ||
    province ||
    "China"
  )
}

function inferPlaceAlias(name: string) {
  const pureName = toText(name)
  if (!pureName) return ""
  if (/[a-z]{3,}/iu.test(pureName)) return pureName
  const matched = PLACE_ALIAS_RULES.find((rule) => rule.pattern.test(pureName))
  return matched?.alias || ""
}

function uniqueQueries(queries: SearchQuery[]) {
  const seen = new Set<string>()
  const results: SearchQuery[] = []
  for (const query of queries) {
    const normalized = query.text.trim().replace(/\s+/g, " ")
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    results.push({
      ...query,
      text: normalized,
    })
  }
  return results
}

function buildQueries(place: PlaceRecord, type: PlaceType) {
  const cityEn = toEnglishCity(place.city, place.province)
  const alias = inferPlaceAlias(place.name)

  if (type === "hotel") {
    return uniqueQueries([
      ...(alias
        ? [{ text: `${alias} ${cityEn} hotel exterior`, level: "strict" as const }]
        : []),
      { text: `${cityEn} hotel exterior`, level: "city" },
      { text: `${cityEn} hotel lobby`, level: "city" },
    ])
  }

  if (type === "food") {
    return uniqueQueries([
      ...(alias
        ? [{ text: `${alias} ${cityEn} restaurant`, level: "strict" as const }]
        : []),
      { text: `${cityEn} local food restaurant`, level: "city" },
      { text: `${cityEn} restaurant dish`, level: "city" },
    ])
  }

  return uniqueQueries([
    ...(alias
      ? [{ text: `${alias} ${cityEn} landmark attraction`, level: "strict" as const }]
      : []),
    { text: `${cityEn} landmark attraction`, level: "city" },
    { text: `${cityEn} skyline`, level: "city" },
  ])
}

function scorePhoto(photo: PexelsPhoto, type: PlaceType) {
  const area = photo.width * photo.height
  const landscape = photo.width >= photo.height ? 1 : 0
  const alt = (photo.alt || "").toLowerCase()

  let semantic = 0
  const hints = type === "hotel" ? HOTEL_ALT_HINTS : type === "food" ? FOOD_ALT_HINTS : SPOT_ALT_HINTS
  for (const hint of hints) {
    if (alt.includes(hint)) semantic += 1
  }

  return landscape * 8 + semantic * 2 + area / 1_000_000
}

function pickBestPhoto(photos: PexelsPhoto[], type: PlaceType) {
  if (!Array.isArray(photos) || photos.length === 0) return null
  return [...photos].sort((a, b) => scorePhoto(b, type) - scorePhoto(a, type))[0] ?? null
}

async function searchPexels(
  apiKey: string,
  query: string,
  perPage: number
): Promise<PexelsPhoto[]> {
  const url = new URL("https://api.pexels.com/v1/search")
  url.searchParams.set("query", query)
  url.searchParams.set("per_page", String(perPage))
  url.searchParams.set("orientation", "landscape")
  url.searchParams.set("size", "large")
  url.searchParams.set("locale", "en-US")

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${body.slice(0, 160)}`)
  }

  const payload = (await response.json()) as PexelsSearchResponse
  return Array.isArray(payload.photos) ? payload.photos : []
}

function containsAny(text: string, tokens: string[]) {
  return tokens.some((token) => token && text.includes(token.toLowerCase()))
}

function tokenizeEnglishLike(value: string) {
  return value
    .toLowerCase()
    .split(/[\s\-_/]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function resolveConfidence(input: {
  place: PlaceRecord
  type: PlaceType
  query: SearchQuery
  photo: PexelsPhoto
}) {
  const alias = inferPlaceAlias(input.place.name).toLowerCase()
  const cityEn = toEnglishCity(input.place.city, input.place.province).toLowerCase()
  const metadataText = `${input.photo.alt || ""} ${input.photo.url || ""}`.toLowerCase()
  const queryText = (input.query.text || "").toLowerCase()

  const aliasTokens = tokenizeEnglishLike(alias)
  const cityTokens = tokenizeEnglishLike(cityEn)
  const placeNameTokens = tokenizeEnglishLike(input.place.name || "")

  const hasAlias = aliasTokens.length > 0 && containsAny(metadataText, aliasTokens)
  const hasCity = cityTokens.length > 0 && containsAny(metadataText, cityTokens)
  const hasPlaceName = placeNameTokens.length > 0 && containsAny(metadataText, placeNameTokens)
  const queryLooksPlaceLevel =
    input.query.level === "strict" &&
    aliasTokens.length > 0 &&
    containsAny(queryText, aliasTokens) &&
    cityTokens.length > 0 &&
    containsAny(queryText, cityTokens)

  const isHighConfidenceExact =
    input.type === "spot" &&
    queryLooksPlaceLevel &&
    hasAlias &&
    hasCity &&
    hasPlaceName

  if (isHighConfidenceExact) {
    return {
      confidence: "exact" as const,
      exactQualified: true,
    }
  }

  if (input.query.level === "city" || hasCity || hasAlias) {
    return {
      confidence: "city_related" as const,
      exactQualified: false,
    }
  }

  return {
    confidence: "fallback" as const,
    exactQualified: false,
  }
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function main() {
  loadDotEnv()
  const options = parseArgs(process.argv.slice(2))
  const apiKey = (process.env.PEXELS_API_KEY || "").trim()
  if (!apiKey) {
    console.warn("[degraded] PEXELS_API_KEY is missing. Skip remote image sync.")
    console.warn(`[degraded] keep existing map: ${path.relative(ROOT_DIR, PLACE_IMAGE_MAP_PATH)}`)
    return
  }

  const sourcePath = getPlaceSourcePath(options.full)
  const places = readJson<PlaceRecord[]>(sourcePath, []).filter(
    (item) => item && toText(item.id) && toText(item.name)
  )
  const imageMap = readJson<Record<string, PlaceImageMapItem>>(PLACE_IMAGE_MAP_PATH, {})

  const cityFilter = normalizeLocationText(options.city)

  const scoped = places
    .filter((place) => {
      const placeType = mapCategoryToType(place)
      if (options.type && placeType !== options.type) return false
      if (cityFilter) {
        const city = normalizeLocationText(place.city)
        const province = normalizeLocationText(place.province)
        if (city !== cityFilter && province !== cityFilter) return false
      }
      return true
    })
    .sort((a, b) => {
      const salesDiff = Number(b.sales || 0) - Number(a.sales || 0)
      if (salesDiff !== 0) return salesDiff
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0)
      if (ratingDiff !== 0) return ratingDiff
      return String(a.name).localeCompare(String(b.name), "zh-CN")
    })

  let skipped = 0
  let attempted = 0
  let successExact = 0
  let successCityRelated = 0
  let fallback = 0
  let failedRequests = 0

  for (const place of scoped) {
    if (attempted >= options.limit) break
    const placeId = toText(place.id)
    const placeType = mapCategoryToType(place)
    const existing = imageMap[placeId]

    if (!options.refresh && options.onlyMissing) {
      if (isExactResolved(existing) || !isPlaceholder(place.coverImage)) {
        skipped += 1
        continue
      }
    }

    attempted += 1
    const queries = buildQueries(place, placeType)
    let chosen: {
      photo: PexelsPhoto
      query: SearchQuery
      confidence: Confidence
      exactQualified: boolean
    } | null = null
    let lastError = ""

    for (const query of queries) {
      try {
        const photos = await searchPexels(apiKey, query.text, options.perPage)
        const best = pickBestPhoto(photos, placeType)
        if (!best) continue
        const confidenceResult = resolveConfidence({
          place,
          type: placeType,
          query,
          photo: best,
        })

        if (!chosen) {
          chosen = {
            photo: best,
            query,
            confidence: confidenceResult.confidence,
            exactQualified: confidenceResult.exactQualified,
          }
        } else if (
          confidenceResult.confidence === "exact" &&
          chosen.confidence !== "exact"
        ) {
          chosen = {
            photo: best,
            query,
            confidence: confidenceResult.confidence,
            exactQualified: confidenceResult.exactQualified,
          }
        } else if (
          confidenceResult.confidence === "city_related" &&
          chosen.confidence === "fallback"
        ) {
          chosen = {
            photo: best,
            query,
            confidence: confidenceResult.confidence,
            exactQualified: confidenceResult.exactQualified,
          }
        }

        if (confidenceResult.confidence === "exact") break
      } catch (error) {
        failedRequests += 1
        lastError = error instanceof Error ? error.message : "unknown error"
      }
      await sleep(options.delayMs)
    }

    if (chosen) {
      const src =
        chosen.photo.src.landscape ||
        chosen.photo.src.large2x ||
        chosen.photo.src.large ||
        chosen.photo.src.original ||
        chosen.photo.src.medium ||
        ""

      if (src) {
        imageMap[placeId] = {
          src,
          source: "pexels",
          confidence: chosen.confidence,
          exactQualified: chosen.exactQualified,
          query: chosen.query.text,
          city: toText(place.city),
          province: toText(place.province),
          slug: toText(place.slug),
          placeType,
          photographer: chosen.photo.photographer || "",
          photographerUrl: chosen.photo.photographer_url || "",
          pexelsUrl: chosen.photo.url || "",
          updatedAt: new Date().toISOString(),
        }
        if (chosen.confidence === "exact") successExact += 1
        else successCityRelated += 1
      } else {
        fallback += 1
      }
    } else {
      imageMap[placeId] = {
        src: DEFAULT_PLACEHOLDER,
        source: "fallback",
        confidence: "fallback",
        query: queries[0]?.text || "",
        city: toText(place.city),
        province: toText(place.province),
        slug: toText(place.slug),
        placeType,
        photographer: "",
        photographerUrl: "",
        pexelsUrl: "",
        updatedAt: new Date().toISOString(),
      }
      fallback += 1
      if (lastError) {
        console.warn(`[fallback] ${place.name}: ${lastError}`)
      }
    }

    await sleep(options.delayMs)
  }

  writeJson(PLACE_IMAGE_MAP_PATH, imageMap)

  console.log("[fetch-pexels-images] map updated")
  console.log(`source: ${path.relative(ROOT_DIR, sourcePath)}`)
  console.log(`scoped: ${scoped.length}`)
  console.log(`attempted: ${attempted}`)
  console.log(`exact: ${successExact}`)
  console.log(`city_related: ${successCityRelated}`)
  console.log(`fallback: ${fallback}`)
  console.log(`skipped: ${skipped}`)
  console.log(`request_failures: ${failedRequests}`)
  console.log(`output: ${path.relative(ROOT_DIR, PLACE_IMAGE_MAP_PATH)}`)
}

main().catch((error) => {
  console.error("[fetch-pexels-images] failed:", error)
  process.exit(1)
})

