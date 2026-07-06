import {
  SUB_TAG_LABELS,
  type BeijingPoi,
  type BeijingPoiRootCategory,
  type BeijingPoiSubTag,
} from "@/lib/places/poi-types"

export interface BeijingPoiFilterInput {
  rootCategory?: BeijingPoiRootCategory
  subTag?: BeijingPoiSubTag | "all"
  subTags?: BeijingPoiSubTag[]
  query?: string
  district?: string
  priceRange?: [number, number]
}

const NON_DESTINATION_PATTERN =
  /停车场|出入口|入口|出口|检票处|售票处|票务|游客中心|咨询处|服务台|卫生间|洗手间|公交站|地铁站|派出所|警务站|公司|办公室|维修|服务中心|客服中心|售楼处|收费站/u
const CORE_DISTRICTS = new Set(["东城区", "西城区", "朝阳区", "海淀区"])

function normalizeText(value?: string) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "")
}

function includesBeijing(value?: string) {
  const text = normalizeText(value)
  return text.includes("北京") || text.includes("鍖椾含")
}

function queryText(poi: BeijingPoi) {
  return [
    poi.name,
    poi.address,
    poi.district,
    poi.businessArea,
    poi.intro,
    poi.type,
    poi.typecode,
    ...poi.tags,
    ...poi.subTags.map((tag) => SUB_TAG_LABELS[tag]),
  ]
    .filter(Boolean)
    .join(" ")
}

function imageScore(poi: BeijingPoi) {
  if (poi.imageSource === "amap" && poi.imageUrl) return 16
  if (poi.imageUrl) return 10
  return 0
}

function categoryScore(poi: BeijingPoi) {
  let score = imageScore(poi)
  score += Math.min(50, Math.max(0, poi.confidence || 0) / 2)
  score += Math.max(0, Math.min(5, poi.rating || 0)) * 8
  if (CORE_DISTRICTS.has(poi.district)) score += 4
  if (poi.source === "amap") score += 3
  if (poi.subTags.length > 1) score += 2
  return score
}

export function isBeijingPoi(poi: Pick<BeijingPoi, "city" | "province" | "district" | "address"> & { adcode?: string }) {
  return (
    includesBeijing(poi.city) ||
    includesBeijing(poi.province) ||
    includesBeijing(poi.address) ||
    includesBeijing(poi.district) ||
    String(poi.adcode || "").startsWith("11")
  )
}

export function isFormalPoi(poi: Pick<BeijingPoi, "name" | "address">) {
  const text = `${poi.name || ""} ${poi.address || ""}`
  if (!poi.name || poi.name.trim().length < 2) return false
  return !NON_DESTINATION_PATTERN.test(text)
}

export function sortBeijingPois(pois: BeijingPoi[]) {
  return [...pois].sort((a, b) => {
    const scoreDiff = categoryScore(b) - categoryScore(a)
    if (scoreDiff !== 0) return scoreDiff
    return a.name.localeCompare(b.name, "zh-Hans-CN")
  })
}

export function filterBeijingPois(pois: BeijingPoi[], input: BeijingPoiFilterInput = {}) {
  const query = normalizeText(input.query)
  const selectedTags = new Set(
    [input.subTag === "all" ? undefined : input.subTag, ...(input.subTags || [])].filter(
      Boolean
    ) as BeijingPoiSubTag[]
  )

  return sortBeijingPois(
    pois.filter((poi) => {
      if (!isFormalPoi(poi) || !isBeijingPoi(poi)) return false
      if (input.rootCategory && poi.rootCategory !== input.rootCategory) return false
      if (input.district && input.district !== "all" && poi.district !== input.district) return false
      if (input.priceRange) {
        const price = Number.isFinite(poi.price) ? poi.price : 0
        if (price < input.priceRange[0] || price > input.priceRange[1]) return false
      }
      if (selectedTags.size > 0 && !poi.subTags.some((tag) => selectedTags.has(tag))) return false
      if (query && !normalizeText(queryText(poi)).includes(query)) return false
      return true
    })
  )
}

export function countPoisByRoot(pois: BeijingPoi[]) {
  return pois.reduce(
    (acc, poi) => {
      acc[poi.rootCategory] += 1
      return acc
    },
    { scenic: 0, food: 0, hotel: 0 } as Record<BeijingPoiRootCategory, number>
  )
}

export function countPoisBySubTag(pois: BeijingPoi[]) {
  const counts = new Map<BeijingPoiSubTag, number>()
  for (const poi of pois) {
    for (const tag of poi.subTags) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return counts
}
