import citiesData from "@/data/normalized/cities.json"
import clientPoisData from "@/data/normalized/client-pois.json"
import hotelsData from "@/data/normalized/hotels.json"
import reviewInsightsData from "@/data/normalized/review-insights.json"
import type { CompanionType, ProvinceCityGroup } from "@/lib/planner-types"
import { resolvePlaceImage } from "@/lib/place-image"
import { beijingHotelSeeds, isBeijingCityName } from "@/lib/beijing-place-data"
type PoiCategory = "attraction" | "restaurant" | "hotel"

export interface NormalizedPoiRecord {
  id: string
  slug: string
  name: string
  province: string
  city: string
  district: string
  category: PoiCategory
  level: string
  rating: number
  price: number
  sales: number
  lng?: number
  lat?: number
  intro: string
  isFree: boolean
  address: string
  coverImage: string
  gallery: string[]
  tags: string[]
}

export interface NormalizedCityRecord {
  id: string
  slug: string
  province: string
  city: string
  tagline: string
  tags: string[]
  poiCount: number
  attractionCount: number
  restaurantCount: number
  hotelCount: number
  avgRating: number
  avgPrice: number
  coverImage: string
}

export interface NormalizedHotelRecord {
  id: string
  slug: string
  name: string
  city: string
  province: string
  district?: string
  price: number
  rating: number
  level?: string
  coverImage: string
  tags: string[]
  sourceType: "poi"
  reason?: string
}

interface ReviewTagStat {
  tag: string
  count: number
  ratio: number
}

interface ReviewPurposeStat {
  purpose: string
  count: number
  avgUserScore: number
  avgHotelScore: number
  avgHotelPrice: number
  topTags: string[]
}

interface ReviewInsightsRecord {
  generatedAt: string
  totalReviews: number
  tagStats: ReviewTagStat[]
  purposeStats: ReviewPurposeStat[]
  recommendationTags: string[]
}

function ensurePoiCategory(item: NormalizedPoiRecord): PoiCategory {
  if (item.category === "hotel") return "hotel"
  if (item.category === "restaurant") return "restaurant"
  return "attraction"
}

export const normalizedPois = (clientPoisData as NormalizedPoiRecord[])
  .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
  .map((item) => ({
    ...item,
    category: ensurePoiCategory(item),
  }))

export const normalizedCities = (citiesData as NormalizedCityRecord[]).filter(
  (item) => item && typeof item.city === "string" && typeof item.province === "string"
)

export const normalizedHotels = (hotelsData as NormalizedHotelRecord[]).filter(
  (item) => item && typeof item.id === "string" && typeof item.name === "string"
)

export const normalizedReviewInsights = reviewInsightsData as ReviewInsightsRecord

export function getProvinceCityGroups(): ProvinceCityGroup[] {
  const map = new Map<string, NormalizedCityRecord[]>()
  for (const city of normalizedCities) {
    const province = city.province?.trim()
    if (!province) continue
    if (!map.has(province)) map.set(province, [])
    map.get(province)?.push(city)
  }
  return Array.from(map.entries())
    .map(([province, cities]) => ({
      province,
      cities: [...cities]
        .sort((a, b) => b.poiCount - a.poiCount)
        .map((city) => ({
          province: city.province,
          city: city.city,
          tagline: city.tagline,
          tags: city.tags?.slice(0, 4) ?? [],
        })),
    }))
    .sort((a, b) => b.cities.length - a.cities.length)
}

function toSpotType(category: PoiCategory): "attraction" | "restaurant" | "hotel" {
  if (category === "restaurant") return "restaurant"
  if (category === "hotel") return "hotel"
  return "attraction"
}

function toHeat(sales: number) {
  if (!Number.isFinite(sales) || sales <= 0) return 60
  const heat = Math.round(Math.log10(sales + 10) * 28)
  return Math.max(55, Math.min(99, heat))
}

export interface SpotLikeRecord {
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
  province?: string
  city?: string
  district?: string
  lng?: number
  lat?: number
  location?: {
    lng?: number
    lat?: number
    city?: string
    address?: string
  }
  coordinates?: [number, number]
  suggestedDurationMinutes?: number
  suggestedDurationText?: string
}

function estimateVisitMinutes(category: PoiCategory) {
  if (category === "hotel") return 30
  if (category === "restaurant") return 90
  return 180
}

