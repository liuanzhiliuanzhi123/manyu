import type {
  GeneratedPlan,
  PlannerCandidate,
  PlannerDiagnostics,
  PlannerEngineMode,
} from "@/lib/planner-types"

export type PlannerEvalMode = "offline" | "live"

export type PlannerEvalBudgetBehavior = "low" | "balanced" | "comfort" | "premium"
export type PlannerEvalRouteBehavior = "lowWalking" | "compact" | "balanced" | "intensive"

export interface PlannerEvalPublicRequest {
  city: "\u5317\u4eac"
  days: number
  budgetTier?: string
  budget?: {
    min?: number
    max?: number
  }
  travelerGroup?: string
  travelerType?: string
  interestTags?: string[]
  pace?: string
  specialNeeds?: string[]
  selectedPlaces?: unknown[]
  startDate?: string
  transportPreference?: string
}

export interface PlannerEvalCase {
  id: string
  name: string
  description: string
  request: PlannerEvalPublicRequest
  expectations: {
    expectedDays: number
    minMainActivitiesPerDay: number
    targetTotalItemsPerDay?: {
      min: number
      max: number
    }
    mustIncludeInterestTags?: string[]
    mustHaveFoodSuggestions?: boolean
    mustHaveHotelSuggestions?: boolean
    mustStayInBeijing?: boolean
    noFoodAsMainActivity?: boolean
    noHotelAsMainActivity?: boolean
    budgetBehavior?: PlannerEvalBudgetBehavior
    routeBehavior?: PlannerEvalRouteBehavior
    allowedFallback?: boolean
  }
}

export interface PlannerEvalPlannerOutput {
  mode: PlannerEvalMode
  source: PlannerEngineMode | "error"
  plan?: GeneratedPlan
  diagnostics?: PlannerDiagnostics
  warnings?: string[]
  candidateCatalog?: PlannerCandidate[]
  errorType?: string
  statusCode?: number
  durationMs?: number
}

export interface PlannerEvalMetrics {
  requestedDays: number
  finalDays: number
  daysPlanLength: number
  dayCountMatched: boolean
  mainActivitiesPerDay: number[]
  totalItemsPerDay: number[]
  foodItemsPerDay: number[]
  hotelItemsPerDay: number[]
  nonBeijingItems: number
  foodAsMainActivity: number
  hotelAsMainActivity: number
  missingFoodSuggestions: boolean
  missingHotelSuggestions: boolean
  fallback: boolean
  repairApplied: boolean
  durationMs?: number
}

export interface PlannerEvalResult {
  caseId: string
  caseName: string
  passed: boolean
  score: number
  maxScore: number
  hardFailures: string[]
  softWarnings: string[]
  metrics: PlannerEvalMetrics
}

export interface PlannerEvalSummary {
  mode: PlannerEvalMode
  totalCases: number
  passedCases: number
  failedCases: number
  averageScore: number
  hardFailureCount: number
  fallbackCount: number
  repairAppliedCount: number
  generatedAt: string
  commonFailureReasons: Array<{
    reason: string
    count: number
  }>
}

export interface PlannerEvalReport {
  summary: PlannerEvalSummary
  results: PlannerEvalResult[]
}

export interface PlannerEvalRunnerOptions {
  live?: boolean
  maxCases?: number
  baseUrl?: string
  delayMs?: number
  jsonReportPath?: string
  markdownReportPath?: string
}

