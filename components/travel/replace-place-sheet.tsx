"use client"

import { ArrowRightLeft, Lock, MapPin, Sparkles } from "lucide-react"
import { MobileSheet } from "@/components/travel/mobile-sheet"
import { AppButton } from "@/components/ui/app-button"
import type { PlanReplaceCandidate } from "@/lib/plan-editor"

interface ReplacePlaceSheetProps {
  open: boolean
  onClose: () => void
  candidates: PlanReplaceCandidate[]
  currentName?: string
  onReplace: (candidate: PlanReplaceCandidate) => void
  locked?: boolean
}

export function ReplacePlaceSheet({
  open,
  onClose,
  candidates,
  currentName,
  onReplace,
  locked = false,
}: ReplacePlaceSheetProps) {
  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title="替换景点"
      description={
        currentName
          ? `当前：${currentName}，将优先展示同类且顺路候选。`
          : "将优先展示同类且顺路候选。"
      }
    >
      {locked ? (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
          <p className="inline-flex items-center gap-1.5 text-[var(--app-warning)]">
            <Lock className="h-3.5 w-3.5" />
            当前景点已锁定，解锁后才能替换。
          </p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
          当前片区候选不足，可放宽半径或换一个锚点。
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <article
              key={candidate.spot.id}
              className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--app-text-strong)]">
                    {candidate.spot.name}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.spot.address}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">
                    {candidate.reason}
                    {candidate.distanceMeters && Number.isFinite(candidate.distanceMeters)
                      ? ` · ${(candidate.distanceMeters / 1000).toFixed(1)}km`
                      : ""}
                  </p>
                </div>
                <AppButton type="button" size="sm" onClick={() => onReplace(candidate)}>
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  替换
                </AppButton>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-brand-soft)] px-3 py-2 text-xs text-[var(--app-brand)]">
        <p className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          替换后会自动重算当日路线、时间和预算。
        </p>
      </div>
    </MobileSheet>
  )
}
