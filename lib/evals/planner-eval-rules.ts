import type {
  GeneratedPlan,
  GeneratedPlanDay,
  PlannerCandidate,
} from "@/lib/planner-types"
import type {
  PlannerEvalCase,
  PlannerEvalMetrics,
  PlannerEvalPlannerOutput,
  PlannerEvalResult,
} from "@/lib/evals/planner-eval-types"

type PlannerRootCategory = "scenic" | "food" | "hotel" | "unknown"

function rootCategoryForCandidate(candidate?: PlannerCandidate): PlannerRootCategory {
  if (!candidate) return "unknown"
  if (candidate.type === "restaurant") return "food"
  if (candidate.type === "hotel") return "hotel"
  if (candidate.type === "attraction") return "scenic"
  return "unknown"
}

function isSelectedFoodOrHotelOnly(evalCase: PlannerEvalCase) {
  const selectedPlaces = evalCase.request.selectedPlaces || []
  if (selectedPlaces.length === 0) return false
  return selectedPlaces.every((item) => {
    if (!item || typeof item !== "object") return false
    const record = item as Record<string, unknown>
    const rawType = String(record.rootCategory || record.type || "")
    return ["food", "restaurant", "hotel"].includes(rawType)
  })
}

function isKnownBeijingCandidate(candidate?: PlannerCandidate) {
  if (!candidate) return false
  const text = [candidate.city, candidate.address, candidate.district]
    .filter(Boolean)
    .join(" ")
  return (
    text.includes("\u5317\u4eac") ||
    text.includes("鍖椾含") ||
    text.includes("閸栨ぞ")
  )
}

function getDayFoodCount(day: GeneratedPlanDay) {
  return Number(Boolean(day.lunch?.placeId)) + Number(Boolean(day.dinner?.placeId))
}

function getDayHotelCount(day: GeneratedPlanDay) {
  return Number(Boolean(day.hotel?.placeId))
}

function getCandidateMap(candidates: PlannerCandidate[]) {
  return new Map(candidates.map((candidate) => [candidate.placeId, candidate]))
}

function collectUsedCandidates(plan: GeneratedPlan | undefined, candidates: PlannerCandidate[]) {
  if (!plan) return []
  const candidateMap = getCandidateMap(candidates)
  const ids = new Set<string>()
  for (const day of plan.days) {
    day.spots.forEach((spot) => ids.add(spot.placeId))
    if (day.lunch?.placeId) ids.add(day.lunch.placeId)
    if (day.dinner?.placeId) ids.add(day.dinner.placeId)
    if (day.hotel?.placeId) ids.add(day.hotel.placeId)
  }
  return Array.from(ids)
    .map((id) => candidateMap.get(id))
    .filter((item): item is PlannerCandidate => Boolean(item))
}

function hasPreferenceSignal(
  evalCase: PlannerEvalCase,
  output: PlannerEvalPlannerOutput,
  tag: string
) {
  if ((evalCase.request.interestTags || []).includes(tag)) return true
  const selectedText = JSON.stringify(evalCase.request.selectedPlaces || []).toLowerCase()
  if (selectedText.includes(tag.toLowerCase())) return true
  const usedText = collectUsedCandidates(output.plan, output.candidateCatalog || [])
    .map((candidate) => `${candidate.name} ${(candidate.tags || []).join(" ")}`)
    .join(" ")
    .toLowerCase()
  return usedText.includes(tag.toLowerCase())
}

