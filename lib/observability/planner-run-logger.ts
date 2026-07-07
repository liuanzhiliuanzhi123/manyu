import { randomUUID } from "node:crypto"
import { estimateDeepSeekCost } from "@/lib/observability/planner-cost"
import {
  classifyPlannerError,
  getPlannerErrorRecommendation,
  type PlannerErrorType,
} from "@/lib/observability/planner-error-taxonomy"
import type {
  EstimatedPlannerCost,
  PlannerFinalDayCount,
  PlannerObservabilityReport,
  PlannerProviderCallMetrics,
  PlannerQualitySignals,
  PlannerRunEnvironment,
  PlannerRunLog,
  PlannerRunSummary,
  PlannerTokenUsage,
} from "@/lib/observability/planner-observability-types"
import type { PlannerDecisionRequestInput, PlannerDecisionResultOutput } from "@/lib/planner-json-schema"
import type { PlannerDayCountDiagnostic } from "@/lib/planner-types"

export const LOCAL_PLANNER_RUN_LOG_PATH = "reports/planner-runs.local.jsonl"
export const PLANNER_OBSERVABILITY_JSON_PATH = "reports/planner-observability-report.json"
export const PLANNER_OBSERVABILITY_MARKDOWN_PATH = "reports/planner-observability-report.md"

interface CreatePlannerRunLogInput {
  request: PlannerDecisionRequestInput
  result: PlannerDecisionResultOutput
  startedAt?: number
  durationMs?: number
  createdAt?: string
  id?: string
  environment?: PlannerRunEnvironment
}

const REPORT_NOTES = [
  "Cost is an estimate only. Actual costs must be checked in the provider invoice.",
  "Reports do not store API keys, tokens, sessions, full prompts, or full model responses.",
  "Vercel serverless local file writes are not long-term persistence.",
]

const REPORTS_DIR = "reports"
const LOCAL_PLANNER_RUN_LOG_FILE = "planner-runs.local.jsonl"
const PLANNER_OBSERVABILITY_JSON_FILE = "planner-observability-report.json"
const PLANNER_OBSERVABILITY_MARKDOWN_FILE = "planner-observability-report.md"

async function loadNodeFileModules() {
  const [fs, nodePath] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ])
  return { fs, nodePath }
}

function getReportFileName(filePath: string, fallback: string) {
  return filePath.replace(/\\/gu, "/").split("/").filter(Boolean).pop() || fallback
}

const FAILURE_TYPES: PlannerErrorType[] = [
  "provider_402",
  "provider_429",
  "provider_timeout",
  "invalid_json",
  "schema_validation_failed",
  "repair_failed",
]

const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|authorization|bearer|secret|service[_-]?role|access[_-]?token|refresh[_-]?token|session|jwt|email|user[_-]?id|full[_-]?prompt|full[_-]?response|raw[_-]?(model)?[_-]?(output|response)|localstorage)/iu

