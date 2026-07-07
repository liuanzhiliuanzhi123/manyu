import { describe, expect, it } from "vitest"
import { plannerEvalCases } from "../lib/evals/planner-eval-cases"
import { runOfflinePlannerEvalCase } from "../lib/evals/planner-evaluator"

const BEIJING = "\u5317\u4eac"

describe("planner eval cases", () => {
  it("defines at least 10 stable Beijing MVP scenarios", () => {
    expect(plannerEvalCases.length).toBeGreaterThanOrEqual(10)
    expect(new Set(plannerEvalCases.map((item) => item.id)).size).toBe(plannerEvalCases.length)
  })

  it("gives every case required request and expectation fields", () => {
    for (const evalCase of plannerEvalCases) {
      expect(evalCase.id).toBeTruthy()
      expect(evalCase.name).toBeTruthy()
      expect(evalCase.description).toBeTruthy()
      expect(evalCase.request.city).toBe(BEIJING)
      expect(evalCase.request.days).toBeGreaterThanOrEqual(1)
      expect(evalCase.expectations.expectedDays).toBe(evalCase.request.days)
      expect(evalCase.expectations.minMainActivitiesPerDay).toBeGreaterThanOrEqual(1)
    }
  })

  it("runs representative offline eval without DeepSeek configuration", () => {
    const previousKey = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY

    const result = runOfflinePlannerEvalCase(plannerEvalCases[0])

    if (previousKey !== undefined) process.env.DEEPSEEK_API_KEY = previousKey
    expect(result.metrics.finalDays).toBe(plannerEvalCases[0].expectations.expectedDays)
    expect(result.hardFailures).toEqual([])
  })
})
