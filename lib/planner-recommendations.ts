import type { PoiBundle, TravelRequirement } from "@/lib/planner-types"
import type { Spot } from "@/lib/travel-context"

export interface RecommendedPoiCandidate {
  spot: Spot
  score: number
  reasonTags: string[]
}

const INTEREST_KEYWORDS: Record<string, string[]> = {
  历史人文: ["历史", "文化", "古", "博物", "遗产"],
  自然风光: ["园", "湖", "山", "自然", "风光"],
  城市漫步: ["街", "巷", "胡同", "城市", "漫步"],
  美食打卡: ["美食", "餐", "烤鸭", "小吃", "老字号"],
  网红拍照: ["打卡", "夜景", "景观", "拍照"],
  亲子互动: ["亲子", "公园", "互动", "博物", "乐园"],
  休闲度假: ["休闲", "度假", "园林", "慢游"],
  博物馆: ["博物馆", "博物", "展"],
  寺庙古建: ["寺", "坛", "宫", "古建", "古"],
  夜生活: ["夜", "酒吧", "夜景"],
  购物: ["购物", "商场", "街区"],
  演出展览: ["演出", "展览", "艺术", "剧院"],
}

const COMPANION_HINTS: Record<TravelRequirement["companions"], string[]> = {
  solo: ["城市", "博物", "漫步"],
  couple: ["夜景", "休闲", "园林"],
  friends: ["美食", "网红", "夜景"],
  family: ["亲子", "公园", "互动"],
  elderly: ["休闲", "园林", "文化"],
  team: ["热闹", "美食", "城市"],
}

const BUNDLE_TAGS = {
  classic: ["经典", "初访", "城市地标"],
  history: ["历史人文", "博物馆", "古建"],
  family: ["亲子", "轻松", "少走路"],
  slow: ["慢游", "休闲", "美食"],
}

interface BundleTemplate {
  id: string
  title: string
  description: string
  city: string
  tags: string[]
  poiNames: string[]
  estimatedHours: number
  estimatedBudget: number
  reason: string
}

const BEIJING_BUNDLE_TEMPLATES: BundleTemplate[] = [
  {
    id: "beijing-classic-first",
    title: "北京经典初访",
    description: "地标+胡同+美食，一天内高效串联",
    city: "北京",
    tags: BUNDLE_TAGS.classic,
    poiNames: ["故宫博物院", "南锣鼓巷", "全聚德烤鸭店"],
    estimatedHours: 9,
    estimatedBudget: 380,
    reason: "适合第一次来北京，覆盖城市代表性体验",
  },
  {
    id: "beijing-history-line",
    title: "北京历史文化线",
    description: "古建与历史脉络集中体验",
    city: "北京",
    tags: BUNDLE_TAGS.history,
    poiNames: ["故宫博物院", "天坛公园", "什刹海"],
    estimatedHours: 8,
    estimatedBudget: 160,
    reason: "适合历史人文和古建偏好",
  },
  {
    id: "beijing-family-relax",
    title: "北京亲子轻松版",
    description: "节奏更平缓，减少长距离折返",
    city: "北京",
    tags: BUNDLE_TAGS.family,
    poiNames: ["颐和园", "天坛公园", "全聚德烤鸭店"],
    estimatedHours: 7,
    estimatedBudget: 260,
    reason: "适合亲子和老人同行，路线相对轻松",
  },
  {
    id: "beijing-slow-vacation",
    title: "北京慢游度假线",
    description: "园林+水岸+美食，强调放松体验",
    city: "北京",
    tags: BUNDLE_TAGS.slow,
    poiNames: ["颐和园", "什刹海", "全聚德烤鸭店"],
    estimatedHours: 7,
    estimatedBudget: 250,
    reason: "适合慢节奏与度假偏好",
  },
]

function normalizedText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "")
}

function includesAnyKeyword(source: string, keywords: string[]) {
  if (keywords.length === 0) return false
  const text = normalizedText(source)
  return keywords.some((keyword) => text.includes(normalizedText(keyword)))
}

function isLowBudget(budgetRange: string) {
  return budgetRange.includes("1000以内") || budgetRange.includes("1000-3000")
}

function isHighBudget(budgetRange: string) {
  return budgetRange.includes("5000-10000") || budgetRange.includes("10000")
}

function isRemoteSpot(spot: Spot) {
  return ["延庆", "昌平", "怀柔", "密云", "平谷", "郊区", "长城"].some((keyword) =>
    `${spot.name}${spot.address}`.includes(keyword)
  )
}

