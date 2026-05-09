"use client"

import { BarChart3, CircleAlert } from "lucide-react"
import type { PlanQualityScore } from "@/lib/planner-types"
import { AppCard } from "@/components/ui/app-card"

interface PlanScoreCardProps {
  score: PlanQualityScore
}

function toPercent(value: number, max: number) {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)))
}

export function PlanScoreCard({ score }: PlanScoreCardProps) {
  const totalPercent = toPercent(score.totalScore, score.maxScore)

  return (
    <AppCard tone="elevated" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-text-strong)]">
            <BarChart3 className="h-4 w-4 text-[var(--app-brand)]" />
            方案质量评分
          </h4>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            综合评分 {totalPercent} / 100
          </p>
        </div>
        <div className="numeric rounded-full bg-[var(--app-brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-brand)]">
          {score.totalScore}/{score.maxScore}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {score.scoreBreakdown.map((item) => {
          const percent = toPercent(item.score, item.maxScore)
          return (
            <div key={item.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--app-text-primary)]">{item.label}</span>
                <span className="numeric text-[var(--app-text-secondary)]">{percent}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--app-surface-muted)]">
                <div
                  className="h-2 rounded-full bg-[var(--app-brand)] transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {item.reason && (
                <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">{item.reason}</p>
              )}
            </div>
          )
        })}
      </div>

      {score.topIssues.length > 0 && (
        <div className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
          <p className="inline-flex items-center gap-1.5 font-medium text-[var(--app-text-primary)]">
            <CircleAlert className="h-3.5 w-3.5 text-[var(--app-warning)]" />
            当前主要问题
          </p>
          <div className="mt-1.5 space-y-1">
            {score.topIssues.slice(0, 3).map((item, index) => (
              <p key={`${item}-${index}`}>• {item}</p>
            ))}
          </div>
        </div>
      )}
    </AppCard>
  )
}
