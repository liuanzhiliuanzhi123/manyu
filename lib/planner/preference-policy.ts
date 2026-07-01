import type { PlannerCandidate, PlannerDecisionRequest } from "@/lib/planner-types"
import {
  BUDGET_TIER_LABELS,
  PACE_LABELS,
  TRAVELER_GROUP_LABELS,
  labelsForInterestTags,
  labelsForSpecialNeeds,
  legacyPaceToPreference,
  normalizeBudgetTier,
  normalizeInterestTag,
  normalizePreferencePace,
  normalizeSpecialNeed,
  normalizeTravelerGroup,
  preferencePaceToLegacy,
  type BudgetTier,
  type InterestTag,
  type PreferencePace,
  type SpecialNeed,
  type StructuredPlannerPreferences,
  type TravelerGroup,
} from "@/lib/planner/preference-types"

export interface NormalizedPreferences {
  travelerGroup: TravelerGroup
  interestTags: InterestTag[]
  pace: PreferencePace
  effectivePace: PreferencePace
  specialNeeds: SpecialNeed[]
  days: 1 | 2 | 3 | 4 | 5
  budgetTier: BudgetTier
  labels: {
    travelerGroup: string
    interestTags: string[]
    pace: string
    effectivePace: string
    specialNeeds: string[]
    budgetTier: string
  }
}

export interface PreferencePolicy {
  normalizedPreferences: NormalizedPreferences
  hardConstraints: {
    beijingOnly: true
    minMainActivitiesPerDay: number
    targetTotalItemsPerDay: string
    maxMainActivitiesPerDay: number
    requireLunchAndDinner: boolean
    requireHotelSuggestion: boolean
    avoidNightlifeAsCore: boolean
    requireRestHints: boolean
  }
  softPreferences: string[]
  poiWeights: Record<string, number>
  dailyRules: string[]
  budgetRules: string[]
  transportRules: string[]
  hotelRules: string[]
  foodRules: string[]
  conflictWarnings: string[]
  preferenceTrace: {
    travelerGroup: TravelerGroup
    pace: PreferencePace
    effectivePace: PreferencePace
    minMainActivitiesPerDay: number
    targetTotalItemsPerDay: string
    budgetTier: BudgetTier
    interestTags: InterestTag[]
    specialNeeds: SpecialNeed[]
    conflictWarnings: string[]
    repairApplied: boolean
  }
}

export interface PreferencePolicyInput {
  travelerGroup?: unknown
  interestTags?: unknown[]
  pace?: unknown
  specialNeeds?: unknown[]
  days?: unknown
  budgetTier?: unknown
  legacy?: {
    companions?: unknown
    interests?: unknown[]
    pace?: unknown
    specialNeeds?: unknown[]
    totalDays?: unknown
    budgetRange?: unknown
  }
}

const PACE_RULES: Record<
  PreferencePace,
  { minMain: number; maxMain: number; target: string; rules: string[] }
> = {
  intensive: {
    minMain: 3,
    maxMain: 6,
    target: "4-6",
    rules: [
      "每天目标 4-6 个点位，其中至少 3 个主活动点。",
      "允许早出晚归，但优先同区或相邻区域密集串联。",
      "不允许每天只有 1-2 个主景点。",
    ],
  },
  balanced: {
    minMain: 2,
    maxMain: 4,
    target: "3-4",
    rules: [
      "每天目标 3-4 个点位，其中至少 2 个主活动点。",
      "午餐和晚餐自然衔接，不要过度赶路。",
    ],
  },
  relaxed: {
    minMain: 1,
    maxMain: 3,
    target: "2-3",
    rules: [
      "每天目标 2-3 个点位，其中至少 1 个主活动点。",
      "减少跨区移动，增加休息、咖啡、酒店或轻松活动。",
    ],
  },
}

