export interface PlannerDaysInput {
  days?: unknown
  totalDays?: unknown
  structuredPreferences?: {
    days?: unknown
  }
  startDate?: unknown
  endDate?: unknown
}

export interface NormalizedRequestedDays {
  requestedDays: number
  normalizedDays: 1 | 2 | 3 | 4 | 5
  source: "days" | "totalDays" | "structuredPreferences" | "dateRange" | "fallback"
  adjusted: boolean
}

export interface DaysLikePlan {
  days?: Array<{ day?: unknown; dayIndex?: unknown }>
  daysPlan?: Array<{ day?: unknown; dayIndex?: unknown }>
}

const MIN_DAYS = 1
const MAX_DAYS = 5
const DEFAULT_DAYS = 3

function toFiniteNumber(input: unknown) {
  const value = Number(input)
  return Number.isFinite(value) ? value : undefined
}

function clampPlannerDays(input: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(MIN_DAYS, Math.min(MAX_DAYS, Math.round(input))) as 1 | 2 | 3 | 4 | 5
}

function parseDateOnly(input: unknown) {
  if (typeof input !== "string" || !input.trim()) return undefined
  const date = new Date(input)
  return Number.isFinite(date.getTime()) ? date : undefined
}

function daysFromDateRange(startDate: unknown, endDate: unknown) {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  if (!start || !end || end < start) return undefined
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((end.getTime() - start.getTime()) / dayMs) + 1
}

export function normalizeRequestedDays(input: PlannerDaysInput): NormalizedRequestedDays {
  const candidates: Array<{
    value: number | undefined
    source: NormalizedRequestedDays["source"]
  }> = [
    { value: toFiniteNumber(input.days), source: "days" },
    { value: toFiniteNumber(input.totalDays), source: "totalDays" },
    {
      value: toFiniteNumber(input.structuredPreferences?.days),
      source: "structuredPreferences",
    },
    { value: daysFromDateRange(input.startDate, input.endDate), source: "dateRange" },
  ]

  const selected = candidates.find((candidate) => candidate.value !== undefined)
  const requestedDays = selected?.value ?? DEFAULT_DAYS
  const normalizedDays = clampPlannerDays(requestedDays)

  return {
    requestedDays,
    normalizedDays,
    source: selected?.source ?? "fallback",
    adjusted: requestedDays !== normalizedDays,
  }
}

function getPlanDays(plan: DaysLikePlan) {
  return plan.daysPlan || plan.days || []
}

function getDayNumber(day: { day?: unknown; dayIndex?: unknown }) {
  return toFiniteNumber(day.dayIndex ?? day.day)
}

export function buildMissingDayIndexes(plan: DaysLikePlan, normalizedDays: number) {
  const returned = new Set(
    getPlanDays(plan)
      .map(getDayNumber)
      .filter((day): day is number => Number.isFinite(day))
      .map((day) => Math.round(day))
  )
  return Array.from({ length: normalizedDays }, (_, index) => index + 1).filter(
    (day) => !returned.has(day)
  )
}

export function assertDaysPlanMatchesRequest(plan: DaysLikePlan, normalizedDays: number) {
  const days = getPlanDays(plan)
  if (days.length !== normalizedDays) {
    throw new Error(`Planner returned ${days.length} days, expected ${normalizedDays}.`)
  }

  const seen = new Set<number>()
  for (const day of days) {
    const dayNumber = getDayNumber(day)
    if (!dayNumber || !Number.isInteger(dayNumber)) {
      throw new Error("Planner returned a day without a valid 1-based day index.")
    }
    seen.add(dayNumber)
  }

  const missingDays = buildMissingDayIndexes(plan, normalizedDays)
  if (missingDays.length > 0 || seen.size !== normalizedDays) {
    throw new Error(
      `Planner day indexes must be exactly 1..${normalizedDays}; missing ${missingDays.join(",")}.`
    )
  }
}

