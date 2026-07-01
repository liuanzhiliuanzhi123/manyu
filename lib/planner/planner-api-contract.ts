import { z } from "zod"
import {
  buildBeijingPlannerCandidates,
  filterBeijingPlannerCandidates,
  filterSupportedBeijingInterests,
  isBeijingPlannerCity,
  isBeijingPlannerCandidate,
  sanitizePlannerText,
} from "@/lib/planner/beijing-planner-context"
import {
  plannerCandidateSchema,
  plannerDecisionRequestSchema,
  type PlannerDecisionRequestInput,
} from "@/lib/planner-json-schema"
import { buildPreferencePolicy, getLegacyFieldsFromPolicy } from "@/lib/planner/preference-policy"
import {
  BUDGET_TIERS,
  INTEREST_TAGS,
  PREFERENCE_PACES,
  SPECIAL_NEEDS,
  TRAVELER_GROUPS,
} from "@/lib/planner/preference-types"

const paceSchema = z.enum(["relaxed", "balanced", "intensive"])
type InternalPace = "fast" | "balanced" | "slow"

const structuredPreferencesSchema = z
  .object({
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
  })
  .strict()

const selectedPlaceSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(120),
    type: z.enum(["scenic", "food", "hotel", "spot", "attraction", "restaurant"]).optional(),
    city: z.string().max(40).optional(),
    province: z.string().max(40).optional(),
    district: z.string().max(40).optional(),
    address: z.string().max(160).optional(),
    lat: z.number().finite().optional(),
    lng: z.number().finite().optional(),
    rating: z.number().finite().optional(),
    price: z.number().finite().optional(),
    tags: z.array(z.string().max(24)).max(8).optional(),
  })
  .strict()

const publicPlannerRequestSchema = z
  .object({
    city: z.string().min(1).max(40),
    province: z.string().max(40).optional(),
    days: z.number().int().min(1).max(5),
    budget: z
      .object({
        min: z.number().finite().nonnegative().optional(),
        max: z.number().finite().nonnegative().optional(),
      })
      .strict()
      .optional(),
    pace: paceSchema.default("balanced"),
    preferences: z.array(z.string().max(24)).max(8).default([]),
    travelerGroup: z.enum(TRAVELER_GROUPS).optional(),
    interestTags: z.array(z.enum(INTEREST_TAGS)).max(16).default([]),
    specialNeeds: z.array(z.enum(SPECIAL_NEEDS)).max(16).default([]),
    budgetTier: z.enum(BUDGET_TIERS).optional(),
    structuredPreferences: structuredPreferencesSchema.optional(),
    selectedPlaces: z.array(selectedPlaceSchema).max(20).default([]),
    startDate: z.string().max(24).optional(),
    endDate: z.string().max(24).optional(),
    travelerType: z
      .enum(["solo", "couple", "family", "elderly", "friends", "company"])
      .default("friends"),
    transportPreference: z
      .enum(["walking", "transit", "driving", "mixed"])
      .default("mixed"),
  })
  .strict()

const internalPlannerApiRequestSchema = plannerDecisionRequestSchema
  .extend({
    totalDays: z.number().int().min(1).max(5),
    interests: z.array(z.string().max(24)).max(16),
    specialNeeds: z.array(z.string().max(24)).max(16),
    attractions: z.array(plannerCandidateSchema).max(40),
    restaurants: z.array(plannerCandidateSchema).max(80),
    hotels: z.array(plannerCandidateSchema).max(60),
    routeHints: plannerDecisionRequestSchema.shape.routeHints.unwrap().max(180).optional(),
  })
  .strict()

function toBudgetRange(budget?: { min?: number; max?: number }) {
  if (!budget?.min && !budget?.max) return "3000-5000"
  if (budget.min && budget.max) return `${Math.round(budget.min)}-${Math.round(budget.max)}`
  if (budget.max) return `${Math.round(budget.max)}以内`
  return `${Math.round(budget.min || 0)}以上`
}

function mapPublicPace(pace: z.infer<typeof paceSchema>): InternalPace {
  if (pace === "relaxed") return "slow"
  if (pace === "intensive") return "fast"
  return "balanced"
}

