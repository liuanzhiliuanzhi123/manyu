import { z } from "zod"

const deepseekPaceSchema = z.enum(["relaxed", "balanced", "intensive"])
const deepseekTransportModeSchema = z.enum(["walking", "transit", "driving", "mixed"])

export const deepseekTransportToNextSchema = z
  .object({
    mode: deepseekTransportModeSchema,
    durationMinutes: z.number().finite().nonnegative().optional(),
    distanceKm: z.number().finite().nonnegative().optional(),
    summary: z.string().max(240).optional(),
  })
  .passthrough()

export const deepseekPlanItemSchema = z
  .object({
    type: z.enum([
      "scenic",
      "spot",
      "attraction",
      "museum",
      "cultural",
      "culture",
      "temple",
      "park",
      "landmark",
      "performance",
      "exhibition",
      "art",
      "citywalk",
      "nature",
      "food",
      "restaurant",
      "hotel",
      "lodging",
      "transit",
      "rest",
      "note",
      "weather",
    ]),
    placeId: z.string().max(120).optional(),
    name: z.string().max(120).optional(),
    address: z.string().max(180).optional(),
    district: z.string().max(40).optional(),
    startTime: z.string().max(16).optional(),
    endTime: z.string().max(16).optional(),
    durationMinutes: z.number().int().positive().optional(),
    reason: z.string().max(320).optional(),
    tips: z.string().max(320).optional(),
    lat: z.number().finite().optional(),
    lng: z.number().finite().optional(),
    estimatedCost: z.number().finite().nonnegative().optional(),
    transportToNext: deepseekTransportToNextSchema.optional(),
  })
  .passthrough()

export const deepseekPlanDaySchema = z
  .object({
    dayIndex: z.number().int().positive(),
    title: z.string().min(1).max(120),
    summary: z.string().max(400).optional(),
    weather: z
      .object({
        weather: z.string().max(80).optional(),
        temperature: z.string().max(80).optional(),
        advice: z.string().max(240).optional(),
      })
      .passthrough()
      .optional(),
    items: z.array(deepseekPlanItemSchema).max(18),
  })
  .passthrough()

export const deepseekGeneratedPlanSchema = z
  .object({
    title: z.string().min(1).max(120),
    city: z.literal("北京"),
    days: z.number().int().min(1).max(5),
    pace: deepseekPaceSchema,
    budgetEstimate: z
      .object({
        total: z.number().finite().nonnegative().optional(),
        currency: z.literal("CNY").or(z.string().max(12)).default("CNY"),
        notes: z.string().max(400).optional(),
      })
      .passthrough(),
    summary: z.string().max(800).optional(),
    weatherAdvice: z
      .object({
        summary: z.string().max(400).optional(),
        tags: z.array(z.string().max(40)).max(12).default([]),
        suggestions: z.array(z.string().max(240)).max(12).default([]),
      })
      .passthrough()
      .optional(),
    daysPlan: z.array(deepseekPlanDaySchema).min(1).max(5),
    foodAndStay: z
      .object({
        lunchSuggestions: z.array(z.unknown()).max(20).default([]),
        dinnerSuggestions: z.array(z.unknown()).max(20).default([]),
        hotelSuggestions: z.array(z.unknown()).max(20).default([]),
      })
      .passthrough()
      .optional(),
    riskWarnings: z.array(z.string().max(240)).max(20).default([]),
    savePayload: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .superRefine((plan, context) => {
    if (plan.daysPlan.length !== plan.days) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daysPlan"],
        message: "daysPlan length must match days",
      })
    }
  })

export {
  generatedPlanDaySchema,
  generatedPlanSchema,
  generatedPlanSpotSchema,
  generatedPlanSuggestionSchema,
  plannerDecisionRequestSchema,
  plannerDecisionResultSchema,
  plannerRouteHintSchema,
  plannerCandidateSchema,
} from "@/lib/planner-json-schema"

export type {
  PlannerDecisionRequestInput,
  PlannerDecisionResultOutput,
} from "@/lib/planner-json-schema"

export type DeepSeekGeneratedPlan = z.infer<typeof deepseekGeneratedPlanSchema>
