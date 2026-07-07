import { describe, expect, it } from "vitest"
import { evaluatePlannerEvalCase } from "../lib/evals/planner-eval-rules"
import {
  assertPlannerEvalReportIsSafe,
  buildPlannerEvalReport,
  renderPlannerEvalMarkdown,
} from "../lib/evals/planner-eval-report"
import type { PlannerEvalCase, PlannerEvalPlannerOutput } from "../lib/evals/planner-eval-types"
import type { GeneratedPlan, PlannerCandidate } from "../lib/planner-types"

const BEIJING = "\u5317\u4eac"

function candidate(
  placeId: string,
  type: PlannerCandidate["type"],
  city = BEIJING
): PlannerCandidate {
  return {
    placeId,
    name: placeId,
    type,
    city,
    tags: ["history"],
  }
}

const baseCase: PlannerEvalCase = {
  id: "unit_case",
  name: "Unit case",
  description: "Unit test case",
  request: {
    city: BEIJING,
    days: 2,
    selectedPlaces: [],
    pace: "balanced",
  },
  expectations: {
    expectedDays: 2,
    minMainActivitiesPerDay: 1,
    targetTotalItemsPerDay: { min: 2, max: 5 },
    mustHaveFoodSuggestions: true,
    mustHaveHotelSuggestions: true,
    mustStayInBeijing: true,
    noFoodAsMainActivity: true,
    noHotelAsMainActivity: true,
  },
}

function plan(days: GeneratedPlan["days"]): GeneratedPlan {
  return {
    destination: BEIJING,
    totalDays: days.length,
    days,
    droppedPlaceIds: [],
    explanations: [],
  }
}

function output(planInput: GeneratedPlan, catalog: PlannerCandidate[]): PlannerEvalPlannerOutput {
  return {
    mode: "offline",
    source: "fallback",
    plan: planInput,
    candidateCatalog: catalog,
    diagnostics: {
      finalDays: planInput.days.length,
    },
  }
}

describe("planner eval rules", () => {
  it("scores a valid summarized plan deterministically", () => {
    const result = evaluatePlannerEvalCase(
      baseCase,
      output(
        plan([
          {
            day: 1,
            theme: "day 1",
            spots: [{ placeId: "a1" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
          {
            day: 2,
            theme: "day 2",
            spots: [{ placeId: "a2" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
        ]),
        [
          candidate("a1", "attraction"),
          candidate("a2", "attraction"),
          candidate("f1", "restaurant"),
          candidate("h1", "hotel"),
        ]
      )
    )

    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
    expect(result.metrics.mainActivitiesPerDay).toEqual([1, 1])
  })

  it("detects day count mismatch and missing main activities", () => {
    const result = evaluatePlannerEvalCase(
      baseCase,
      output(
        plan([
          {
            day: 1,
            theme: "bad day",
            spots: [],
          },
        ]),
        []
      )
    )

    expect(result.passed).toBe(false)
    expect(result.hardFailures).toEqual(
      expect.arrayContaining([
        "final_days_mismatch",
        "days_plan_length_mismatch",
        "insufficient_main_activities",
        "zero_main_activity_day",
      ])
    )
  })

  it("detects food and hotel used as main activities", () => {
    const result = evaluatePlannerEvalCase(
      baseCase,
      output(
        plan([
          {
            day: 1,
            theme: "food as main",
            spots: [{ placeId: "f1" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
          {
            day: 2,
            theme: "hotel as main",
            spots: [{ placeId: "h1" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
        ]),
        [candidate("f1", "restaurant"), candidate("h1", "hotel")]
      )
    )

    expect(result.passed).toBe(false)
    expect(result.hardFailures).toEqual(
      expect.arrayContaining(["food_as_main_activity", "hotel_as_main_activity"])
    )
  })

  it("detects non-Beijing or unknown POIs", () => {
    const result = evaluatePlannerEvalCase(
      baseCase,
      output(
        plan([
          {
            day: 1,
            theme: "bad city",
            spots: [{ placeId: "sh-1" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
          {
            day: 2,
            theme: "unknown",
            spots: [{ placeId: "unknown" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
        ]),
        [
          candidate("sh-1", "attraction", "Shanghai"),
          candidate("f1", "restaurant"),
          candidate("h1", "hotel"),
        ]
      )
    )

    expect(result.metrics.nonBeijingItems).toBeGreaterThan(0)
    expect(result.hardFailures).toContain("non_beijing_or_unknown_poi")
  })

  it("renders safe reports without sensitive fields", () => {
    const result = evaluatePlannerEvalCase(
      baseCase,
      output(
        plan([
          {
            day: 1,
            theme: "day 1",
            spots: [{ placeId: "a1" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
          {
            day: 2,
            theme: "day 2",
            spots: [{ placeId: "a2" }],
            lunch: { placeId: "f1" },
            dinner: { placeId: "f1" },
            hotel: { placeId: "h1" },
          },
        ]),
        [
          candidate("a1", "attraction"),
          candidate("a2", "attraction"),
          candidate("f1", "restaurant"),
          candidate("h1", "hotel"),
        ]
      )
    )
    const report = buildPlannerEvalReport([result], "offline", "2026-07-07T00:00:00.000Z")
    const markdown = renderPlannerEvalMarkdown(report)

    expect(() => assertPlannerEvalReportIsSafe(JSON.stringify(report))).not.toThrow()
    expect(() => assertPlannerEvalReportIsSafe(markdown)).not.toThrow()
    expect(() => assertPlannerEvalReportIsSafe("api_key=secret")).toThrow()
  })
})

