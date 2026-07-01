import { describe, expect, it } from "vitest"
import {
  deepseekGeneratedPlanSchema,
  generatedPlanSchema,
} from "../lib/planner/plan-schema"
import {
  cleanJsonObjectText,
  parseDeepSeekPlanJson,
  parseGeneratedPlanJson,
} from "../lib/planner/plan-validator"
import {
  buildBeijingPlannerCandidates,
  filterBeijingPlannerCandidates,
} from "../lib/planner/beijing-planner-context"
import { buildFallbackGeneratedPlan } from "../lib/planner/fallback-planner"
import {
  getPlannerRuntimeMode,
  normalizePlannerApiRequest,
} from "../lib/planner/planner-api-contract"
import {
  buildPreferencePolicy,
  buildPreferencePolicyFromRequest,
} from "../lib/planner/preference-policy"
import {
  repairGeneratedPlanWithPolicy,
  validateGeneratedPlanAgainstPolicy,
} from "../lib/planner/plan-repair"
import { checkRateLimit, type RateLimitState } from "../lib/planner/rate-limit"
import { mapTravelPlanToSavedTrip } from "../lib/travel-data/mappers"
import type { GeneratedPlan } from "../lib/planner-types"
import type { ItineraryDay, Spot, TripPlan } from "../lib/travel-context"

function minimalGeneratedPlan() {
  return {
    destination: "北京",
    totalDays: 1,
    totalBudget: 600,
    days: [
      {
        day: 1,
        theme: "故宫与中轴线",
        spots: [
          {
            placeId: "forbidden-city",
            stayMinutes: 180,
            reason: "符合历史人文偏好",
          },
        ],
      },
    ],
    droppedPlaceIds: [],
    explanations: ["仅使用北京候选池。"],
  }
}

function minimalDeepSeekPlan() {
  return {
    title: "北京智能行程",
    city: "北京",
    days: 1,
    pace: "balanced",
    budgetEstimate: {
      total: 600,
      currency: "CNY",
      notes: "预算按北京一日游估算。",
    },
    summary: "围绕故宫与中轴线规划。",
    weatherAdvice: {
      summary: "适合城市漫步。",
      tags: ["城市漫步友好"],
      suggestions: ["午后注意补水。"],
    },
    daysPlan: [
      {
        dayIndex: 1,
        title: "故宫与中轴线",
        summary: "历史人文路线。",
        weather: {
          weather: "多云",
          temperature: "15-28℃",
          advice: "适合步行。",
        },
        items: [
          {
            type: "scenic",
            placeId: "forbidden-city",
            name: "故宫博物院",
            district: "东城区",
            startTime: "09:00",
            endTime: "12:00",
            durationMinutes: 180,
            reason: "符合历史人文偏好",
          },
        ],
      },
    ],
    foodAndStay: {
      lunchSuggestions: [],
      dinnerSuggestions: [],
      hotelSuggestions: [],
    },
    riskWarnings: [],
    savePayload: {},
  }
}

function spot(overrides: Partial<Spot> & Pick<Spot, "id" | "name">): Spot {
  return {
    type: "attraction",
    address: "北京市东城区",
    rating: 4.8,
    heat: 90,
    ticketPrice: 60,
    description: "北京测试地点",
    image: "/images/placeholders/poi-default.jpg",
    tags: ["北京", "历史人文"],
    city: "北京",
    province: "北京",
    ...overrides,
  }
}

