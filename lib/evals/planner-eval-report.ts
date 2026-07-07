import type {
  PlannerEvalMode,
  PlannerEvalReport,
  PlannerEvalResult,
  PlannerEvalSummary,
} from "@/lib/evals/planner-eval-types"

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /authorization/i,
  /bearer\s+[a-z0-9._-]+/i,
  /service[_-]?role/i,
  /supabase.*token/i,
  /vercel.*token/i,
  /session/i,
  /prompt/i,
  /raw.*response/i,
]

function round(value: number) {
  return Math.round(value * 100) / 100
}

function countCommonFailures(results: PlannerEvalResult[]) {
  const counts = new Map<string, number>()
  for (const result of results) {
    for (const failure of result.hardFailures) {
      counts.set(failure, (counts.get(failure) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

export function buildPlannerEvalSummary(
  results: PlannerEvalResult[],
  mode: PlannerEvalMode,
  generatedAt = new Date().toISOString()
): PlannerEvalSummary {
  const totalCases = results.length
  const passedCases = results.filter((result) => result.passed).length
  const failedCases = totalCases - passedCases
  const scoreTotal = results.reduce((sum, result) => sum + result.score, 0)

  return {
    mode,
    totalCases,
    passedCases,
    failedCases,
    averageScore: totalCases > 0 ? round(scoreTotal / totalCases) : 0,
    hardFailureCount: results.reduce((sum, result) => sum + result.hardFailures.length, 0),
    fallbackCount: results.filter((result) => result.metrics.fallback).length,
    repairAppliedCount: results.filter((result) => result.metrics.repairApplied).length,
    generatedAt,
    commonFailureReasons: countCommonFailures(results),
  }
}

export function buildPlannerEvalReport(
  results: PlannerEvalResult[],
  mode: PlannerEvalMode,
  generatedAt = new Date().toISOString()
): PlannerEvalReport {
  return {
    summary: buildPlannerEvalSummary(results, mode, generatedAt),
    results,
  }
}

function listOrNone(items: string[]) {
  return items.length > 0 ? items.join(", ") : "none"
}

export function renderPlannerEvalMarkdown(report: PlannerEvalReport) {
  const lines: string[] = []
  const summary = report.summary

  lines.push("# Planner Eval Report")
  lines.push("")
  lines.push("## Summary")
  lines.push(`- Mode: ${summary.mode}`)
  lines.push(`- Total cases: ${summary.totalCases}`)
  lines.push(`- Passed cases: ${summary.passedCases}`)
  lines.push(`- Failed cases: ${summary.failedCases}`)
  lines.push(`- Average score: ${summary.averageScore}`)
  lines.push(`- Hard failure count: ${summary.hardFailureCount}`)
  lines.push(`- Fallback count: ${summary.fallbackCount}`)
  lines.push(`- Repair applied count: ${summary.repairAppliedCount}`)
  lines.push(`- Generated at: ${summary.generatedAt}`)
  lines.push("")
  lines.push("## Case Results")

  for (const result of report.results) {
    lines.push("")
    lines.push(`### ${result.caseId}`)
    lines.push(`- Name: ${result.caseName}`)
    lines.push(`- Status: ${result.passed ? "PASS" : "FAIL"}`)
    lines.push(`- Score: ${result.score}/${result.maxScore}`)
    lines.push(
      `- finalDays / expectedDays: ${result.metrics.finalDays} / ${result.metrics.requestedDays}`
    )
    lines.push(`- mainActivitiesPerDay: ${result.metrics.mainActivitiesPerDay.join(", ")}`)
    lines.push(`- totalItemsPerDay: ${result.metrics.totalItemsPerDay.join(", ")}`)
    lines.push(`- fallback: ${result.metrics.fallback}`)
    lines.push(`- repairApplied: ${result.metrics.repairApplied}`)
    lines.push(`- hardFailures: ${listOrNone(result.hardFailures)}`)
    lines.push(`- softWarnings: ${listOrNone(result.softWarnings)}`)
  }

  lines.push("")
  lines.push("## Key Findings")
  if (summary.failedCases === 0) {
    lines.push("- All offline planner cases passed hard constraints.")
  } else {
    lines.push(
      `- Failed cases: ${report.results
        .filter((result) => !result.passed)
        .map((result) => result.caseId)
        .join(", ")}`
    )
  }
  if (summary.commonFailureReasons.length > 0) {
    lines.push(
      `- Most common hard failure: ${summary.commonFailureReasons[0].reason} (${summary.commonFailureReasons[0].count})`
    )
  } else {
    lines.push("- Most common hard failure: none")
  }
  lines.push("- Stable scenarios are those with matched day counts and required main activity counts.")
  lines.push("- Next step: add cost and route-distance observability before making live eval a release gate.")
  lines.push("")

  return lines.join("\n")
}

export function assertPlannerEvalReportIsSafe(reportText: string) {
  const matched = SENSITIVE_PATTERNS.find((pattern) => pattern.test(reportText))
  if (matched) {
    throw new Error(`Planner eval report contains a blocked sensitive pattern: ${matched}`)
  }
}

