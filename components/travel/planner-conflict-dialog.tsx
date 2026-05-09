"use client"

import type { Spot } from "@/lib/travel-context"

interface PlannerConflictDialogProps {
  open: boolean
  targetCity: string
  mismatched: Spot[]
  onKeepMatched: () => void
  onClearAll: () => void
  onBackToEdit: () => void
}

export function PlannerConflictDialog({
  open,
  targetCity,
  mismatched,
  onKeepMatched,
  onClearAll,
  onBackToEdit,
}: PlannerConflictDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-md rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4 shadow-[var(--app-shadow-lifted)]">
        <h3 className="text-base font-semibold text-[var(--app-text-strong)]">检测到城市冲突</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--app-text-secondary)]">
          当前规划城市为“{targetCity}”，但已选清单中有 {mismatched.length} 个地点不在该城市。
        </p>

        <div className="mt-3 max-h-32 space-y-1 overflow-auto rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] p-3 text-xs text-[var(--app-text-secondary)]">
          {mismatched.slice(0, 5).map((spot) => (
            <p key={spot.id}>· {spot.name}</p>
          ))}
          {mismatched.length > 5 && <p>还有 {mismatched.length - 5} 个地点...</p>}
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onKeepMatched}
            className="w-full rounded-[var(--app-radius-sm)] bg-[var(--app-brand)] px-3 py-2.5 text-sm font-medium text-white"
          >
            仅保留 {targetCity} 相关内容
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5 text-sm font-medium text-[var(--app-text-primary)]"
          >
            清空当前已选内容
          </button>
          <button
            type="button"
            onClick={onBackToEdit}
            className="w-full rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm text-[var(--app-text-secondary)]"
          >
            返回修改目的地
          </button>
        </div>
      </div>
    </div>
  )
}
