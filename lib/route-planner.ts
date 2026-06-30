import { loadAMap } from "@/lib/amap-loader"
import { analyzeAmapError } from "@/lib/amap-error-utils"
import {
  formatDistance,
  formatDuration,
  getSpotLngLat,
  resolveSpotCoordinates,
} from "@/lib/amap-spot-utils"
import { requestRouteLegByWebService } from "@/lib/amap-webservice-client"
import type {
  AMapNamespace,
  LngLatTuple,
} from "@/lib/amap-types"
import { buildPlannerDayAssignments } from "@/lib/planner-engine"
import type { TransportSuggestionMode, TravelRequirement } from "@/lib/planner-types"
import { getHotelRecommendations, normalizedSpots } from "@/lib/normalized-data"
import {
  beijingHotelSeeds,
  beijingRestaurantSeeds,
  isBeijingCityName,
} from "@/lib/beijing-place-data"
import { recommendBeijingMealCandidate } from "@/lib/beijing-food-recommender"
import { recommendBeijingHotelCandidate } from "@/lib/beijing-hotel-recommender"
import { getNearbyPoiCandidates } from "@/lib/poi-provider"
import type { PoiEntityType, PoiProviderItem } from "@/lib/poi-normalizer"
import type {
  DaySuggestionItem,
  ItineraryDay,
  PlanGenerationStatus,
  RouteTransportMode,
  Spot,
  TravelLeg,
} from "@/lib/travel-context"
import {
  estimatePlayMinutes,
  formatClock,
  formatStayDuration,
  getDayTheme,
  getDefaultDayStartMinutes,
  resolveDayCount,
  splitSpotsByDay,
} from "@/lib/itinerary-utils"

interface BuildItineraryInput {
  spots: Spot[]
  startDate: string
  endDate: string
  pace: string
  departure: string
  transportMode?: RouteTransportMode
  requirement?: TravelRequirement
  forcedDaySpotIds?: string[][]
  forcedDayMetas?: Array<Pick<PlannedDayMeta, "theme" | "districtSummary" | "warnings">>
  forcedSpotReasonMap?: Record<string, string>
}

export interface BuildItineraryOutput {
  days: ItineraryDay[]
  totalDays: number
  totalSpots: number
  totalDistanceMeters: number
  totalTravelSeconds: number
  totalPlayMinutes: number
  totalEstimatedCost: number
  status: PlanGenerationStatus
  notices: string[]
}

interface RouteContext {
  AMap: AMapNamespace | null
  notices: string[]
}

interface CalculatedLeg {
  distanceMeters: number
  durationSeconds: number
  isEstimated: boolean
  estimateReason?: string
  recommendedMode: TransportSuggestionMode
  recommendedReason: string
  transitLineSummary?: string[]
  transitTransferCount?: number
  transitSteps?: TravelLeg["transitSteps"]
}

interface PlannedDayMeta {
  title: string
  theme: string
  districtSummary?: string
  warnings?: string[]
}

interface DayRecommendationInput {
  daySpots: Spot[]
  cityHint: string
  requirement?: TravelRequirement
  dayIndex: number
  usedFoodIds: Set<string>
  usedHotelIds: Set<string>
  externalFoodCandidates?: Spot[]
  externalHotelCandidates?: Spot[]
}

const DEFAULT_IMAGE = "/images/placeholders/poi-default.jpg"

function normalizeGeoText(input?: string) {
  if (!input) return ""
  return input.trim().replace(/市$/, "").replace(/省$/, "")
}

