import { buildFallbackGeneratedPlan } from "@/lib/planner/fallback-planner"
import { normalizePlannerApiRequest } from "@/lib/planner/planner-api-contract"
import type { PlannerCandidate } from "@/lib/planner-types"
import { evaluatePlannerEvalCase } from "@/lib/evals/planner-eval-rules"
import type {
  PlannerEvalCase,
  PlannerEvalMode,
  PlannerEvalPlannerOutput,
  PlannerEvalResult,
} from "@/lib/evals/planner-eval-types"

function candidateCatalogFromRequest(request: ReturnType<typeof normalizePlannerApiRequest>) {
  return [
    ...request.attractions,
    ...request.restaurants,
    ...request.hotels,
  ] satisfies PlannerCandidate[]
}

function getSafeLiveErrorType(status: number, bodyText: string) {
  if (status === 402) return "billing_or_quota"
  if (status === 429) return "rate_limited"
  if (status >= 500) return "server_error"
  if (bodyText.includes("FUNCTION_INVOCATION_TIMEOUT")) return "function_timeout"
  return "http_status"
}

export function runOfflinePlannerEvalCase(evalCase: PlannerEvalCase): PlannerEvalResult {
  const startedAt = Date.now()
  try {
    const request = normalizePlannerApiRequest(evalCase.request)
    const fallback = buildFallbackGeneratedPlan(request)
    const output: PlannerEvalPlannerOutput = {
      mode: "offline",
      source: "fallback",
      plan: fallback.plan,
      warnings: fallback.warnings,
      candidateCatalog: candidateCatalogFromRequest(request),
      diagnostics: {
        finalDays: fallback.plan.days.length,
        repairApplied: fallback.warnings.length > 0,
      },
      durationMs: Date.now() - startedAt,
    }
    return evaluatePlannerEvalCase(evalCase, output)
  } catch (error) {
    const output: PlannerEvalPlannerOutput = {
      mode: "offline",
      source: "error",
      errorType: error instanceof Error ? error.message : "unknown",
      durationMs: Date.now() - startedAt,
    }
    return evaluatePlannerEvalCase(evalCase, output)
  }
}

export async function runLivePlannerEvalCase(
  evalCase: PlannerEvalCase,
  input?: {
    baseUrl?: string
  }
): Promise<PlannerEvalResult> {
  const startedAt = Date.now()
  const baseUrl = (input?.baseUrl || process.env.PLANNER_EVAL_BASE_URL || "https://manyu-self.vercel.app")
    .trim()
    .replace(/\/+$/u, "")

  let candidateCatalog: PlannerCandidate[] = []
  try {
    const request = normalizePlannerApiRequest(evalCase.request)
    candidateCatalog = candidateCatalogFromRequest(request)
  } catch {
    candidateCatalog = []
  }

  try {
    const response = await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evalCase.request),
    })
    const bodyText = await response.text()
    if (!response.ok) {
      const output: PlannerEvalPlannerOutput = {
        mode: "live",
        source: "error",
        statusCode: response.status,
        errorType: getSafeLiveErrorType(response.status, bodyText),
        candidateCatalog,
        durationMs: Date.now() - startedAt,
      }
      return evaluatePlannerEvalCase(evalCase, output)
    }

    const payload = JSON.parse(bodyText) as {
      ok?: boolean
      data?: PlannerEvalPlannerOutput
      meta?: {
        source?: "deepseek" | "fallback"
        fallback?: boolean
      }
    }

    if (!payload.ok || !payload.data?.plan) {
      const output: PlannerEvalPlannerOutput = {
        mode: "live",
        source: "error",
        errorType: "invalid_live_response",
        candidateCatalog,
        durationMs: Date.now() - startedAt,
      }
      return evaluatePlannerEvalCase(evalCase, output)
    }

    const output: PlannerEvalPlannerOutput = {
      mode: "live",
      source: payload.data.source || payload.meta?.source || "fallback",
      plan: payload.data.plan,
      warnings: payload.data.warnings,
      diagnostics: payload.data.diagnostics,
      candidateCatalog,
      durationMs: Date.now() - startedAt,
    }
    return evaluatePlannerEvalCase(evalCase, output)
  } catch (error) {
    const output: PlannerEvalPlannerOutput = {
      mode: "live",
      source: "error",
      errorType: error instanceof Error ? error.name || error.message : "unknown",
      candidateCatalog,
      durationMs: Date.now() - startedAt,
    }
    return evaluatePlannerEvalCase(evalCase, output)
  }
}

export async function runPlannerEvalCase(
  evalCase: PlannerEvalCase,
  mode: PlannerEvalMode,
  input?: {
    baseUrl?: string
  }
) {
  if (mode === "live") return runLivePlannerEvalCase(evalCase, input)
  return runOfflinePlannerEvalCase(evalCase)
}