const SENSITIVE_TEXT_PATTERNS = [
  /api[_-]?key\s*[:=]\s*["']?[^,\s"']+/iu,
  /authorization\s*[:=]\s*["']?[^,\n]+/iu,
  /bearer\s+[a-z0-9._-]{10,}/iu,
  /service[_-]?role[_-]?key\s*[:=]/iu,
  /access[_-]?token\s*[:=]\s*["']?[^,\s"']+/iu,
  /refresh[_-]?token\s*[:=]\s*["']?[^,\s"']+/iu,
  /session\s*[:=]\s*["']?[a-z0-9._-]{10,}/iu,
  /jwt\s*[:=]\s*["']?[^,\s"']+/iu,
  /full[_-]?prompt\s*[:=]/iu,
  /full[_-]?response\s*[:=]/iu,
  /raw[_-]?(model)?[_-]?(output|response)\s*[:=]/iu,
  /email\s*[:=]\s*["']?[^@\s"']+@[^,\s"']+/iu,
  /user[_-]?id\s*[:=]\s*["']?[a-f0-9-]{8,}/iu,
]

function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Number((numerator / denominator).toFixed(4))
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)
  return sorted[Math.max(0, index)]
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function getPlannerEnvironment(): PlannerRunEnvironment {
  if (process.env.NODE_ENV === "test") return "test"
  if (process.env.VERCEL_ENV === "production") return "production"
  if (process.env.VERCEL_ENV === "preview") return "preview"
  return "development"
}

function selectedCounts(request: PlannerDecisionRequestInput) {
  const preferredIds = new Set(request.manualPreferredPlaceIds || [])
  const isSelected = (item: { placeId: string; source?: string }) =>
    item.source === "selected" || preferredIds.has(item.placeId)
  const selectedScenicCount = request.attractions.filter(isSelected).length
  const selectedFoodCount = request.restaurants.filter(isSelected).length
  const selectedHotelCount = request.hotels.filter(isSelected).length
  return {
    selectedScenicCount,
    selectedFoodCount,
    selectedHotelCount,
    selectedPlaceCount: selectedScenicCount + selectedFoodCount + selectedHotelCount,
  }
}

function dayCountToLog(day: PlannerDayCountDiagnostic): PlannerFinalDayCount {
  const foodItems = day.foodItems ?? day.food ?? 0
  const hotelItems = day.hotelItems ?? day.hotel ?? 0
  const mainActivities = day.mainActivities ?? day.spots ?? 0
  return {
    dayIndex: day.dayIndex ?? day.day,
    totalItems: day.totalItems ?? mainActivities + foodItems + hotelItems,
    mainActivities,
    foodItems,
    hotelItems,
  }
}

function buildDayCounts(result: PlannerDecisionResultOutput) {
  if (result.diagnostics?.finalDayCounts?.length) {
    return result.diagnostics.finalDayCounts.map(dayCountToLog)
  }

  return result.plan.days.map((day) => {
    const foodItems = Number(Boolean(day.lunch?.placeId)) + Number(Boolean(day.dinner?.placeId))
    const hotelItems = Number(Boolean(day.hotel?.placeId))
    return {
      dayIndex: day.day,
      totalItems: day.spots.length + foodItems + hotelItems,
      mainActivities: day.spots.length,
      foodItems,
      hotelItems,
    }
  })
}

function normalizeUsage(usage?: PlannerTokenUsage): PlannerTokenUsage | undefined {
  const promptTokens = safeNumber(usage?.promptTokens)
  const completionTokens = safeNumber(usage?.completionTokens)
  const totalTokens = safeNumber(usage?.totalTokens)
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}

function getProviderCall(result: PlannerDecisionResultOutput): PlannerProviderCallMetrics | undefined {
  return result.diagnostics?.aiCall
}

function getErrorType(result: PlannerDecisionResultOutput): PlannerErrorType {
  const diagnostics = result.diagnostics
  const classified = classifyPlannerError(
    diagnostics?.deepseekError,
    diagnostics?.deepseekError?.statusCode ?? diagnostics?.aiCall?.providerStatus
  )
  if (classified !== "none") return classified
  if (result.source === "fallback") return "fallback_used"
  return "none"
}

export function createPlannerRunLog(input: CreatePlannerRunLogInput): PlannerRunLog {
  const diagnostics = input.result.diagnostics
  const providerCall = getProviderCall(input.result)
  const usage = normalizeUsage(providerCall?.usage)
  const errorType = getErrorType(input.result)
  const selected = selectedCounts(input.request)
  const repairApplied =
    diagnostics?.repairApplied ?? input.result.preferenceTrace?.repairApplied ?? false
  const durationMs =
    safeNumber(input.durationMs) ??
    (input.startedAt ? Math.max(0, Date.now() - input.startedAt) : undefined) ??
    providerCall?.durationMs ??
    0

  const log: PlannerRunLog = {
    id: input.id || randomUUID(),
    createdAt: input.createdAt || new Date().toISOString(),
    environment: input.environment || getPlannerEnvironment(),
    source: input.result.source,
    fallback: input.result.source === "fallback",
    fallbackReason:
      input.result.source === "fallback"
        ? diagnostics?.repairReason || diagnostics?.deepseekError?.errorType || "fallback_used"
        : undefined,
    repairApplied,
    repairReason: diagnostics?.repairReason,
    errorType,
    providerStatus: diagnostics?.deepseekError?.statusCode ?? providerCall?.providerStatus,
    providerModel:
      providerCall?.providerModel || diagnostics?.deepseekError?.providerModel || diagnostics?.deepseekError?.model,
    durationMs,
    timeoutMs: providerCall?.timeoutMs ?? diagnostics?.deepseekError?.timeoutMs,
    requestedDays: diagnostics?.requestedDays ?? input.request.totalDays,
    finalDays: diagnostics?.finalDays ?? input.result.plan.days.length,
    requestedPace: diagnostics?.requestedPace ?? input.request.pace,
    normalizedPace: diagnostics?.normalizedPace ?? input.result.preferenceTrace?.effectivePace,
    travelerGroup:
      input.request.structuredPreferences?.travelerGroup || input.result.preferenceTrace?.travelerGroup,
    budgetTier: input.request.structuredPreferences?.budgetTier || input.result.preferenceTrace?.budgetTier,
    interestTagCount:
      input.request.structuredPreferences?.interestTags?.length ?? input.request.interests.length,
    specialNeedCount:
      input.request.structuredPreferences?.specialNeeds?.length ?? input.request.specialNeeds.length,
    selectedPlaceCount: selected.selectedPlaceCount,
    selectedScenicCount: selected.selectedScenicCount,
    selectedFoodCount: selected.selectedFoodCount,
    selectedHotelCount: selected.selectedHotelCount,
    finalDayCounts: buildDayCounts(input.result),
    usage,
    estimatedCost: estimateDeepSeekCost({
      model: providerCall?.providerModel || diagnostics?.deepseekError?.providerModel,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
    }),
    safeDiagnostics: {
      hasApiKey: diagnostics?.deepseekError?.hasApiKey,
      usedFallbackPlanner: input.result.source === "fallback",
      usedRepair: repairApplied,
      schemaValidated: input.result.source === "deepseek" && errorType === "none",
      rateLimited: errorType === "rate_limited" || errorType === "provider_429",
    },
  }

  return redactPlannerLog(log)
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue)
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      return SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(value)) ? "[redacted]" : value
    }
    return value
  }

  const redacted: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue
    redacted[key] = redactValue(child)
  }
  return redacted
}

export function redactPlannerLog(log: PlannerRunLog): PlannerRunLog {
  return redactValue(log) as PlannerRunLog
}

function toConsoleSummary(log: PlannerRunLog) {
  return {
    id: log.id,
    environment: log.environment,
    source: log.source,
    fallback: log.fallback,
    errorType: log.errorType,
    providerStatus: log.providerStatus,
    providerModel: log.providerModel,
    durationMs: log.durationMs,
    requestedDays: log.requestedDays,
    finalDays: log.finalDays,
    repairApplied: log.repairApplied,
    usage: log.usage,
  }
}

export async function writePlannerRunLog(log: PlannerRunLog): Promise<void> {
  const redacted = redactPlannerLog(log)

  if (redacted.environment === "production" || redacted.environment === "preview") {
    if (process.env.NODE_ENV !== "test") {
      console.info("[planner-observability]", JSON.stringify(toConsoleSummary(redacted)))
    }
    return
  }

  try {
    const { fs, nodePath } = await loadNodeFileModules()
    const absolutePath = nodePath.join(process.cwd(), REPORTS_DIR, LOCAL_PLANNER_RUN_LOG_FILE)
    await fs.mkdir(nodePath.dirname(absolutePath), { recursive: true })
    await fs.appendFile(absolutePath, `${JSON.stringify(redacted)}\n`, "utf8")
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[planner-observability] local log write skipped", {
        errorType: classifyPlannerError(error),
      })
    }
  }
}

