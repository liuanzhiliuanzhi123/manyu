import { access, readFile } from "node:fs/promises"
import path from "node:path"
import {
  buildPlannerObservabilityReport,
  readPlannerRunLogs,
  writePlannerObservabilityReport,
} from "@/lib/observability/planner-run-logger"
import type { PlannerObservabilityReport } from "@/lib/observability/planner-observability-types"

const EVAL_REPORT_PATH = path.join("reports", "planner-eval-report.json")

async function readEvalReport(): Promise<PlannerObservabilityReport["evalReport"] | undefined> {
  const absolutePath = path.join(process.cwd(), EVAL_REPORT_PATH)
  try {
    await access(absolutePath)
  } catch {
    return undefined
  }

  try {
    const text = await readFile(absolutePath, "utf8")
    const report = JSON.parse(text) as {
      summary?: PlannerObservabilityReport["evalReport"]
    }
    const summary = report.summary
    if (!summary) return undefined
    return {
      mode: summary.mode,
      totalCases: summary.totalCases,
      passedCases: summary.passedCases,
      failedCases: summary.failedCases,
      averageScore: summary.averageScore,
      hardFailureCount: summary.hardFailureCount,
      fallbackCount: summary.fallbackCount,
      repairAppliedCount: summary.repairAppliedCount,
    }
  } catch {
    return undefined
  }
}

async function main() {
  const logs = await readPlannerRunLogs()
  const evalReport = await readEvalReport()
  const report = buildPlannerObservabilityReport(logs, evalReport)
  const paths = await writePlannerObservabilityReport(report)

  console.log(
    [
      "Planner observability summary",
      `Total runs: ${report.summary.totalRuns}`,
      `DeepSeek runs: ${report.summary.deepseekRuns}`,
      `Fallback runs: ${report.summary.fallbackRuns}`,
      `Fallback rate: ${report.summary.fallbackRate}`,
      `Repair rate: ${report.summary.repairRate}`,
      `Average duration: ${report.summary.averageDurationMs}ms`,
      `JSON report: ${paths.jsonReportPath}`,
      `Markdown report: ${paths.markdownReportPath}`,
      logs.length === 0 ? "No local planner run log was found; generated an empty report." : "",
    ]
      .filter(Boolean)
      .join("\n")
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Planner observability failed")
  process.exitCode = 1
})
