"use client"

import { useState } from "react"
import { Calendar, Edit3, Share2, Star, Trash2 } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppModal } from "@/components/ui/app-modal"
import type { TripPlan } from "@/lib/travel-context"

interface SavedPlanCardProps {
  plan: TripPlan
  onOpen: () => void
  onDelete: () => void
  onShare?: () => void
}

export function SavedPlanCard({ plan, onOpen, onDelete, onShare }: SavedPlanCardProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const totalScorePercent =
    plan.qualityScore && plan.qualityScore.maxScore > 0
      ? Math.round((plan.qualityScore.totalScore / plan.qualityScore.maxScore) * 100)
      : null

  return (
    <>
      <AppCard
        tone="elevated"
        padding="md"
        interactive
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpen()
          }
        }}
        className="cursor-pointer text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-6 text-[var(--app-text-strong)]">{plan.name}</h3>
            <p className="numeric mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)]">
              <Calendar className="h-3.5 w-3.5" />
              {plan.startDate || "--"} - {plan.endDate || "--"}
            </p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
              {plan.requirement?.city || "北京"} · {plan.totalDays || plan.days?.length || 0} 天 ·{" "}
              {plan.totalSpots || plan.spots.length} 个点位
            </p>
          </div>
          {totalScorePercent !== null && (
            <span className="numeric inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--app-brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-brand)]">
              <Star className="h-3.5 w-3.5" />
              {totalScorePercent}
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <AppButton
            type="button"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            继续编辑
          </AppButton>
          <AppButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation()
              onShare?.()
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            分享
          </AppButton>
          <AppButton
            type="button"
            size="sm"
            variant="danger"
            onClick={(event) => {
              event.stopPropagation()
              setConfirmDeleteOpen(true)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </AppButton>
        </div>
      </AppCard>

      <AppModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="删除保存方案"
        description={`确定删除“${plan.name}”吗？删除后不会影响当前已选地点。`}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <AppButton type="button" variant="secondary" size="lg" onClick={() => setConfirmDeleteOpen(false)}>
            取消
          </AppButton>
          <AppButton
            type="button"
            variant="danger"
            size="lg"
            onClick={() => {
              setConfirmDeleteOpen(false)
              onDelete()
            }}
          >
            确认删除
          </AppButton>
        </div>
      </AppModal>
    </>
  )
}