function inferBudgetTierFromBudget(budget?: { min?: number; max?: number }) {
  const value = budget?.max ?? budget?.min
  if (!Number.isFinite(value)) return undefined
  if ((value || 0) <= 1000) return "under1000"
  if ((value || 0) <= 3000) return "budget1000to3000"
  if ((value || 0) <= 5000) return "budget3000to5000"
  if ((value || 0) <= 10000) return "budget5000to10000"
  return "over10000"
}

function specialNeedsFromTransport(transportPreference: z.infer<typeof publicPlannerRequestSchema>["transportPreference"]) {
  if (transportPreference === "transit") return ["publicTransit"]
  if (transportPreference === "driving") return ["driving"]
  return []
}

function structuredPreferencesFromPolicy(policy: ReturnType<typeof buildPreferencePolicy>) {
  const preferences = policy.normalizedPreferences
  return {
    travelerGroup: preferences.travelerGroup,
    interestTags: preferences.interestTags,
    pace: preferences.effectivePace,
    specialNeeds: preferences.specialNeeds,
    days: preferences.days,
    budgetTier: preferences.budgetTier,
  } satisfies NonNullable<PlannerDecisionRequestInput["structuredPreferences"]>
}

function selectedPlaceToCandidate(place: z.infer<typeof selectedPlaceSchema>) {
  const mappedType =
    place.type === "hotel"
      ? "hotel"
      : place.type === "food" || place.type === "restaurant"
        ? "restaurant"
        : "attraction"
  return {
    placeId: sanitizePlannerText(place.id, 120),
    name: sanitizePlannerText(place.name, 80),
    type: mappedType,
    city: "北京",
    district: sanitizePlannerText(place.district, 32) || undefined,
    address: sanitizePlannerText(place.address, 140) || undefined,
    rating: place.rating,
    price: place.price,
    tags: (place.tags || []).map((tag) => sanitizePlannerText(tag, 24)).filter(Boolean),
    lng: place.lng,
    lat: place.lat,
    source: "selected",
  } satisfies PlannerDecisionRequestInput["attractions"][number]
}

function assertBeijing(city: string, province?: string) {
  if (!isBeijingPlannerCity(city, province)) {
    throw new Error("INVALID_CITY")
  }
}

function isAllowedSelectedPlace(place: z.infer<typeof selectedPlaceSchema>) {
  const hasLocationHint = Boolean(place.city || place.province || place.address || place.district)
  if (!hasLocationHint) return true
  return isBeijingPlannerCandidate({
    city: place.city,
    province: place.province,
    address: place.address,
    district: place.district,
  })
}

