import { describe, expect, it } from "vitest"
import { deepseekGeneratedPlanSchema } from "../lib/planner/plan-schema"
import { normalizePlannerApiRequest } from "../lib/planner/planner-api-contract"
import { buildPreferencePolicyFromRequest } from "../lib/planner/preference-policy"
import {
  isMainActivityItem,
  normalizePlannerItemType,
} from "../lib/planner/main-activity"
import {
  repairGeneratedPlanWithPolicy,
  validateGeneratedPlanAgainstPolicy,
} from "../lib/planner/plan-repair"
import { buildFallbackGeneratedPlan } from "../lib/planner/fallback-planner"
import { buildAiItinerary } from "../lib/route-planner"
import type { GeneratedPlan } from "../lib/planner-types"
import type { Spot } from "../lib/travel-context"

function requestForPace(pace: "relaxed" | "balanced" | "intensive") {
  return normalizePlannerApiRequest({
    city: "北京",
    days: 2,
    pace,
    selectedPlaces: [],
    travelerType: "friends",
    transportPreference: "mixed",
  })
}

function emptySpotsPlan(request: ReturnType<typeof normalizePlannerApiRequest>): GeneratedPlan {
  return {
    destination: "北京",
    totalDays: request.totalDays,
    days: Array.from({ length: request.totalDays }, (_, index) => ({
      day: index + 1,
      theme: "food and hotel only",
      spots: [],
      lunch: { placeId: request.restaurants[0]?.placeId },
      dinner: { placeId: request.restaurants[1]?.placeId || request.restaurants[0]?.placeId },
      hotel: { placeId: request.hotels[0]?.placeId },
    })),
    droppedPlaceIds: [],
    explanations: [],
  }
}

function spot(id: string, name: string): Spot {
  return {
    id,
    name,
    type: "attraction",
    rootCategory: "scenic",
    address: "北京市东城区",
    rating: 4.8,
    heat: 90,
    ticketPrice: 0,
    description: "北京测试景点",
    image: "/images/placeholders/poi-default.jpg",
    tags: ["北京", "历史人文"],
    city: "北京",
    province: "北京",
    suggestedDurationMinutes: 120,
    suggestedDurationText: "2小时",
  }
}

