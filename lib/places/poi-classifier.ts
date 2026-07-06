import type { AmapPoiInput, BeijingPoiRootCategory } from "@/lib/places/poi-types"

export interface PoiClassificationResult {
  rootCategory?: BeijingPoiRootCategory
  confidence: number
  reason: string
  quarantined: boolean
}

const FOOD_TYPECODE = /^05/u
const HOTEL_TYPECODE = /^10/u
const SCENIC_TYPECODE = /^11/u
const CULTURE_TYPECODE = /^14/u

const FOOD_SIGNALS =
  /餐饮|餐厅|中餐|西餐|快餐|小吃|饭馆|饭店|菜馆|面馆|火锅|涮肉|烤鸭|咖啡|茶馆|甜品|烧烤|夜宵|美食|饺子|炸酱面|卤煮|爆肚|护国寺|全聚德|四季民福|便宜坊|聚宝源|局气/u
const HOTEL_SIGNALS =
  /住宿|宾馆|酒店|旅馆|旅店|民宿|客栈|公寓酒店|度假酒店|大饭店|饭店\(酒店\)|饭店（酒店）/u
const SCENIC_SIGNALS =
  /风景名胜|旅游景点|景区|公园|博物馆|纪念馆|美术馆|展览馆|科技馆|寺|庙|宫|坛|观|园林|长城|胡同|古迹|遗址|艺术区|剧场|剧院|大剧院|动物园|植物园|水族馆|广场|故居|天坛|颐和园|故宫|什刹海|南锣鼓巷|798/u

function toText(value: unknown) {
  if (Array.isArray(value)) return value.join(" ")
  return String(value || "").trim()
}

function getPoiText(poi: Pick<AmapPoiInput, "name" | "type" | "typecode" | "address">) {
  return [poi.name, poi.type, poi.typecode, toText(poi.address)].filter(Boolean).join(" ")
}

function hasFoodSignal(text: string) {
  return FOOD_SIGNALS.test(text)
}

function hasHotelSignal(text: string) {
  return HOTEL_SIGNALS.test(text)
}

function hasScenicSignal(text: string) {
  return SCENIC_SIGNALS.test(text)
}

export function classifyPoiRootCategory(
  poi: Pick<AmapPoiInput, "name" | "type" | "typecode" | "address">
): PoiClassificationResult {
  const typecode = toText(poi.typecode)
  const text = getPoiText(poi)

  if (FOOD_TYPECODE.test(typecode)) {
    return {
      rootCategory: "food",
      confidence: hasFoodSignal(text) ? 96 : 88,
      reason: "amap_typecode_food",
      quarantined: false,
    }
  }

  if (HOTEL_TYPECODE.test(typecode)) {
    return {
      rootCategory: "hotel",
      confidence: hasHotelSignal(text) ? 96 : 88,
      reason: "amap_typecode_hotel",
      quarantined: false,
    }
  }

  if (SCENIC_TYPECODE.test(typecode)) {
    return {
      rootCategory: "scenic",
      confidence: hasScenicSignal(text) ? 96 : 86,
      reason: "amap_typecode_scenic",
      quarantined: false,
    }
  }

  if (CULTURE_TYPECODE.test(typecode) && hasScenicSignal(text)) {
    return {
      rootCategory: "scenic",
      confidence: 82,
      reason: "amap_typecode_culture_with_scenic_signal",
      quarantined: false,
    }
  }

  if (hasHotelSignal(text) && !hasFoodSignal(text)) {
    return {
      rootCategory: "hotel",
      confidence: 74,
      reason: "text_hotel_signal",
      quarantined: false,
    }
  }

  if (hasFoodSignal(text) && !hasHotelSignal(text)) {
    return {
      rootCategory: "food",
      confidence: 74,
      reason: "text_food_signal",
      quarantined: false,
    }
  }

  if (hasScenicSignal(text) && !hasFoodSignal(text) && !hasHotelSignal(text)) {
    return {
      rootCategory: "scenic",
      confidence: 72,
      reason: "text_scenic_signal",
      quarantined: false,
    }
  }

  return {
    confidence: 0,
    reason: "no_supported_category_signal",
    quarantined: true,
  }
}

export function isFoodPoi(poi: Pick<AmapPoiInput, "name" | "type" | "typecode" | "address">) {
  return classifyPoiRootCategory(poi).rootCategory === "food"
}

export function isHotelPoi(poi: Pick<AmapPoiInput, "name" | "type" | "typecode" | "address">) {
  return classifyPoiRootCategory(poi).rootCategory === "hotel"
}

export function isScenicPoi(poi: Pick<AmapPoiInput, "name" | "type" | "typecode" | "address">) {
  return classifyPoiRootCategory(poi).rootCategory === "scenic"
}
