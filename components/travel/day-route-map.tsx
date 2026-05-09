"use client"

import { useMemo, useState, type ComponentType } from "react"
import { Bus, Car, Footprints, MapPinned } from "lucide-react"
import {
  MapView,
  type RouteSummaryInfo,
  type TransportMode,
} from "@/components/travel/map-view"
import { getMapSegmentIds } from "@/lib/map-view-model"
import type { RouteLegResult } from "@/lib/amap-route-utils"
import type { ItineraryDay } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface DayRouteMapProps {
  days: ItineraryDay[]
  activeDayIndex?: number
  onDayChange?: (index: number) => void
  showDayTabs?: boolean
  highlightedSpotId?: string | null
  highlightedLegId?: string | null
  onSpotSelect?: (spotId: string) => void
  onLegSelect?: (legId: string) => void
  onModeChange?: (mode: TransportMode) => void
  onRouteLegsChange?: (payload: { dayIndex: number; mode: TransportMode; legs: RouteLegResult[] }) => void
}

const MODE_OPTIONS: Array<{
  id: TransportMode
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
  { id: "driving", label: "驾车", icon: Car },
  { id: "walking", label: "步行", icon: Footprints },
  { id: "transit", label: "公交", icon: Bus },
]

function createSummary(mode: TransportMode): RouteSummaryInfo {
  return {
    mode,
    status: "idle",
    distance: 0,
    duration: 0,
    distanceText: "--",
    durationText: "--",
    startName: "--",
    endName: "--",
    waypointCount: 0,
    resolvedCount: 0,
    message: "地图正在准备路线信息",
    partialErrors: [],
    fallbackRouteUrl: "",
  }
}

export function DayRouteMap({
  days,
  activeDayIndex,
  onDayChange,
  showDayTabs = true,
  highlightedSpotId = null,
  highlightedLegId = null,
  onSpotSelect,
  onLegSelect,
  onModeChange,
  onRouteLegsChange,
}: DayRouteMapProps) {
  const [innerIndex, setInnerIndex] = useState(0)
  const [mode, setMode] = useState<TransportMode>("driving")
  const [summary, setSummary] = useState<RouteSummaryInfo>(() => createSummary("driving"))

  const currentIndex = activeDayIndex ?? innerIndex
  const setCurrentIndex = (index: number) => {
    if (onDayChange) onDayChange(index)
    else setInnerIndex(index)
  }

  const currentDay = useMemo(() => days[currentIndex] ?? null, [currentIndex, days])
  const routeSegmentIds = useMemo(
    () => (currentDay ? getMapSegmentIds(currentDay) : []),
    [currentDay]
  )

  if (!currentDay) return null

  return (
    <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4 shadow-[var(--app-shadow-soft)]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-text-strong)]">
            <MapPinned className="h-4 w-4 text-[var(--app-brand)]" />
            当日路线总览地图
          </h4>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">地图与景点时间线双向联动，帮助快速读懂今日节奏。</p>
        </div>
        <span className="numeric rounded-full bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)]">
          第 {currentDay.day} 天
        </span>
      </header>

      {showDayTabs && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {days.map((day, index) => (
            <button
              key={`map-day-${day.day}`}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "numeric shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                index === currentIndex
                  ? "bg-[var(--app-brand)] text-white"
                  : "bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
              )}
            >
              第{day.day}天
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {MODE_OPTIONS.map((item) => {
          const Icon = item.icon
          const active = mode === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id)
                setSummary(createSummary(item.id))
                onModeChange?.(item.id)
              }}
              className={cn(
                "rounded-[var(--app-radius-sm)] border px-2 py-2 text-xs transition",
                active
                  ? "border-[var(--app-brand)] bg-[var(--app-brand)] text-white"
                  : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
              )}
            >
              <Icon className="mx-auto mb-1 h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-line)]">
        <MapView
          spots={currentDay.spots}
          transportMode={mode}
          routeMode="trip"
          routeSegmentIds={routeSegmentIds}
          highlightedSpotId={highlightedSpotId}
          highlightedSegmentId={highlightedLegId}
          onSpotClick={onSpotSelect}
          onSegmentClick={onLegSelect}
          onSummaryChange={setSummary}
          onRouteLegsChange={(legs) => {
            onRouteLegsChange?.({
              dayIndex: currentIndex,
              mode,
              legs,
            })
          }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2">
          <p className="text-[var(--app-text-secondary)]">地图测算路程</p>
          <p className="numeric mt-1 font-semibold text-[var(--app-text-strong)]">{summary.distanceText}</p>
        </div>
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2">
          <p className="text-[var(--app-text-secondary)]">地图测算通勤</p>
          <p className="numeric mt-1 font-semibold text-[var(--app-text-strong)]">{summary.durationText}</p>
        </div>
      </div>

      {summary.message && (
        <p className="mt-2 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-[11px] text-[var(--app-text-secondary)]">
          {summary.message}
        </p>
      )}
    </section>
  )
}
