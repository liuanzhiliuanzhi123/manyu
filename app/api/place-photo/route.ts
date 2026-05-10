import { NextResponse } from "next/server"

type PlacePhotoType = "scenic" | "food" | "hotel"

type AmapPoi = {
  name?: string
  type?: string
  typecode?: string
  address?: string | string[]
  cityname?: string
  adname?: string
  pname?: string
  photos?: Array<{
    title?: string
    url?: string
  }>
}

type AmapPlaceResponse = {
  status?: string
  info?: string
  infocode?: string
  pois?: AmapPoi[]
}

const PLACEHOLDER_BY_TYPE: Record<PlacePhotoType, string> = {
  scenic: "/images/places/placeholders/scenic.jpg",
  food: "/images/places/placeholders/food.jpg",
  hotel: "/images/places/placeholders/hotel.jpg",
}

function normalizeType(value: string | null): PlacePhotoType {
  if (value === "food" || value === "restaurant") return "food"
  if (value === "hotel") return "hotel"
  return "scenic"
}

function normalizeText(value?: string | string[] | null) {
  if (Array.isArray(value)) return value.join("")
  return (value || "").trim().replace(/\s+/g, "").replace(/市$/u, "")
}

function includesEither(a: string, b: string) {
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

function getAddressText(poi: AmapPoi) {
  return normalizeText(poi.address)
}

function getPhotoUrl(poi?: AmapPoi | null) {
  return poi?.photos?.find((photo) => Boolean(photo?.url))?.url || ""
}

function scoreTypeMatch(poi: AmapPoi, type: PlacePhotoType) {
  const poiType = `${poi.type || ""} ${poi.typecode || ""}`
  if (type === "food") {
    if (/餐饮服务|中餐厅|外国餐厅|快餐厅|咖啡厅|茶艺馆|甜品店|餐厅|美食/u.test(poiType)) return 24
    return -18
  }
  if (type === "hotel") {
    if (/住宿服务|宾馆酒店|酒店|旅馆|民宿/u.test(poiType)) return 24
    return -18
  }
  if (/旅游景点|风景名胜|公园广场|公园|博物馆|科教文化服务|展览馆|景点/u.test(poiType)) {
    return 24
  }
  if (/餐饮服务|住宿服务/u.test(poiType)) return -18
  return 0
}

function scorePoi(poi: AmapPoi, name: string, city: string, type: PlacePhotoType) {
  const normalizedName = normalizeText(name)
  const poiName = normalizeText(poi.name)
  const normalizedCity = normalizeText(city)
  let score = 0

  if (poiName && poiName === normalizedName) score += 70
  else if (includesEither(poiName, normalizedName)) score += 45
  else if (poiName && normalizedName && poiName.slice(0, 2) === normalizedName.slice(0, 2)) score += 14

  const cityText = `${normalizeText(poi.cityname)} ${normalizeText(poi.adname)} ${getAddressText(poi)}`
  if (normalizedCity && cityText.includes(normalizedCity)) score += 18
  else if (normalizedCity) score -= 8

  score += scoreTypeMatch(poi, type)
  if (getPhotoUrl(poi)) score += 8

  return Math.max(0, Math.min(100, score))
}

async function fetchAmapPlace(
  endpoint: "v5" | "v3",
  key: string,
  name: string,
  city: string
): Promise<AmapPoi[]> {
  const url =
    endpoint === "v5"
      ? new URL("https://restapi.amap.com/v5/place/text")
      : new URL("https://restapi.amap.com/v3/place/text")

  url.searchParams.set("key", key)
  url.searchParams.set("keywords", name)
  url.searchParams.set("output", "json")

  if (endpoint === "v5") {
    url.searchParams.set("region", city)
    url.searchParams.set("city_limit", "true")
    url.searchParams.set("page_size", "10")
    url.searchParams.set("page_num", "1")
    url.searchParams.set("show_fields", "photos,business")
  } else {
    url.searchParams.set("city", city)
    url.searchParams.set("citylimit", "true")
    url.searchParams.set("offset", "10")
    url.searchParams.set("page", "1")
    url.searchParams.set("extensions", "all")
  }

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) return []

  const payload = (await response.json()) as AmapPlaceResponse
  if (payload.status !== "1" || !Array.isArray(payload.pois)) return []
  return payload.pois
}

function pickBestPoi(pois: AmapPoi[], name: string, city: string, type: PlacePhotoType) {
  let best: { poi: AmapPoi; confidence: number } | null = null
  for (const poi of pois) {
    const confidence = scorePoi(poi, name, city, type)
    if (!best || confidence > best.confidence) {
      best = { poi, confidence }
    }
  }
  return best
}

function placeholderResponse(type: PlacePhotoType, confidence = 0, poi?: AmapPoi | null) {
  return NextResponse.json({
    ok: true,
    imageUrl: PLACEHOLDER_BY_TYPE[type],
    source: "placeholder",
    confidence,
    poiName: poi?.name,
    poiAddress: Array.isArray(poi?.address) ? poi?.address.join("") : poi?.address,
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")?.trim() || ""
  const city = searchParams.get("city")?.trim() || ""
  const type = normalizeType(searchParams.get("type"))
  const key = process.env.AMAP_WEB_SERVICE_KEY?.trim()

  if (!name || !city) {
    return placeholderResponse(type)
  }

  if (!key) {
    return placeholderResponse(type)
  }

  try {
    const v5Pois = await fetchAmapPlace("v5", key, name, city)
    const v5Best = pickBestPoi(v5Pois, name, city, type)
    const v5Photo = getPhotoUrl(v5Best?.poi)

    if (v5Best && v5Photo && v5Best.confidence >= 55) {
      return NextResponse.json({
        ok: true,
        imageUrl: v5Photo,
        source: "amap",
        confidence: v5Best.confidence,
        poiName: v5Best.poi.name,
        poiAddress: Array.isArray(v5Best.poi.address)
          ? v5Best.poi.address.join("")
          : v5Best.poi.address,
      })
    }

    const v3Pois = await fetchAmapPlace("v3", key, name, city)
    const v3Best = pickBestPoi(v3Pois, name, city, type)
    const v3Photo = getPhotoUrl(v3Best?.poi)

    if (v3Best && v3Photo && v3Best.confidence >= 55) {
      return NextResponse.json({
        ok: true,
        imageUrl: v3Photo,
        source: "amap",
        confidence: v3Best.confidence,
        poiName: v3Best.poi.name,
        poiAddress: Array.isArray(v3Best.poi.address)
          ? v3Best.poi.address.join("")
          : v3Best.poi.address,
      })
    }

    return placeholderResponse(type, Math.max(v5Best?.confidence || 0, v3Best?.confidence || 0), v5Best?.poi || v3Best?.poi)
  } catch {
    return placeholderResponse(type)
  }
}
