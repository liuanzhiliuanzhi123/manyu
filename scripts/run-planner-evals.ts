import {
  getPlannerEvalOptionsFromEnv,
  runPlannerEvalSuite,
  writePlannerEvalReports,
} from "@/lib/evals/planner-eval-runner"

async function main() {
  const options = getPlannerEvalOptionsFromEnv()
  const report = await runPlannerEvalSuite(options)
  const paths = await writePlannerEvalReports(report, options)
  const summary = report.summary

  console.log(
    [
      `Planner eval mode: ${summary.mode}`,
      `Total cases: ${summary.totalCases}`,
      `Passed cases: ${summary.passedCases}`,
      `Failed cases: ${summary.failedCases}`,
      `Average score: ${summary.averageScore}`,
      `Hard failures: ${summary.hardFailureCount}`,
      `Fallback count: ${summary.fallbackCount}`,
      `Repair applied count: ${summary.repairAppliedCount}`,
      `JSON report: ${paths.jsonReportPath}`,
      `Markdown report: ${paths.markdownReportPath}`,
    ].join("\n")
  )

  if (summary.mode === "offline" && summary.failedCases > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Planner eval failed")
  process.exitCode = 1
})