function parseBudgetUpperBound(budgetRange?: string) {
  if (!budgetRange) return Number.POSITIVE_INFINITY
  const text = budgetRange.trim()
  if (text.includes("以内")) {
    const value = Number(text.replace(/[^\d]/g, ""))
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  if (text.includes("以上")) return Number.POSITIVE_INFINITY
  const [minText, maxText] = text.split("-")
  const maxValue = Number((maxText || minText || "").replace(/[^\d]/g, ""))
  return Number.isFinite(maxValue) ? maxValue : Number.POSITIVE_INFINITY
}

function toSuggestionItemFromSpot(
  spot: Spot,
  type: "food" | "hotel",
  reason: string
): DaySuggestionItem {
  const rawPrice = Number(spot.ticketPrice)
  const basePrice =
    Number.isFinite(rawPrice) && rawPrice > 0
      ? rawPrice
      : type === "hotel"
      ? 360
      : 88
  return {
    id: `${type}-${spot.id}`,
    name: spot.name,
    type,
    address: spot.address || `${spot.city || ""}${spot.name}`,
    price: Math.round(basePrice),
    rating: Number.isFinite(spot.rating) && spot.rating > 0 ? spot.rating : 4.5,
    image: spot.image || DEFAULT_IMAGE,
    reason,
    tags: spot.tags?.slice(0, 4) || [],
  }
}

function inferSpotTypeFromPoi(type: PoiEntityType): Spot["type"] {
  if (type === "food") return "restaurant"
  if (type === "hotel") return "hotel"
  return "attraction"
}

function toSpotFromPoi(item: PoiProviderItem): Spot {
  const inferredType = inferSpotTypeFromPoi(item.type)
  const lng = typeof item.lng === "number" ? item.lng : undefined
  const lat = typeof item.lat === "number" ? item.lat : undefined
  const rating = Number.isFinite(item.rating) && Number(item.rating) > 0 ? Number(item.rating) : 0
  const price = Number.isFinite(item.price) && Number(item.price) > 0 ? Math.round(Number(item.price)) : 0
  return {
    id: item.id,
    name: item.name,
    type: inferredType,
    address: item.address || `${item.city}${item.name}`,
    rating,
    heat: 70,
    ticketPrice: price,
    description: `${item.name}（高德附近推荐）`,
    image: DEFAULT_IMAGE,
    tags: item.tags ?? [],
    province: item.province || "北京",
    city: item.city || "北京",
    district: item.district || "",
    lng,
    lat,
    longitude: lng,
    latitude: lat,
    location:
      typeof lng === "number" && typeof lat === "number"
        ? {
            lng,
            lat,
            city: item.city || "北京",
            address: item.address || `${item.city}${item.name}`,
          }
        : undefined,
    coordinates:
      typeof lng === "number" && typeof lat === "number" ? [lng, lat] : undefined,
    suggestedDurationMinutes: inferredType === "restaurant" ? 90 : inferredType === "hotel" ? 30 : 120,
    suggestedDurationText: inferredType === "restaurant" ? "90分钟" : inferredType === "hotel" ? "30分钟" : "2小时",
    source: item.source,
  }
}

function normalizeIdentityText(value?: string) {
  if (!value) return ""
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）【】[\]{}<>《》"'`.,，。:：;；!?！？、\-_/\\]/g, "")
}

function hasValidRating(spot: Spot) {
  return Number.isFinite(spot.rating) && spot.rating > 0
}

function hasValidPrice(spot: Spot) {
  return Number.isFinite(spot.ticketPrice) && spot.ticketPrice > 0
}

function hasValidCoordinates(spot: Spot) {
  const lng = Number(spot.lng)
  const lat = Number(spot.lat)
  return Number.isFinite(lng) && Number.isFinite(lat)
}

function hasUsableImage(spot: Spot) {
  return Boolean(spot.image && spot.image !== DEFAULT_IMAGE)
}

function mergeSpotBySupplement(base: Spot, supplement: Spot): Spot {
  const merged: Spot = {
    ...base,
    tags: Array.from(
      new Set(
        [...(base.tags || []), ...(supplement.tags || [])]
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    ),
  }

  if (!merged.address && supplement.address) merged.address = supplement.address
  if (!merged.province && supplement.province) merged.province = supplement.province
  if (!merged.city && supplement.city) merged.city = supplement.city
  if (!merged.district && supplement.district) merged.district = supplement.district
  if ((!merged.description || merged.description.length < 8) && supplement.description) {
    merged.description = supplement.description
  }
  if (!hasUsableImage(merged) && hasUsableImage(supplement)) {
    merged.image = supplement.image
  }
  if (!hasValidRating(merged) && hasValidRating(supplement)) {
    merged.rating = supplement.rating
  }
  if (!hasValidPrice(merged) && hasValidPrice(supplement)) {
    merged.ticketPrice = supplement.ticketPrice
  }

  if (!hasValidCoordinates(merged) && hasValidCoordinates(supplement)) {
    merged.lng = supplement.lng
    merged.lat = supplement.lat
    merged.longitude = supplement.longitude ?? supplement.lng
    merged.latitude = supplement.latitude ?? supplement.lat
    merged.coordinates = supplement.coordinates
    merged.location = supplement.location
  }

  return merged
}

function buildCandidateIdentityKeys(spot: Spot): string[] {
  const keys: string[] = []
  const name = normalizeIdentityText(spot.name)
  const address = normalizeIdentityText(spot.address)
  const city = normalizeIdentityText(spot.city || spot.province || "")
  const district = normalizeIdentityText(spot.district || "")
  const type = spot.type || "attraction"

  if (spot.id) keys.push(`id:${spot.id}`)
  if (name && address) keys.push(`name-address:${type}:${name}|${address}`)
  if (name && city) keys.push(`name-city:${type}:${name}|${city}`)
  if (name && district && city) keys.push(`name-district:${type}:${name}|${district}|${city}`)

  return keys
}

function mergeUniqueCandidates(base: Spot[], enhanced: Spot[]) {
  const byId = new Map<string, Spot>()
  const keyToId = new Map<string, string>()

  const upsert = (spot: Spot, fromEnhanced: boolean) => {
    const keys = buildCandidateIdentityKeys(spot)
    let matchedId = ""
    for (const key of keys) {
      const existingId = keyToId.get(key)
      if (existingId) {
        matchedId = existingId
        break
      }
    }
    if (!matchedId && byId.has(spot.id)) {
      matchedId = spot.id
    }

    if (!matchedId) {
      byId.set(spot.id, spot)
      for (const key of keys) keyToId.set(key, spot.id)
      return
    }

    const existing = byId.get(matchedId)
    if (!existing) return
    const merged = mergeSpotBySupplement(existing, spot)
    byId.set(matchedId, merged)
    for (const key of buildCandidateIdentityKeys(merged)) {
      keyToId.set(key, matchedId)
    }
  }

  for (const spot of base) upsert(spot, false)
  for (const spot of enhanced) upsert(spot, true)

  const deduped = new Map<string, Spot>()
  for (const candidate of byId.values()) {
    const dedupeKey = buildCandidateIdentityKeys(candidate)[1] || `id:${candidate.id}`
    if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, candidate)
  }
  return [...deduped.values()]
}

function getMealAnchorSpot(daySpots: Spot[], mealType: "lunch" | "dinner") {
  const attractions = daySpots.filter((spot) => spot.type === "attraction")
  if (attractions.length === 0) return daySpots[0] || null
  if (mealType === "lunch") {
    return attractions[Math.max(0, Math.floor((attractions.length - 1) / 2))]
  }
  return attractions[attractions.length - 1]
}

function getHotelAnchorSpot(daySpots: Spot[]) {
  return (
    [...daySpots].reverse().find((spot) => spot.type !== "restaurant") ||
    daySpots[daySpots.length - 1] ||
    null
  )
}

async function fetchEnhancedDayCandidates(input: {
  daySpots: Spot[]
  cityHint: string
}): Promise<{
  foodCandidates: Spot[]
  hotelCandidates: Spot[]
  warnings: string[]
}> {
  const cityHint = normalizeGeoText(input.cityHint || input.daySpots[0]?.city || "")
  if (!isBeijingCityName(cityHint)) {
    return {
      foodCandidates: [],
      hotelCandidates: [],
      warnings: [],
    }
  }

  const warnings: string[] = []
  const lunchAnchor = getMealAnchorSpot(input.daySpots, "lunch")
  const dinnerAnchor = getMealAnchorSpot(input.daySpots, "dinner")
  const hotelAnchor = getHotelAnchorSpot(input.daySpots)

  const lunchLngLat = lunchAnchor ? getSpotLngLat(lunchAnchor) : null
  const dinnerLngLat = dinnerAnchor ? getSpotLngLat(dinnerAnchor) : null
  const hotelLngLat = hotelAnchor ? getSpotLngLat(hotelAnchor) : null

  const calls: Array<Promise<PoiProviderItem[]>> = []
  if (lunchLngLat) {
    calls.push(
      getNearbyPoiCandidates({
        city: "北京",
        type: "food",
        anchor: lunchLngLat,
        radius: 1500,
        limit: 10,
      })
    )
  }
  if (dinnerLngLat) {
    calls.push(
      getNearbyPoiCandidates({
        city: "北京",
        type: "food",
        anchor: dinnerLngLat,
        radius: 2500,
        limit: 12,
      })
    )
  }
  if (hotelLngLat) {
    calls.push(
      getNearbyPoiCandidates({
        city: "北京",
        type: "hotel",
        anchor: hotelLngLat,
        radius: 3000,
        limit: 12,
      })
    )
  }

  if (calls.length === 0) {
    return {
      foodCandidates: [],
      hotelCandidates: [],
      warnings: [],
    }
  }

  try {
    const results = await Promise.all(calls)
    const flattened = results.flat()
    const foods = flattened
      .filter((item) => item.type === "food")
      .map((item) => toSpotFromPoi(item))
    const hotels = flattened
      .filter((item) => item.type === "hotel")
      .map((item) => toSpotFromPoi(item))

    if (foods.length === 0) {
      warnings.push("未获取到可用的附近餐饮增强数据，已使用本地候选")
    }
    if (hotels.length === 0) {
      warnings.push("未获取到可用的附近酒店增强数据，已使用本地候选")
    }

    return {
      foodCandidates: foods,
      hotelCandidates: hotels,
      warnings,
    }
  } catch {
    return {
      foodCandidates: [],
      hotelCandidates: [],
      warnings: ["附近 POI 增强请求失败，已自动回退到本地推荐数据"],
    }
  }
}

function scoreFoodCandidate(
  candidate: Spot,
  preferredDistrict: string,
  budgetUpper: number,
  companions?: TravelRequirement["companions"]
) {
  let score = 0
  if (preferredDistrict && candidate.district === preferredDistrict) score += 24
  if (candidate.rating > 0) score += candidate.rating * 6
  if (candidate.heat > 0) score += candidate.heat * 0.2
  if (budgetUpper !== Number.POSITIVE_INFINITY) {
    if (candidate.ticketPrice <= budgetUpper * 0.08) score += 14
    if (candidate.ticketPrice > budgetUpper * 0.18) score -= 10
  }
  if (companions === "family" || companions === "elderly") {
    if (candidate.tags.some((tag) => /亲子|家庭|舒适|安静/u.test(tag))) score += 8
  }
  return score
}

function scoreHotelCandidate(
  candidate: Spot,
  preferredDistrict: string,
  budgetUpper: number,
  specialNeeds: string[]
) {
  let score = 0
  if (preferredDistrict && candidate.district === preferredDistrict) score += 20
  if (candidate.rating > 0) score += candidate.rating * 7
  if (budgetUpper !== Number.POSITIVE_INFINITY) {
    if (candidate.ticketPrice <= budgetUpper * 0.25) score += 16
    if (candidate.ticketPrice > budgetUpper * 0.5) score -= 12
  }
  if (specialNeeds.includes("酒店舒适优先")) score += 10
  if (specialNeeds.includes("低预算优先") && candidate.ticketPrice <= 300) score += 8
  return score
}

function pickNearestDistrict(daySpots: Spot[]) {
  return (
    daySpots.find((spot) => spot.type === "attraction" && spot.district)?.district ||
    daySpots.find((spot) => spot.district)?.district ||
    ""
  )
}

function getCityScopedPools(cityHint: string, requirement?: TravelRequirement) {
  const targetCity = normalizeGeoText(cityHint || requirement?.city || "")
  const budgetUpper = parseBudgetUpperBound(requirement?.budgetRange)
  const isBeijing = isBeijingCityName(targetCity)

  if (isBeijing) {
    const cityRestaurants = beijingRestaurantSeeds.map<Spot>((spot) => ({ ...spot }))
    const cityHotels = beijingHotelSeeds.map<Spot>((spot) => ({ ...spot }))
    return {
      cityRestaurants,
      cityHotels,
      budgetUpper,
    }
  }

  const cityRestaurants = normalizedSpots
    .filter((spot) => spot.type === "restaurant")
    .filter((spot) => {
      const spotCity = normalizeGeoText(spot.city)
      return !targetCity || spotCity === targetCity
    })
    .map<Spot>((spot) => ({
      id: spot.id,
      name: spot.name,
      type: "restaurant",
      address: spot.address,
      rating: spot.rating,
      heat: spot.heat,
      ticketPrice: spot.ticketPrice,
      description: spot.description,
      image: spot.image || DEFAULT_IMAGE,
      tags: spot.tags,
      city: spot.city,
      province: spot.province,
      district: spot.district,
      lng: spot.lng,
      lat: spot.lat,
      location: spot.location,
      coordinates: spot.coordinates,
      suggestedDurationMinutes: 90,
      suggestedDurationText: "90分钟",
    }))

  const hotelSeed = getHotelRecommendations({
    city: cityHint || requirement?.city,
    budgetRange: requirement?.budgetRange,
    companions: requirement?.companions,
    interests: requirement?.interests,
    limit: 16,
  }).map<Spot>((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    type: "hotel",
    address: hotel.district
      ? `${hotel.city}${hotel.district}`
      : `${hotel.city}市区`,
    rating: hotel.rating,
    heat: Math.round((hotel.rating || 4) * 20),
    ticketPrice: Math.round(hotel.price || 0),
    description: hotel.reason || "酒店推荐",
    image: hotel.coverImage || DEFAULT_IMAGE,
    tags: hotel.tags,
    city: hotel.city,
    province: hotel.province,
    district: hotel.district,
  }))

  const cityHotelsFromPoi = normalizedSpots
    .filter((spot) => spot.type === "hotel")
    .filter((spot) => {
      const spotCity = normalizeGeoText(spot.city)
      return !targetCity || spotCity === targetCity
    })
    .map<Spot>((spot) => ({
      id: spot.id,
      name: spot.name,
      type: "hotel",
      address: spot.address,
      rating: spot.rating,
      heat: spot.heat,
      ticketPrice: spot.ticketPrice,
      description: spot.description,
      image: spot.image || DEFAULT_IMAGE,
      tags: spot.tags,
      city: spot.city,
      province: spot.province,
      district: spot.district,
      lng: spot.lng,
      lat: spot.lat,
      location: spot.location,
      coordinates: spot.coordinates,
    }))

  const hotelMap = new Map<string, Spot>()
  for (const item of [...hotelSeed, ...cityHotelsFromPoi]) {
    if (!hotelMap.has(item.id)) hotelMap.set(item.id, item)
  }

  return {
    cityRestaurants,
    cityHotels: [...hotelMap.values()],
    budgetUpper,
  }
}