function buildMetrics(
  evalCase: PlannerEvalCase,
  output: PlannerEvalPlannerOutput
): PlannerEvalMetrics {
  const plan = output.plan
  const candidateMap = getCandidateMap(output.candidateCatalog || [])
  const days = plan?.days || []
  const mainActivitiesPerDay: number[] = []
  const totalItemsPerDay: number[] = []
  const foodItemsPerDay: number[] = []
  const hotelItemsPerDay: number[] = []
  let nonBeijingItems = 0
  let foodAsMainActivity = 0
  let hotelAsMainActivity = 0

  for (const day of days) {
    let mainCount = 0
    for (const spot of day.spots) {
      const candidate = candidateMap.get(spot.placeId)
      const rootCategory = rootCategoryForCandidate(candidate)
      if (!isKnownBeijingCandidate(candidate)) nonBeijingItems += 1
      if (rootCategory === "food") foodAsMainActivity += 1
      else if (rootCategory === "hotel") hotelAsMainActivity += 1
      else if (rootCategory === "scenic") mainCount += 1
      else mainCount += 1
    }

    const foodCount = getDayFoodCount(day)
    const hotelCount = getDayHotelCount(day)
    mainActivitiesPerDay.push(mainCount)
    foodItemsPerDay.push(foodCount)
    hotelItemsPerDay.push(hotelCount)
    totalItemsPerDay.push(day.spots.length + foodCount + hotelCount)
  }

  const finalDays = output.diagnostics?.finalDays ?? days.length
  const daysPlanLength = days.length
  return {
    requestedDays: evalCase.request.days,
    finalDays,
    daysPlanLength,
    dayCountMatched:
      finalDays === evalCase.expectations.expectedDays &&
      daysPlanLength === evalCase.expectations.expectedDays,
    mainActivitiesPerDay,
    totalItemsPerDay,
    foodItemsPerDay,
    hotelItemsPerDay,
    nonBeijingItems,
    foodAsMainActivity,
    hotelAsMainActivity,
    missingFoodSuggestions:
      days.length === 0 || days.some((day) => !day.lunch?.placeId || !day.dinner?.placeId),
    missingHotelSuggestions:
      days.length === 0 || days.some((day) => !day.hotel?.placeId),
    fallback: output.source === "fallback",
    repairApplied: Boolean(
      output.diagnostics?.repairApplied ||
        output.diagnostics?.dayRepairApplied ||
        output.diagnostics?.missingDaysRepaired?.length
    ),
    durationMs: output.durationMs,
  }
}

function buildHardFailures(evalCase: PlannerEvalCase, metrics: PlannerEvalMetrics) {
  const failures: string[] = []
  const expectations = evalCase.expectations

  if (metrics.daysPlanLength === 0) failures.push("missing_days_plan")
  if (metrics.finalDays !== expectations.expectedDays) failures.push("final_days_mismatch")
  if (metrics.daysPlanLength !== expectations.expectedDays) failures.push("days_plan_length_mismatch")
  if (metrics.mainActivitiesPerDay.some((count) => count < expectations.minMainActivitiesPerDay)) {
    failures.push("insufficient_main_activities")
  }
  if (metrics.mainActivitiesPerDay.some((count) => count === 0)) {
    failures.push("zero_main_activity_day")
  }
  if (expectations.mustStayInBeijing && metrics.nonBeijingItems > 0) {
    failures.push("non_beijing_or_unknown_poi")
  }
  if (expectations.noFoodAsMainActivity && metrics.foodAsMainActivity > 0) {
    failures.push("food_as_main_activity")
  }
  if (expectations.noHotelAsMainActivity && metrics.hotelAsMainActivity > 0) {
    failures.push("hotel_as_main_activity")
  }
  if (metrics.mainActivitiesPerDay.length > 0 && metrics.mainActivitiesPerDay.length < expectations.expectedDays) {
    failures.push("empty_spot_timeline")
  }
  if (isSelectedFoodOrHotelOnly(evalCase)) {
    const totalMainActivities = metrics.mainActivitiesPerDay.reduce((sum, count) => sum + count, 0)
    if (totalMainActivities === 0) failures.push("selected_food_or_hotel_without_scenic_supplement")
  }

  return Array.from(new Set(failures))
}