describe("DeepSeek planner schema and JSON cleaning", () => {
  it("validates the strict internal generated plan schema", () => {
    expect(generatedPlanSchema.parse(minimalGeneratedPlan()).destination).toBe("北京")
  })

  it("validates the DeepSeek structured plan schema", () => {
    expect(deepseekGeneratedPlanSchema.parse(minimalDeepSeekPlan()).city).toBe("北京")
  })

  it("rejects a DeepSeek plan when daysPlan length does not match days", () => {
    expect(() =>
      deepseekGeneratedPlanSchema.parse({
        ...minimalDeepSeekPlan(),
        days: 2,
      })
    ).toThrow()
  })

  it("cleans markdown fences and parses JSON object output", () => {
    const raw = `\n\`\`\`json\n${JSON.stringify(minimalGeneratedPlan())}\n\`\`\`\n`
    const cleaned = cleanJsonObjectText(raw)
    expect(cleaned.startsWith("{")).toBe(true)
    expect(parseGeneratedPlanJson(raw).totalDays).toBe(1)
  })

  it("parses DeepSeek JSON output after cleaning markdown fences", () => {
    const raw = `\`\`\`json\n${JSON.stringify(minimalDeepSeekPlan())}\n\`\`\``
    expect(parseDeepSeekPlanJson(raw).title).toBe("北京智能行程")
  })
})

describe("北京 MVP planner request constraints", () => {
  it("filters non-Beijing candidates before model planning", () => {
    const filtered = filterBeijingPlannerCandidates([
      {
        placeId: "bj-1",
        name: "故宫博物院",
        type: "attraction",
        city: "北京",
      },
      {
        placeId: "sh-1",
        name: "外滩",
        type: "attraction",
        city: "上海",
      },
    ])

    expect(filtered.map((item) => item.placeId)).toEqual(["bj-1"])
  })

  it("normalizes public request body into internal planner input", () => {
    const request = normalizePlannerApiRequest({
      city: "北京",
      days: 3,
      budget: { min: 500, max: 1500 },
      pace: "relaxed",
      preferences: ["历史人文", "不支持的偏好"],
      selectedPlaces: [
        {
          id: "forbidden-city",
          name: "故宫博物院",
          type: "scenic",
          city: "北京",
          address: "北京市东城区景山前街4号",
        },
      ],
      travelerType: "friends",
      transportPreference: "transit",
    })

    expect(request.city).toBe("北京")
    expect(request.totalDays).toBe(3)
    expect(request.pace).toBe("slow")
    expect(request.interests).toEqual(["历史人文"])
    expect(request.structuredPreferences?.pace).toBe("relaxed")
    expect(request.structuredPreferences?.specialNeeds).toContain("publicTransit")
    expect(request.manualPreferredPlaceIds).toEqual(["forbidden-city"])
  })

  it("normalizes structured preference payloads into legacy planner fields", () => {
    const request = normalizePlannerApiRequest({
      city: "北京",
      days: 2,
      pace: "balanced",
      preferences: ["城市漫步"],
      travelerGroup: "family",
      interestTags: ["nature", "food"],
      specialNeeds: ["kidFriendly", "lessWalking"],
      budgetTier: "budget1000to3000",
      transportPreference: "mixed",
    })

    expect(request.companions).toBe("family")
    expect(request.pace).toBe("balanced")
    expect(request.budgetRange).toBe("1000-3000")
    expect(request.interests).toEqual(expect.arrayContaining(["自然风光", "美食打卡"]))
    expect(request.specialNeeds).toEqual(expect.arrayContaining(["适合小孩", "少走路"]))
    expect(request.structuredPreferences).toMatchObject({
      travelerGroup: "family",
      pace: "balanced",
      budgetTier: "budget1000to3000",
    })
  })

  it("drops selected places with explicit non-Beijing location hints", () => {
    const request = normalizePlannerApiRequest({
      city: "北京",
      days: 1,
      selectedPlaces: [
        {
          id: "sh-bund",
          name: "外滩",
          type: "scenic",
          city: "上海",
          address: "上海市黄浦区",
        },
      ],
    })

    expect(request.manualPreferredPlaceIds).toEqual([])
    expect(request.attractions.some((item) => item.placeId === "sh-bund")).toBe(false)
  })

  it("rejects non-Beijing planner requests", () => {
    expect(() =>
      normalizePlannerApiRequest({
        city: "上海",
        days: 2,
        preferences: ["历史人文"],
      })
    ).toThrow("INVALID_CITY")
  })

  it("rejects public requests over 5 days or 20 selected places", () => {
    expect(() =>
      normalizePlannerApiRequest({
        city: "北京",
        days: 6,
        selectedPlaces: [],
      })
    ).toThrow()

    expect(() =>
      normalizePlannerApiRequest({
        city: "北京",
        days: 2,
        selectedPlaces: Array.from({ length: 21 }, (_, index) => ({
          id: `poi-${index}`,
          name: `北京地点${index}`,
          type: "scenic",
        })),
      })
    ).toThrow()
  })

  it("builds Beijing fallback candidate pools", () => {
    const context = buildBeijingPlannerCandidates({ attractionLimit: 5 })
    expect(context.attractions.length).toBeGreaterThan(0)
    expect(context.attractions.every((item) => item.city === "北京")).toBe(true)
  })
})

