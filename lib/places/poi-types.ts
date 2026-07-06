export const BEIJING_ROOT_CATEGORIES = ["scenic", "food", "hotel"] as const

export type BeijingPoiRootCategory = (typeof BEIJING_ROOT_CATEGORIES)[number]
export type BeijingSpotType = "attraction" | "restaurant" | "hotel"

export const ROOT_CATEGORY_LABELS: Record<BeijingPoiRootCategory, string> = {
  scenic: "景区",
  food: "美食",
  hotel: "酒店",
}

export const ROOT_CATEGORY_TO_SPOT_TYPE: Record<BeijingPoiRootCategory, BeijingSpotType> = {
  scenic: "attraction",
  food: "restaurant",
  hotel: "hotel",
}

export const SPOT_TYPE_TO_ROOT_CATEGORY: Record<BeijingSpotType, BeijingPoiRootCategory> = {
  attraction: "scenic",
  restaurant: "food",
  hotel: "hotel",
}

export const SCENIC_SUB_TAGS = [
  "nature",
  "culture",
  "popular",
  "hiddenGem",
  "museum",
  "temple",
  "citywalk",
  "familyFriendly",
  "nightView",
  "performance",
] as const

export const FOOD_SUB_TAGS = [
  "popularFood",
  "localSpecialty",
  "halal",
  "beijingCuisine",
  "pekingDuck",
  "snack",
  "hotpot",
  "cafeDessert",
  "lateNightFood",
  "valueFood",
] as const

export const HOTEL_SUB_TAGS = [
  "fiveStar",
  "fourStar",
  "threeStarOrBelow",
  "budgetHotel",
  "comfortHotel",
  "luxuryHotel",
  "familyHotel",
  "nearMetro",
  "businessAreaHotel",
] as const

export type ScenicSubTag = (typeof SCENIC_SUB_TAGS)[number]
export type FoodSubTag = (typeof FOOD_SUB_TAGS)[number]
export type HotelSubTag = (typeof HOTEL_SUB_TAGS)[number]
export type BeijingPoiSubTag = ScenicSubTag | FoodSubTag | HotelSubTag

export const SUB_TAGS_BY_ROOT: Record<BeijingPoiRootCategory, readonly BeijingPoiSubTag[]> = {
  scenic: SCENIC_SUB_TAGS,
  food: FOOD_SUB_TAGS,
  hotel: HOTEL_SUB_TAGS,
}

export const SUB_TAG_LABELS: Record<BeijingPoiSubTag, string> = {
  nature: "自然风光",
  culture: "历史人文",
  popular: "热门必去",
  hiddenGem: "小众探索",
  museum: "博物馆",
  temple: "寺庙古建",
  citywalk: "城市漫步",
  familyFriendly: "亲子友好",
  nightView: "夜景夜游",
  performance: "演出展览",
  popularFood: "热门餐厅",
  localSpecialty: "本地特色",
  halal: "清真友好",
  beijingCuisine: "京味京菜",
  pekingDuck: "北京烤鸭",
  snack: "小吃简餐",
  hotpot: "火锅涮肉",
  cafeDessert: "咖啡甜品",
  lateNightFood: "夜宵聚餐",
  valueFood: "高性价比",
  fiveStar: "五星酒店",
  fourStar: "四星酒店",
  threeStarOrBelow: "三星及以下",
  budgetHotel: "经济型",
  comfortHotel: "舒适型",
  luxuryHotel: "高端奢华",
  familyHotel: "亲子家庭",
  nearMetro: "近地铁",
  businessAreaHotel: "商圈便利",
}

export const PLACEHOLDER_BY_ROOT_CATEGORY: Record<BeijingPoiRootCategory, string> = {
  scenic: "/images/places/placeholders/scenic.jpg",
  food: "/images/places/placeholders/food.jpg",
  hotel: "/images/places/placeholders/hotel.jpg",
}

export type BeijingPoiSource = "amap" | "legacy" | "manual"
export type BeijingPoiImageSource = "amap" | "place-photo" | "placeholder" | "legacy"

export interface AmapPoiPhoto {
  title?: string
  url?: string
}

export interface AmapPoiInput {
  id?: string
  name?: string
  type?: string
  typecode?: string
  address?: string | string[]
  pname?: string
  cityname?: string
  adname?: string
  adcode?: string
  location?: string
  tel?: string
  website?: string
  entr_location?: string
  exit_location?: string
  business_area?: string
  biz_ext?: {
    rating?: string | number
    cost?: string | number
  }
  photos?: AmapPoiPhoto[]
  opentime?: string
  open_time?: string
  business?: {
    business_area?: string
  }
}

export interface BeijingPoi {
  id: string
  amapPoiId?: string
  rootCategory: BeijingPoiRootCategory
  name: string
  province: string
  city: string
  district: string
  address: string
  lng?: number
  lat?: number
  rating: number
  reviewCount?: number
  price: number
  tags: string[]
  subTags: BeijingPoiSubTag[]
  intro: string
  source: BeijingPoiSource
  type?: string
  typecode?: string
  businessArea?: string
  phone?: string
  openTime?: string
  imageUrl?: string
  imageTitle?: string
  imageSource: BeijingPoiImageSource
  confidence: number
  importedAt?: string
}

export function isBeijingRootCategory(value: unknown): value is BeijingPoiRootCategory {
  return typeof value === "string" && BEIJING_ROOT_CATEGORIES.includes(value as BeijingPoiRootCategory)
}

export function rootCategoryToSpotType(category: BeijingPoiRootCategory): BeijingSpotType {
  return ROOT_CATEGORY_TO_SPOT_TYPE[category]
}

export function spotTypeToRootCategory(type: BeijingSpotType): BeijingPoiRootCategory {
  return SPOT_TYPE_TO_ROOT_CATEGORY[type]
}

export function isBeijingText(value?: string) {
  const normalized = (value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/市$/u, "")
    .replace(/甯?$/u, "")
  return normalized === "北京" || normalized === "北京市" || normalized === "鍖椾含"
}
