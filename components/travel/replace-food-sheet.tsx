"use client"

import { UtensilsCrossed } from "lucide-react"
import { MobileSheet } from "@/components/travel/mobile-sheet"
import { AppButton } from "@/components/ui/app-button"
import type { PlanReplaceCandidate } from "@/lib/plan-editor"

interface ReplaceFoodSheetProps {
  open: boolean
  onClose: () => void
  mealType: "lunch" | "dinner"
  candidates: PlanReplaceCandidate[]
  onReplace: (candidate: PlanReplaceCandidate) => void
}

export function ReplaceFoodSheet({
  open,
  onClose,
  mealType,
  candidates,
  onReplace,
}: ReplaceFoodSheetProps) {
  const title = mealType === "lunch" ? "替换午餐" : "替换晚餐"

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={title}
      description="优先展示附近且更顺路的餐饮候选。"
    >
      {candidates.length === 0 ? (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
          当前区域餐饮候选不足，可改用附近商圈推荐或放宽距离。
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <article
              key={candidate.spot.id}
              className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-3"
            >
              <p className="text-sm font-medium text-[var(--app-text-strong)]">{candidate.spot.name}</p>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{candidate.spot.address}</p>
              <p className="numeric mt-1 text-[11px] text-[var(--app-brand)]">
                评分 {candidate.spot.rating?.toFixed(1) || "--"} · 参考价 ¥{candidate.spot.ticketPrice || 88}
              </p>
              <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">{candidate.reason}</p>
              <AppButton
                type="button"
                size="sm"
                className="mt-2"
                onClick={() => onReplace(candidate)}
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                用这家替换
              </AppButton>
            </article>
          ))}
        </div>
      )}
    </MobileSheet>
  )
}
