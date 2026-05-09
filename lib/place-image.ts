import localImageManifestData from "@/data/normalized/local-image-manifest.json"
import placeImageMapData from "@/data/normalized/place-image-map.json"
import beijingImageMapData from "@/data/normalized/beijing-image-map.json"

const DEFAULT_PLACEHOLDER = "/images/placeholders/poi-default.jpg"
const IMAGE_EXTENSIONS = [".jpg", ".png", ".webp"] as const
const CHINA_SUFFIX_PATTERN = /(?:省|市|自治区|特别行政区|地区|自治州|盟)$/u

export type PlaceImageMatchLevel = "exact" | "city_related" | "fallback"

interface PlaceImageMapItem {
  src: string
  source?: string
  query?: string
  confidence?: PlaceImageMatchLevel
  exactQualified?: boolean
  city?: string
  province?: string
  slug?: string
  photographer?: string
  photographerUrl?: string
  pexelsUrl?: string
}

interface LocalImageManifest {
  pois?: string[]
  hotels?: string[]
  foods?: string[]
  cities?: string[]
}

export interface PlaceImageInput {
  id?: string
  slug?: string
  name?: string
  city?: string
  province?: string
  type?: "attraction" | "restaurant" | "hotel"
  image?: string
  coverImage?: string
  gallery?: string[]
  imageConfidence?: PlaceImageMatchLevel
}

export interface ResolvedPlaceImage {
  src: string
  matchLevel: PlaceImageMatchLevel
  source: string
  meta?: PlaceImageMapItem | null
}

const placeImageMap = {
  ...(placeImageMapData as Record<string, PlaceImageMapItem>),
  ...(beijingImageMapData as Record<string, PlaceImageMapItem>),
}
const localImageManifest = (localImageManifestData || {}) as LocalImageManifest

const localPoiSet = new Set(localImageManifest.pois ?? [])
const localHotelSet = new Set(localImageManifest.hotels ?? [])
const localFoodSet = new Set(localImageManifest.foods ?? [])
const localCitySet = new Set(localImageManifest.cities ?? [])

