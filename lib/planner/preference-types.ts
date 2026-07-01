export const TRAVELER_GROUPS = [
  "solo",
  "couple",
  "friends",
  "family",
  "elderly",
  "company",
] as const

export const INTEREST_TAGS = [
  "history",
  "nature",
  "citywalk",
  "food",
  "photo",
  "familyFun",
  "vacation",
  "museum",
  "temple",
  "nightlife",
  "shopping",
  "performance",
] as const

export const PREFERENCE_PACES = ["intensive", "balanced", "relaxed"] as const

export const SPECIAL_NEEDS = [
  "lessWalking",
  "elderlyFriendly",
  "kidFriendly",
  "avoidCrowds",
  "publicTransit",
  "driving",
  "lowBudget",
  "foodPriority",
  "hotelComfort",
] as const

export const BUDGET_TIERS = [
  "under1000",
  "budget1000to3000",
  "budget3000to5000",
  "budget5000to10000",
  "over10000",
] as const

export type TravelerGroup = (typeof TRAVELER_GROUPS)[number]
export type InterestTag = (typeof INTEREST_TAGS)[number]
export type PreferencePace = (typeof PREFERENCE_PACES)[number]
export type SpecialNeed = (typeof SPECIAL_NEEDS)[number]
export type BudgetTier = (typeof BUDGET_TIERS)[number]

export interface StructuredPlannerPreferences {
  travelerGroup?: TravelerGroup
  interestTags?: InterestTag[]
  pace?: PreferencePace
  specialNeeds?: SpecialNeed[]
  days?: 1 | 2 | 3 | 4 | 5
  budgetTier?: BudgetTier
}

export const TRAVELER_GROUP_LABELS: Record<TravelerGroup, string> = {
  solo: "一个人",
  couple: "情侣",
  friends: "朋友",
  family: "家庭亲子",
  elderly: "老人同行",
  company: "公司团建",
}

export const INTEREST_TAG_LABELS: Record<InterestTag, string> = {
  history: "历史人文",
  nature: "自然风光",
  citywalk: "城市漫步",
  food: "美食打卡",
  photo: "网红拍照",
  familyFun: "亲子互动",
  vacation: "休闲度假",
  museum: "博物馆",
  temple: "寺庙古建",
  nightlife: "夜生活",
  shopping: "购物",
  performance: "演出展览",
}

export const PACE_LABELS: Record<PreferencePace, string> = {
  intensive: "特种兵式",
  balanced: "轻松适中",
  relaxed: "慢节奏放松",
}

export const SPECIAL_NEED_LABELS: Record<SpecialNeed, string> = {
  lessWalking: "少走路",
  elderlyFriendly: "适合老人",
  kidFriendly: "适合小孩",
  avoidCrowds: "避开人群",
  publicTransit: "公共交通优先",
  driving: "自驾优先",
  lowBudget: "低预算优先",
  foodPriority: "美食优先",
  hotelComfort: "酒店舒适优先",
}

export const BUDGET_TIER_LABELS: Record<BudgetTier, string> = {
  under1000: "1000以内",
  budget1000to3000: "1000-3000",
  budget3000to5000: "3000-5000",
  budget5000to10000: "5000-10000",
  over10000: "10000以上",
}

const normalizeText = (input: unknown) =>
  typeof input === "string" ? input.trim().replace(/\s+/g, "") : ""

const reverse = <T extends string>(map: Record<T, string>) =>
  Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key])) as Record<string, T>

const TRAVELER_GROUP_BY_LABEL = reverse(TRAVELER_GROUP_LABELS)
const INTEREST_TAG_BY_LABEL = reverse(INTEREST_TAG_LABELS)
const PACE_BY_LABEL = reverse(PACE_LABELS)
const SPECIAL_NEED_BY_LABEL = reverse(SPECIAL_NEED_LABELS)
const BUDGET_TIER_BY_LABEL = reverse(BUDGET_TIER_LABELS)

export function normalizeTravelerGroup(input: unknown): TravelerGroup | undefined {
  const text = normalizeText(input)
  if (!text) return undefined
  if ((TRAVELER_GROUPS as readonly string[]).includes(text)) return text as TravelerGroup
  if (text === "team") return "company"
  return TRAVELER_GROUP_BY_LABEL[text]
}

export function normalizeInterestTag(input: unknown): InterestTag | undefined {
  const text = normalizeText(input)
  if (!text) return undefined
  if ((INTEREST_TAGS as readonly string[]).includes(text)) return text as InterestTag
  return INTEREST_TAG_BY_LABEL[text]
}

export function normalizePreferencePace(input: unknown): PreferencePace | undefined {
  const text = normalizeText(input)
  if (!text) return undefined
  if ((PREFERENCE_PACES as readonly string[]).includes(text)) return text as PreferencePace
  if (text === "fast") return "intensive"
  if (text === "slow") return "relaxed"
  if (text === "moderate") return "balanced"
  return PACE_BY_LABEL[text]
}

export function normalizeSpecialNeed(input: unknown): SpecialNeed | undefined {
  const text = normalizeText(input)
  if (!text) return undefined
  if ((SPECIAL_NEEDS as readonly string[]).includes(text)) return text as SpecialNeed
  return SPECIAL_NEED_BY_LABEL[text]
}

export function normalizeBudgetTier(input: unknown): BudgetTier | undefined {
  const text = normalizeText(input)
  if (!text) return undefined
  if ((BUDGET_TIERS as readonly string[]).includes(text)) return text as BudgetTier
  return BUDGET_TIER_BY_LABEL[text]
}

export function preferencePaceToLegacy(pace: PreferencePace) {
  if (pace === "intensive") return "fast"
  if (pace === "relaxed") return "slow"
  return "balanced"
}

export function legacyPaceToPreference(pace: unknown) {
  return normalizePreferencePace(pace) || "balanced"
}

export function labelsForInterestTags(tags: InterestTag[]) {
  return tags.map((tag) => INTEREST_TAG_LABELS[tag])
}

export function labelsForSpecialNeeds(needs: SpecialNeed[]) {
  return needs.map((need) => SPECIAL_NEED_LABELS[need])
}