export function toSpotLikeRecord(poi: NormalizedPoiRecord): SpotLikeRecord {
  const rating = Number.isFinite(poi.rating) && poi.rating > 0 ? poi.rating : 4.5
  const ticketPrice = Number.isFinite(poi.price) ? Math.max(0, Number(poi.price.toFixed(2))) : 0
  const spotType = toSpotType(poi.category)
  const suggestedDurationMinutes = estimateVisitMinutes(poi.category)
  const lng = poi.lng
  const lat = poi.lat
  const hasCoordinates =
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    typeof lat === "number" &&
    Number.isFinite(lat)

  return {
    id: poi.id,
    name: poi.name,
    type: spotType,
    address: poi.address || `${poi.province}${poi.city}${poi.name}`,
    rating: Number(rating.toFixed(1)),
    heat: toHeat(poi.sales),
    ticketPrice,
    description: poi.intro || `${poi.name}（${poi.city}）`,
    image: resolvePlaceImage({
      id: poi.id,
      slug: poi.slug,
      name: poi.name,
      city: poi.city,
      province: poi.province,
      coverImage: poi.coverImage,
      gallery: poi.gallery,
    }),
    tags: Array.isArray(poi.tags) ? poi.tags.slice(0, 8) : [],
    province: poi.province,
    city: poi.city,
    district: poi.district,
    lng,
    lat,
    location: hasCoordinates
      ? {
          lng,
          lat,
          city: poi.city,
          address: poi.address,
        }
      : undefined,
    coordinates: hasCoordinates ? [lng, lat] : undefined,
    suggestedDurationMinutes,
    suggestedDurationText:
      spotType === "attraction"
        ? `${Math.round(suggestedDurationMinutes / 60)}小时`
        : `${suggestedDurationMinutes}分钟`,
  }
}

export const normalizedSpots: SpotLikeRecord[] = normalizedPois.map(toSpotLikeRecord)

function parseBudgetUpperBound(budgetRange?: string) {
  if (!budgetRange) return Number.POSITIVE_INFINITY
  const text = budgetRange.trim()
  if (text.includes("以内")) {
    const value = Number(text.replace(/[^\d]/g, ""))
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  if (text.includes("以上")) {
    return Number.POSITIVE_INFINITY
  }
  const parts = text.split("-").map((item) => Number(item.replace(/[^\d]/g, "")))
  if (parts.length === 2 && Number.isFinite(parts[1])) return parts[1]
  return Number.POSITIVE_INFINITY
}

export function getHotelRecommendations(input: {
  city?: string
  budgetRange?: string
  companions?: CompanionType
  interests?: string[]
  limit?: number
}) {
  const city = input.city?.trim() ?? ""
  if (isBeijingCityName(city)) {
    const budgetUpper = parseBudgetUpperBound(input.budgetRange)
    return beijingHotelSeeds
      .map((hotel) => {
        let score = Math.round((hotel.rating || 4.5) * 12)
        if (budgetUpper !== Number.POSITIVE_INFINITY) {
          if (hotel.ticketPrice <= budgetUpper * 0.35) score += 22
          else score -= 10
        }
        if (
          input.companions === "family" &&
          hotel.tags.some((tag) => /亲子|家庭|小孩/u.test(tag))
        ) {
          score += 8
        }
        if (
          input.companions === "elderly" &&
          hotel.tags.some((tag) => /老人|安静|少走路/u.test(tag))
        ) {
          score += 8
        }
        if ((input.interests ?? []).includes("休闲度假")) score += 4

        return {
          id: hotel.id,
          slug: hotel.id,
          name: hotel.name,
          city: hotel.city || "北京",
          province: hotel.province || "北京",
          district: hotel.district,
          price: hotel.ticketPrice || 0,
          rating: hotel.rating || 4.5,
          level: "",
          coverImage: hotel.image,
          tags: hotel.tags,
          sourceType: "poi" as const,
          reason: "基于北京样板城市与评论偏好标签推荐",
          score,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit ?? 4)
      .map(({ score: _score, ...item }) => item)
  }

  const budgetUpper = parseBudgetUpperBound(input.budgetRange)
  const interestSet = new Set(input.interests ?? [])
  const preferredTagHints = new Set<string>()
  if (input.companions === "family") preferredTagHints.add("适合亲子")
  if (input.companions === "elderly") preferredTagHints.add("适合老人")
  if (interestSet.has("休闲度假")) preferredTagHints.add("适合度假")
  for (const tag of normalizedReviewInsights.recommendationTags ?? []) {
    preferredTagHints.add(tag)
  }

  const scoped = normalizedHotels.filter((hotel) => {
    if (!city) return true
    return hotel.city === city
  })

  return scoped
    .map((hotel) => {
      let score = 0
      if (city && hotel.city === city) score += 30
      if (budgetUpper !== Number.POSITIVE_INFINITY) {
        if (hotel.price <= budgetUpper) score += 20
        else score -= 10
      }
      score += Math.round((hotel.rating || 0) * 6)
      score += hotel.tags.reduce(
        (sum, tag) => sum + (preferredTagHints.has(tag) ? 6 : 0),
        0
      )
      return { ...hotel, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 4)
}