describe("preference policy and repair", () => {
  it("downgrades unsafe conflict combinations while keeping a safe trace", () => {
    const elderly = buildPreferencePolicy({
      travelerGroup: "elderly",
      pace: "intensive",
      specialNeeds: ["elderlyFriendly"],
      interestTags: ["history"],
      days: 2,
      budgetTier: "budget3000to5000",
    })
    expect(elderly.normalizedPreferences.effectivePace).toBe("relaxed")
    expect(elderly.conflictWarnings.length).toBeGreaterThan(0)
    expect(elderly.preferenceTrace).not.toHaveProperty("email")

    const familyNight = buildPreferencePolicy({
      travelerGroup: "family",
      pace: "balanced",
      specialNeeds: ["kidFriendly"],
      interestTags: ["nightlife"],
      days: 2,
      budgetTier: "budget3000to5000",
    })
    expect(familyNight.conflictWarnings.join(" ")).toContain("亲子")

    const budgetComfort = buildPreferencePolicy({
      travelerGroup: "friends",
      pace: "balanced",
      specialNeeds: ["lowBudget", "hotelComfort"],
      interestTags: ["food"],
      days: 2,
      budgetTier: "over10000",
    })
    expect(budgetComfort.conflictWarnings.join(" ")).toContain("低预算")
  })

  it("repairs sparse model plans to satisfy daily preference constraints", () => {
    const request = normalizePlannerApiRequest({
      city: "北京",
      days: 1,
      pace: "intensive",
      interestTags: ["history", "food"],
      specialNeeds: ["foodPriority"],
      budgetTier: "budget3000to5000",
    })
    const policy = buildPreferencePolicyFromRequest(request)
    const sparsePlan: GeneratedPlan = {
      destination: "北京",
      totalDays: 1,
      days: [
        {
          day: 1,
          theme: "模型少点位路线",
          spots: [{ placeId: request.attractions[0].placeId }],
        },
      ],
      droppedPlaceIds: [],
      explanations: [],
    }

    const repaired = repairGeneratedPlanWithPolicy(sparsePlan, request, policy)
    const errors = validateGeneratedPlanAgainstPolicy(repaired.plan, request, policy).filter(
      (issue) => issue.level === "error"
    )

    expect(repaired.repairApplied).toBe(true)
    expect(repaired.plan.days[0].spots.length).toBeGreaterThanOrEqual(3)
    expect(repaired.plan.days[0].lunch?.placeId).toBeTruthy()
    expect(repaired.plan.days[0].dinner?.placeId).toBeTruthy()
    expect(repaired.plan.days[0].hotel?.placeId).toBeTruthy()
    expect(errors).toEqual([])
  })

  it("keeps fallback plans inside the preference policy for key Beijing MVP combinations", () => {
    const combinations = [
      { travelerGroup: "friends", pace: "intensive", interestTags: ["history", "food"], specialNeeds: ["foodPriority"] },
      { travelerGroup: "friends", pace: "relaxed", interestTags: ["citywalk"], specialNeeds: ["lessWalking"] },
      { travelerGroup: "family", pace: "balanced", interestTags: ["familyFun", "nature"], specialNeeds: ["kidFriendly"] },
      { travelerGroup: "elderly", pace: "balanced", interestTags: ["history"], specialNeeds: ["elderlyFriendly"] },
      { travelerGroup: "friends", pace: "balanced", interestTags: ["museum"], specialNeeds: ["lowBudget"], budgetTier: "under1000" },
      { travelerGroup: "couple", pace: "relaxed", interestTags: ["vacation"], specialNeeds: ["hotelComfort"], budgetTier: "over10000" },
      { travelerGroup: "friends", pace: "intensive", interestTags: ["nightlife", "food"], specialNeeds: [] },
      { travelerGroup: "solo", pace: "balanced", interestTags: ["citywalk"], specialNeeds: ["publicTransit"] },
      { travelerGroup: "friends", pace: "balanced", interestTags: ["nature"], specialNeeds: ["driving"] },
    ] as const

    for (const preferences of combinations) {
      const request = normalizePlannerApiRequest({
        city: "北京",
        days: 2,
        structuredPreferences: {
          days: 2,
          budgetTier: "budget3000to5000",
          ...preferences,
        },
      })
      const policy = buildPreferencePolicyFromRequest(request)
      const fallback = buildFallbackGeneratedPlan(request)
      const errors = validateGeneratedPlanAgainstPolicy(fallback.plan, request, policy).filter(
        (issue) => issue.level === "error"
      )

      expect(errors).toEqual([])
      fallback.plan.days.forEach((day) => {
        expect(day.spots.length).toBeGreaterThanOrEqual(
          policy.hardConstraints.minMainActivitiesPerDay
        )
      })
    }
  })
})

