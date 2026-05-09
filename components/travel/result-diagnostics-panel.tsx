"use client"

import { ChevronDown, CircleCheck, Lightbulb, ShieldAlert } from "lucide-react"
import type { PlanQualityScore, PlanValidationResult } from "@/lib/planner-types"
import { PlanScoreCard } from "@/components/travel/plan-score-card"
import { PlanWarningPanel } from "@/components/travel/plan-warning-panel"

interface ResultDiagnosticsPanelProps {
  validationResult?: PlanValidationResult
  qualityScore?: PlanQualityScore
  notices?: string[]
  onAutoOptimize?: () => void
}

function buildSummary(validationResult?: PlanValidationResult, qualityScore?: PlanQualityScore) {
  if (!validationResult && !qualityScore) {
    return "当前行程以阅读体验优先，诊断信息暂不可用。"
  }
  const warningCount = validationResult?.warnings.length || 0
  const errorCount = validationResult?.errors.length || 0
  const issueCount = warningCount + errorCount
  if (issueCount === 0) {
    return "当前行程整体合理，可查看 0 条优化建议。"
  }
  return `当前行程整体可执行，可查看 ${issueCount} 条优化建议。`
}

export function ResultDiagnosticsPanel({
  validationResult,
  qualityScore,
  notices = [],
  onAutoOptimize,
}: ResultDiagnosticsPanelProps) {
  const summary = buildSummary(validationResult, qualityScore)

  return (
    <section className="rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface)] p-3">
      <header className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--app-text-secondary)]" />
        <div>
          <h4 className="text-sm font-semibold text-[var(--app-text-primary)]">行程诊断</h4>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{summary}</p>
        </div>
      </header>

      <div className="mt-3 space-y-2">
        {validationResult && (
          <details className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-[var(--app-text-primary)]">
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                查看行程诊断
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className="mt-2">
              <PlanWarningPanel result={validationResult} onAutoOptimize={onAutoOptimize} />
            </div>
          </details>
        )}

        {qualityScore && (
          <details className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-[var(--app-text-primary)]">
              <span className="inline-flex items-center gap-1.5">
                <CircleCheck className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                查看方案质量评分
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className="mt-2">
              <PlanScoreCard score={qualityScore} />
            </div>
          </details>
        )}

        {notices.length > 0 && (
          <details className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-[var(--app-text-primary)]">
              <span>查看系统提示</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className="mt-2 space-y-1 text-xs text-[var(--app-text-secondary)]">
              {notices.map((notice, index) => (
                <p key={`${notice}-${index}`}>• {notice}</p>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  )
}
