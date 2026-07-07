import { z } from "zod"
import {
  BUDGET_TIERS,
  INTEREST_TAGS,
  PREFERENCE_PACES,
  SPECIAL_NEEDS,
  TRAVELER_GROUPS,
} from "@/lib/planner/preference-types"

const candidateTypeSchema = z.enum(["attraction", "restaurant", "hotel"])

const weatherLiveSchema = z.object({
  weather: z.string(),
  temperature: z.string(),
  winddirection: z.string(),
  windpower: z.string(),
  humidity: z.string(),
  reporttime: z.string(),
}).strict()

const weatherForecastSchema = z.object({
  date: z.string(),
  week: z.string().optional(),
  dayweather: z.string(),
  nightweather: z.string(),
  daytemp: z.string(),
  nighttemp: z.string(),
  daywind: z.string(),
  nightwind: z.string(),
  daypower: z.string(),
  nightpower: z.string(),
}).strict()

const travelWeatherAdviceSchema = z.object({
  summary: z.string(),
  tags: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  suggestions: z.array(z.string()),
  itineraryRules: z.array(z.string()),
}).strict()

const weatherSummarySchema = z.object({
  city: z.string(),
  adcode: z.string().optional(),
  live: weatherLiveSchema.optional(),
  forecasts: z.array(weatherForecastSchema).optional(),
  source: z.enum(["amap", "fallback"]),
  unavailableReason: z.string().optional(),
  travelAdvice: travelWeatherAdviceSchema,
}).strict()

const dayWeatherSchema = z.object({
  date: z.string().optional(),
  weather: z.string(),
  dayweather: z.string().optional(),
  nightweather: z.string().optional(),
  temperatureText: z.string(),
  windText: z.string().optional(),
  advice: z.string(),
  tags: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  suggestions: z.array(z.string()),
}).strict()

const weatherPlanContextSchema = z.object({
  summary: weatherSummarySchema,
  dayWeather: z.array(dayWeatherSchema),
}).strict()

export const plannerCandidateSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  type: candidateTypeSchema,
  city: z.string().min(1),
  district: z.string().optional(),
  address: z.string().optional(),
  rating: z.number().finite().optional(),
  price: z.number().finite().optional(),
  tags: z.array(z.string()).optional(),
  lng: z.number().finite().optional(),
  lat: z.number().finite().optional(),
  openTime: z.string().optional(),
  source: z.string().optional(),
  stayMinutes: z.number().int().positive().optional(),
}).strict()

export const plannerRouteHintSchema = z.object({
  fromPlaceId: z.string().min(1),
  toPlaceId: z.string().min(1),
  distanceMeters: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  mode: z
    .enum(["walking", "driving", "transit", "subway", "bus", "taxi", "train", "flight"])
    .optional(),
}).strict()

const structuredPlannerPreferencesSchema = z.object({
  travelerGroup: z.enum(TRAVELER_GROUPS).optional(),
  interestTags: z.array(z.enum(INTEREST_TAGS)).max(16).optional(),
  pace: z.enum(PREFERENCE_PACES).optional(),
  specialNeeds: z.array(z.enum(SPECIAL_NEEDS)).max(16).optional(),
  days: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]).optional(),
  budgetTier: z.enum(BUDGET_TIERS).optional(),
}).strict()

const plannerPreferenceTraceSchema = z.object({
  travelerGroup: z.enum(TRAVELER_GROUPS),
  pace: z.enum(PREFERENCE_PACES),
  effectivePace: z.enum(PREFERENCE_PACES),
  minMainActivitiesPerDay: z.number().int().positive(),
  targetTotalItemsPerDay: z.string().min(1),
  budgetTier: z.enum(BUDGET_TIERS),
  interestTags: z.array(z.enum(INTEREST_TAGS)),
  specialNeeds: z.array(z.enum(SPECIAL_NEEDS)),
  conflictWarnings: z.array(z.string()),
  repairApplied: z.boolean(),
}).strict()

const plannerCatalogStatsSchema = z.object({
  attractions: z.number().int().nonnegative(),
  restaurants: z.number().int().nonnegative(),
  hotels: z.number().int().nonnegative(),
}).strict()

const plannerDayCountDiagnosticSchema = z.object({
  day: z.number().int().positive(),
  dayIndex: z.number().int().positive().optional(),
  items: z.number().int().nonnegative().optional(),
  totalItems: z.number().int().nonnegative().optional(),
  spots: z.number().int().nonnegative().optional(),
  mainActivities: z.number().int().nonnegative(),
  food: z.number().int().nonnegative(),
  foodItems: z.number().int().nonnegative().optional(),
  hotel: z.number().int().nonnegative(),
  hotelItems: z.number().int().nonnegative().optional(),
  transit: z.number().int().nonnegative(),
  rest: z.number().int().nonnegative(),
  note: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
}).strict()

const plannerDroppedItemReasonsSchema = z.object({
  missingIdentity: z.number().int().nonnegative(),
  invalidType: z.number().int().nonnegative(),
  unmatchedCandidate: z.number().int().nonnegative(),
  duplicate: z.number().int().nonnegative(),
  nonMain: z.number().int().nonnegative(),
}).strict()

const plannerTokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).strict()

