"use client"

import { AppButton } from "@/components/ui/app-button"
import type { TravelRequirement } from "@/lib/planner-types"
import type { Spot } from "@/lib/travel-context"

interface PlannerSummaryBarProps {
  requirement: TravelRequirement
  selectedPois: Spot[]
  onAction?: () => void
  actionText?: string
  disabled?: boolean
}

export function PlannerSummaryBar({
  requirement,
  selectedPois,
  onAction,
  actionText,
  disabled,
}: PlannerSummaryBarProps) {
  const spotCount = selectedPois.filter(
    (item) => item.rootCategory === "scenic" || item.type === "attraction"
  ).length
  const foodCount = selectedPois.filter(
    (item) => item.rootCategory === "food" || item.type === "restaurant"
  ).length
  const hotelCount = selectedPois.filter(
    (item) => item.rootCategory === "hotel" || item.type === "hotel"
  ).length

  return (
    <div className="glass sticky bottom-[5.2rem] z-20 rounded-[var(--app-radius-lg)] border border-[var(--app-line)] p-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[0.7rem] bg-[var(--app-surface)] px-2.5 py-2 text-[var(--app-text-secondary)]">
          城市 <span className="font-medium text-[var(--app-text-strong)]">{requirement.city || "未选择"}</span>
        </div>
        <div className="rounded-[0.7rem] bg-[var(--app-surface)] px-2.5 py-2 text-[var(--app-text-secondary)]">
          天数 <span className="numeric font-medium text-[var(--app-text-strong)]">{requirement.days} 天</span>
        </div>
        <div className="rounded-[0.7rem] bg-[var(--app-surface)] px-2.5 py-2 text-[var(--app-text-secondary)]">
          预算 <span className="font-medium text-[var(--app-text-strong)]">{requirement.budgetRange}</span>
        </div>
        <div className="rounded-[0.7rem] bg-[var(--app-surface)] px-2.5 py-2 text-[var(--app-text-secondary)]">
          偏好 <span className="numeric font-medium text-[var(--app-text-strong)]">{requirement.interests.length} 项</span>
        </div>
      </div>

      <div className="numeric mt-2 flex items-center justify-between rounded-[0.7rem] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
        <span>已选：景点 {spotCount} · 美食 {foodCount} · 住宿 {hotelCount}</span>
        <span>共 {selectedPois.length}</span>
      </div>

      {onAction && actionText && (
        <AppButton
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="mt-2 w-full"
          size="lg"
        >
          {actionText}
        </AppButton>
      )}
    </div>
  )
}