function pickDayRecommendations({
  daySpots,
  cityHint,
  requirement,
  dayIndex,
  usedFoodIds,
  usedHotelIds,
  externalFoodCandidates,
  externalHotelCandidates,
}: DayRecommendationInput): {
  lunch: DaySuggestionItem | null
  dinner: DaySuggestionItem | null
  hotel: DaySuggestionItem | null
  mealCost: number
  hotelCost: number
  warnings: string[]
} {
  const warnings: string[] = []
  const selectedFoods = daySpots.filter((spot) => spot.type === "restaurant")
  const selectedHotels = daySpots.filter((spot) => spot.type === "hotel")
  const preferredDistrict = pickNearestDistrict(daySpots)
  const { cityRestaurants, cityHotels, budgetUpper } = getCityScopedPools(cityHint, requirement)
  const mergedRestaurants = mergeUniqueCandidates(
    cityRestaurants,
    externalFoodCandidates ?? []
  )
  const mergedHotels = mergeUniqueCandidates(cityHotels, externalHotelCandidates ?? [])
  const beijingMode = isBeijingCityName(cityHint || requirement?.city)

  const fallbackFoods = mergedRestaurants.filter((spot) => !usedFoodIds.has(spot.id))
  const sortedFallbackFoods = [...fallbackFoods].sort((a, b) => {
    const scoreDiff =
      scoreFoodCandidate(b, preferredDistrict, budgetUpper, requirement?.companions) -
      scoreFoodCandidate(a, preferredDistrict, budgetUpper, requirement?.companions)
    if (scoreDiff !== 0) return scoreDiff
    return b.rating - a.rating
  })

  const lunchSpot =
    selectedFoods[0] ||
    (beijingMode
      ? recommendBeijingMealCandidate({
          candidates: fallbackFoods,
          daySpots,
          mealType: "lunch",
          budgetUpper,
          usedIds: usedFoodIds,
          requirement,
        })
      : sortedFallbackFoods[0]) ||
    null
  if (lunchSpot) usedFoodIds.add(lunchSpot.id)

  const dinnerSpot =
    selectedFoods[1] ||
    (beijingMode
      ? recommendBeijingMealCandidate({
          candidates: fallbackFoods.filter((spot) => spot.id !== lunchSpot?.id),
          daySpots,
          mealType: "dinner",
          budgetUpper,
          usedIds: usedFoodIds,
          requirement,
        })
      : sortedFallbackFoods.find((spot) => spot.id !== lunchSpot?.id)) ||
    null
  if (dinnerSpot) usedFoodIds.add(dinnerSpot.id)

  const fallbackHotels = mergedHotels.filter((spot) => !usedHotelIds.has(spot.id))
  const sortedFallbackHotels = [...fallbackHotels].sort((a, b) => {
    const scoreDiff =
      scoreHotelCandidate(
        b,
        preferredDistrict,
        budgetUpper,
        requirement?.specialNeeds || []
      ) -
      scoreHotelCandidate(
        a,
        preferredDistrict,
        budgetUpper,
        requirement?.specialNeeds || []
      )
    if (scoreDiff !== 0) return scoreDiff
    return b.rating - a.rating
  })

  const hotelSpot =
    selectedHotels[0] ||
    (beijingMode
      ? recommendBeijingHotelCandidate({
          candidates: fallbackHotels,
          daySpots,
          budgetUpper,
          usedIds: usedHotelIds,
          requirement,
        })
      : sortedFallbackHotels[dayIndex % Math.max(1, Math.min(3, sortedFallbackHotels.length))]) ||
    sortedFallbackHotels[0] ||
    null
  if (hotelSpot) usedHotelIds.add(hotelSpot.id)

  if (!lunchSpot || !dinnerSpot) {
    warnings.push("当日餐饮数据不足，已使用城市热门候选补齐")
  }
  if (!hotelSpot) {
    warnings.push("当日暂无合适酒店候选，可在结果页手动替换住宿")
  }

  const lunch = lunchSpot
    ? toSuggestionItemFromSpot(
        lunchSpot,
        "food",
        selectedFoods[0]?.id === lunchSpot.id
          ? "来自你手动加入的美食点"
          : "根据当天路线与预算自动推荐午餐"
      )
    : null
  const dinner = dinnerSpot
    ? toSuggestionItemFromSpot(
        dinnerSpot,
        "food",
        selectedFoods[1]?.id === dinnerSpot.id
          ? "来自你手动加入的美食点"
          : "根据路线终点与晚间时段自动推荐晚餐"
      )
    : null
  const hotel = hotelSpot
    ? toSuggestionItemFromSpot(
        hotelSpot,
        "hotel",
        selectedHotels[0]?.id === hotelSpot.id
          ? "来自你手动加入的住宿点"
          : "根据当日终点、预算和评论偏好推荐住宿"
      )
    : null

  const mealCost = (lunch?.price || 0) + (dinner?.price || 0)
  const hotelCost = hotel?.price || 0

  return { lunch, dinner, hotel, mealCost, hotelCost, warnings }
}

