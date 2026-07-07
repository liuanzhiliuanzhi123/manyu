import type { PlannerErrorType } from "@/lib/observability/planner-error-taxonomy"

export type PlannerRunEnvironment = "development" | "production" | "preview" | "test"

export interface PlannerTokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface EstimatedPlannerCost {
  currency: "CNY" | "USD"
  amount: number
  note: string
}

export interface PlannerProviderCallMetrics {
  providerStatus?: number
  providerModel?: string
  requestId?: string
  durationMs?: number
  timeoutMs?: number
  maxTokens?: number
  callCount?: number
  usage?: PlannerTokenUsage
}

export interface PlannerFinalDayCount {
  dayIndex: number
  totalItems: number
  mainActivities: number
  foodItems: number
  hotelItems: number
}

export interface PlannerRunLog {
  id: string
  createdAt: string
  environment: PlannerRunEnvironment
  source: "deepseek" | "fallback"
  fallback: boolean
  fallbackReason?: string
  repairApplied: boolean
  repairReason?: string
  errorType?: PlannerErrorType
  providerStatus?: number
  providerModel?: string
  durationMs: number
  timeoutMs?: number
  requestedDays: number
  finalDays: number
  requestedPace?: string
  normalizedPace?: string
  travelerGroup?: string
  budgetTier?: string
  interestTagCount: number
  specialNeedCount: number
  selectedPlaceCount: number
  selectedScenicCount: number
  selectedFoodCount: number
  selectedHotelCount: number
  finalDayCounts: PlannerFinalDayCount[]
  usage?: PlannerTokenUsage
  estimatedCost?: EstimatedPlannerCost
  safeDiagnostics?: {
    hasApiKey?: boolean
    usedFallbackPlanner?: boolean
    usedRepair?: boolean
    schemaValidated?: boolean
    rateLimited?: boolean
  }
}

export interface PlannerQualitySignals {
  averageFinalDays: number
  daysMismatchCount: number
  zeroMainActivityDayCount: number
  averageMainActivitiesPerDay: number
  averageTotalItemsPerDay: number
}

export interface PlannerRunSummary {
  totalRuns: number
  deepseekRuns: number
  fallbackRuns: number
  fallbackRate: number
  repairAppliedRuns: number
  repairRate: number
  averageDurationMs: number
  p95DurationMs: number
  errorCounts: Partial<Record<PlannerErrorType, number>>
  averagePromptTokens: number
  averageCompletionTokens: number
  averageTotalTokens: number
  estimatedTotalCost: EstimatedPlannerCost
  qualitySignals: PlannerQualitySignals
}

export interface PlannerObservabilityReport {
  title: "Planner Observability Report"
  generatedAt: string
  summary: PlannerRunSummary
  failureAnalysis: Partial<Record<PlannerErrorType, number>>
  recommendations: string[]
  evalReport?: {
    mode?: string
    totalCases?: number
    passedCases?: number
    failedCases?: number
    averageScore?: number
    hardFailureCount?: number
    fallbackCount?: number
    repairAppliedCount?: number
  }
  notes: string[]
}