function buildSoftWarnings(
  evalCase: PlannerEvalCase,
  output: PlannerEvalPlannerOutput,
  metrics: PlannerEvalMetrics
) {
  const warnings: string[] = []
  const expectations = evalCase.expectations
  const target = expectations.targetTotalItemsPerDay

  if (output.source === "error") warnings.push(`planner_error:${output.errorType || "unknown"}`)
  if (metrics.fallback && output.mode === "live" && !expectations.allowedFallback) {
    warnings.push("live_fallback_triggered")
  }
  if (metrics.repairApplied) warnings.push("repair_applied")
  if (expectations.mustHaveFoodSuggestions && metrics.missingFoodSuggestions) {
    warnings.push("missing_food_suggestions")
  }
  if (expectations.mustHaveHotelSuggestions && metrics.missingHotelSuggestions) {
    warnings.push("missing_hotel_suggestions")
  }
  if (target) {
    metrics.totalItemsPerDay.forEach((count, index) => {
      if (count < target.min || count > target.max) {
        warnings.push(`day_${index + 1}_total_items_outside_target`)
      }
    })
  }
  for (const tag of expectations.mustIncludeInterestTags || []) {
    if (!hasPreferenceSignal(evalCase, output, tag)) {
      warnings.push(`weak_preference_signal:${tag}`)
    }
  }
  if (
    expectations.routeBehavior === "lowWalking" &&
    metrics.mainActivitiesPerDay.some((count) => count > 3)
  ) {
    warnings.push("route_may_be_too_dense_for_low_walking")
  }
  if (expectations.budgetBehavior && !evalCase.request.budgetTier && !evalCase.request.budget) {
    warnings.push("budget_behavior_not_explicit_in_request")
  }

  return Array.from(new Set(warnings))
}

function calculateScore(
  evalCase: PlannerEvalCase,
  output: PlannerEvalPlannerOutput,
  metrics: PlannerEvalMetrics
) {
  const expectedDays = Math.max(1, evalCase.expectations.expectedDays)
  const dayCountScore = metrics.dayCountMatched ? 20 : 0
  const daysMeetingMain = metrics.mainActivitiesPerDay.filter(
    (count) => count >= evalCase.expectations.minMainActivitiesPerDay
  ).length
  const mainActivityScore = Math.round((25 * daysMeetingMain) / expectedDays)
  const beijingScore = metrics.nonBeijingItems === 0 ? 15 : 0
  const categoryScore = Math.max(
    0,
    15 -
      (metrics.foodAsMainActivity > 0 ? 8 : 0) -
      (metrics.hotelAsMainActivity > 0 ? 7 : 0)
  )
  const preferenceScore =
    (evalCase.expectations.mustIncludeInterestTags || []).every((tag) =>
      hasPreferenceSignal(evalCase, output, tag)
    )
      ? 10
      : 6
  const foodStayScore =
    (evalCase.expectations.mustHaveFoodSuggestions && metrics.missingFoodSuggestions ? 0 : 5) +
    (evalCase.expectations.mustHaveHotelSuggestions && metrics.missingHotelSuggestions ? 0 : 5)
  const fallbackRepairScore =
    output.mode === "offline"
      ? 5
      : Math.max(0, 5 - (metrics.fallback && !evalCase.expectations.allowedFallback ? 3 : 0) - (metrics.repairApplied ? 1 : 0))

  return Math.max(
    0,
    Math.min(
      100,
      dayCountScore +
        mainActivityScore +
        beijingScore +
        categoryScore +
        preferenceScore +
        foodStayScore +
        fallbackRepairScore
    )
  )
}

export function evaluatePlannerEvalCase(
  evalCase: PlannerEvalCase,
  output: PlannerEvalPlannerOutput
): PlannerEvalResult {
  const metrics = buildMetrics(evalCase, output)
  const hardFailures = buildHardFailures(evalCase, metrics)
  const softWarnings = buildSoftWarnings(evalCase, output, metrics)
  const score = calculateScore(evalCase, output, metrics)

  return {
    caseId: evalCase.id,
    caseName: evalCase.name,
    passed: hardFailures.length === 0,
    score,
    maxScore: 100,
    hardFailures,
    softWarnings,
    metrics,
  }
}