function getDistanceByHaversine(from: LngLatTuple, to: LngLatTuple) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const [lng1, lat1] = from
  const [lng2, lat2] = to
  const earthRadius = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.max(300, Math.round(earthRadius * c))
}

function estimateDurationByMode(distanceMeters: number, mode: RouteTransportMode) {
  const speedMeterPerSecond =
    mode === "walking" ? 1.35 : mode === "transit" ? 6.5 : 11.5
  const base = Math.round(distanceMeters / speedMeterPerSecond)
  return Math.max(5 * 60, base)
}

function normalizeCity(city?: string) {
  if (!city) return ""
  return city.trim().replace(/市$/, "")
}

function recommendTransportMode(
  distanceMeters: number,
  fromCity?: string,
  toCity?: string
): { mode: TransportSuggestionMode; reason: string } {
  const distanceKm = distanceMeters / 1000
  const from = normalizeCity(fromCity)
  const to = normalizeCity(toCity)
  const crossCity = Boolean(from && to && from !== to)

  if (crossCity) {
    if (distanceKm >= 800) {
      return {
        mode: "flight",
        reason: "跨城距离较长，建议优先选择飞机提升效率",
      }
    }
    return {
      mode: "train",
      reason: "属于跨城出行，建议优先选择高铁或城际铁路",
    }
  }

  if (distanceKm <= 1.8) {
    return {
      mode: "walking",
      reason: "距离较短，步行更高效且省去等车时间",
    }
  }

  if (distanceKm <= 7) {
    return {
      mode: "subway",
      reason: "市内中短途，地铁通常更稳更快",
    }
  }

  if (distanceKm <= 15) {
    return {
      mode: "bus",
      reason: "市内跨区通勤，公交/地铁换乘成本更低",
    }
  }

  if (distanceKm <= 40) {
    return {
      mode: "taxi",
      reason: "市内中长途建议打车或网约车，减少换乘负担",
    }
  }

  return {
    mode: "driving",
    reason: "远距离或远郊段，驾车更灵活",
  }
}