function calculatePoiScore(
  requirement: TravelRequirement,
  city: string,
  spot: Spot
): RecommendedPoiCandidate {
  const reasonTags: string[] = []
  const sourceText = `${spot.name} ${spot.address} ${spot.tags.join(" ")}`
  let score = 0

  const cityMatched = city
    ? `${spot.city || ""}${spot.address}`.includes(city) || (spot.city || "") === city
    : true
  score += cityMatched ? 26 : 8
  if (cityMatched) {
    reasonTags.push("同城优先")
  } else {
    reasonTags.push("热门迁移推荐")
  }

  for (const interest of requirement.interests) {
    const keywords = INTEREST_KEYWORDS[interest] || [interest]
    if (includesAnyKeyword(sourceText, keywords)) {
      score += 16
      reasonTags.push(interest)
    }
  }

  if (requirement.interests.includes("历史人文") || requirement.interests.includes("博物馆")) {
    if (spot.type === "attraction" && includesAnyKeyword(sourceText, ["博物", "历史", "古", "文化"])) {
      score += 14
      reasonTags.push("历史文化优先")
    }
  }

  if (requirement.interests.includes("美食打卡")) {
    if (spot.type === "restaurant") {
      score += 22
      reasonTags.push("美食偏好强化")
    }
    if (spot.type === "hotel" && includesAnyKeyword(sourceText, ["餐饮方便", "美食", "商圈"])) {
      score += 8
    }
  }

  if (includesAnyKeyword(sourceText, COMPANION_HINTS[requirement.companions] || [])) {
    score += 8
    reasonTags.push("适配同行人群")
  }

  if (requirement.companions === "family") {
    if (spot.type === "hotel" && includesAnyKeyword(sourceText, ["亲子", "家庭"])) {
      score += 12
      reasonTags.push("亲子住宿")
    }
    if (spot.type === "restaurant" && includesAnyKeyword(sourceText, ["家庭", "亲子", "安静"])) {
      score += 6
    }
  }

  if (requirement.companions === "couple" && spot.type === "restaurant") {
    if (includesAnyKeyword(sourceText, ["夜景", "氛围", "景观"])) {
      score += 8
    }
  }

  if ((requirement.specialNeeds || []).includes("少走路") && !isRemoteSpot(spot)) {
    score += 8
    reasonTags.push("步行负担低")
  }

  if ((requirement.specialNeeds || []).includes("避开人群") && spot.heat <= 92) {
    score += 7
    reasonTags.push("相对不拥挤")
  }

  if ((requirement.specialNeeds || []).includes("公共交通优先") && !isRemoteSpot(spot)) {
    score += 6
    reasonTags.push("交通更友好")
  }

  if ((requirement.specialNeeds || []).includes("自驾优先") && isRemoteSpot(spot)) {
    score += 6
    reasonTags.push("适合自驾")
  }

  if ((requirement.specialNeeds || []).includes("美食优先") && spot.type === "restaurant") {
    score += 12
    reasonTags.push("美食优先")
  }

  if ((requirement.specialNeeds || []).includes("酒店舒适优先") && spot.type === "hotel") {
    score += 12
    reasonTags.push("住宿优先")
  }

  if (isLowBudget(requirement.budgetRange)) {
    if (spot.ticketPrice <= 60) {
      score += 11
      reasonTags.push("低预算友好")
    } else if (spot.ticketPrice >= 180) {
      score -= 8
    }
  }

  if (isHighBudget(requirement.budgetRange) && spot.ticketPrice >= 100) {
    score += 6
    reasonTags.push("品质体验")
  }

  if (requirement.pace === "fast") {
    score += spot.heat * 0.08
    reasonTags.push("高热度效率路线")
  } else if (requirement.pace === "slow") {
    score += spot.rating * 1.8
    if (!isRemoteSpot(spot)) {
      score += 3
    }
    if (spot.type === "restaurant") {
      score += 5
    }
    reasonTags.push("慢节奏体验")
  } else {
    score += spot.rating * 1.2
  }

  score += spot.type === "attraction" ? 4 : spot.type === "restaurant" ? 2 : 1

  return {
    spot,
    score,
    reasonTags: Array.from(new Set(reasonTags)).slice(0, 4),
  }
}

function uniqueBySpot(candidates: RecommendedPoiCandidate[]) {
  const bucket = new Map<string, RecommendedPoiCandidate>()
  for (const item of candidates) {
    const existing = bucket.get(item.spot.id)
    if (!existing || item.score > existing.score) {
      bucket.set(item.spot.id, item)
    }
  }
  return Array.from(bucket.values())
}

