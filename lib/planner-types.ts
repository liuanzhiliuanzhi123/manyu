export type CompanionType =
  | "solo"
  | "couple"
  | "friends"
  | "family"
  | "elderly"
  | "team"

import type { DayWeather, WeatherPlanContext, WeatherSummary } from "@/lib/weather-types"
import type {
  BudgetTier,
  InterestTag,
  PreferencePace,
  SpecialNeed,
  StructuredPlannerPreferences,
  TravelerGroup,
} from "@/lib/planner/preference-types"

export type PacePreference = "fast" | "balanced" | "slow"

export type SelectedPoiType = "spot" | "food" | "hotel"

export type TransportSuggestionMode =
  | "walking"
  | "driving"
  | "transit"
  | "subway"
  | "bus"
  | "taxi"
  | "train"
  | "flight"

export type PlannerEngineMode = "deepseek" | "fallback"

export type PlannerCandidateType = "attraction" | "restaurant" | "hotel"

export interface PlannerCandidate {
  placeId: string
  name: string
  type: PlannerCandidateType
  city: string
  district?: string
  address?: string
  rating?: number
  price?: number
  tags?: string[]
  lng?: number
  lat?: number
  openTime?: string
  source?: string
  stayMinutes?: number
}

export interface PlannerRouteHint {
  fromPlaceId: string
  toPlaceId: string
  distanceMeters: number
  durationSeconds: number
  mode?: TransportSuggestionMode
}

export interface GeneratedPlanSpot {
  placeId: string
  arrivalTime?: string
  departureTime?: string
  stayMinutes?: number
  reason?: string
}

export interface GeneratedPlanSuggestion {
  placeId?: string
  area?: string
  reason?: string
}

export interface GeneratedPlanDay {
  day: number
  theme: string
  districtSummary?: string
  startTime?: string
  endTime?: string
  weather?: DayWeather
  weatherAdvice?: string
  weatherTags?: string[]
  spots: GeneratedPlanSpot[]
  lunch?: GeneratedPlanSuggestion
  dinner?: GeneratedPlanSuggestion
  hotel?: GeneratedPlanSuggestion
  routeLegIds?: string[]
  dayBudget?: number
  warnings?: string[]
}

export interface GeneratedPlan {
  destination: string
  totalDays: number
  totalBudget?: number
  weatherSummary?: WeatherSummary
  days: GeneratedPlanDay[]
  droppedPlaceIds?: string[]
  explanations?: string[]
}

export interface PlannerDecisionRequest {
  destination: string
  city: string
  province: string
  startDate?: string
  endDate?: string
  totalDays: number
  budgetRange: string
  companions: CompanionType
  interests: string[]
  pace: PacePreference
  specialNeeds: string[]
  structuredPreferences?: StructuredPlannerPreferences
  attractions: PlannerCandidate[]
  restaurants: PlannerCandidate[]
  hotels: PlannerCandidate[]
  routeHints?: PlannerRouteHint[]
  manualPreferredPlaceIds?: string[]
  weatherContext?: WeatherPlanContext
}

