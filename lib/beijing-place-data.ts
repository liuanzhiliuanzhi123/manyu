import beijingPlacesData from "@/data/normalized/beijing-places.json"
import { resolvePlaceImageWithMeta, type PlaceImageMatchLevel } from "@/lib/place-image"

export type BeijingPlaceType = "spot" | "food" | "hotel"

export interface BeijingPlace {
  id: string
  type: BeijingPlaceType
  name: string
  province: string
  city: string
  district: string
  address: string
  lng: number
  lat: number
  rating: number
  reviewCount: number
  price: number
  tags: string[]
  intro: string
  source: string
  coverImage?: string
  imageConfidence?: PlaceImageMatchLevel
}

export interface BeijingSpotSeed {
  id: string
  name: string
  type: "attraction" | "restaurant" | "hotel"
  address: string
  rating: number
  heat: number
  ticketPrice: number
  description: string
  image: string
  tags: string[]
  openTime?: string
  phone?: string
  province: string
  city: string
  district: string
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

const beijingPlacesRaw = beijingPlacesData as BeijingPlace[]

export function isBeijingCityName(input?: string) {
  if (!input) return false
  const normalized = input.trim().replace(/市$/u, "")
  return normalized === "北京"
}

function toSpotType(type: BeijingPlaceType): BeijingSpotSeed["type"] {
  if (type === "food") return "restaurant"
  if (type === "hotel") return "hotel"
  return "attraction"
}

function estimateDurationByType(type: BeijingPlaceType) {
  if (type === "food") return 75
  if (type === "hotel") return 30
  return 150
}

function estimateHeatScore(rating: number, reviewCount: number) {
  const ratingPart = Math.max(0, Math.min(5, rating)) * 14
  const reviewPart = Math.log10(Math.max(1, reviewCount)) * 15
  return Math.max(55, Math.min(99, Math.round(ratingPart + reviewPart)))
}

function toDurationLabel(minutes: number) {
  if (minutes >= 120) return `${Math.round(minutes / 60)}小时`
  return `${minutes}分钟`
}

function toImageType(type: BeijingPlaceType) {
  if (type === "food") return "restaurant" as const
  if (type === "hotel") return "hotel" as const
  return "attraction" as const
}

export const beijingPlaces: BeijingPlace[] = beijingPlacesRaw
  .filter((item) => isBeijingCityName(item.city) || isBeijingCityName(item.province))
  .map((item) => ({
    ...item,
    province: "北京",
    city: "北京",
    district: item.district?.trim() || "",
    tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
    rating: Number.isFinite(item.rating) ? item.rating : 4.5,
    reviewCount: Number.isFinite(item.reviewCount) ? item.reviewCount : 0,
    price: Number.isFinite(item.price) ? item.price : 0,
    imageConfidence: item.imageConfidence || "fallback",
  }))

export const beijingPlaceMap = new Map(beijingPlaces.map((item) => [item.id, item]))

export const beijingSpotSeeds: BeijingSpotSeed[] = beijingPlaces.map((place) => {
  const image = resolvePlaceImageWithMeta({
    id: place.id,
    name: place.name,
    city: place.city,
    province: place.province,
    type: toImageType(place.type),
    coverImage: place.coverImage,
    imageConfidence: place.imageConfidence,
  })
  const duration = estimateDurationByType(place.type)
  const type = toSpotType(place.type)
  return {
    id: place.id,
    name: place.name,
    type,
    address: place.address,
    rating: place.rating,
    heat: estimateHeatScore(place.rating, place.reviewCount),
    ticketPrice: place.price,
    description: place.intro,
    image: image.src,
    tags: place.tags,
    province: "北京",
    city: "北京",
    district: place.district,
    lng: place.lng,
    lat: place.lat,
    longitude: place.lng,
    latitude: place.lat,
    location: {
      lng: place.lng,
      lat: place.lat,
      city: "北京",
      address: place.address,
    },
    coordinates: [place.lng, place.lat],
    suggestedDurationMinutes: duration,
    suggestedDurationText: toDurationLabel(duration),
    source: place.source,
    imageConfidence: image.matchLevel,
  }
})

export const beijingRestaurantSeeds = beijingSpotSeeds.filter(
  (item) => item.type === "restaurant"
)
export const beijingHotelSeeds = beijingSpotSeeds.filter((item) => item.type === "hotel")
export const beijingAttractionSeeds = beijingSpotSeeds.filter(
  (item) => item.type === "attraction"
)

