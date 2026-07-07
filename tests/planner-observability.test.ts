import { describe, expect, it } from "vitest"
import {
  assertPlannerObservabilityTextIsSafe,
  buildPlannerObservabilityReport,
  createPlannerRunLog,
  redactPlannerLog,
  renderPlannerObservabilityMarkdown,
  summarizePlannerRuns,
} from "../lib/observability/planner-run-logger"
import type { PlannerDecisionRequestInput, PlannerDecisionResultOutput } from "../lib/planner-json-schema"

const request: PlannerDecisionRequestInput = {
  destination: "Beijing 2 day trip",
  city: "Beijing",
  province: "Beijing",
  totalDays: 2,
  budgetRange: "3000-5000",
  companions: "friends",
  interests: ["history"],
  pace: "balanced",
  specialNeeds: [],
  structuredPreferences: {
    travelerGroup: "friends",
    interestTags: ["history"],
    pace: "balanced",
    specialNeeds: [],
    days: 2,
    budgetTier: "budget3000to5000",
  },
  attractions: [
    {
      placeId: "a1",
      name: "Selected Scenic",
      type: "attraction",
      city: "Beijing",
      source: "selected",
    },
    {
      placeId: "a2",
      name: "Catalog Scenic",
      type: "attraction",
      city: "Beijing",
      source: "catalog",
    },
  ],
  restaurants: [
    {
      placeId: "f1",
      name: "Selected Food",
      type: "restaurant",
      city: "Beijing",
      source: "selected",
    },
  ],
  hotels: [
    {
      placeId: "h1",
      name: "Selected Hotel",
      type: "hotel",
      city: "Beijing",
      source: "selected",
    },
  ],
  routeHints: [],
  manualPreferredPlaceIds: ["a1", "f1", "h1"],
}

const result: PlannerDecisionResultOutput = {
  source: "deepseek",
  plan: {
    destination: "Beijing",
    totalDays: 2,
    days: [
      {
        day: 1,
        theme: "Day 1",
        spots: [{ placeId: "a1" }],
        lunch: { placeId: "f1" },
        hotel: { placeId: "h1" },
      },
      {
        day: 2,
        theme: "Day 2",
        spots: [{ placeId: "a2" }],
        dinner: { placeId: "f1" },
        hotel: { placeId: "h1" },
      },
    ],
    droppedPlaceIds: [],
    explanations: [],
  },
  warnings: [],
  preferenceTrace: {
    travelerGroup: "friends",
    pace: "balanced",
    effectivePace: "balanced",
    minMainActivitiesPerDay: 1,
    targetTotalItemsPerDay: "3-4",
    budgetTier: "budget3000to5000",
    interestTags: ["history"],
    specialNeeds: [],
    conflictWarnings: [],
    repairApplied: false,
  },
  diagnostics: {
    requestedDays: 2,
    finalDays: 2,
    requestedPace: "balanced",
    normalizedPace: "balanced",
    finalDayCounts: [
      {
        day: 1,
        totalItems: 3,
        mainActivities: 1,
        food: 1,
        foodItems: 1,
        hotel: 1,
        hotelItems: 1,
        transit: 0,
        rest: 0,
        note: 0,
        unknown: 0,
      },
      {
        day: 2,
        totalItems: 3,
        mainActivities: 1,
        food: 1,
        foodItems: 1,
        hotel: 1,
        hotelItems: 1,
        transit: 0,
        rest: 0,
        note: 0,
        unknown: 0,
      },
    ],
    aiCall: {
      providerStatus: 200,
      providerModel: "deepseek-v4-flash",
      durationMs: 1200,
      timeoutMs: 45000,
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
    },
    repairApplied: false,
  },
}

describe("planner observability", () => {
  it("creates a stable safe run summary without raw selected place content", () => {
    const log = createPlannerRunLog({
      request,
      result,
      id: "run-1",
      createdAt: "2026-07-07T00:00:00.000Z",
      environment: "test",
      durationMs: 1300,
    })

    expect(log.id).toBe("run-1")
    expect(log.source).toBe("deepseek")
    expect(log.errorType).toBe("none")
    expect(log.selectedPlaceCount).toBe(3)
    expect(log.selectedScenicCount).toBe(1)
    expect(log.selectedFoodCount).toBe(1)
    expect(log.selectedHotelCount).toBe(1)
    expect(log.usage?.totalTokens).toBe(300)
    expect(JSON.stringify(log)).not.toContain("Selected Scenic")
    expect(JSON.stringify(log)).not.toContain("Selected Food")
  })

  it("redacts sensitive keys and values", () => {
    const fakeApiKeyAssignment = ["api", "key=fake_test_value"].join("_")
    const fakeSessionAssignment = ["session", "fake_test_value"].join("=")
    const log = createPlannerRunLog({
      request,
      result,
      id: "run-2",
      createdAt: "2026-07-07T00:00:00.000Z",
      environment: "test",
      durationMs: 1300,
    })
    const redacted = redactPlannerLog({
      ...log,
      fullPrompt: fakeApiKeyAssignment,
      nested: {
        session: fakeSessionAssignment,
      },
    } as never)
    const text = JSON.stringify(redacted)

    expect(text).not.toContain(fakeApiKeyAssignment)
    expect(text).not.toContain(fakeSessionAssignment)
  })

  it("summarizes rates and durations", () => {
    const deepseekLog = createPlannerRunLog({
      request,
      result,
      id: "run-3",
      createdAt: "2026-07-07T00:00:00.000Z",
      environment: "test",
      durationMs: 1000,
    })
    const fallbackLog = {
      ...deepseekLog,
      id: "run-4",
      source: "fallback" as const,
      fallback: true,
      repairApplied: true,
      durationMs: 2000,
      errorType: "provider_402" as const,
    }

    const summary = summarizePlannerRuns([deepseekLog, fallbackLog])

    expect(summary.totalRuns).toBe(2)
    expect(summary.fallbackRate).toBe(0.5)
    expect(summary.repairRate).toBe(0.5)
    expect(summary.averageDurationMs).toBe(1500)
    expect(summary.errorCounts.provider_402).toBe(1)
  })

  it("renders safe markdown reports", () => {
    const log = createPlannerRunLog({
      request,
      result,
      id: "run-5",
      createdAt: "2026-07-07T00:00:00.000Z",
      environment: "test",
      durationMs: 1300,
    })
    const report = buildPlannerObservabilityReport([log], undefined, "2026-07-07T00:00:00.000Z")
    const markdown = renderPlannerObservabilityMarkdown(report)
    const fakeApiKeyAssignment = ["api", "key=fake_test_value"].join("_")

    expect(markdown).toContain("fallbackRate")
    expect(() => assertPlannerObservabilityTextIsSafe(markdown)).not.toThrow()
    expect(() => assertPlannerObservabilityTextIsSafe(fakeApiKeyAssignment)).toThrow()
  })
})
