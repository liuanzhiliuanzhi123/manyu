import type { ProvinceCityGroup, RecommendedCity } from "@/lib/planner-types"

const BEIJING_CITY: RecommendedCity = {
  provinceCode: "p-beijing",
  province: "北京",
  cityCode: "c-beijing",
  city: "北京",
  isSpecialRegion: false,
  tagline: "历史地标、城市漫步与京味美食可以高效串联",
  displayTags: ["历史人文", "美食打卡", "城市漫步", "博物馆"],
  tags: ["历史人文", "美食打卡", "城市漫步", "博物馆"],
}

export const RECOMMENDED_CITY_GROUPS: ProvinceCityGroup[] = [
  {
    provinceCode: "p-beijing",
    province: "北京",
    isSpecialRegion: false,
    cities: [BEIJING_CITY],
  },
]

export const RECOMMENDED_CITIES: RecommendedCity[] = [BEIJING_CITY]

export function getCitiesByProvince(province: string) {
  const normalized = province.trim().replace(/市$/u, "")
  if (normalized === "北京") {
    return [BEIJING_CITY]
  }
  return []
}

