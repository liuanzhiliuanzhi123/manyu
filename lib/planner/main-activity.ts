type PlannerItemLike = {
  type?: unknown
  rootCategory?: unknown
  tags?: unknown
  subTags?: unknown
  name?: unknown
}

export const MAIN_ACTIVITY_TYPES = [
  "scenic",
  "spot",
  "attraction",
  "museum",
  "cultural",
  "culture",
  "temple",
  "park",
  "landmark",
  "performance",
  "exhibition",
  "art",
  "citywalk",
  "nature",
] as const

export const NON_MAIN_ACTIVITY_TYPES = [
  "food",
  "restaurant",
  "dining",
  "meal",
  "cafe",
  "snack",
  "bar",
  "hotel",
  "lodging",
  "accommodation",
  "transit",
  "transport",
  "rest",
  "note",
  "weather",
] as const

type MainActivityType = (typeof MAIN_ACTIVITY_TYPES)[number]
type NonMainActivityType = (typeof NON_MAIN_ACTIVITY_TYPES)[number]
export type NormalizedPlannerItemType = MainActivityType | NonMainActivityType | "shopping" | "unknown"
export type PlannerRootCategory = "scenic" | "food" | "hotel"

const MAIN_TYPE_SET = new Set<string>(MAIN_ACTIVITY_TYPES)
const NON_MAIN_TYPE_SET = new Set<string>(NON_MAIN_ACTIVITY_TYPES)
const LANDMARK_SHOPPING_KEYWORDS = [
  "mall",
  "market",
  "street",
  "square",
  "historic",
  "landmark",
  "文化",
  "历史",
  "街区",
  "老街",
  "胡同",
  "广场",
]

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function collectText(item: PlannerItemLike) {
  const tags = Array.isArray(item.tags) ? item.tags : []
  const subTags = Array.isArray(item.subTags) ? item.subTags : []
  return [item.name, ...tags, ...subTags]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
}

function isLandmarkShopping(item: PlannerItemLike) {
  const text = collectText(item)
  return LANDMARK_SHOPPING_KEYWORDS.some((keyword) => text.includes(keyword))
}

export function normalizePlannerItemType(item: PlannerItemLike): NormalizedPlannerItemType {
  const rootCategory = normalizeToken(item.rootCategory)
  if (rootCategory === "scenic") return "scenic"
  if (rootCategory === "food") return "food"
  if (rootCategory === "hotel") return "hotel"

  const type = normalizeToken(item.type)
  if (MAIN_TYPE_SET.has(type)) return type as MainActivityType
  if (NON_MAIN_TYPE_SET.has(type)) return type as NonMainActivityType
  if (type === "shopping") return isLandmarkShopping(item) ? "landmark" : "shopping"
  return "unknown"
}

export function getRootCategoryFromPlannerItem(
  item: PlannerItemLike
): PlannerRootCategory | undefined {
  const normalizedType = normalizePlannerItemType(item)
  if (MAIN_TYPE_SET.has(normalizedType)) return "scenic"
  if (
    normalizedType === "food" ||
    normalizedType === "restaurant" ||
    normalizedType === "dining" ||
    normalizedType === "meal" ||
    normalizedType === "cafe" ||
    normalizedType === "snack" ||
    normalizedType === "bar"
  ) {
    return "food"
  }
  if (
    normalizedType === "hotel" ||
    normalizedType === "lodging" ||
    normalizedType === "accommodation"
  ) {
    return "hotel"
  }
  return undefined
}

export function isMainActivityItem(item: PlannerItemLike) {
  return getRootCategoryFromPlannerItem(item) === "scenic"
}