export async function readPlannerRunLogs(filePath = LOCAL_PLANNER_RUN_LOG_PATH) {
  const { fs, nodePath } = await loadNodeFileModules()
  const fileName = getReportFileName(filePath, LOCAL_PLANNER_RUN_LOG_FILE)
  const absolutePath = nodePath.join(process.cwd(), REPORTS_DIR, fileName)
  try {
    await fs.access(absolutePath)
  } catch {
    return [] as PlannerRunLog[]
  }

  const text = await fs.readFile(absolutePath, "utf8")
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [redactPlannerLog(JSON.parse(line) as PlannerRunLog)]
      } catch {
        return []
      }
    })
}

function countErrors(logs: PlannerRunLog[]) {
  return logs.reduce<Partial<Record<PlannerErrorType, number>>>((counts, log) => {
    const errorType = log.errorType || "none"
    counts[errorType] = (counts[errorType] || 0) + 1
    return counts
  }, {})
}

function summarizeQuality(logs: PlannerRunLog[]): PlannerQualitySignals {
  const allDays = logs.flatMap((log) => log.finalDayCounts)
  const mainActivities = allDays.map((day) => day.mainActivities)
  const totalItems = allDays.map((day) => day.totalItems)

  return {
    averageFinalDays: average(logs.map((log) => log.finalDays)),
    daysMismatchCount: logs.filter((log) => log.requestedDays !== log.finalDays).length,
    zeroMainActivityDayCount: allDays.filter((day) => day.mainActivities <= 0).length,
    averageMainActivitiesPerDay: average(mainActivities),
    averageTotalItemsPerDay: average(totalItems),
  }
}

