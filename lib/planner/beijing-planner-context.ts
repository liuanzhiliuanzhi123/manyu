import {
  beijingPoiAttractionSeeds,
  beijingPoiHotelSeeds,
  beijingPoiRestaurantSeeds,
  type BeijingPoiSpotSeed,
} from "@/lib/places/beijing-poi-data"
import type { PlannerCandidate } from "@/lib/planner-types"

export const BEIJING_MVP_INTERESTS = [
  "历史人文",
  "自然风光",
  "城市漫步",
  "美食打卡",
  "网红拍照",
  "亲子互动",
  "休闲度假",
  "博物馆",
  "寺庙古建",
  "夜生活",
  "购物",
  "演出展览",
]

const BEIJING_DISTRICTS = [
  "东城区",
  "西城区",
  "朝阳区",
  "海淀区",
  "丰台区",
  "石景山区",
  "昌平区",
  "通州区",
  "大兴区",
  "顺义区",
  "怀柔区",
  "延庆区",
  "密云区",
  "平谷区",
  "门头沟区",
  "房山区",
]

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

export function isBeijingPlannerCity(city?: string, province?: string) {
  const normalize = (value?: string) =>
    (value || "").trim().replace(/\s+/g, "").replace(/市$/u, "").replace(/甯?$/u, "")
  const cityText = normalize(city)
  const provinceText = normalize(province)
  return (
    cityText === "北京" ||
    cityText === "鍖椾含" ||
    provinceText === "北京" ||
    provinceText === "鍖椾含"
  )
}

export function isBeijingPlannerCandidate(candidate: {
  city?: string
  province?: string
  address?: string
  district?: string
}) {
  const text = [
    candidate.city,
    candidate.province,
    candidate.address,
    candidate.district,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    isBeijingPlannerCity(candidate.city, candidate.province) ||
    text.includes("北京") ||
    text.includes("鍖椾含")
  )
}

export function sanitizePlannerText(input: unknown, maxLength = 80) {
  if (typeof input !== "string") return ""
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength)
}

function toCandidate(seed: BeijingPoiSpotSeed): PlannerCandidate {
  return {
    placeId: seed.id,
    name: sanitizePlannerText(seed.name, 60),
    type:
      seed.type === "hotel"
        ? "hotel"
        : seed.type === "restaurant"
          ? "restaurant"
          : "attraction",
    city: "北京",
    district: sanitizePlannerText(seed.district, 24) || undefined,
    address: sanitizePlannerText(seed.address, 120) || undefined,
    rating: toFiniteNumber(seed.rating),
    price: toFiniteNumber(seed.ticketPrice),
    tags: [...seed.tags, ...(seed.subTags || [])]
      .map((tag) => sanitizePlannerText(tag, 24))
      .filter(Boolean),
    lng: toFiniteNumber(seed.lng),
    lat: toFiniteNumber(seed.lat),
    openTime: sanitizePlannerText(seed.openTime, 80) || undefined,
    source: sanitizePlannerText(seed.source, 40) || undefined,
    stayMinutes: seed.suggestedDurationMinutes,
  }
}

function uniqueByPlaceId(candidates: PlannerCandidate[]) {
  const bucket = new Map<string, PlannerCandidate>()
  candidates.forEach((candidate) => {
    if (!candidate.placeId || bucket.has(candidate.placeId)) return
    if (!isBeijingPlannerCandidate(candidate)) return
    bucket.set(candidate.placeId, candidate)
  })
  return Array.from(bucket.values())
}

export function filterBeijingPlannerCandidates(candidates: PlannerCandidate[]) {
  return uniqueByPlaceId(candidates)
}

export function filterSupportedBeijingInterests(preferences: string[], limit = 8) {
  return preferences
    .map((item) => sanitizePlannerText(item, 24))
    .filter((item) => BEIJING_MVP_INTERESTS.includes(item))
    .slice(0, limit)
}

export function buildBeijingPlannerCandidates(input?: {
  selectedPlaceIds?: string[]
  attractionLimit?: number
  restaurantLimit?: number
  hotelLimit?: number
}) {
  const preferred = new Set(input?.selectedPlaceIds || [])
  const sortPreferredFirst = (a: PlannerCandidate, b: PlannerCandidate) => {
    const aPreferred = preferred.has(a.placeId) ? 1 : 0
    const bPreferred = preferred.has(b.placeId) ? 1 : 0
    if (aPreferred !== bPreferred) return bPreferred - aPreferred
    return (b.rating || 0) - (a.rating || 0)
  }

  return {
    attractions: beijingPoiAttractionSeeds
      .map(toCandidate)
      .sort(sortPreferredFirst)
      .slice(0, input?.attractionLimit ?? 32),
    restaurants: beijingPoiRestaurantSeeds
      .map(toCandidate)
      .sort(sortPreferredFirst)
      .slice(0, input?.restaurantLimit ?? 60),
    hotels: beijingPoiHotelSeeds
      .map(toCandidate)
      .sort(sortPreferredFirst)
      .slice(0, input?.hotelLimit ?? 40),
    districts: BEIJING_DISTRICTS,
    interests: BEIJING_MVP_INTERESTS,
  }
}
