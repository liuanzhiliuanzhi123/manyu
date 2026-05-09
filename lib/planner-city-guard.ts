import { RECOMMENDED_CITY_GROUPS } from "@/lib/planner-city-data"
import type { Spot } from "@/lib/travel-context"

export interface CityConflictResult {
  targetCity: string
  targetProvince?: string
  matched: Spot[]
  mismatched: Spot[]
  unknown: Spot[]
}

function normalizeText(input?: string) {
  if (!input) return ""
  return input
    .trim()
    .replace(/资源包$/u, "")
    .replace(/特别行政区$/u, "")
    .replace(/自治区$/u, "")
    .replace(/自治州$/u, "")
    .replace(/地区$/u, "")
    .replace(/省$/u, "")
    .replace(/市$/u, "")
    .toLowerCase()
}

function inferFromAddress(address?: string) {
  const text = address?.trim() || ""
  if (!text) return { province: "", city: "" }
  const provinceMatch = text.match(/([\u4e00-\u9fa5]{2,8})(省|自治区|特别行政区)/u)
  const cityMatch = text.match(/([\u4e00-\u9fa5]{2,8})(市|地区|自治州)/u)
  return {
    province: provinceMatch?.[1] || "",
    city: cityMatch?.[1] || "",
  }
}

export function resolveSpotCity(spot: Spot) {
  const direct = spot.city?.trim()
  if (direct) return direct
  const inferred = inferFromAddress(spot.address)
  return inferred.city || ""
}

export function resolveSpotProvince(spot: Spot) {
  const direct = spot.province?.trim()
  if (direct) return direct
  const inferred = inferFromAddress(spot.address)
  if (inferred.province) return inferred.province
  const city = resolveSpotCity(spot)
  if (["北京", "上海", "天津", "重庆"].includes(city)) {
    return city
  }
  return ""
}

export function inferMajorityCity(spots: Spot[]) {
  if (spots.length === 0) return ""
  const bucket = new Map<string, { original: string; count: number }>()
  for (const spot of spots) {
    const city = resolveSpotCity(spot)
    if (!city) continue
    const key = normalizeText(city)
    const current = bucket.get(key)
    if (current) current.count += 1
    else bucket.set(key, { original: city, count: 1 })
  }
  return [...bucket.values()].sort((a, b) => b.count - a.count)[0]?.original || ""
}

export function findProvinceByCity(city: string) {
  const normalized = normalizeText(city)
  for (const group of RECOMMENDED_CITY_GROUPS) {
    const matched = group.cities.find((item) => normalizeText(item.city) === normalized)
    if (matched) {
      return {
        province: group.province,
        city: matched.city,
        tagline: matched.tagline,
      }
    }
  }
  return null
}

export function isSpotInDestination(
  spot: Spot,
  destination: { city?: string; province?: string }
) {
  const targetCity = normalizeText(destination.city)
  const targetProvince = normalizeText(destination.province)
  const spotCity = normalizeText(resolveSpotCity(spot))
  const spotProvince = normalizeText(resolveSpotProvince(spot))

  if (!targetCity && !targetProvince) return true

  if (targetCity) {
    if (spotCity && spotCity === targetCity) return true
    if (!spotCity && targetProvince && spotProvince && spotProvince === targetProvince) {
      return true
    }
    return false
  }

  if (targetProvince) {
    return Boolean(spotProvince && spotProvince === targetProvince)
  }

  return true
}

export function detectCityConflict(
  spots: Spot[],
  city: string,
  province?: string
): CityConflictResult {
  const matched: Spot[] = []
  const mismatched: Spot[] = []
  const unknown: Spot[] = []

  for (const spot of spots) {
    const spotCity = resolveSpotCity(spot)
    const spotProvince = resolveSpotProvince(spot)
    if (!spotCity && !spotProvince) {
      unknown.push(spot)
      continue
    }
    if (isSpotInDestination(spot, { city, province })) matched.push(spot)
    else mismatched.push(spot)
  }

  return {
    targetCity: city,
    targetProvince: province,
    matched,
    mismatched,
    unknown,
  }
}

export function filterSpotsByCity(spots: Spot[], city: string, province?: string) {
  const { matched } = detectCityConflict(spots, city, province)
  return matched
}