export function getRecommendedPoisByRequirement(
  requirement: TravelRequirement,
  city: string,
  pois: Spot[],
  limit = 10
): RecommendedPoiCandidate[] {
  if (pois.length === 0) return []

  const scored = pois.map((spot) => calculatePoiScore(requirement, city, spot))
  const sorted = uniqueBySpot(scored).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.spot.heat !== a.spot.heat) return b.spot.heat - a.spot.heat
    return b.spot.rating - a.spot.rating
  })

  if (sorted.length === 0) {
    return pois.slice(0, limit).map((spot) => ({
      spot,
      score: spot.heat,
      reasonTags: ["热门推荐"],
    }))
  }

  return sorted.slice(0, Math.max(1, limit))
}

function resolveBundlePoiIds(template: BundleTemplate, pois: Spot[]) {
  const ids: string[] = []
  for (const name of template.poiNames) {
    const matched = pois.find((spot) =>
      normalizedText(spot.name).includes(normalizedText(name)) ||
      normalizedText(name).includes(normalizedText(spot.name))
    )
    if (matched) {
      ids.push(matched.id)
    }
  }
  return ids
}

function rankBundle(requirement: TravelRequirement, bundle: PoiBundle) {
  let score = 0
  if (bundle.tags.some((tag) => requirement.interests.includes(tag))) {
    score += 18
  }
  if (requirement.companions === "family" && bundle.tags.includes("亲子")) {
    score += 12
  }
  if (requirement.companions === "couple" && bundle.tags.includes("慢游")) {
    score += 8
  }
  if (requirement.pace === "slow" && bundle.tags.includes("慢游")) {
    score += 8
  }
  if (requirement.pace === "fast" && bundle.tags.includes("经典")) {
    score += 6
  }
  if (isLowBudget(requirement.budgetRange) && (bundle.estimatedBudget || 0) <= 300) {
    score += 8
  }
  return score
}

function createDynamicBundles(
  requirement: TravelRequirement,
  city: string,
  pois: Spot[]
): PoiBundle[] {
  const recommended = getRecommendedPoisByRequirement(requirement, city, pois, 8)
  const attractions = recommended.filter((item) => item.spot.type === "attraction")
  const restaurants = recommended.filter((item) => item.spot.type === "restaurant")

  const classic = attractions.slice(0, 3).map((item) => item.spot)
  const leisure: Spot[] = []
  if (attractions[0]) leisure.push(attractions[0].spot)
  if (restaurants[0]) leisure.push(restaurants[0].spot)
  if (attractions[1]) leisure.push(attractions[1].spot)

  const toBudget = (spots: Spot[]) =>
    spots.reduce((sum, spot) => sum + spot.ticketPrice, 0)

  const dynamicBundles: PoiBundle[] = []

  if (classic.length >= 2) {
    dynamicBundles.push({
      id: `${city}-dynamic-classic`,
      title: `${city || "目的地"}经典组合`,
      description: "优先覆盖代表性景点，适合首次到访",
      city,
      tags: ["经典", "初访", "按偏好推荐"],
      poiIds: classic.map((spot) => spot.id),
      estimatedHours: Math.max(6, classic.length * 2),
      estimatedBudget: toBudget(classic),
      reason: "根据你的偏好自动组合，减少选点成本",
    })
  }

  if (leisure.length >= 2) {
    dynamicBundles.push({
      id: `${city}-dynamic-leisure`,
      title: `${city || "目的地"}轻松串联线`,
      description: "景点+美食顺路串联，减少折返",
      city,
      tags: ["慢游", "美食", "顺路"],
      poiIds: leisure.map((spot) => spot.id),
      estimatedHours: Math.max(5, leisure.length * 2),
      estimatedBudget: toBudget(leisure),
      reason: "适合不知道怎么选时直接套用",
    })
  }

  return dynamicBundles
}

export function getRecommendedBundles(
  requirement: TravelRequirement,
  city: string,
  pois: Spot[]
): PoiBundle[] {
  if (pois.length === 0) return []

  const normalizedCity = city || requirement.city || ""

  const templateBundles =
    normalizedCity.includes("北京") || normalizedCity === ""
      ? BEIJING_BUNDLE_TEMPLATES
      : []

  const resolvedTemplates: PoiBundle[] = templateBundles
    .map((template) => {
      const poiIds = resolveBundlePoiIds(template, pois)
      return {
        id: template.id,
        title: template.title,
        description: template.description,
        city: normalizedCity || template.city,
        tags: template.tags,
        poiIds,
        estimatedHours: template.estimatedHours,
        estimatedBudget: template.estimatedBudget,
        reason: template.reason,
      } satisfies PoiBundle
    })
    .filter((bundle) => bundle.poiIds.length >= 2)

  const dynamic = createDynamicBundles(requirement, normalizedCity, pois)

  return [...resolvedTemplates, ...dynamic]
    .sort((a, b) => rankBundle(requirement, b) - rankBundle(requirement, a))
    .slice(0, 4)
}
