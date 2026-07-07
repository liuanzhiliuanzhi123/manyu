import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { plannerEvalCases } from "@/lib/evals/planner-eval-cases"
import { runPlannerEvalCase } from "@/lib/evals/planner-evaluator"
import {
  assertPlannerEvalReportIsSafe,
  buildPlannerEvalReport,
  renderPlannerEvalMarkdown,
} from "@/lib/evals/planner-eval-report"
import type {
  PlannerEvalMode,
  PlannerEvalReport,
  PlannerEvalResult,
  PlannerEvalRunnerOptions,
} from "@/lib/evals/planner-eval-types"

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function writeTextFile(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, "utf8")
}

export function getPlannerEvalOptionsFromEnv(argv = process.argv): PlannerEvalRunnerOptions {
  const cliLive = argv.includes("--live")
  const live = cliLive || process.env.PLANNER_EVAL_LIVE === "true"
  const maxCases = live
    ? parsePositiveInteger(process.env.PLANNER_EVAL_MAX_CASES, 3)
    : plannerEvalCases.length
  const suffix = live ? ".live" : ""

  return {
    live,
    maxCases,
    baseUrl: process.env.PLANNER_EVAL_BASE_URL,
    delayMs: live ? parsePositiveInteger(process.env.PLANNER_EVAL_DELAY_MS, 1500) : 0,
    jsonReportPath: `reports/planner-eval-report${suffix}.json`,
    markdownReportPath: `reports/planner-eval-report${suffix}.md`,
  }
}

export async function runPlannerEvalSuite(
  options: PlannerEvalRunnerOptions = {}
): Promise<PlannerEvalReport> {
  const mode: PlannerEvalMode = options.live ? "live" : "offline"
  const maxCases = options.live
    ? Math.min(options.maxCases || 3, plannerEvalCases.length)
    : plannerEvalCases.length
  const selectedCases = plannerEvalCases.slice(0, maxCases)
  const results: PlannerEvalResult[] = []

  for (let index = 0; index < selectedCases.length; index += 1) {
    const evalCase = selectedCases[index]
    const result = await runPlannerEvalCase(evalCase, mode, {
      baseUrl: options.baseUrl,
    })
    results.push(result)

    if (mode === "live" && options.delayMs && index < selectedCases.length - 1) {
      await sleep(options.delayMs)
    }
  }

  return buildPlannerEvalReport(results, mode)
}

export async function writePlannerEvalReports(
  report: PlannerEvalReport,
  options: PlannerEvalRunnerOptions = {}
) {
  const jsonReportPath = options.jsonReportPath || "reports/planner-eval-report.json"
  const markdownReportPath = options.markdownReportPath || "reports/planner-eval-report.md"
  const jsonText = `${JSON.stringify(report, null, 2)}\n`
  const markdownText = renderPlannerEvalMarkdown(report)

  assertPlannerEvalReportIsSafe(jsonText)
  assertPlannerEvalReportIsSafe(markdownText)

  await writeTextFile(jsonReportPath, jsonText)
  await writeTextFile(markdownReportPath, markdownText)

  return {
    jsonReportPath,
    markdownReportPath,
  }
}