describe("planner main activity policy", () => {
  it("counts museum, cultural, park, and landmark as main activities", () => {
    expect(isMainActivityItem({ type: "museum" })).toBe(true)
    expect(isMainActivityItem({ type: "cultural" })).toBe(true)
    expect(isMainActivityItem({ type: "park" })).toBe(true)
    expect(isMainActivityItem({ type: "landmark" })).toBe(true)
    expect(isMainActivityItem({ rootCategory: "scenic", type: "note" })).toBe(true)
  })

  it("does not count food, hotel, transit, rest, note, or weather as main activities", () => {
    for (const type of ["food", "restaurant", "hotel", "lodging", "transit", "rest", "note", "weather"]) {
      expect(isMainActivityItem({ type })).toBe(false)
    }
    expect(normalizePlannerItemType({ type: "shopping", name: "historic market" })).toBe("landmark")
    expect(normalizePlannerItemType({ type: "shopping", name: "generic shop" })).toBe("shopping")
  })

  it("accepts DeepSeek main activity aliases in the schema", () => {
    const parsed = deepseekGeneratedPlanSchema.parse({
      title: "北京智能行程",
      city: "北京",
      days: 1,
      pace: "balanced",
      budgetEstimate: { currency: "CNY" },
      daysPlan: [
        {
          dayIndex: 1,
          title: "museum day",
          items: [
            { type: "museum", placeId: "museum-1", name: "Museum" },
            { type: "cultural", placeId: "culture-1", name: "Culture" },
            { type: "park", placeId: "park-1", name: "Park" },
          ],
        },
      ],
    })

    expect(parsed.daysPlan[0].items.map((item) => item.type)).toEqual([
      "museum",
      "cultural",
      "park",
    ])
  })

  it("rejects food/hotel-only days and repairs them with scenic activities", () => {
    const request = normalizePlannerApiRequest({
      city: "北京",
      days: 1,
      pace: "balanced",
      selectedPlaces: [
        {
          id: "food-only-selected",
          name: "北京餐厅",
          rootCategory: "food",
          type: "food",
          city: "北京",
        },
        {
          id: "hotel-only-selected",
          name: "北京酒店",
          rootCategory: "hotel",
          type: "hotel",
          city: "北京",
        },
      ],
    })
    const policy = buildPreferencePolicyFromRequest(request)
    const plan = emptySpotsPlan(request)
    const errors = validateGeneratedPlanAgainstPolicy(plan, request, policy).filter(
      (issue) => issue.level === "error"
    )

    expect(errors.map((issue) => issue.id)).toContain("missing_main_activity_timeline")

    const repaired = repairGeneratedPlanWithPolicy(plan, request, policy)
    const repairedErrors = validateGeneratedPlanAgainstPolicy(repaired.plan, request, policy).filter(
      (issue) => issue.level === "error"
    )

    expect(repaired.repairApplied).toBe(true)
    expect(repaired.plan.days[0].spots.length).toBeGreaterThanOrEqual(
      policy.hardConstraints.minMainActivitiesPerDay
    )
    expect(repaired.plan.days[0].spots[0].arrivalTime).toMatch(/^\d{2}:\d{2}$/)
    expect(repairedErrors).toEqual([])
  })

  it("enforces relaxed, balanced, and intensive minimum main activity counts", () => {
    const cases = [
      { pace: "relaxed", min: 1 },
      { pace: "balanced", min: 2 },
      { pace: "intensive", min: 3 },
    ] as const

    for (const item of cases) {
      const request = requestForPace(item.pace)
      const policy = buildPreferencePolicyFromRequest(request)
      const repaired = repairGeneratedPlanWithPolicy(emptySpotsPlan(request), request, policy)

      expect(policy.hardConstraints.minMainActivitiesPerDay).toBe(item.min)
      repaired.plan.days.forEach((day) => {
        expect(day.spots.length).toBeGreaterThanOrEqual(item.min)
      })
    }
  })

  it("supplements scenic candidates when selectedPlaces is empty or only restaurant", () => {
    const empty = normalizePlannerApiRequest({
      city: "北京",
      days: 1,
      selectedPlaces: [],
    })
    const foodOnly = normalizePlannerApiRequest({
      city: "北京",
      days: 1,
      selectedPlaces: [
        {
          id: "food-only-selected",
          name: "北京餐厅",
          rootCategory: "food",
          type: "food",
          city: "北京",
        },
      ],
    })

    expect(empty.attractions.length).toBeGreaterThan(0)
    expect(foodOnly.attractions.length).toBeGreaterThan(0)
    expect(foodOnly.attractions.every((item) => item.type === "attraction")).toBe(true)
  })

  it("keeps fallback final plans free of zero-main-activity days", () => {
    const request = requestForPace("intensive")
    const policy = buildPreferencePolicyFromRequest(request)
    const fallback = buildFallbackGeneratedPlan(request)
    const errors = validateGeneratedPlanAgainstPolicy(fallback.plan, request, policy).filter(
      (issue) => issue.level === "error"
    )

    expect(errors).toEqual([])
    fallback.plan.days.forEach((day) => {
      expect(day.spots.length).toBeGreaterThan(0)
    })
  })

  it("uses final main activities for route legs when a forced day is empty", async () => {
    const spots = [spot("a", "A景点"), spot("b", "B景点"), spot("c", "C景点")]
    const result = await buildAiItinerary({
      spots,
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      pace: "balanced",
      departure: "",
      requirement: {
        province: "北京",
        city: "北京",
        days: 2,
        budgetRange: "3000-5000",
        companions: "friends",
        interests: ["历史人文"],
        pace: "balanced",
        specialNeeds: [],
      },
      forcedDaySpotIds: [["a", "b"], []],
    })

    expect(result.days).toHaveLength(2)
    expect(result.days.every((day) => day.spots.length > 0)).toBe(true)
    expect(result.days[0].routeLegs.map((leg) => [leg.fromName, leg.toName])).toEqual([
      ["A景点", "B景点"],
    ])
  })
})