function sumEstimatedCost(logs: PlannerRunLog[]): EstimatedPlannerCost {
  const configuredCosts = logs
    .map((log) => log.estimatedCost)
    .filter((cost): cost is EstimatedPlannerCost => Boolean(cost))
  const amount = configuredCosts.reduce((sum, cost) => sum + cost.amount, 0)
  const hasConfiguredAmount = configuredCosts.some((cost) => cost.amount > 0)
  return {
    currency: configuredCosts[0]?.currency || "CNY",
    amount: Number(amount.toFixed(6)),
    note: hasConfiguredAmount
      ? "estimate_only; actual_costs_follow_provider_invoice"
      : "pricing_not_configured; estimate_only; actual_costs_follow_provider_invoice",
  }
}

export function summarizePlannerRuns(logs: PlannerRunLog[]): PlannerRunSummary {
  const totalRuns = logs.length
  const deepseekRuns = logs.filter((log) => log.source === "deepseek").length
  const fallbackRuns = logs.filter((log) => log.fallback).length
  const repairAppliedRuns = logs.filter((log) => log.repairApplied).length
  const durations = logs.map((log) => log.durationMs).filter((duration) => duration >= 0)

  return {
    totalRuns,
    deepseekRuns,
    fallbackRuns,
    fallbackRate: ratio(fallbackRuns, totalRuns),
    repairAppliedRuns,
    repairRate: ratio(repairAppliedRuns, totalRuns),
    averageDurationMs: average(durations),
    p95DurationMs: percentile(durations, 0.95),
    errorCounts: countErrors(logs),
    averagePromptTokens: average(logs.map((log) => log.usage?.promptTokens || 0)),
    averageCompletionTokens: average(logs.map((log) => log.usage?.completionTokens || 0)),
    averageTotalTokens: average(logs.map((log) => log.usage?.totalTokens || 0)),
    estimatedTotalCost: sumEstimatedCost(logs),
    qualitySignals: summarizeQuality(logs),
  }
}

function buildRecommendations(summary: PlannerRunSummary): string[] {
  const recommendations: string[] = []
  if (summary.fallbackRate > 0.2) {
    recommendations.push("Fallback rate is elevated. Check DeepSeek availability and error counts.")
  }
  if (summary.repairRate > 0.2) {
    recommendations.push("Repair rate is elevated. Review prompt constraints and candidate quality.")
  }
  for (const errorType of FAILURE_TYPES) {
    if ((summary.errorCounts[errorType] || 0) > 0) {
      const recommendation = getPlannerErrorRecommendation(errorType)
      if (recommendation) recommendations.push(recommendation)
    }
  }
  if (summary.qualitySignals.daysMismatchCount > 0) {
    recommendations.push("Day mismatches were observed. Review the day-count validator.")
  }
  if (summary.qualitySignals.zeroMainActivityDayCount > 0) {
    recommendations.push("Zero-main-activity days were observed. Review candidate repair rules.")
  }
  if (recommendations.length === 0) {
    recommendations.push("No immediate observability action is required.")
  }
  return Array.from(new Set(recommendations))
}

export function buildPlannerObservabilityReport(
  logs: PlannerRunLog[],
  evalReport?: PlannerObservabilityReport["evalReport"],
  generatedAt = new Date().toISOString()
): PlannerObservabilityReport {
  const summary = summarizePlannerRuns(logs)
  const failureAnalysis = FAILURE_TYPES.reduce<Partial<Record<PlannerErrorType, number>>>(
    (counts, type) => {
      counts[type] = summary.errorCounts[type] || 0
      return counts
    },
    {}
  )

  return {
    title: "Planner Observability Report",
    generatedAt,
    summary,
    failureAnalysis,
    recommendations: buildRecommendations(summary),
    evalReport,
    notes: REPORT_NOTES,
  }
}