function normalizeImagePath(value?: string) {
  const raw = (value || "").trim()
  if (!raw) return ""
  if (/^https?:\/\//iu.test(raw)) return raw
  if (raw.startsWith("/")) return raw
  return `/${raw.replace(/^\.?\//u, "")}`
}

function normalizeLocationText(value?: string) {
  return (value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(CHINA_SUFFIX_PATTERN, "")
    .toLowerCase()
}

function slugify(value?: string) {
  const text = (value || "").trim()
  if (!text) return ""
  const ascii = text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (ascii) return ascii
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

function isPlaceholder(value?: string) {
  const normalized = normalizeImagePath(value)
  return !normalized || normalized.includes("/images/placeholders/")
}

function isPexelsSource(item: Pick<PlaceImageMapItem, "source" | "src">) {
  const source = (item.source || "").toLowerCase()
  const src = (item.src || "").toLowerCase()
  return source === "pexels" || src.includes("pexels.com")
}

function inferConfidence(item: PlaceImageMapItem): PlaceImageMatchLevel {
  if (item.confidence === "exact") {
    if (isPexelsSource(item) && item.exactQualified !== true) {
      return "city_related"
    }
    return "exact"
  }
  if (item.confidence === "city_related") return "city_related"
  if (item.confidence === "fallback") return "fallback"
  if (isPexelsSource(item)) {
    return "city_related"
  }
  return "fallback"
}

function normalizeMapItem(item?: PlaceImageMapItem | null): PlaceImageMapItem | null {
  if (!item?.src) return null
  const src = normalizeImagePath(item.src)
  if (!src) return null
  return {
    ...item,
    src,
    confidence: inferConfidence(item),
  }
}

function isCityConsistent(input: PlaceImageInput, item?: PlaceImageMapItem | null) {
  if (!item) return true
  const inputCity = normalizeLocationText(input.city || input.province || "")
  const mapCity = normalizeLocationText(item.city || item.province || "")
  if (!inputCity || !mapCity) return true
  return inputCity === mapCity
}

function pickFromExplicit(input: PlaceImageInput): ResolvedPlaceImage | null {
  const explicitList = [input.coverImage, input.image, ...(input.gallery ?? [])]
  for (const raw of explicitList) {
    const src = normalizeImagePath(raw)
    if (!src || isPlaceholder(src)) continue
    const isPexels = src.toLowerCase().includes("pexels.com")
    return {
      src,
      matchLevel: input.imageConfidence || (isPexels ? "city_related" : "exact"),
      source: "data",
      meta: null,
    }
  }
  return null
}

function pickLocalTypedImage(
  slug: string,
  type?: PlaceImageInput["type"]
): ResolvedPlaceImage | null {
  if (!slug) return null
  const usePoi = type === "attraction" || !type
  const useHotel = type === "hotel" || !type
  const useFood = type === "restaurant" || !type

  for (const ext of IMAGE_EXTENSIONS) {
    if (usePoi && localPoiSet.has(`${slug}${ext}`)) {
      return {
        src: `/images/pois/${slug}${ext}`,
        matchLevel: "exact",
        source: "local-poi",
        meta: null,
      }
    }
    if (useHotel && localHotelSet.has(`${slug}${ext}`)) {
      return {
        src: `/images/hotels/${slug}${ext}`,
        matchLevel: "exact",
        source: "local-hotel",
        meta: null,
      }
    }
    if (useFood && localFoodSet.has(`${slug}${ext}`)) {
      return {
        src: `/images/foods/${slug}${ext}`,
        matchLevel: "exact",
        source: "local-food",
        meta: null,
      }
    }
  }
  return null
}

function pickLocalCityImage(citySlug: string): ResolvedPlaceImage | null {
  if (!citySlug) return null
  for (const ext of IMAGE_EXTENSIONS) {
    if (localCitySet.has(`${citySlug}${ext}`)) {
      return {
        src: `/images/cities/${citySlug}${ext}`,
        matchLevel: "city_related",
        source: "local-city",
        meta: null,
      }
    }
  }
  return null
}

const cityRelatedPool = new Map<string, string>()
for (const item of Object.values(placeImageMap)) {
  if (!item?.src) continue
  if (inferConfidence(item) !== "city_related") continue
  const city = normalizeLocationText(item.city || item.province || "")
  if (!city || cityRelatedPool.has(city)) continue
  cityRelatedPool.set(city, normalizeImagePath(item.src))
}

function pickCityRelatedMapImage(input: PlaceImageInput): ResolvedPlaceImage | null {
  const cityToken = normalizeLocationText(input.city || input.province || "")
  if (!cityToken) return null
  const src = cityRelatedPool.get(cityToken)
  if (!src || isPlaceholder(src)) return null
  return {
    src,
    matchLevel: "city_related",
    source: "map-city-related",
    meta: null,
  }
}

export function resolvePlaceImageWithMeta(input: PlaceImageInput): ResolvedPlaceImage {
  const explicit = pickFromExplicit(input)
  if (explicit) return explicit

  const mapItem = input.id ? normalizeMapItem(placeImageMap[input.id] ?? null) : null
  if (
    mapItem &&
    mapItem.confidence === "exact" &&
    !isPlaceholder(mapItem.src) &&
    isCityConsistent(input, mapItem)
  ) {
    return {
      src: mapItem.src,
      matchLevel: "exact",
      source: mapItem.source || "map",
      meta: mapItem,
    }
  }

  const normalizedSlug = slugify(input.slug || input.name || input.id || "")
  const localTyped = pickLocalTypedImage(normalizedSlug, input.type)
  if (localTyped) return localTyped

  const citySlug = slugify(normalizeLocationText(input.city || input.province || ""))
  const localCity = pickLocalCityImage(citySlug)
  if (localCity) return localCity

  if (mapItem && mapItem.confidence === "city_related" && !isPlaceholder(mapItem.src)) {
    return {
      src: mapItem.src,
      matchLevel: "city_related",
      source: mapItem.source || "map",
      meta: mapItem,
    }
  }

  const cityRelated = pickCityRelatedMapImage(input)
  if (cityRelated) return cityRelated

  return {
    src: DEFAULT_PLACEHOLDER,
    matchLevel: "fallback",
    source: "placeholder",
    meta: null,
  }
}

export function resolvePlaceImage(input: PlaceImageInput) {
  return resolvePlaceImageWithMeta(input).src
}

export function getPlaceImageCandidates(input: PlaceImageInput) {
  const candidates: string[] = []
  const first = resolvePlaceImageWithMeta(input).src
  if (first) candidates.push(first)

  const explicitList = [input.coverImage, input.image, ...(input.gallery ?? [])]
  for (const raw of explicitList) {
    const src = normalizeImagePath(raw)
    if (!src || isPlaceholder(src) || candidates.includes(src)) continue
    candidates.push(src)
  }

  if (!candidates.includes(DEFAULT_PLACEHOLDER)) {
    candidates.push(DEFAULT_PLACEHOLDER)
  }
  return candidates
}

export function getDefaultPlaceImage() {
  return DEFAULT_PLACEHOLDER
}

export function getPlaceImageMeta(placeId?: string) {
  if (!placeId) return null
  return normalizeMapItem(placeImageMap[placeId] ?? null)
}
