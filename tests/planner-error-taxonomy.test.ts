import { describe, expect, it } from "vitest"
import { classifyPlannerError } from "../lib/observability/planner-error-taxonomy"

describe("planner error taxonomy", () => {
  it("classifies provider status codes", () => {
    expect(classifyPlannerError(undefined, 402)).toBe("provider_402")
    expect(classifyPlannerError(undefined, 429)).toBe("provider_429")
    expect(classifyPlannerError(undefined, 503)).toBe("provider_503")
  })

  it("classifies timeout and network errors", () => {
    expect(classifyPlannerError({ errorType: "timeout" })).toBe("provider_timeout")
    expect(classifyPlannerError(new Error("fetch failed: network error"))).toBe("network_error")
  })

  it("classifies json and schema failures", () => {
    expect(classifyPlannerError(new Error("Model JSON parse failed."))).toBe("invalid_json")
    expect(classifyPlannerError({ name: "ZodError", message: "schema mismatch" })).toBe(
      "schema_validation_failed"
    )
  })
})
