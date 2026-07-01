import { deepseekGeneratedPlanSchema } from "@/lib/planner/plan-schema"
import { generatedPlanSchema } from "@/lib/planner-json-schema"
import type { DeepSeekGeneratedPlan } from "@/lib/planner/plan-schema"
import type { GeneratedPlan } from "@/lib/planner-types"

export function cleanJsonObjectText(raw: string) {
  const text = raw.trim()
  if (!text) return ""

  const withoutFence = text
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim()

  if (withoutFence.startsWith("{") && withoutFence.endsWith("}")) {
    return withoutFence
  }

  const first = withoutFence.indexOf("{")
  if (first < 0) return ""

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = first; i < withoutFence.length; i += 1) {
    const ch = withoutFence[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === "\\") {
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === "{") depth += 1
    if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        return withoutFence.slice(first, i + 1)
      }
    }
  }

  return ""
}

export function parseGeneratedPlanJson(raw: string): GeneratedPlan {
  const jsonText = cleanJsonObjectText(raw)
  if (!jsonText) {
    throw new Error("Model did not return a JSON object.")
  }

  let payload: unknown
  try {
    payload = JSON.parse(jsonText)
  } catch {
    throw new Error("Model JSON parse failed.")
  }

  return generatedPlanSchema.parse(payload)
}

export function parseDeepSeekPlanJson(raw: string): DeepSeekGeneratedPlan {
  const jsonText = cleanJsonObjectText(raw)
  if (!jsonText) {
    throw new Error("Model did not return a JSON object.")
  }

  let payload: unknown
  try {
    payload = JSON.parse(jsonText)
  } catch {
    throw new Error("Model JSON parse failed.")
  }

  return deepseekGeneratedPlanSchema.parse(payload)
}