const INTEREST_WEIGHTS: Record<InterestTag, string[]> = {
  history: ["故宫", "国家博物馆", "天坛", "前门", "景山", "恭王府", "历史", "人文"],
  nature: ["公园", "颐和园", "圆明园", "北海", "森林", "香山", "自然"],
  citywalk: ["胡同", "前门", "南锣鼓巷", "什刹海", "鼓楼", "钟楼", "王府井", "城市漫步"],
  food: ["美食", "小吃", "烤鸭", "北京菜", "餐厅"],
  photo: ["地标", "建筑", "夜景", "胡同", "艺术区", "公园", "拍照"],
  familyFun: ["亲子", "儿童", "动物", "科技", "公园", "互动"],
  vacation: ["休闲", "度假", "酒店", "咖啡", "园林", "公园"],
  museum: ["博物馆", "美术馆", "展馆", "展览"],
  temple: ["雍和宫", "孔庙", "国子监", "白塔寺", "天坛", "寺", "古建"],
  nightlife: ["三里屯", "后海", "夜景", "夜市", "演出", "酒吧", "夜生活"],
  shopping: ["王府井", "三里屯", "SKP", "蓝色港湾", "前门", "购物"],
  performance: ["剧院", "展览", "798", "艺术区", "演出", "美术馆"],
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function normalizeDays(input: unknown): 1 | 2 | 3 | 4 | 5 {
  const value = Number(input)
  if (!Number.isFinite(value)) return 3
  return Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5
}

function inferBudgetTierFromRange(input: unknown): BudgetTier {
  const direct = normalizeBudgetTier(input)
  if (direct) return direct
  const text = typeof input === "string" ? input.trim() : ""
  if (text.includes("1000以内")) return "under1000"
  if (text.includes("1000-3000")) return "budget1000to3000"
  if (text.includes("3000-5000")) return "budget3000to5000"
  if (text.includes("5000-10000")) return "budget5000to10000"
  if (text.includes("10000以上")) return "over10000"
  return "budget3000to5000"
}

function normalizeInterestTags(primary?: unknown[], fallback?: unknown[]) {
  return unique([...(primary || []), ...(fallback || [])].map(normalizeInterestTag).filter(Boolean) as InterestTag[])
}

function normalizeSpecialNeeds(primary?: unknown[], fallback?: unknown[]) {
  return unique([...(primary || []), ...(fallback || [])].map(normalizeSpecialNeed).filter(Boolean) as SpecialNeed[])
}

function applyConflictRules(input: {
  travelerGroup: TravelerGroup
  pace: PreferencePace
  specialNeeds: SpecialNeed[]
  interestTags: InterestTag[]
}) {
  let effectivePace = input.pace
  const specialNeeds = [...input.specialNeeds]
  const conflictWarnings: string[] = []
  const interestTags = [...input.interestTags]

  if (input.travelerGroup === "elderly" && input.pace === "intensive") {
    effectivePace = specialNeeds.includes("elderlyFriendly") ? "relaxed" : "balanced"
    conflictWarnings.push("老人同行与特种兵强度冲突，已优先保护体力与安全。")
  }

  if (specialNeeds.includes("elderlyFriendly") && effectivePace === "intensive") {
    effectivePace = "balanced"
    conflictWarnings.push("适合老人需求与高强度节奏冲突，已降低实际强度。")
  }

  if (specialNeeds.includes("lessWalking") && input.pace === "intensive") {
    conflictWarnings.push("少走路与特种兵强度冲突，已保留较多点位但要求同区密集串联。")
  }

  if (
    (input.travelerGroup === "family" || specialNeeds.includes("kidFriendly")) &&
    interestTags.includes("nightlife")
  ) {
    conflictWarnings.push("亲子同行与夜生活偏好冲突，已将夜生活替换为安全夜景或轻松晚间散步。")
  }

  if (
    specialNeeds.includes("lowBudget") &&
    specialNeeds.includes("hotelComfort")
  ) {
    conflictWarnings.push("低预算优先与酒店舒适优先冲突，已采用性价比舒适住宿策略。")
  }

  if (specialNeeds.includes("publicTransit") && specialNeeds.includes("driving")) {
    conflictWarnings.push("公共交通优先与自驾优先同时存在，已按 mixed 策略处理。")
  }

  return {
    effectivePace,
    specialNeeds,
    interestTags,
    conflictWarnings,
  }
}

function buildPoiWeights(preferences: NormalizedPreferences) {
  const weights: Record<string, number> = {}
  for (const interest of preferences.interestTags) {
    const boost = interest === "food" ? 10 : 18
    for (const keyword of INTEREST_WEIGHTS[interest]) {
      weights[keyword] = (weights[keyword] || 0) + boost
    }
  }
  if (preferences.travelerGroup === "family" || preferences.specialNeeds.includes("kidFriendly")) {
    for (const keyword of ["亲子", "儿童", "动物", "科技", "公园"]) weights[keyword] = (weights[keyword] || 0) + 20
  }
  if (preferences.travelerGroup === "elderly" || preferences.specialNeeds.includes("elderlyFriendly")) {
    for (const keyword of ["博物馆", "公园", "文化", "室内", "交通便利"]) weights[keyword] = (weights[keyword] || 0) + 16
  }
  if (preferences.specialNeeds.includes("lowBudget")) {
    weights["免费"] = (weights["免费"] || 0) + 20
    weights["低价"] = (weights["低价"] || 0) + 16
  }
  return weights
}

function buildRuleText(preferences: NormalizedPreferences) {
  const dailyRules = [...PACE_RULES[preferences.effectivePace].rules]
  const softPreferences: string[] = []
  const transportRules: string[] = []
  const foodRules: string[] = []
  const hotelRules: string[] = []
  const budgetRules: string[] = []

  if (preferences.travelerGroup === "solo") {
    softPreferences.push("路线清晰、安全、交通方便，晚间活动避免过偏区域。")
  }
  if (preferences.travelerGroup === "couple") {
    softPreferences.push("增加城市漫步、拍照、夜景和体验感强的餐厅。")
  }
  if (preferences.travelerGroup === "friends") {
    softPreferences.push("增加美食、拍照、夜生活、城市漫步和互动型活动。")
  }
  if (preferences.travelerGroup === "family") {
    softPreferences.push("增加亲子互动、博物馆、科技馆、公园、动物园和轻松餐厅。")
    dailyRules.push("每天安排休息节点，减少夜生活和高强度步行。")
  }
  if (preferences.travelerGroup === "elderly") {
    softPreferences.push("安全和体力保护优先，减少步行、换乘和折返。")
    dailyRules.push("每天安排休息或低强度节点，避免过度特种兵。")
  }
  if (preferences.travelerGroup === "company") {
    softPreferences.push("增加团队活动、餐饮容量、交通集中和易集合点。")
  }

  if (preferences.specialNeeds.includes("lessWalking")) {
    transportRules.push("少走路：优先同区，减少连续长距离 citywalk，多使用打车或地铁。")
  }
  if (preferences.specialNeeds.includes("publicTransit")) {
    transportRules.push("公共交通优先：交通建议偏地铁/公交，酒店靠近地铁站。")
  }
  if (preferences.specialNeeds.includes("driving")) {
    transportRules.push("自驾优先：交通建议偏驾车，并提示停车和拥堵风险。")
  }
  if (preferences.specialNeeds.includes("lowBudget")) {
    budgetRules.push("低预算优先：免费/低价景点、公共交通、克制餐饮和住宿预算。")
  }
  if (preferences.specialNeeds.includes("foodPriority") || preferences.interestTags.includes("food")) {
    foodRules.push("每天必须给出午餐和晚餐建议，餐厅贴近当天路线。")
  }
  if (preferences.specialNeeds.includes("hotelComfort")) {
    hotelRules.push("酒店舒适优先：重视舒适度、交通便利、安全和评分，区域衔接当天路线。")
  }
  if (preferences.specialNeeds.includes("kidFriendly")) {
    dailyRules.push("适合小孩：增加亲子互动，避免太多纯讲解型古迹，增加休息和餐饮便利性。")
  }
  if (preferences.specialNeeds.includes("elderlyFriendly")) {
    dailyRules.push("适合老人：体力保护优先，避开拥挤高峰，增加休息和室内节点。")
  }
  if (preferences.specialNeeds.includes("avoidCrowds")) {
    dailyRules.push("避开人群：热门景点尽量安排早上，提示拥挤风险和替代点位。")
  }

  if (preferences.budgetTier === "under1000") {
    budgetRules.push("1000以内：免费/低价景点优先，公共交通优先，避免高价酒店。")
  } else if (preferences.budgetTier === "budget1000to3000") {
    budgetRules.push("1000-3000：兼顾经典景点和普通餐饮。")
  } else if (preferences.budgetTier === "budget3000to5000") {
    budgetRules.push("3000-5000：可加入舒适酒店和特色餐饮。")
  } else if (preferences.budgetTier === "budget5000to10000") {
    budgetRules.push("5000-10000：舒适体验优先，可加入高品质餐饮和更好酒店。")
  } else {
    budgetRules.push("10000以上：高舒适度，可加入精品酒店和高品质餐饮，但不编造服务。")
  }

  return { dailyRules, softPreferences, transportRules, foodRules, hotelRules, budgetRules }
}

export function buildPreferencePolicy(input: PreferencePolicyInput): PreferencePolicy {
  const legacy = input.legacy || {}
  const travelerGroup =
    normalizeTravelerGroup(input.travelerGroup) ||
    normalizeTravelerGroup(legacy.companions) ||
    "friends"
  const pace =
    normalizePreferencePace(input.pace) ||
    normalizePreferencePace(legacy.pace) ||
    legacyPaceToPreference(legacy.pace)
  const interestTags = normalizeInterestTags(input.interestTags, legacy.interests)
  const specialNeeds = normalizeSpecialNeeds(input.specialNeeds, legacy.specialNeeds)
  const days = normalizeDays(input.days ?? legacy.totalDays)
  const budgetTier = normalizeBudgetTier(input.budgetTier) || inferBudgetTierFromRange(legacy.budgetRange)

  const resolved = applyConflictRules({
    travelerGroup,
    pace,
    specialNeeds,
    interestTags,
  })

  const effectivePace = resolved.effectivePace
  const paceRules = PACE_RULES[effectivePace]
  const normalizedPreferences: NormalizedPreferences = {
    travelerGroup,
    interestTags: resolved.interestTags,
    pace,
    effectivePace,
    specialNeeds: resolved.specialNeeds,
    days,
    budgetTier,
    labels: {
      travelerGroup: TRAVELER_GROUP_LABELS[travelerGroup],
      interestTags: labelsForInterestTags(resolved.interestTags),
      pace: PACE_LABELS[pace],
      effectivePace: PACE_LABELS[effectivePace],
      specialNeeds: labelsForSpecialNeeds(resolved.specialNeeds),
      budgetTier: BUDGET_TIER_LABELS[budgetTier],
    },
  }

  const rules = buildRuleText(normalizedPreferences)

  return {
    normalizedPreferences,
    hardConstraints: {
      beijingOnly: true,
      minMainActivitiesPerDay: paceRules.minMain,
      targetTotalItemsPerDay: paceRules.target,
      maxMainActivitiesPerDay: paceRules.maxMain,
      requireLunchAndDinner: true,
      requireHotelSuggestion: true,
      avoidNightlifeAsCore:
        travelerGroup === "family" ||
        travelerGroup === "elderly" ||
        resolved.specialNeeds.includes("kidFriendly") ||
        resolved.specialNeeds.includes("elderlyFriendly"),
      requireRestHints:
        effectivePace === "relaxed" ||
        travelerGroup === "family" ||
        travelerGroup === "elderly" ||
        resolved.specialNeeds.includes("lessWalking") ||
        resolved.specialNeeds.includes("elderlyFriendly"),
    },
    softPreferences: rules.softPreferences,
    poiWeights: buildPoiWeights(normalizedPreferences),
    dailyRules: rules.dailyRules,
    budgetRules: rules.budgetRules,
    transportRules: rules.transportRules,
    hotelRules: rules.hotelRules,
    foodRules: rules.foodRules,
    conflictWarnings: resolved.conflictWarnings,
    preferenceTrace: {
      travelerGroup,
      pace,
      effectivePace,
      minMainActivitiesPerDay: paceRules.minMain,
      targetTotalItemsPerDay: paceRules.target,
      budgetTier,
      interestTags: resolved.interestTags,
      specialNeeds: resolved.specialNeeds,
      conflictWarnings: resolved.conflictWarnings,
      repairApplied: false,
    },
  }
}

export function buildPreferencePolicyFromRequest(request: PlannerDecisionRequest): PreferencePolicy {
  return buildPreferencePolicy({
    travelerGroup: request.structuredPreferences?.travelerGroup,
    interestTags: request.structuredPreferences?.interestTags,
    pace: request.structuredPreferences?.pace,
    specialNeeds: request.structuredPreferences?.specialNeeds,
    days: request.structuredPreferences?.days,
    budgetTier: request.structuredPreferences?.budgetTier,
    legacy: {
      companions: request.companions,
      interests: request.interests,
      pace: request.pace,
      specialNeeds: request.specialNeeds,
      totalDays: request.totalDays,
      budgetRange: request.budgetRange,
    },
  })
}

export function getCandidatePolicyScore(candidate: PlannerCandidate, policy: PreferencePolicy) {
  const text = `${candidate.name} ${(candidate.tags || []).join(" ")} ${candidate.address || ""}`
  let score = 0
  for (const [keyword, weight] of Object.entries(policy.poiWeights)) {
    if (text.includes(keyword)) score += weight
  }
  if (policy.normalizedPreferences.specialNeeds.includes("lowBudget") && Number.isFinite(candidate.price)) {
    score -= Math.max(0, candidate.price || 0) / 10
  }
  return score
}

export function getLegacyFieldsFromPolicy(policy: PreferencePolicy) {
  return {
    companions:
      policy.normalizedPreferences.travelerGroup === "company"
        ? "team"
        : policy.normalizedPreferences.travelerGroup,
    pace: preferencePaceToLegacy(policy.normalizedPreferences.effectivePace),
    interests: policy.normalizedPreferences.labels.interestTags,
    specialNeeds: policy.normalizedPreferences.labels.specialNeeds,
    budgetRange: BUDGET_TIER_LABELS[policy.normalizedPreferences.budgetTier],
  }
}

export function hasMainActivityKeyword(candidate: PlannerCandidate) {
  const text = `${candidate.name} ${(candidate.tags || []).join(" ")} ${candidate.address || ""}`
  return /景区|景点|博物馆|公园|故宫|天坛|景山|恭王府|胡同|前门|什刹海|鼓楼|钟楼|寺|古建|艺术|展览|剧院|商场|购物|地标|长城|动物园|科技馆|美术馆|湖|园/u.test(text)
}

export type { BudgetTier, InterestTag, PreferencePace, SpecialNeed, StructuredPlannerPreferences, TravelerGroup }