export function normalizePlannerApiRequest(payload: unknown): PlannerDecisionRequestInput {
  const maybeRecord = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}

  if ("attractions" in maybeRecord || "totalDays" in maybeRecord) {
    const parsed = internalPlannerApiRequestSchema.parse(payload)
    assertBeijing(parsed.city, parsed.province)
    const policy = buildPreferencePolicy({
      travelerGroup: parsed.structuredPreferences?.travelerGroup,
      interestTags: parsed.structuredPreferences?.interestTags,
      pace: parsed.structuredPreferences?.pace,
      specialNeeds: parsed.structuredPreferences?.specialNeeds,
      days: parsed.structuredPreferences?.days,
      budgetTier: parsed.structuredPreferences?.budgetTier,
      legacy: {
        companions: parsed.companions,
        interests: parsed.interests,
        pace: parsed.pace,
        specialNeeds: parsed.specialNeeds,
        totalDays: parsed.totalDays,
        budgetRange: parsed.budgetRange,
      },
    })
    const legacyFields = getLegacyFieldsFromPolicy(policy)

    return {
      ...parsed,
      destination: sanitizePlannerText(parsed.destination, 80) || "北京智能行程",
      city: "北京",
      province: "北京",
      startDate: sanitizePlannerText(parsed.startDate, 24) || undefined,
      endDate: sanitizePlannerText(parsed.endDate, 24) || undefined,
      budgetRange: legacyFields.budgetRange,
      companions: legacyFields.companions as PlannerDecisionRequestInput["companions"],
      interests: filterSupportedBeijingInterests(legacyFields.interests, 8),
      pace: legacyFields.pace as PlannerDecisionRequestInput["pace"],
      specialNeeds: legacyFields.specialNeeds
        .map((item) => sanitizePlannerText(item, 24))
        .filter(Boolean)
        .slice(0, 8),
      structuredPreferences: structuredPreferencesFromPolicy(policy),
      attractions: filterBeijingPlannerCandidates(parsed.attractions).slice(0, 40),
      restaurants: filterBeijingPlannerCandidates(parsed.restaurants).slice(0, 80),
      hotels: filterBeijingPlannerCandidates(parsed.hotels).slice(0, 60),
      routeHints: (parsed.routeHints || []).slice(0, 180),
      manualPreferredPlaceIds: (parsed.manualPreferredPlaceIds || [])
        .map((item) => sanitizePlannerText(item, 120))
        .filter(Boolean)
        .slice(0, 20),
    }
  }

  const parsed = publicPlannerRequestSchema.parse(payload)
  assertBeijing(parsed.city, parsed.province)

  const selectedCandidates = parsed.selectedPlaces
    .filter(isAllowedSelectedPlace)
    .map(selectedPlaceToCandidate)
    .filter((item) => item.name && item.placeId)
  const selectedPlaceIds = selectedCandidates.map((item) => item.placeId)
  const context = buildBeijingPlannerCandidates({
    selectedPlaceIds,
    attractionLimit: 32,
    restaurantLimit: 60,
    hotelLimit: 40,
  })

  const attractions = filterBeijingPlannerCandidates([
    ...selectedCandidates.filter((item) => item.type === "attraction"),
    ...context.attractions,
  ]).slice(0, 40)
  const policy = buildPreferencePolicy({
    travelerGroup:
      parsed.structuredPreferences?.travelerGroup ||
      parsed.travelerGroup ||
      parsed.travelerType,
    interestTags: [
      ...(parsed.structuredPreferences?.interestTags || []),
      ...parsed.interestTags,
    ],
    pace: parsed.structuredPreferences?.pace || parsed.pace,
    specialNeeds: [
      ...(parsed.structuredPreferences?.specialNeeds || []),
      ...parsed.specialNeeds,
      ...specialNeedsFromTransport(parsed.transportPreference),
    ],
    days: parsed.structuredPreferences?.days || parsed.days,
    budgetTier:
      parsed.structuredPreferences?.budgetTier ||
      parsed.budgetTier ||
      inferBudgetTierFromBudget(parsed.budget),
    legacy: {
      companions: parsed.travelerType,
      interests: parsed.preferences,
      pace: parsed.pace,
      totalDays: parsed.days,
      budgetRange: toBudgetRange(parsed.budget),
    },
  })
  const legacyFields = getLegacyFieldsFromPolicy(policy)

  return {
    destination: `北京 ${parsed.days}日游`,
    city: "北京",
    province: "北京",
    startDate: sanitizePlannerText(parsed.startDate, 24) || undefined,
    endDate: sanitizePlannerText(parsed.endDate, 24) || undefined,
    totalDays: parsed.days,
    budgetRange: legacyFields.budgetRange,
    companions: legacyFields.companions as PlannerDecisionRequestInput["companions"],
    interests: filterSupportedBeijingInterests(legacyFields.interests, 8),
    pace: mapPublicPace(policy.normalizedPreferences.effectivePace),
    specialNeeds: legacyFields.specialNeeds,
    structuredPreferences: structuredPreferencesFromPolicy(policy),
    attractions,
    restaurants: filterBeijingPlannerCandidates([
      ...selectedCandidates.filter((item) => item.type === "restaurant"),
      ...context.restaurants,
    ]).slice(0, 80),
    hotels: filterBeijingPlannerCandidates([
      ...selectedCandidates.filter((item) => item.type === "hotel"),
      ...context.hotels,
    ]).slice(0, 60),
    routeHints: [],
    manualPreferredPlaceIds: selectedPlaceIds.slice(0, 20),
  }
}

export function toPlannerApiError(error: unknown) {
  if (error instanceof Error && error.message === "INVALID_CITY") {
    return {
      status: 400,
      code: "invalid_city",
      message: "当前北京 MVP 只支持北京行程规划。",
    }
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return {
      status: 400,
      code: "invalid_request",
      message: "规划参数不完整或格式不正确。",
    }
  }
  return {
    status: 500,
    code: "planner_failed",
    message: "智能规划暂时不可用，请稍后再试。",
  }
}

export function getPlannerRuntimeMode(hasDeepSeekApiKey: boolean) {
  return hasDeepSeekApiKey ? "deepseek" : "fallback"
}
