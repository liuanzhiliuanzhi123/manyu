import { describe, expect, it } from "vitest"
import { estimateDeepSeekCost } from "../lib/observability/planner-cost"

describe("planner cost estimate", () => {
  it("returns zero when model pricing is not configured", () => {
    const result = estimateDeepSeekCost({
      model: "deepseek-v4-flash",
      promptTokens: 1000,
      completionTokens: 2000,
    })

    expect(result.amount).toBe(0)
    expect(result.currency).toBe("CNY")
    expect(result.note).toContain("pricing_not_configured")
  })

  it("returns zero for unknown models without inventing prices", () => {
    const result = estimateDeepSeekCost({
      model: "unknown-model",
      promptTokens: 1000,
      completionTokens: 2000,
    })

    expect(result.amount).toBe(0)
    expect(result.note).toContain("pricing_not_configured")
  })
})