export function renderPlannerObservabilityMarkdown(report: PlannerObservabilityReport) {
  const summary = report.summary
  const quality = summary.qualitySignals
  const errorRows = Object.entries(summary.errorCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `- ${type}: ${count}`)
    .join("\n")

  const failureRows = FAILURE_TYPES.map(
    (type) => `- ${type}: ${report.failureAnalysis[type] || 0}`
  ).join("\n")

  return [
    "# Planner Observability Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- totalRuns: ${summary.totalRuns}`,
    `- deepseekRuns: ${summary.deepseekRuns}`,
    `- fallbackRuns: ${summary.fallbackRuns}`,
    `- fallbackRate: ${summary.fallbackRate}`,
    `- repairAppliedRuns: ${summary.repairAppliedRuns}`,
    `- repairRate: ${summary.repairRate}`,
    `- averageDurationMs: ${summary.averageDurationMs}`,
    `- p95DurationMs: ${summary.p95DurationMs}`,
    `- averagePromptTokens: ${summary.averagePromptTokens}`,
    `- averageCompletionTokens: ${summary.averageCompletionTokens}`,
    `- averageTotalTokens: ${summary.averageTotalTokens}`,
    `- estimatedTotalCost: ${summary.estimatedTotalCost.amount} ${summary.estimatedTotalCost.currency}`,
    `- estimatedCostNote: ${summary.estimatedTotalCost.note}`,
    "",
    "## Error Counts",
    "",
    errorRows || "- none: 0",
    "",
    "## Failure Analysis",
    "",
    failureRows,
    "",
    "## Quality Signals",
    "",
    `- averageFinalDays: ${quality.averageFinalDays}`,
    `- daysMismatchCount: ${quality.daysMismatchCount}`,
    `- zeroMainActivityDayCount: ${quality.zeroMainActivityDayCount}`,
    `- averageMainActivitiesPerDay: ${quality.averageMainActivitiesPerDay}`,
    `- averageTotalItemsPerDay: ${quality.averageTotalItemsPerDay}`,
    "",
    "## Eval Report",
    "",
    report.evalReport
      ? [
          `- mode: ${report.evalReport.mode || "unknown"}`,
          `- totalCases: ${report.evalReport.totalCases ?? 0}`,
          `- passedCases: ${report.evalReport.passedCases ?? 0}`,
          `- failedCases: ${report.evalReport.failedCases ?? 0}`,
          `- averageScore: ${report.evalReport.averageScore ?? 0}`,
          `- hardFailureCount: ${report.evalReport.hardFailureCount ?? 0}`,
          `- fallbackCount: ${report.evalReport.fallbackCount ?? 0}`,
          `- repairAppliedCount: ${report.evalReport.repairAppliedCount ?? 0}`,
        ].join("\n")
      : "- No eval report was found.",
    "",
    "## Recommendations",
    "",
    report.recommendations.map((item) => `- ${item}`).join("\n"),
    "",
    "## Notes",
    "",
    report.notes.map((item) => `- ${item}`).join("\n"),
    "",
  ].join("\n")
}

export function assertPlannerObservabilityTextIsSafe(text: string) {
  const matched = SENSITIVE_TEXT_PATTERNS.find((pattern) => pattern.test(text))
  if (matched) {
    throw new Error(`Planner observability report contains sensitive content: ${matched.source}`)
  }
}

export async function writePlannerObservabilityReport(report: PlannerObservabilityReport) {
  const json = `${JSON.stringify(report, null, 2)}\n`
  const markdown = renderPlannerObservabilityMarkdown(report)
  assertPlannerObservabilityTextIsSafe(json)
  assertPlannerObservabilityTextIsSafe(markdown)

  const { fs, nodePath } = await loadNodeFileModules()
  const jsonPath = nodePath.join(process.cwd(), REPORTS_DIR, PLANNER_OBSERVABILITY_JSON_FILE)
  const markdownPath = nodePath.join(
    process.cwd(),
    REPORTS_DIR,
    PLANNER_OBSERVABILITY_MARKDOWN_FILE
  )
  await fs.mkdir(nodePath.dirname(jsonPath), { recursive: true })
  await fs.writeFile(jsonPath, json, "utf8")
  await fs.writeFile(markdownPath, markdown, "utf8")
  return {
    jsonReportPath: PLANNER_OBSERVABILITY_JSON_PATH,
    markdownReportPath: PLANNER_OBSERVABILITY_MARKDOWN_PATH,
  }
}
