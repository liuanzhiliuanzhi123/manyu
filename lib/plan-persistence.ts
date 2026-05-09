import type { PlanShareSummary } from "@/lib/planner-types"
import type { TripPlan } from "@/lib/travel-context"

const SAVED_PLANS_STORAGE_KEY = "travel-assistant:beijing:saved-plans:v4"
const CURRENT_PLAN_STORAGE_KEY = "travel-assistant:beijing:current-plan-id:v4"

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadSavedPlansFromStorage(): TripPlan[] {
  if (!isBrowser()) return []
  const raw = window.localStorage.getItem(SAVED_PLANS_STORAGE_KEY)
  const parsed = safeJsonParse<TripPlan[]>(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
}

export function persistSavedPlansToStorage(plans: TripPlan[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(plans))
}

export function loadCurrentPlanIdFromStorage(): string | null {
  if (!isBrowser()) return null
  return window.localStorage.getItem(CURRENT_PLAN_STORAGE_KEY)
}

export function persistCurrentPlanIdToStorage(planId: string | null) {
  if (!isBrowser()) return
  if (!planId) {
    window.localStorage.removeItem(CURRENT_PLAN_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(CURRENT_PLAN_STORAGE_KEY, planId)
}

function toDistanceText(distanceMeters: number | undefined) {
  if (!distanceMeters || distanceMeters <= 0) return ""
  return `${(distanceMeters / 1000).toFixed(1)} 公里`
}

function toPlanHighlights(plan: TripPlan) {
  const names = (plan.days || [])
    .flatMap((day) => day.spots)
    .map((spot) => spot.name)
  const deduped: string[] = []
  for (const name of names) {
    if (!name || deduped.includes(name)) continue
    deduped.push(name)
    if (deduped.length >= 4) break
  }
  return deduped
}

function toPlanTips(plan: TripPlan) {
  const warnings = [
    ...(plan.validationResult?.warnings.map((item) => item.message) || []),
    ...(plan.generationNotices || []),
  ]
  const deduped: string[] = []
  for (const warning of warnings) {
    if (!warning || deduped.includes(warning)) continue
    deduped.push(warning)
    if (deduped.length >= 3) break
  }
  if (deduped.length > 0) return deduped
  return ["路线与预算可继续在编辑模式中微调。"]
}

export function buildPlanShareSummary(plan: TripPlan): PlanShareSummary {
  const totalSpots =
    plan.totalSpots ||
    (plan.days || []).reduce((sum, day) => sum + day.spots.length, 0) ||
    plan.spots.length

  return {
    title: plan.name,
    destination: plan.requirement?.city || "北京",
    dayCount: plan.totalDays || plan.days?.length || 0,
    totalSpots,
    totalBudget: Math.round(plan.totalEstimatedCost || 0),
    routeDistanceText: toDistanceText(plan.totalDistanceMeters),
    highlights: toPlanHighlights(plan),
    tips: toPlanTips(plan),
  }
}

export function toShareSummaryText(summary: PlanShareSummary) {
  const lines = [
    `${summary.title}`,
    `${summary.destination} · ${summary.dayCount}天 · ${summary.totalSpots}个点位`,
    `总预算约 ¥${summary.totalBudget}`,
  ]
  if (summary.routeDistanceText) {
    lines.push(`累计路线约 ${summary.routeDistanceText}`)
  }
  if (summary.highlights.length > 0) {
    lines.push(`亮点：${summary.highlights.join(" / ")}`)
  }
  if (summary.tips.length > 0) {
    lines.push(`提示：${summary.tips.join("；")}`)
  }
  return lines.join("\n")
}
