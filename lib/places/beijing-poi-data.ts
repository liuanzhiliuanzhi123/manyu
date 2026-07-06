import generatedPoisData from "@/data/beijing-pois.generated.json"
import { beijingPlaces, type BeijingPlace } from "@/lib/beijing-place-data"
import { resolvePlaceImageWithMeta, type PlaceImageMatchLevel } from "@/lib/place-image"
import { buildPoiSubTags } from "@/lib/places/poi-subtagger"
import {
  PLACEHOLDER_BY_ROOT_CATEGORY,
  ROOT_CATEGORY_TO_SPOT_TYPE,
  SUB_TAG_LABELS,
  type BeijingPoi,
  type BeijingPoiRootCategory,
  type BeijingPoiSubTag,
  type BeijingSpotType,
} from "@/lib/places/poi-types"

export interface BeijingPoiSpotSeed {
  id: string
  name: string
  type: BeijingSpotType
  rootCategory: BeijingPoiRootCategory
  amapPoiId?: string
  address: string
  rating: number
  heat: number
  ticketPrice: number
  description: string
  image: string
  imageTitle?: string
  tags: string[]
  subTags: BeijingPoiSubTag[]
  openTime?: string
  phone?: string
  province: string
  city: string
  district: string
  businessArea?: string
  lng: number
  lat: number
  longitude: number
  latitude: number
  location: {
    lng: number
    lat: number
    city: string
    address: string
  }
  coordinates: [number, number]
  suggestedDurationMinutes: number
  suggestedDurationText: string
  source: string
  imageConfidence: PlaceImageMatchLevel
}

const generatedPois = generatedPoisData as BeijingPoi[]

function toFiniteNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function uniqueTexts(values: Array<string | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = (value || "").trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

function legacyRootCategory(type: BeijingPlace["type"]): BeijingPoiRootCategory {
  if (type === "food") return "food"
  if (type === "hotel") return "hotel"
  return "scenic"
}

function legacyPlaceToPoi(place: BeijingPlace): BeijingPoi {
  const rootCategory = legacyRootCategory(place.type)
  const subTags = buildPoiSubTags(
    {
      name: place.name,
      address: place.address,
      district: place.district,
      rootCategory,
      rating: place.rating,
      price: place.price,
      tags: place.tags,
    },
    rootCategory
  )

  return {
    id: place.id,
    rootCategory,
    name: place.name,
    province: place.province,
    city: place.city,
    district: place.district,
    address: place.address,
    lng: place.lng,
    lat: place.lat,
    rating: place.rating,
    reviewCount: place.reviewCount,
    price: place.price,
    tags: place.tags,
    subTags,
    intro: place.intro,
    source: "legacy",
    imageUrl: place.coverImage,
    imageSource: place.coverImage ? "legacy" : "placeholder",
    confidence: 70,
  }
}

function normalizeGeneratedPoi(poi: BeijingPoi): BeijingPoi {
  return {
    ...poi,
    province: poi.province || "北京",
    city: poi.city || "北京",
    district: poi.district || "",
    address: poi.address || poi.name,
    rating: toFiniteNumber(poi.rating, 4.5),
    price: toFiniteNumber(poi.price, 0),
    tags: Array.isArray(poi.tags) ? poi.tags.filter(Boolean) : [],
    subTags:
      Array.isArray(poi.subTags) && poi.subTags.length > 0
        ? poi.subTags
        : buildPoiSubTags(poi, poi.rootCategory),
    source: poi.source || "amap",
    imageSource: poi.imageUrl ? poi.imageSource || "amap" : "placeholder",
    confidence: toFiniteNumber(poi.confidence, 70),
  }
}

const sourcePois = generatedPois.length > 0 ? generatedPois.map(normalizeGeneratedPoi) : beijingPlaces.map(legacyPlaceToPoi)

export const beijingPois: BeijingPoi[] = sourcePois

export const beijingPoiMap = new Map(beijingPois.map((poi) => [poi.id, poi]))

function estimateDurationByRoot(rootCategory: BeijingPoiRootCategory) {
  if (rootCategory === "food") return 75
  if (rootCategory === "hotel") return 30
  return 150
}

function estimateHeatScore(poi: BeijingPoi) {
  const ratingPart = Math.max(0, Math.min(5, poi.rating || 0)) * 13
  const confidencePart = Math.max(0, Math.min(100, poi.confidence || 0)) * 0.18
  const imagePart = poi.imageUrl ? 8 : 0
  const reviewPart = Math.log10(Math.max(1, poi.reviewCount || 1)) * 8
  return Math.max(50, Math.min(99, Math.round(ratingPart + confidencePart + imagePart + reviewPart)))
}

function toDurationLabel(minutes: number) {
  if (minutes >= 120) return `${Math.round(minutes / 60)}小时`
  return `${minutes}分钟`
}

function toImageType(rootCategory: BeijingPoiRootCategory) {
  if (rootCategory === "food") return "restaurant" as const
  if (rootCategory === "hotel") return "hotel" as const
  return "attraction" as const
}

export function getPoiImageFallback(poi: BeijingPoi) {
  if (poi.imageUrl) {
    return {
      src: poi.imageUrl,
      confidence: "exact" as PlaceImageMatchLevel,
    }
  }

  if (poi.source === "legacy") {
    const resolved = resolvePlaceImageWithMeta({
      id: poi.id,
      name: poi.name,
      city: poi.city,
      province: poi.province,
      type: toImageType(poi.rootCategory),
    })

    if (resolved.matchLevel !== "fallback") {
      return {
        src: resolved.src,
        confidence: resolved.matchLevel,
      }
    }
  }

  return {
    src: PLACEHOLDER_BY_ROOT_CATEGORY[poi.rootCategory],
    confidence: "fallback" as PlaceImageMatchLevel,
  }
}

export function beijingPoiToSpot(poi: BeijingPoi): BeijingPoiSpotSeed {
  const image = getPoiImageFallback(poi)
  const duration = estimateDurationByRoot(poi.rootCategory)
  const lng = toFiniteNumber(poi.lng)
  const lat = toFiniteNumber(poi.lat)
  const tagLabels = poi.subTags.map((tag) => SUB_TAG_LABELS[tag])
  const tags = uniqueTexts([...tagLabels, ...poi.tags]).slice(0, 8)

  return {
    id: poi.id,
    amapPoiId: poi.amapPoiId,
    name: poi.name,
    type: ROOT_CATEGORY_TO_SPOT_TYPE[poi.rootCategory],
    rootCategory: poi.rootCategory,
    address: poi.address,
    rating: poi.rating,
    heat: estimateHeatScore(poi),
    ticketPrice: poi.price,
    description: poi.intro,
    image: image.src,
    imageTitle: poi.imageTitle,
    tags,
    subTags: poi.subTags,
    openTime: poi.openTime,
    phone: poi.phone,
    province: poi.province,
    city: poi.city,
    district: poi.district,
    businessArea: poi.businessArea,
    lng,
    lat,
    longitude: lng,
    latitude: lat,
    location: {
      lng,
      lat,
      city: poi.city,
      address: poi.address,
    },
    coordinates: [lng, lat],
    suggestedDurationMinutes: duration,
    suggestedDurationText: toDurationLabel(duration),
    source: poi.source,
    imageConfidence: image.confidence,
  }
}

export const beijingPoiSpotSeeds: BeijingPoiSpotSeed[] = beijingPois.map(beijingPoiToSpot)
export const beijingPoiAttractionSeeds = beijingPoiSpotSeeds.filter(
  (item) => item.rootCategory === "scenic"
)
export const beijingPoiRestaurantSeeds = beijingPoiSpotSeeds.filter(
  (item) => item.rootCategory === "food"
)
export const beijingPoiHotelSeeds = beijingPoiSpotSeeds.filter(
  (item) => item.rootCategory === "hotel"
)
