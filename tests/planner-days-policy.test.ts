import { describe, expect, it } from "vitest"
import { buildAiItinerary } from "../lib/route-planner"
import { buildFallbackGeneratedPlan } from "../lib/planner/fallback-planner"
import {
  assertDaysPlanMatchesRequest,
  buildMissingDayIndexes,
  normalizeRequestedDays,
} from "../lib/planner/days-policy"
import { normalizePlannerApiRequest } from "../lib/planner/planner-api-contract"
import { buildPreferencePolicyFromRequest } from "../lib/planner/preference-policy"
import {
  repairGeneratedPlanWithPolicy,
  validateGeneratedPlanAgainstPolicy,
} from "../lib/planner/plan-repair"
import type { GeneratedPlan } from "../lib/planner-types"
import type { Spot } from "../lib/travel-context"

function makeSpot(index: number): Spot {
  return {
    id: `spot-${index}`,
    name: `Spot ${index}`,
    type: "attraction",
    rootCategory: "scenic",
    address: "Beijing test district",
    rating: 4.8,
    heat: 90,
    ticketPrice: 0,
    description: "Beijing route test spot",
    image: "/images/placeholders/poi-default.jpg",
    tags: ["history"],
    city: "鍖椾含",
    province: "鍖椾含",
    district: "test",
    suggestedDurationMinutes: 90,
    suggestedDurationText: "90 min",
  }
}

describe("planner day and pace hard constraints", () => {
  it("normalizes requested days without collapsing a 4-day request", () => {
    expect(normalizeRequestedDays({ days: 4 }).normalizedDays).toBe(4)
    expect(normalizeRequestedDays({ totalDays: 4 }).normalizedDays).toBe(4)
    expect(normalizeRequestedDays({ days: 8 })).toMatchObject({
      requestedDays: 8,
      normalizedDays: 5,
      adjusted: true,
    })
  })

  it("detects missing day indexes before display or save", () => {
    const oneDayPlan = { daysPlan: [{ dayIndex: 1 }] }

    expect(buildMissingDayIndexes(oneDayPlan, 4)).toEqual([2, 3, 4])
    expect(() => assertDaysPlanMatchesRequest(oneDayPlan, 4)).toThrow()
  })

  it("keeps 4-day intensive food-only requests with enough scenic candidates", () => {
    const request = normalizePlannerApiRequest({
      city: "鍖椾含",
      days: 4,
      pace: "intensive",
      travelerType: "solo",
      interestTags: ["history", "nature", "food", "nightlife"],
      budgetTier: "budget5000to10000",
      selectedPlaces: [
        { id: "food-1", name: "Food 1", rootCategory: "food", type: "food", city: "鍖椾含" },
        { id: "food-2", name: "Food 2", rootCategory: "food", type: "food", city: "鍖椾含" },
        { id: "food-3", name: "Food 3", rootCategory: "food", type: "food", city: "鍖椾含" },
      ],
    })

    expect(request.totalDays).toBe(4)
    expect(request.structuredPreferences?.days).toBe(4)
    expect(request.structuredPreferences?.pace).toBe("intensive")
    expect(request.attractions.length).toBeGreaterThanOrEqual(12)
    expect(request.attractions.every((item) => item.type === "attraction")).toBe(true)
  })

  it("repairs a one-day model output into the requested 4-day intensive plan", () => {
    const request = normalizePlannerApiRequest({
      city: "鍖椾含",
      days: 4,
      pace: "intensive",
      travelerType: "solo",
      interestTags: ["history", "nature", "food", "nightlife"],
      budgetTier: "budget5000to10000",
      selectedPlaces: [],
    })
    const policy = buildPreferencePolicyFromRequest(request)
    const sparsePlan: GeneratedPlan = {
      destination: "鍖椾含",
      totalDays: 1,
      days: [
        {
          day: 1,
          theme: "Model returned only one day",
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
    expect(repaired.missingDaysRepaired).toEqual([2, 3, 4])
    expect(repaired.plan.totalDays).toBe(4)
    expect(repaired.plan.days).toHaveLength(4)
    repaired.plan.days.forEach((day) => {
      expect(day.spots.length).toBeGreaterThanOrEqual(3)
      expect(
        day.spots.length +
          Number(Boolean(day.lunch?.placeId)) +
          Number(Boolean(day.dinner?.placeId)) +
          Number(Boolean(day.hotel?.placeId))
      ).toBeGreaterThanOrEqual(4)
    })
    expect(errors).toEqual([])
  })

  it("generates a 4-day intensive fallback plan without compressing days", () => {
    const request = normalizePlannerApiRequest({
      city: "鍖椾含",
      days: 4,
      pace: "intensive",
      interestTags: ["history", "nature", "food", "nightlife"],
      selectedPlaces: [],
    })
    const fallback = buildFallbackGeneratedPlan(request)

    expect(fallback.plan.totalDays).toBe(4)
    expect(fallback.plan.days).toHaveLength(4)
    fallback.plan.days.forEach((day) => {
      expect(day.spots.length).toBeGreaterThanOrEqual(3)
    })
  })

  it("keeps forced 4-day result tabs when building display itinerary", async () => {
    const spots = Array.from({ length: 12 }, (_, index) => makeSpot(index + 1))
    const result = await buildAiItinerary({
      spots,
      startDate: "2026-07-01",
      endDate: "2026-07-04",
      pace: "intensive",
      departure: "",
      requirement: {
        province: "鍖椾含",
        city: "鍖椾含",
        days: 4,
        budgetRange: "5000-10000",
        companions: "solo",
        interests: ["history"],
        pace: "fast",
        specialNeeds: [],
      },
      forcedDaySpotIds: [
        ["spot-1", "spot-2", "spot-3"],
        ["spot-4", "spot-5", "spot-6"],
        ["spot-7", "spot-8", "spot-9"],
        ["spot-10", "spot-11", "spot-12"],
      ],
    })

    expect(result.days).toHaveLength(4)
    expect(result.totalDays).toBe(4)
    expect(result.days.map((day) => day.day)).toEqual([1, 2, 3, 4])
    expect(result.days.every((day) => day.spots.length >= 3)).toBe(true)
  })
})

