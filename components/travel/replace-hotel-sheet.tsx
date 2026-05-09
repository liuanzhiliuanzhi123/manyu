"use client"

import { BedDouble } from "lucide-react"
import { MobileSheet } from "@/components/travel/mobile-sheet"
import { AppButton } from "@/components/ui/app-button"
import type { PlanReplaceCandidate } from "@/lib/plan-editor"

interface ReplaceHotelSheetProps {
  open: boolean
  onClose: () => void
  candidates: PlanReplaceCandidate[]
  onReplace: (candidate: PlanReplaceCandidate) => void
}

export function ReplaceHotelSheet({
  open,
  onClose,
  candidates,
  onReplace,
}: ReplaceHotelSheetProps) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title="替换酒店"
      description="优先展示靠近当日终点和次日起点的酒店。"
    >
      {candidates.length === 0 ? (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
          当前区域酒店候选不足，可放宽半径或适当提高预算。
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
                评分 {candidate.spot.rating?.toFixed(1) || "--"} · 参考价 ¥{candidate.spot.ticketPrice || 380}
              </p>
              <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">{candidate.reason}</p>
              <AppButton
                type="button"
                size="sm"
                className="mt-2"
                onClick={() => onReplace(candidate)}
              >
                <BedDouble className="h-3.5 w-3.5" />
                用这家替换
              </AppButton>
            </article>
          ))}
        </div>
      )}
    </MobileSheet>
  )
}
