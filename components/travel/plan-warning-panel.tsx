"use client"

import { AlertCircle, CircleCheck, Lightbulb, TriangleAlert } from "lucide-react"
import type { PlanValidationResult } from "@/lib/planner-types"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"

interface PlanWarningPanelProps {
  result: PlanValidationResult
  onAutoOptimize?: () => void
}

export function PlanWarningPanel({ result, onAutoOptimize }: PlanWarningPanelProps) {
  const hasIssues = result.errors.length > 0 || result.warnings.length > 0
  if (!hasIssues) {
    return (
      <AppCard tone="soft" padding="md">
        <p className="inline-flex items-center gap-2 text-sm text-[var(--app-success)]">
          <CircleCheck className="h-4 w-4" />
          当前方案校验通过，结构完整且可执行。
        </p>
      </AppCard>
    )
  }

  return (
    <AppCard tone="elevated" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-text-strong)]">
            <TriangleAlert className="h-4 w-4 text-[var(--app-warning)]" />
            方案校验提示
          </h4>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            错误 {result.summary.errorCount} 条 · 警告 {result.summary.warningCount} 条
          </p>
        </div>
        {onAutoOptimize && (
          <AppButton type="button" size="sm" variant="secondary" onClick={onAutoOptimize}>
            试一次自动优化
          </AppButton>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {result.errors.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--app-radius-sm)] surface-error px-3 py-2 text-xs text-[var(--app-error)]"
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 leading-5">{item.message}</p>
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {result.warnings.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--app-radius-sm)] surface-warning px-3 py-2 text-xs text-[var(--app-warning)]"
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 leading-5">{item.message}</p>
            </div>
          ))}
        </div>
      )}

      {result.suggestionHints.length > 0 && (
        <div className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
          <p className="inline-flex items-center gap-1.5 font-medium text-[var(--app-text-primary)]">
            <Lightbulb className="h-3.5 w-3.5 text-[var(--app-brand)]" />
            优化建议
          </p>
          <div className="mt-1.5 space-y-1">
            {result.suggestionHints.slice(0, 3).map((hint, index) => (
              <p key={`${hint}-${index}`} className="leading-5">
                • {hint}
              </p>
            ))}
          </div>
        </div>
      )}

      {result.summary.hasBlockingErrors && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--app-error)]">
          <AlertCircle className="h-3.5 w-3.5" />
          当前方案存在阻塞错误，建议先修复后再分享。
        </p>
      )}
    </AppCard>
  )
}
