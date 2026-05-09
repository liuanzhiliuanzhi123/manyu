"use client"

import { useMemo, useState } from "react"
import {
  Bus,
  Car,
  ChevronDown,
  ChevronUp,
  Clock3,
  Footprints,
  MapPin,
  Navigation,
} from "lucide-react"
import type { RouteTransportMode, TravelLeg } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface RouteLegCardProps {
  leg: TravelLeg
  active?: boolean
  onClick?: (legId: string) => void
  displayMode?: RouteTransportMode
  tone?: "default" | "subtle"
}

const modeConfig = {
  driving: { label: "驾车", icon: Car },
  walking: { label: "步行", icon: Footprints },
  transit: { label: "公交", icon: Bus },
} as const

const recommendLabel: Record<string, string> = {
  walking: "步行",
  driving: "驾车",
  transit: "公交",
  subway: "地铁",
  bus: "公交",
  taxi: "打车",
  train: "高铁",
  flight: "飞机",
}

const transitStepLabel: Record<string, string> = {
  walk: "步行",
  bus: "公交",
  subway: "地铁",
  transfer: "换乘",
}

export function RouteLegCard({
  leg,
  active = false,
  onClick,
  displayMode,
  tone = "default",
}: RouteLegCardProps) {
  const [expandTransitSteps, setExpandTransitSteps] = useState(false)
  const modeKey = displayMode ?? leg.transportMode
  const mode = modeConfig[modeKey]
  const Icon = mode.icon
  const isTransit = modeKey === "transit"
  const hasTransitSteps = (leg.transitSteps?.length ?? 0) > 0
  const transitSummaryText = useMemo(() => {
    if (!leg.transitLineSummary || leg.transitLineSummary.length === 0) return ""
    return leg.transitLineSummary.join(" → ")
  }, [leg.transitLineSummary])

  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(leg.id)}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick(leg.id)
        }
      }}
      className={cn(
        "rounded-[var(--app-radius-md)] border p-3 transition-colors",
        onClick && "cursor-pointer",
        active && "border-[var(--app-brand)] ring-2 ring-[var(--app-brand)]/20",
        tone === "subtle"
          ? "border-[var(--app-line)] bg-[var(--app-surface)]"
          : leg.isEstimated
          ? "border-[color:rgba(194,122,58,0.45)] surface-warning"
          : "border-[var(--app-line)] bg-[var(--app-surface)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)]">
            <Navigation className="h-3.5 w-3.5" />
            路线段
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--app-text-strong)]">
            {leg.fromName} → {leg.toName}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--app-text-primary)]">
          <Icon className="h-3.5 w-3.5" />
          {mode.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2.5 py-2 text-[var(--app-text-secondary)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--app-brand)]" />
          {leg.readableDistance}
        </div>
        <div className="flex items-center gap-1.5 rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2.5 py-2 text-[var(--app-text-secondary)]">
          <Clock3 className="h-3.5 w-3.5 text-[var(--app-brand)]" />
          {leg.readableDuration}
        </div>
      </div>

      <div className="numeric mt-2 flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
        <span>建议 {leg.startTime} 出发</span>
        <span>·</span>
        <span>预计 {leg.arrivalTime} 到达</span>
      </div>

      {isTransit && (
        <div className="mt-2 space-y-2">
          <div className="rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2.5 py-2 text-xs text-[var(--app-text-secondary)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--app-brand-soft)] px-2 py-0.5 text-[var(--app-brand)]">
                公交换乘
              </span>
              <span className="numeric">换乘 {Math.max(0, leg.transitTransferCount ?? 0)} 次</span>
            </div>
            {transitSummaryText && (
              <p className="mt-1 leading-5 text-[var(--app-text-primary)]">{transitSummaryText}</p>
            )}
          </div>

          {hasTransitSteps && (
            <div className="rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2.5 py-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpandTransitSteps((prev) => !prev)
                }}
                className="flex w-full items-center justify-between text-xs font-medium text-[var(--app-text-primary)]"
              >
                <span>查看换乘步骤</span>
                {expandTransitSteps ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="mt-2 space-y-1.5 text-xs text-[var(--app-text-secondary)]">
                {(expandTransitSteps ? leg.transitSteps : leg.transitSteps?.slice(0, 3))?.map(
                  (step, index) => (
                    <p key={`${leg.id}-step-${index}`} className="leading-5">
                      <span className="mr-1 text-[var(--app-text-primary)]">
                        {index + 1}. {transitStepLabel[step.type] || "步骤"}
                      </span>
                      {step.instruction}
                    </p>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isTransit && leg.recommendedMode && (
        <div className="mt-2 rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2.5 py-2 text-xs text-[var(--app-text-secondary)]">
          推荐方式：{recommendLabel[leg.recommendedMode] || leg.recommendedMode}
          {leg.recommendedReason ? `（${leg.recommendedReason}）` : ""}
        </div>
      )}

      {leg.isEstimated && (
        <p className="mt-2 text-[11px] leading-5 text-[var(--app-warning)]">
          {isTransit
            ? leg.estimateReason || "该路段暂无稳定公交方案，已按预估通勤时间展示"
            : leg.estimateReason || "该路段为预估结果"}
        </p>
      )}
    </article>
  )
}
