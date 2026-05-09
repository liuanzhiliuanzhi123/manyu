import type {
  PlanQualityScore,
  PlanScoreDimension,
  PlanValidationResult,
  TravelRequirement,
} from "@/lib/planner-types"
import type { TripPlan } from "@/lib/travel-context"

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function parseBudgetUpperBound(budgetRange?: string) {
  if (!budgetRange) return Number.POSITIVE_INFINITY
  if (budgetRange.includes("以内")) {
    const value = Number(budgetRange.replace(/[^\d]/g, ""))
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  if (budgetRange.includes("以上")) return Number.POSITIVE_INFINITY
  const parts = budgetRange.split("-")
  const upper = Number((parts[1] || parts[0] || "").replace(/[^\d]/g, ""))
  return Number.isFinite(upper) ? upper : Number.POSITIVE_INFINITY
}

function countWarningByCategory(validation: PlanValidationResult, category: string) {
  return validation.warnings.filter((item) => item.category === category).length
}

function countErrorByCategory(validation: PlanValidationResult, category: string) {
  return validation.errors.filter((item) => item.category === category).length
}

function createDimension(
  key: PlanScoreDimension["key"],
  label: string,
  score: number,
  reason: string
): PlanScoreDimension {
  return {
    key,
    label,
    score: clampScore(score),
    maxScore: 100,
    reason,
  }
}

export function calculatePlanQualityScore(
  plan: TripPlan,
  validation: PlanValidationResult,
  requirement?: TravelRequirement
): PlanQualityScore {
  const referenceRequirement = requirement || plan.requirement
  const routePenalty = countWarningByCategory(validation, "route") * 10 + countErrorByCategory(validation, "route") * 16
  const routeSmoothness = createDimension(
    "routeSmoothness",
    "顺路性",
    94 - routePenalty,
    routePenalty > 0 ? "存在跨区/折返/通勤偏长问题" : "路线整体顺路"
  )

  const budgetUpper = parseBudgetUpperBound(referenceRequirement?.budgetRange)
  const totalBudget = plan.totalEstimatedCost || 0
  let budgetRawScore = 88
  if (Number.isFinite(budgetUpper) && budgetUpper > 0) {
    const ratio = totalBudget / budgetUpper
    if (ratio <= 0.9) budgetRawScore = 96
    else if (ratio <= 1.05) budgetRawScore = 88
    else if (ratio <= 1.2) budgetRawScore = 72
    else budgetRawScore = 52
  }
  const budgetPenalty = countWarningByCategory(validation, "budget") * 10 + countErrorByCategory(validation, "budget") * 18
  const budgetMatch = createDimension(
    "budgetMatch",
    "预算匹配",
    budgetRawScore - budgetPenalty,
    budgetPenalty > 0 ? "预算有超出风险" : "预算与需求区间匹配"
  )

  const preferencePenalty =
    countWarningByCategory(validation, "preference") * 14 +
    countErrorByCategory(validation, "preference") * 20
  const preferenceMatch = createDimension(
    "preferenceMatch",
    "偏好匹配",
    90 - preferencePenalty,
    preferencePenalty > 0 ? "部分兴趣偏好命中不足" : "兴趣偏好命中稳定"
  )

  const allLegs = plan.days?.flatMap((day) => day.routeLegs) || []
  const estimatedRatio =
    allLegs.length > 0
      ? allLegs.filter((leg) => leg.isEstimated).length / allLegs.length
      : 0.25
  const transportPenalty = Math.round(estimatedRatio * 36) + countWarningByCategory(validation, "route") * 6
  const transportRationality = createDimension(
    "transportRationality",
    "交通合理性",
    92 - transportPenalty,
    transportPenalty > 26 ? "存在估算路段较多或通勤偏长" : "交通方案总体可执行"
  )

  const mealWarnings = validation.warnings.filter(
    (item) => item.category === "meal_hotel" && /午餐|晚餐/.test(item.title)
  ).length
  const foodPlacement = createDimension(
    "foodPlacement",
    "餐饮安排",
    93 - mealWarnings * 14,
    mealWarnings > 0 ? "部分日期餐饮未充分顺路" : "餐饮插入较自然"
  )

  const hotelWarnings = validation.warnings.filter(
    (item) => item.category === "meal_hotel" && /酒店|住宿/.test(item.title)
  ).length
  const hotelPlacement = createDimension(
    "hotelPlacement",
    "酒店位置",
    92 - hotelWarnings * 14,
    hotelWarnings > 0 ? "部分酒店与日程锚点距离偏远" : "酒店位置合理"
  )

  const completenessPenalty =
    countWarningByCategory(validation, "completeness") * 10 +
    countErrorByCategory(validation, "completeness") * 18 +
    validation.errors.length * 6
  const completeness = createDimension(
    "completeness",
    "完整性",
    95 - completenessPenalty,
    completenessPenalty > 0 ? "存在缺失字段或降级路段" : "方案数据完整"
  )

  const scoreBreakdown = [
    routeSmoothness,
    budgetMatch,
    preferenceMatch,
    transportRationality,
    foodPlacement,
    hotelPlacement,
    completeness,
  ]

  const maxScore = scoreBreakdown.reduce((sum, item) => sum + item.maxScore, 0)
  const totalScore = scoreBreakdown.reduce((sum, item) => sum + item.score, 0)

  const topIssues = [
    ...validation.errors.map((item) => item.title),
    ...validation.warnings.map((item) => item.title),
  ].slice(0, 5)

  const optimizationHints = Array.from(
    new Set([
      ...validation.suggestionHints,
      "可优先处理评分最低的维度，分步提升方案质量。",
    ])
  ).slice(0, 8)

  return {
    totalScore,
    maxScore,
    scoreBreakdown,
    topIssues,
    optimizationHints,
  }
}