describe("fallback planner and rate limit", () => {
  it("generates a deterministic Beijing fallback plan", () => {
    const request = normalizePlannerApiRequest({
      city: "北京",
      days: 2,
      budget: { min: 500, max: 1500 },
      pace: "balanced",
      preferences: ["历史人文"],
      selectedPlaces: [],
      travelerType: "friends",
      transportPreference: "mixed",
    })

    const fallback = buildFallbackGeneratedPlan(request)

    expect(fallback.plan.totalDays).toBe(2)
    expect(fallback.plan.days).toHaveLength(2)
    expect(fallback.plan.days.flatMap((day) => day.spots).length).toBeGreaterThan(0)
  })

  it("limits requests inside a rolling window", () => {
    const store = new Map<string, RateLimitState>()
    expect(checkRateLimit(store, "ip:test", { limit: 2, windowMs: 60_000, now: 0 }).allowed).toBe(true)
    expect(checkRateLimit(store, "ip:test", { limit: 2, windowMs: 60_000, now: 1 }).allowed).toBe(true)
    expect(checkRateLimit(store, "ip:test", { limit: 2, windowMs: 60_000, now: 2 }).allowed).toBe(false)
    expect(checkRateLimit(store, "ip:test", { limit: 2, windowMs: 60_000, now: 60_001 }).allowed).toBe(true)
  })

  it("uses fallback mode when DeepSeek key is missing", () => {
    expect(getPlannerRuntimeMode(false)).toBe("fallback")
    expect(getPlannerRuntimeMode(true)).toBe("deepseek")
  })
})

describe("planner save mapper", () => {
  it("maps generated itinerary into Supabase saved trip payload", () => {
    const day: ItineraryDay = {
      day: 1,
      title: "第1天",
      startTime: "09:00",
      endTime: "17:00",
      spots: [spot({ id: "forbidden-city", name: "故宫博物院" })],
      routeLegs: [],
      totalDistanceMeters: 0,
      totalTravelSeconds: 0,
      totalPlayMinutes: 180,
      totalEstimatedCost: 60,
    }
    const plan: TripPlan = {
      id: "local-plan",
      name: "北京智能行程",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      pace: "轻松适中",
      departure: "酒店",
      spots: day.spots,
      createdAt: "2026-06-30T00:00:00.000Z",
      days: [day],
      totalDays: 1,
      generatedPlan: minimalGeneratedPlan() as GeneratedPlan,
    }

    const mapped = mapTravelPlanToSavedTrip(plan, "00000000-0000-4000-8000-000000000000")

    expect(mapped.savedTrip.city).toBe("北京")
    expect(mapped.tripDays).toHaveLength(1)
    expect(mapped.tripItems.some((item) => item.name === "故宫博物院")).toBe(true)
  })
})