async function prepareRouteContext(): Promise<RouteContext> {
  try {
    const AMap = await loadAMap(["AMap.Geocoder", "AMap.PlaceSearch"])
    return {
      AMap,
      notices: [],
    }
  } catch (error) {
    const analysis = analyzeAmapError(error, "高德路线服务暂不可用，将改为预估通勤时间")
    return {
      AMap: null,
      notices: [analysis.userMessage],
    }
  }
}

async function resolveTextLocation(
  AMap: AMapNamespace,
  text: string,
  cityHint?: string
): Promise<LngLatTuple | null> {
  const keyword = text.trim()
  if (!keyword) return null

  const geocodeResult = await new Promise<LngLatTuple | null>((resolve) => {
    const geocoder = new AMap.Geocoder({ city: cityHint })
    geocoder.getLocation(keyword, (status, result) => {
      if (status !== "complete" || !result.geocodes?.length) {
        resolve(null)
        return
      }
      const location = result.geocodes[0]?.location
      const lng = Number(location?.lng ?? location?.getLng?.())
      const lat = Number(location?.lat ?? location?.getLat?.())
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        resolve([lng, lat])
        return
      }
      resolve(null)
    })
  })
  if (geocodeResult) return geocodeResult

  const searchResult = await new Promise<LngLatTuple | null>((resolve) => {
    const placeSearch = new AMap.PlaceSearch({
      city: cityHint,
      citylimit: false,
      pageSize: 1,
      pageIndex: 1,
    })
    placeSearch.search(keyword, (status, result) => {
      if (status !== "complete") {
        resolve(null)
        return
      }
      const location = result.poiList?.pois?.[0]?.location
      const lng = Number(location?.lng ?? location?.getLng?.())
      const lat = Number(location?.lat ?? location?.getLat?.())
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        resolve([lng, lat])
        return
      }
      resolve(null)
    })
  })

  return searchResult
}

async function calculateLeg(
  context: RouteContext,
  fromName: string,
  toName: string,
  fromLngLat: LngLatTuple | null,
  toLngLat: LngLatTuple | null,
  mode: RouteTransportMode,
  fromCity?: string,
  toCity?: string
): Promise<CalculatedLeg> {
  if (!fromLngLat || !toLngLat) {
    const guessedDistance = 6000
    const recommendation = recommendTransportMode(guessedDistance, fromCity, toCity)
    return {
      distanceMeters: guessedDistance,
      durationSeconds: estimateDurationByMode(guessedDistance, mode),
      isEstimated: true,
      estimateReason: "起点或终点缺少坐标，已按城市通勤经验预估",
      recommendedMode: recommendation.mode,
      recommendedReason: recommendation.reason,
    }
  }

  try {
    const routeResult = await requestRouteLegByWebService(mode, {
      origin: fromLngLat,
      destination: toLngLat,
      fromName,
      toName,
      city: normalizeGeoText(fromCity || toCity || ""),
      cityd: normalizeGeoText(toCity || fromCity || ""),
    })

    const recommendation = recommendTransportMode(
      routeResult.distanceMeters > 0
        ? routeResult.distanceMeters
        : getDistanceByHaversine(fromLngLat, toLngLat),
      fromCity,
      toCity
    )

    if (
      routeResult.status === "success" &&
      routeResult.distanceMeters > 0 &&
      routeResult.durationSeconds > 0
    ) {
      return {
        distanceMeters: routeResult.distanceMeters,
        durationSeconds: routeResult.durationSeconds,
        isEstimated: false,
        recommendedMode: recommendation.mode,
        recommendedReason: recommendation.reason,
        transitLineSummary: routeResult.transitLineSummary,
        transitTransferCount: routeResult.transitTransferCount,
        transitSteps: routeResult.transitSteps,
      }
    }

    const fallbackDistance =
      routeResult.distanceMeters > 0
        ? routeResult.distanceMeters
        : getDistanceByHaversine(fromLngLat, toLngLat)
    const fallbackDuration =
      routeResult.durationSeconds > 0
        ? routeResult.durationSeconds
        : estimateDurationByMode(fallbackDistance, mode)
    const fallbackReason =
      routeResult.message ||
      (mode === "transit"
        ? "当前路段暂无可用公交方案，已按预估通勤时间展示"
        : mode === "walking"
        ? "步行路线暂不可用，已按预估步行时间展示"
        : "驾车路线暂不可用，已按预估通勤时间展示")
    return {
      distanceMeters: fallbackDistance,
      durationSeconds: fallbackDuration,
      isEstimated: true,
      estimateReason: fallbackReason,
      recommendedMode: recommendation.mode,
      recommendedReason: recommendation.reason,
      transitLineSummary: routeResult.transitLineSummary,
      transitTransferCount: routeResult.transitTransferCount,
      transitSteps: routeResult.transitSteps,
    }
  } catch (error) {
    const analysis = analyzeAmapError(error, "路线规划失败，已自动降级为预估")
    const estimatedDistance = getDistanceByHaversine(fromLngLat, toLngLat)
    const recommendation = recommendTransportMode(estimatedDistance, fromCity, toCity)
    return {
      distanceMeters: estimatedDistance,
      durationSeconds: estimateDurationByMode(estimatedDistance, mode),
      isEstimated: true,
      estimateReason: analysis.userMessage,
      recommendedMode: recommendation.mode,
      recommendedReason: recommendation.reason,
    }
  }
}

