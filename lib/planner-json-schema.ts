import { z } from "zod"

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
  totalDays: z.number().int().positive().max(14),
  budgetRange: z.string().min(1),
  companions: z.enum(["solo", "couple", "friends", "family", "elderly", "team"]),
  interests: z.array(z.string()).max(16),
  pace: z.enum(["fast", "balanced", "slow"]),
  specialNeeds: z.array(z.string()).max(16),
  attractions: z.array(plannerCandidateSchema),
  restaurants: z.array(plannerCandidateSchema),
  hotels: z.array(plannerCandidateSchema),
  routeHints: z.array(plannerRouteHintSchema).optional(),
  manualPreferredPlaceIds: z.array(z.string()).optional(),
  weatherContext: weatherPlanContextSchema.optional(),
}).strict()

export const plannerDecisionResultSchema = z.object({
  source: z.enum(["qwen", "fallback"]),
  plan: generatedPlanSchema,
  warnings: z.array(z.string()),
}).strict()

export type PlannerDecisionRequestInput = z.infer<typeof plannerDecisionRequestSchema>
export type PlannerDecisionResultOutput = z.infer<typeof plannerDecisionResultSchema>
