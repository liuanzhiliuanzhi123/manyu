import type { LngLatTuple } from "@/lib/amap-types"

export type PoiEntityType = "spot" | "food" | "hotel"

export interface PoiProviderItem {
  id: string
  type: PoiEntityType
  name: string
  province: string
  city: string
  district: string
  address: string
  lng?: number
  lat?: number
  rating?: number
  price?: number
  tags: string[]
  source: "local" | "amap_nearby" | "amap_text"
  distanceToAnchor?: number
}

interface AmapPoiRaw {
  id?: string
  name?: string
  pname?: string
  cityname?: string
  adname?: string
  address?: string
  location?: string
  distance?: string
  type?: string
  typecode?: string
  biz_ext?: {
    rating?: string
    cost?: string
  }
}

function parseNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function parseLocation(location?: string): LngLatTuple | null {
  if (!location) return null
  const [lngText, latText] = location.split(",")
  const lng = parseNumber(lngText)
  const lat = parseNumber(latText)
  if (lng === undefined || lat === undefined) return null
  return [lng, lat]
}

function inferType(rawTypeText: string, defaultType: PoiEntityType): PoiEntityType {
  const text = rawTypeText.toLowerCase()
  if (/酒店|宾馆|民宿|hotel|resort/u.test(text)) return "hotel"
  if (/餐饮|餐厅|小吃|火锅|咖啡|food|restaurant/u.test(text)) return "food"
  if (/景区|景点|公园|博物馆|attraction|scenic/u.test(text)) return "spot"
  return defaultType
}

function cleanTags(typeText: string): string[] {
  if (!typeText.trim()) return []
  return Array.from(
    new Set(
      typeText
        .split(/[;>|,，]/u)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .slice(0, 6)
    )
  )
}

export function normalizeAmapPoiToProviderItem(input: {
  raw: AmapPoiRaw
  source: PoiProviderItem["source"]
  defaultType: PoiEntityType
}): PoiProviderItem | null {
  const { raw, source, defaultType } = input
  const name = (raw.name || "").trim()
  if (!name) return null

  const location = parseLocation(raw.location)
  const rating = parseNumber(raw.biz_ext?.rating)
  const cost = parseNumber(raw.biz_ext?.cost)
  const distance = parseNumber(raw.distance)
  const typeText = (raw.type || "").trim()
  const mappedType = inferType(typeText, defaultType)

  return {
    id: raw.id?.trim() || `amap-${source}-${name}`,
    type: mappedType,
    name,
    province: (raw.pname || "北京").trim() || "北京",
    city: (raw.cityname || "北京").trim() || "北京",
    district: (raw.adname || "").trim(),
    address: (raw.address || "").trim() || `${raw.cityname || "北京"}${name}`,
    lng: location?.[0],
    lat: location?.[1],
    rating,
    price: cost,
    tags: cleanTags(typeText),
    source,
    distanceToAnchor: distance,
  }
}