function resolveDayChunks(
  spots: Spot[],
  startDate: string,
  endDate: string,
  pace: string,
  requirement?: TravelRequirement,
  forcedDaySpotIds?: string[][],
  forcedDayMetas?: Array<Pick<PlannedDayMeta, "theme" | "districtSummary" | "warnings">>
) {
  const targetDayCount = Math.max(
    1,
    requirement?.days || resolveDayCount(startDate, endDate, spots.length, pace)
  )

  if (forcedDaySpotIds && forcedDaySpotIds.length > 0) {
    const byId = new Map(spots.map((spot) => [spot.id, spot]))
    const used = new Set<string>()
    const dayChunks = forcedDaySpotIds.map((ids) => {
      const daySpots: Spot[] = []
      for (const id of ids) {
        const spot = byId.get(id)
        if (!spot || used.has(id)) continue
        daySpots.push(spot)
        used.add(id)
      }
      return daySpots
    })

    const unplanned = spots.filter((spot) => !used.has(spot.id))
    const notices: string[] = []
    if (unplanned.length > 0) {
      notices.push(`LLM未排入${unplanned.length}个候选景点，已标记为顺延。`)
    }
    if (dayChunks.every((day) => day.length === 0)) {
      notices.push("LLM规划未返回有效日程，已回退规则引擎排期。")
    } else {
      const dayMetas = dayChunks.map<PlannedDayMeta>((_, index) => ({
        title: `第${index + 1}天`,
        theme: forcedDayMetas?.[index]?.theme || getDayTheme(index + 1),
        districtSummary: forcedDayMetas?.[index]?.districtSummary,
        warnings: forcedDayMetas?.[index]?.warnings || [],
      }))
      return {
        plannerResult: {
          days: dayChunks.map((day, index) => ({
            day: index + 1,
            title: `第${index + 1}天`,
            theme: dayMetas[index]?.theme || getDayTheme(index + 1),
            districtSummary: dayMetas[index]?.districtSummary || "城市核心片区",
            spots: day,
            warnings: dayMetas[index]?.warnings || [],
          })),
          unplanned,
          notices,
          usedDayCount: dayChunks.filter((day) => day.length > 0).length,
        },
        dayChunks,
        dayMetas,
      }
    }
  }

  const plannerResult = buildPlannerDayAssignments({
    spots,
    requirement,
    pace,
    targetDayCount,
  })

  if (plannerResult.days.length > 0) {
    return {
      plannerResult,
      dayChunks: plannerResult.days.map((day) => day.spots),
      dayMetas: plannerResult.days.map<PlannedDayMeta>((day) => ({
        title: day.title,
        theme: day.theme,
        districtSummary: day.districtSummary,
        warnings: day.warnings,
      })),
    }
  }

  const fallbackChunks = splitSpotsByDay(spots, targetDayCount)
  return {
    plannerResult,
    dayChunks: fallbackChunks,
    dayMetas: fallbackChunks.map((_, index) => ({
      title: `第${index + 1}天`,
      theme: getDayTheme(index + 1),
      districtSummary: "城市核心片区",
      warnings: [],
    })),
  }
}

function buildBasicDays(
  spots: Spot[],
  pace: string,
  departure: string,
  requirement?: TravelRequirement
) {
  const { dayChunks, dayMetas } = resolveDayChunks(spots, "", "", pace, requirement)
  const cityHint = requirement?.city || spots[0]?.city || ""
  const usedFoodIds = new Set<string>()
  const usedHotelIds = new Set<string>()

  return dayChunks.map((daySpots, index) => {
    const startMinutes = getDefaultDayStartMinutes(pace, index)
    let cursor = startMinutes
    const normalizedSpots = daySpots.map((spot) => {
      const stay = estimatePlayMinutes(spot, pace)
      const arrivalTime = formatClock(cursor)
      cursor += stay
      const leaveTime = formatClock(cursor)
      return {
        ...spot,
        arrivalTime,
        leaveTime,
        suggestedDurationMinutes: stay,
        suggestedDurationText: formatStayDuration(stay),
      }
    })
    const totalPlayMinutes = normalizedSpots.reduce(
      (sum, spot) => sum + (spot.suggestedDurationMinutes || 0),
      0
    )
    const daySuggestions = pickDayRecommendations({
      daySpots: normalizedSpots,
      cityHint,
      requirement,
      dayIndex: index,
      usedFoodIds,
      usedHotelIds,
    })

    const meta = dayMetas[index]
    const ticketCost = daySpots.reduce((sum, spot) => sum + spot.ticketPrice, 0)

    return {
      day: index + 1,
      title: meta?.title || `第${index + 1}天`,
      theme: meta?.theme || getDayTheme(index + 1),
      districtSummary: meta?.districtSummary,
      startTime: formatClock(startMinutes),
      endTime: formatClock(startMinutes + totalPlayMinutes),
      spots: normalizedSpots,
      routeLegs: [],
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes,
      totalEstimatedCost:
        ticketCost + daySuggestions.mealCost + daySuggestions.hotelCost,
      warnings: [
        ...(meta?.warnings || []),
        ...daySuggestions.warnings,
      ],
      startsFromDeparture: Boolean(departure.trim()),
      returnsToDeparture: Boolean(departure.trim()),
      departureName: departure.trim() || undefined,
      lunchSuggestion: daySuggestions.lunch,
      dinnerSuggestion: daySuggestions.dinner,
      hotelSuggestion: daySuggestions.hotel,
      totalMealCost: daySuggestions.mealCost,
      totalHotelCost: daySuggestions.hotelCost,
    } as ItineraryDay
  })
}

