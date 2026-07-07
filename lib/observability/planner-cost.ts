import type { EstimatedPlannerCost } from "@/lib/observability/planner-observability-types"

interface DeepSeekCostInput {
  model?: string
  promptTokens?: number
  completionTokens?: number
}

interface ModelPricing {
  currency: "CNY" | "USD"
  inputPer1M: number
  outputPer1M: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "deepseek-v4-flash": {
    currency: "CNY",
    inputPer1M: 0,
    outputPer1M: 0,
  },
  "deepseek-v4-pro": {
    currency: "CNY",
    inputPer1M: 0,
    outputPer1M: 0,
  },
}

function safeTokenCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export function estimateDeepSeekCost(input: DeepSeekCostInput): EstimatedPlannerCost {
  const pricing = input.model ? MODEL_PRICING[input.model] : undefined
  if (!pricing || pricing.inputPer1M <= 0 || pricing.outputPer1M <= 0) {
    return {
      currency: pricing?.currency || "CNY",
      amount: 0,
      note:
        "pricing_not_configured; estimate_only; actual_costs_follow_provider_invoice",
    }
  }

  const promptTokens = safeTokenCount(input.promptTokens)
  const completionTokens = safeTokenCount(input.completionTokens)
  const amount =
    (promptTokens / 1_000_000) * pricing.inputPer1M +
    (completionTokens / 1_000_000) * pricing.outputPer1M

  return {
    currency: pricing.currency,
    amount: Number(amount.toFixed(6)),
    note: "estimate_only; actual_costs_follow_provider_invoice",
  }
}