const plannerProviderCallMetricsSchema = z.object({
  providerStatus: z.number().int().optional(),
  providerModel: z.string().optional(),
  requestId: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
  maxTokens: z.number().int().nonnegative().optional(),
  callCount: z.number().int().nonnegative().optional(),
  usage: plannerTokenUsageSchema.optional(),
}).strict()

const plannerDiagnosticsSchema = z.object({
  requestedDays: z.number().finite().optional(),
  normalizedDays: z.number().int().positive().optional(),
  modelReturnedDays: z.number().int().nonnegative().optional(),
  finalDays: z.number().int().nonnegative().optional(),
  requestedPace: z.string().optional(),
  normalizedPace: z.string().optional(),
  targetTotalItemsPerDay: z.string().optional(),
  minMainActivitiesPerDay: z.number().int().nonnegative().optional(),
  dayRepairApplied: z.boolean().optional(),
  missingDaysRepaired: z.array(z.number().int().positive()).optional(),
  requestedPreferences: z.object({
    city: z.string(),
    totalDays: z.number().int().positive(),
    budgetRange: z.string(),
    companions: z.enum(["solo", "couple", "friends", "family", "elderly", "team"]),
    interests: z.array(z.string()),
    pace: z.enum(["fast", "balanced", "slow"]),
    specialNeeds: z.array(z.string()),
    structuredPreferences: structuredPlannerPreferencesSchema.optional(),
  }).strict().optional(),
  normalizedPreferences: plannerPreferenceTraceSchema.optional(),
  poiCatalogStats: plannerCatalogStatsSchema.optional(),
  rawModelDayCounts: z.array(plannerDayCountDiagnosticSchema).optional(),
  normalizedDayCounts: z.array(plannerDayCountDiagnosticSchema).optional(),
  finalDayCounts: z.array(plannerDayCountDiagnosticSchema).optional(),
  droppedItemReasons: plannerDroppedItemReasonsSchema.optional(),
  deepseekError: z.object({
    hasApiKey: z.boolean().optional(),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
    providerModel: z.string().optional(),
    errorType: z.string().optional(),
    statusCode: z.number().int().optional(),
    requestId: z.string().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    timeoutMs: z.number().int().nonnegative().optional(),
  }).strict().optional(),
  aiCall: plannerProviderCallMetricsSchema.optional(),
  repairApplied: z.boolean().optional(),
  repairReason: z.string().max(800).optional(),
}).strict()

export const generatedPlanSpotSchema = z.object({
  placeId: z.string().min(1),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
  stayMinutes: z.number().int().positive().optional(),
  reason: z.string().optional(),
}).strict()

export const generatedPlanSuggestionSchema = z.object({
  placeId: z.string().optional(),
  area: z.string().optional(),
  reason: z.string().optional(),
}).strict()

export const generatedPlanDaySchema = z.object({
  day: z.number().int().positive(),
  theme: z.string().min(1),
  districtSummary: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  weather: dayWeatherSchema.optional(),
  weatherAdvice: z.string().optional(),
  weatherTags: z.array(z.string()).optional(),
  spots: z.array(generatedPlanSpotSchema),
  lunch: generatedPlanSuggestionSchema.optional(),
  dinner: generatedPlanSuggestionSchema.optional(),
  hotel: generatedPlanSuggestionSchema.optional(),
  routeLegIds: z.array(z.string()).optional(),
  dayBudget: z.number().finite().nonnegative().optional(),
  warnings: z.array(z.string()).optional(),
}).strict()

export const generatedPlanSchema = z.object({
  destination: z.string().min(1),
  totalDays: z.number().int().positive(),
  totalBudget: z.number().finite().nonnegative().optional(),
  weatherSummary: weatherSummarySchema.optional(),
  days: z.array(generatedPlanDaySchema),
  droppedPlaceIds: z.array(z.string()).optional(),
  explanations: z.array(z.string()).optional(),
}).strict()

export const plannerDecisionRequestSchema = z.object({
  destination: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalDays: z.number().int().min(1).max(5),
  budgetRange: z.string().min(1),
  companions: z.enum(["solo", "couple", "friends", "family", "elderly", "team"]),
  interests: z.array(z.string()).max(16),
  pace: z.enum(["fast", "balanced", "slow"]),
  specialNeeds: z.array(z.string()).max(16),
  structuredPreferences: structuredPlannerPreferencesSchema.optional(),
  attractions: z.array(plannerCandidateSchema).max(40),
  restaurants: z.array(plannerCandidateSchema).max(80),
  hotels: z.array(plannerCandidateSchema).max(60),
  routeHints: z.array(plannerRouteHintSchema).max(180).optional(),
  manualPreferredPlaceIds: z.array(z.string()).max(20).optional(),
  weatherContext: weatherPlanContextSchema.optional(),
}).strict()

export const plannerDecisionResultSchema = z.object({
  source: z.enum(["deepseek", "fallback"]),
  plan: generatedPlanSchema,
  warnings: z.array(z.string()),
  preferenceTrace: plannerPreferenceTraceSchema.optional(),
  diagnostics: plannerDiagnosticsSchema.optional(),
}).strict()

export type PlannerDecisionRequestInput = z.infer<typeof plannerDecisionRequestSchema>
export type PlannerDecisionResultOutput = z.infer<typeof plannerDecisionResultSchema>