export async function buildAiItinerary({
  spots,
  startDate,
  endDate,
  pace,
  departure,
  transportMode = "driving",
  requirement,
  forcedDaySpotIds,
  forcedDayMetas,
  forcedSpotReasonMap,
}: BuildItineraryInput): Promise<BuildItineraryOutput> {
  if (spots.length === 0) {
    return {
      days: [],
      totalDays: 0,
      totalSpots: 0,
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes: 0,
      totalEstimatedCost: 0,
      status: "error",
      notices: ["没有可规划的景点，请先添加景点后再试"],
    }
  }

  try {
    const context = await prepareRouteContext()
    const notices = [...context.notices]

    const { plannerResult, dayChunks, dayMetas } = resolveDayChunks(
      spots,
      startDate,
      endDate,
      pace,
      requirement,
      forcedDaySpotIds,
      forcedDayMetas
    )

    if (plannerResult.notices.length > 0) {
      notices.push(...plannerResult.notices)
    }

    if (plannerResult.unplanned.length > 0) {
      const previewNames = plannerResult.unplanned
        .slice(0, 3)
        .map((item) => item.name)
        .join("、")
      notices.push(
        `以下地点因天数或路线冲突未纳入：${previewNames}${
          plannerResult.unplanned.length > 3 ? " 等" : ""
        }`
      )
    }

    const coordinateMap = new Map<string, LngLatTuple | null>()
    if (context.AMap) {
      const resolvedResult = await resolveSpotCoordinates(context.AMap, spots)
      for (const resolved of resolvedResult.resolved) {
        coordinateMap.set(resolved.spot.id, resolved.lngLat)
      }
      for (const unresolved of resolvedResult.unresolved) {
        coordinateMap.set(unresolved.spot.id, null)
      }
      if (resolvedResult.unresolved.length > 0) {
        notices.push("部分景点未获取到精确坐标，相关路段已自动预估")
      }
    } else {
      for (const spot of spots) {
        coordinateMap.set(spot.id, getSpotLngLat(spot))
      }
    }

    const cityHint = requirement?.city || spots.find((spot) => spot.city)?.city
    let departureCoordinate: LngLatTuple | null = null
    const departureName = departure.trim()
    if (departureName && context.AMap) {
      departureCoordinate = await resolveTextLocation(context.AMap, departureName, cityHint)
      if (!departureCoordinate) {
        notices.push("未能解析出发地坐标，出发与返程路段已按预估处理")
      }
    }

    const days: ItineraryDay[] = []
    let estimatedLegCount = 0
    const usedFoodIds = new Set<string>()
    const usedHotelIds = new Set<string>()

    for (let dayIndex = 0; dayIndex < dayChunks.length; dayIndex += 1) {
      const daySpots = dayChunks[dayIndex]
      const dayStartMinutes = getDefaultDayStartMinutes(pace, dayIndex)
      let cursorMinutes = dayStartMinutes
      const startsFromDeparture = Boolean(departureName)
      const returnsToDeparture = Boolean(departureName)

      const enrichedSpots: Spot[] = []
      const routeLegs: TravelLeg[] = []

      if (startsFromDeparture && daySpots.length > 0) {
        const firstSpot = daySpots[0]
        const firstLeg = await calculateLeg(
          context,
          departureName,
          firstSpot.name,
          departureCoordinate,
          coordinateMap.get(firstSpot.id) ?? null,
          transportMode,
          cityHint,
          firstSpot.city || cityHint
        )
        const startTime = formatClock(cursorMinutes)
        cursorMinutes += Math.max(1, Math.round(firstLeg.durationSeconds / 60))
        const arrivalTime = formatClock(cursorMinutes)
        routeLegs.push({
          id: `d${dayIndex + 1}-start`,
          fromName: departureName,
          toName: firstSpot.name,
          transportMode,
          recommendedMode: firstLeg.recommendedMode,
          recommendedReason: firstLeg.recommendedReason,
          distanceMeters: firstLeg.distanceMeters,
          durationSeconds: firstLeg.durationSeconds,
          startTime,
          arrivalTime,
          readableDistance: formatDistance(firstLeg.distanceMeters),
          readableDuration: formatDuration(firstLeg.durationSeconds),
          isEstimated: firstLeg.isEstimated,
          estimateReason: firstLeg.estimateReason,
          transitLineSummary: firstLeg.transitLineSummary,
          transitTransferCount: firstLeg.transitTransferCount,
          transitSteps: firstLeg.transitSteps,
        })
      }

      for (let index = 0; index < daySpots.length; index += 1) {
        const currentSpot = daySpots[index]
        const suggestedDurationMinutes = estimatePlayMinutes(currentSpot, pace)
        const arrivalTime = formatClock(cursorMinutes)
        cursorMinutes += suggestedDurationMinutes
        const leaveTime = formatClock(cursorMinutes)
        enrichedSpots.push({
          ...currentSpot,
          arrivalTime,
          leaveTime,
          suggestedDurationMinutes,
          suggestedDurationText: formatStayDuration(suggestedDurationMinutes),
          plannerReason: forcedSpotReasonMap?.[currentSpot.id],
        })

        const hasNextSpot = index < daySpots.length - 1
        if (hasNextSpot) {
          const nextSpot = daySpots[index + 1]
          const legResult = await calculateLeg(
            context,
            currentSpot.name,
            nextSpot.name,
            coordinateMap.get(currentSpot.id) ?? null,
            coordinateMap.get(nextSpot.id) ?? null,
            transportMode,
            currentSpot.city || cityHint,
            nextSpot.city || cityHint
          )
          const startTime = formatClock(cursorMinutes)
          cursorMinutes += Math.max(1, Math.round(legResult.durationSeconds / 60))
          const arrivalTimeForLeg = formatClock(cursorMinutes)
          routeLegs.push({
            id: `d${dayIndex + 1}-${currentSpot.id}-${nextSpot.id}`,
            fromName: currentSpot.name,
            toName: nextSpot.name,
            transportMode,
            recommendedMode: legResult.recommendedMode,
            recommendedReason: legResult.recommendedReason,
            distanceMeters: legResult.distanceMeters,
            durationSeconds: legResult.durationSeconds,
            startTime,
            arrivalTime: arrivalTimeForLeg,
            readableDistance: formatDistance(legResult.distanceMeters),
            readableDuration: formatDuration(legResult.durationSeconds),
            isEstimated: legResult.isEstimated,
            estimateReason: legResult.estimateReason,
            transitLineSummary: legResult.transitLineSummary,
            transitTransferCount: legResult.transitTransferCount,
            transitSteps: legResult.transitSteps,
          })
        }
      }

      if (returnsToDeparture && daySpots.length > 0) {
        const lastSpot = daySpots[daySpots.length - 1]
        const returnLeg = await calculateLeg(
          context,
          lastSpot.name,
          departureName,
          coordinateMap.get(lastSpot.id) ?? null,
          departureCoordinate,
          transportMode,
          lastSpot.city || cityHint,
          cityHint
        )
        const startTime = formatClock(cursorMinutes)
        cursorMinutes += Math.max(1, Math.round(returnLeg.durationSeconds / 60))
        const arrivalTime = formatClock(cursorMinutes)
        routeLegs.push({
          id: `d${dayIndex + 1}-end`,
          fromName: lastSpot.name,
          toName: departureName,
          transportMode,
          recommendedMode: returnLeg.recommendedMode,
          recommendedReason: returnLeg.recommendedReason,
          distanceMeters: returnLeg.distanceMeters,
          durationSeconds: returnLeg.durationSeconds,
          startTime,
          arrivalTime,
          readableDistance: formatDistance(returnLeg.distanceMeters),
          readableDuration: formatDuration(returnLeg.durationSeconds),
          isEstimated: returnLeg.isEstimated,
          estimateReason: returnLeg.estimateReason,
          transitLineSummary: returnLeg.transitLineSummary,
          transitTransferCount: returnLeg.transitTransferCount,
          transitSteps: returnLeg.transitSteps,
        })
      }

      estimatedLegCount += routeLegs.filter((leg) => leg.isEstimated).length

      const totalDistanceMeters = routeLegs.reduce(
        (sum, leg) => sum + leg.distanceMeters,
        0
      )
      const totalTravelSeconds = routeLegs.reduce(
        (sum, leg) => sum + leg.durationSeconds,
        0
      )
      const totalPlayMinutes = enrichedSpots.reduce(
        (sum, spot) => sum + (spot.suggestedDurationMinutes || 0),
        0
      )
      const ticketCost = enrichedSpots.reduce(
        (sum, spot) => sum + spot.ticketPrice,
        0
      )
      const enhancedCandidates = await fetchEnhancedDayCandidates({
        daySpots: enrichedSpots,
        cityHint: cityHint || requirement?.city || "",
      })
      const daySuggestions = pickDayRecommendations({
        daySpots: enrichedSpots,
        cityHint: cityHint || requirement?.city || "",
        requirement,
        dayIndex,
        usedFoodIds,
        usedHotelIds,
        externalFoodCandidates: enhancedCandidates.foodCandidates,
        externalHotelCandidates: enhancedCandidates.hotelCandidates,
      })
      const totalEstimatedCost =
        ticketCost + daySuggestions.mealCost + daySuggestions.hotelCost

      const dayMeta = dayMetas[dayIndex]
      const mergedWarnings = [
        ...(dayMeta?.warnings || []),
        ...enhancedCandidates.warnings,
        ...daySuggestions.warnings,
      ]

      days.push({
        day: dayIndex + 1,
        title: dayMeta?.title || `第${dayIndex + 1}天`,
        theme: dayMeta?.theme || getDayTheme(dayIndex + 1),
        districtSummary: dayMeta?.districtSummary,
        warnings: mergedWarnings,
        startTime: routeLegs[0]?.startTime || formatClock(dayStartMinutes),
        endTime:
          routeLegs[routeLegs.length - 1]?.arrivalTime ||
          enrichedSpots[enrichedSpots.length - 1]?.leaveTime ||
          formatClock(dayStartMinutes),
        spots: enrichedSpots,
        routeLegs,
        totalDistanceMeters,
        totalTravelSeconds,
        totalPlayMinutes,
        totalEstimatedCost,
        startsFromDeparture,
        returnsToDeparture,
        departureName: departureName || undefined,
        lunchSuggestion: daySuggestions.lunch,
        dinnerSuggestion: daySuggestions.dinner,
        hotelSuggestion: daySuggestions.hotel,
        totalMealCost: daySuggestions.mealCost,
        totalHotelCost: daySuggestions.hotelCost,
      })
    }

    const totalDistanceMeters = days.reduce(
      (sum, day) => sum + day.totalDistanceMeters,
      0
    )
    const totalTravelSeconds = days.reduce(
      (sum, day) => sum + day.totalTravelSeconds,
      0
    )
    const totalPlayMinutes = days.reduce((sum, day) => sum + day.totalPlayMinutes, 0)
    const totalEstimatedCost = days.reduce(
      (sum, day) => sum + day.totalEstimatedCost,
      0
    )
    const mealFallbackDays = days.filter(
      (day) => !day.lunchSuggestion || !day.dinnerSuggestion
    ).length
    const hotelFallbackDays = days.filter((day) => !day.hotelSuggestion).length
    if (mealFallbackDays > 0) {
      notices.push(`有 ${mealFallbackDays} 天餐饮候选不足，已按城市热门点补齐`)
    }
    if (hotelFallbackDays > 0) {
      notices.push(`有 ${hotelFallbackDays} 天未匹配到酒店，建议在结果页手动补充住宿`)
    }

    const status: PlanGenerationStatus =
      estimatedLegCount > 0 || notices.length > 0 ? "partial" : "success"

    return {
      days,
      totalDays: days.length,
      totalSpots: spots.length,
      totalDistanceMeters,
      totalTravelSeconds,
      totalPlayMinutes,
      totalEstimatedCost,
      status,
      notices: Array.from(new Set(notices)),
    }
  } catch (error) {
    const basicDays = buildBasicDays(spots, pace, departure, requirement)
    const analysis = analyzeAmapError(error, "路线生成失败，已降级为基础时间安排")
    return {
      days: basicDays,
      totalDays: basicDays.length,
      totalSpots: spots.length,
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes: basicDays.reduce((sum, day) => sum + day.totalPlayMinutes, 0),
      totalEstimatedCost: basicDays.reduce((sum, day) => sum + day.totalEstimatedCost, 0),
      status: "error",
      notices: [analysis.userMessage],
    }
  }
}