export interface PlannerPreferenceTrace {
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

export interface PlannerCatalogStats {
  attractions: number
  restaurants: number
  hotels: number
}

export interface PlannerDayCountDiagnostic {
  day: number
  items?: number
  spots?: number
  mainActivities: number
  food: number
  hotel: number
  transit: number
  rest: number
  note: number
  unknown: number
}

export interface PlannerDroppedItemReasons {
  missingIdentity: number
  invalidType: number
  unmatchedCandidate: number
  duplicate: number
  nonMain: number
}

export interface PlannerDiagnostics {
  requestedPreferences?: {
    city: string
    totalDays: number
    budgetRange: string
    companions: CompanionType
    interests: string[]
    pace: PacePreference
    specialNeeds: string[]
    structuredPreferences?: StructuredPlannerPreferences
  }
  normalizedPreferences?: PlannerPreferenceTrace
  poiCatalogStats?: PlannerCatalogStats
  rawModelDayCounts?: PlannerDayCountDiagnostic[]
  normalizedDayCounts?: PlannerDayCountDiagnostic[]
  finalDayCounts?: PlannerDayCountDiagnostic[]
  droppedItemReasons?: PlannerDroppedItemReasons
  repairApplied?: boolean
  repairReason?: string
}

export interface PlannerDecisionResult {
  source: PlannerEngineMode
  plan: GeneratedPlan
  warnings: string[]
  preferenceTrace?: PlannerPreferenceTrace
  diagnostics?: PlannerDiagnostics
}

export interface TravelRequirement {
  province: string
  city: string
  cityTagline?: string
  days: number
  budgetRange: string
  companions: CompanionType
  interests: string[]
  pace?: PacePreference
  specialNeeds?: string[]
}

export interface SelectedPoiItem {
  id: string
  name: string
  type: SelectedPoiType
  rootCategory?: "scenic" | "food" | "hotel"
  district?: string
  city?: string
  lng?: number
  lat?: number
  estimatedVisitMinutes?: number
  price?: number
  openingHours?: string
  address?: string
  subTags?: string[]
}

export interface PlannerDraft {
  requirement: TravelRequirement
  selectedPois: SelectedPoiItem[]
  tripName?: string
  departure?: string
  startDate?: string
  endDate?: string
  skipManualSelection?: boolean
  manualSelectionCompleted?: boolean
}

export interface PlannerWarning {
  level: "info" | "warning"
  message: string
}

export type PlanIssueLevel = "info" | "warning" | "error"

export interface PlanValidationIssue {
  id: string
  level: PlanIssueLevel
  category:
    | "time"
    | "route"
    | "budget"
    | "meal_hotel"
    | "completeness"
    | "preference"
  title: string
  message: string
  day?: number
}

export interface PlanValidationResult {
  errors: PlanValidationIssue[]
  warnings: PlanValidationIssue[]
  qualityIssues: string[]
  suggestionHints: string[]
  summary: {
    hasBlockingErrors: boolean
    errorCount: number
    warningCount: number
  }
}

export interface PlanScoreDimension {
  key:
    | "routeSmoothness"
    | "budgetMatch"
    | "preferenceMatch"
    | "transportRationality"
    | "foodPlacement"
    | "hotelPlacement"
    | "completeness"
  label: string
  score: number
  maxScore: number
  reason?: string
}

export interface PlanQualityScore {
  totalScore: number
  maxScore: number
  scoreBreakdown: PlanScoreDimension[]
  topIssues: string[]
  optimizationHints: string[]
}

export type PlanFeedbackSentiment = "satisfied" | "neutral" | "unsatisfied"

export type PlanFeedbackTag =
  | "dislike_restaurant"
  | "dislike_hotel"
  | "day_too_tight"
  | "day_too_loose"
  | "lower_budget"
  | "more_food"
  | "more_relaxed"
  | "refresh_route"

export interface PlanFeedbackRecord {
  id: string
  sentiment: PlanFeedbackSentiment
  tags: PlanFeedbackTag[]
  comment?: string
  day?: number
  createdAt: string
}

export interface PlanShareSummary {
  title: string
  destination: string
  dayCount: number
  totalSpots: number
  totalBudget: number
  routeDistanceText?: string
  highlights: string[]
  tips: string[]
}

export interface PoiBundle {
  id: string
  title: string
  description?: string
  city: string
  tags: string[]
  poiIds: string[]
  estimatedHours?: number
  estimatedBudget?: number
  reason?: string
}

export interface RecommendedCity {
  provinceCode?: string
  province: string
  cityCode?: string
  city: string
  isSpecialRegion?: boolean
  displayTags?: string[]
  tagline: string
  tags: string[]
}

export interface ProvinceCityGroup {
  provinceCode?: string
  province: string
  isSpecialRegion?: boolean
  cities: RecommendedCity[]
}

export const TRAVEL_DAY_OPTIONS = [1, 2, 3, 4, 5] as const

export const BUDGET_OPTIONS = [
  "1000以内",
  "1000-3000",
  "3000-5000",
  "5000-10000",
  "10000以上",
] as const

export const COMPANION_OPTIONS: Array<{ id: CompanionType; label: string }> = [
  { id: "solo", label: "一个人" },
  { id: "couple", label: "情侣" },
  { id: "friends", label: "朋友" },
  { id: "family", label: "家庭亲子" },
  { id: "elderly", label: "老人同行" },
  { id: "team", label: "公司团建" },
]

export const INTEREST_OPTIONS = [
  "历史人文",
  "自然风光",
  "城市漫步",
  "美食打卡",
  "网红拍照",
  "亲子互动",
  "休闲度假",
  "博物馆",
  "寺庙古建",
  "夜生活",
  "购物",
  "演出展览",
] as const

export const PACE_OPTIONS: Array<{ id: PacePreference; label: string; description: string }> = [
  { id: "fast", label: "特种兵式", description: "尽可能多打卡，每天 4-6 个点" },
  { id: "balanced", label: "轻松适中", description: "兼顾体验与效率，每天 3-4 个点" },
  { id: "slow", label: "慢节奏放松", description: "减少赶路压力，每天 2-3 个点" },
]

export const SPECIAL_NEED_OPTIONS = [
  "少走路",
  "适合老人",
  "适合小孩",
  "避开人群",
  "公共交通优先",
  "自驾优先",
  "低预算优先",
  "美食优先",
  "酒店舒适优先",
] as const
