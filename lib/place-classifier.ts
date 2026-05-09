export type PlaceCategory = "attraction" | "restaurant" | "hotel"

interface ClassifyInput {
  name: string
  intro?: string
  address?: string
  rawCategory?: string
  tags?: string[]
  level?: string
  price?: number
}

const HOTEL_KEYWORDS = [
  "酒店",
  "宾馆",
  "旅馆",
  "民宿",
  "客栈",
  "公寓酒店",
  "度假酒店",
  "Hotel",
  "Resort",
  "Inn",
]

const HOTEL_CONTEXT = ["入住", "退房", "客房", "前台", "房型", "房费", "大堂", "早餐"]

const FOOD_PRIMARY_KEYWORDS = [
  "美食",
  "餐厅",
  "饭店",
  "饭馆",
  "酒楼",
  "小吃",
  "火锅",
  "面馆",
  "茶餐厅",
  "咖啡",
  "甜品",
  "烧烤",
  "饮品",
  "美食街",
  "夜市",
  "私房菜",
  "本帮菜",
  "粤菜",
  "川菜",
  "湘菜",
  "Restaurant",
  "Cafe",
  "Bistro",
]

const FOOD_SECONDARY_KEYWORDS = ["餐饮", "午餐", "晚餐", "下午茶", "料理", "茶饮"]

const SPOT_KEYWORDS = [
  "景区",
  "景点",
  "公园",
  "博物馆",
  "纪念馆",
  "古镇",
  "古城",
  "乐园",
  "游乐园",
  "风景区",
  "名胜",
  "遗址",
  "塔",
  "寺",
  "山",
  "湖",
  "海洋馆",
  "动物园",
  "植物园",
  "Museum",
  "Park",
  "Attraction",
  "Scenic",
]

const SPOT_CONTEXT = ["门票", "游玩", "开放时间", "导览", "预约", "打卡", "景区"]
const FOOD_FORCE_NAMES = ["美食街", "小吃街", "夜市", "餐饮"]

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function hitCount(text: string, keywords: string[]) {
  if (!text) return 0
  return keywords.reduce((count, keyword) => (text.includes(keyword.toLowerCase()) ? count + 1 : count), 0)
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()))
}

function scoreByRawCategory(rawCategory: string) {
  const text = normalizeText(rawCategory)
  const score = { attraction: 0, restaurant: 0, hotel: 0 }
  if (!text) return score

  if (/酒店|宾馆|民宿|客栈|hotel|resort/iu.test(text)) score.hotel += 12
  if (/美食|餐饮|餐厅|饭店|restaurant|food|小吃|咖啡|火锅/iu.test(text)) score.restaurant += 12
  if (/景区|景点|公园|博物馆|古镇|乐园|attraction|scenic/iu.test(text)) score.attraction += 12
  return score
}

function classifyByStrongRule(name: string, fullText: string): PlaceCategory | null {
  const hasHotel = hasAny(name, HOTEL_KEYWORDS)
  const hasFood = hasAny(name, FOOD_PRIMARY_KEYWORDS)
  const hasSpot = hasAny(name, SPOT_KEYWORDS)

  if (hasHotel && !hasFood && !hasSpot) return "hotel"
  if (hasFood && !hasHotel && !hasSpot) return "restaurant"
  if (hasSpot && !hasHotel && !hasFood) return "attraction"
  if (hasAny(name, FOOD_FORCE_NAMES) && !hasSpot) return "restaurant"

  if (name.includes("温泉山庄")) {
    if (/(入住|客房|住宿|房型|酒店)/u.test(fullText)) return "hotel"
    if (/(景区|景点|门票|游玩)/u.test(fullText)) return "attraction"
  }

  return null
}

export function classifyPlaceCategory(input: ClassifyInput): PlaceCategory {
  const name = normalizeText(input.name)
  const intro = normalizeText(input.intro ?? "")
  const address = normalizeText(input.address ?? "")
  const tags = normalizeText((input.tags ?? []).join(" "))
  const level = normalizeText(input.level ?? "")
  const text = `${name} ${intro} ${address} ${tags} ${level}`

  const forced = classifyByStrongRule(name, text)
  if (forced) return forced

  const score = {
    attraction: 2,
    restaurant: 0,
    hotel: 0,
  }

  const rawScore = scoreByRawCategory(input.rawCategory ?? "")
  score.attraction += rawScore.attraction
  score.restaurant += rawScore.restaurant
  score.hotel += rawScore.hotel

  score.attraction += hitCount(name, SPOT_KEYWORDS) * 8
  score.restaurant += hitCount(name, FOOD_PRIMARY_KEYWORDS) * 10
  score.restaurant += hitCount(name, FOOD_SECONDARY_KEYWORDS) * 4
  score.hotel += hitCount(name, HOTEL_KEYWORDS) * 10

  score.attraction += hitCount(text, SPOT_CONTEXT) * 4
  score.restaurant += hitCount(text, FOOD_SECONDARY_KEYWORDS) * 3
  score.hotel += hitCount(text, HOTEL_CONTEXT) * 4

  if (hasAny(name, HOTEL_KEYWORDS)) score.hotel += 8
  if (hasAny(name, FOOD_PRIMARY_KEYWORDS)) score.restaurant += 8
  if (hasAny(name, SPOT_KEYWORDS)) score.attraction += 8

  if (/(景区|景点|博物馆|公园|古镇|遗址|乐园|风景区|海洋馆|动物园|植物园)/u.test(name)) {
    score.attraction += 10
    score.restaurant -= 4
  }

  if (hasAny(name, HOTEL_KEYWORDS) && hasAny(name, FOOD_PRIMARY_KEYWORDS)) {
    score.restaurant += 6
    score.hotel += 3
  }

  if (typeof input.price === "number" && Number.isFinite(input.price)) {
    if (input.price <= 120) score.restaurant += 1
    if (input.price >= 300) score.hotel += 1
  }

  const ranked = (Object.entries(score) as Array<[PlaceCategory, number]>).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    const tieBreaker: Record<PlaceCategory, number> = {
      attraction: 3,
      restaurant: 2,
      hotel: 1,
    }
    return tieBreaker[b[0]] - tieBreaker[a[0]]
  })

  const best = ranked[0]
  if (!best) return "attraction"

  const hasFoodEvidence =
    hasAny(name, FOOD_PRIMARY_KEYWORDS) || hitCount(text, FOOD_SECONDARY_KEYWORDS) > 0
  const hasHotelEvidence = hasAny(name, HOTEL_KEYWORDS) || hitCount(text, HOTEL_CONTEXT) > 0

  if (best[0] === "restaurant" && !hasFoodEvidence) return "attraction"
  if (best[0] === "hotel" && !hasHotelEvidence) return "attraction"
  if (best[1] <= 2) return "attraction"

  return best[0]
}

