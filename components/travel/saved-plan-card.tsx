"use client"

import { Calendar, Edit3, Share2, Star, Trash2 } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import type { TripPlan } from "@/lib/travel-context"

interface SavedPlanCardProps {
  plan: TripPlan
  onOpen: () => void
  onDelete: () => void
  onShare?: () => void
}

export function SavedPlanCard({ plan, onOpen, onDelete, onShare }: SavedPlanCardProps) {
  const totalScorePercent =
    plan.qualityScore && plan.qualityScore.maxScore > 0
      ? Math.round((plan.qualityScore.totalScore / plan.qualityScore.maxScore) * 100)
      : null

  return (
    <AppCard tone="elevated" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--app-text-strong)]">{plan.name}</h3>
          <p className="numeric mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)]">
            <Calendar className="h-3.5 w-3.5" />
            {plan.startDate || "--"} - {plan.endDate || "--"}
          </p>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            {plan.requirement?.city || "北京"} · {plan.totalDays || plan.days?.length || 0} 天 ·
            {" "}{plan.totalSpots || plan.spots.length} 个点位
          </p>
        </div>
        {totalScorePercent !== null && (
          <span className="numeric inline-flex items-center gap-1 rounded-full bg-[var(--app-brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-brand)]">
            <Star className="h-3.5 w-3.5" />
            {totalScorePercent}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <AppButton type="button" size="sm" onClick={onOpen}>
          <Edit3 className="h-3.5 w-3.5" />
          继续编辑
        </AppButton>
        <AppButton type="button" size="sm" variant="secondary" onClick={onShare}>
          <Share2 className="h-3.5 w-3.5" />
          分享
        </AppButton>
        <AppButton type="button" size="sm" variant="danger" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </AppButton>
      </div>
    </AppCard>
  )
}
