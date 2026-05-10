"use client"

import {
  ArrowDown,
  ArrowUp,
  CloudSun,
  Clock3,
  Lock,
  LockOpen,
  RefreshCcw,
  Tag,
  Timer,
  Umbrella,
  Wallet,
  Wind,
} from "lucide-react"
import { PlacePhotoImage } from "@/components/travel/place-photo-image"
import { RouteLegCard } from "@/components/travel/route-leg-card"
import { ResultLifestyleCard } from "@/components/travel/result-lifestyle-card"
import { AppButton } from "@/components/ui/app-button"
import { AppTag } from "@/components/ui/app-tag"
import { getDayHeadline, getDayLabel } from "@/lib/result-layout"
import type { ItineraryDay, RouteTransportMode } from "@/lib/travel-context"

interface DailyRouteCardProps {
  day: ItineraryDay
  showDayHeader?: boolean
  highlightedSpotId?: string | null
  highlightedLegId?: string | null
  onSpotClick?: (spotId: string) => void
  onLegClick?: (legId: string) => void
  domIdPrefix?: string
  routeLegsOverride?: ItineraryDay["routeLegs"]
  displayMode?: RouteTransportMode
  editable?: boolean
  lockedSpotIds?: string[]
  onMoveSpot?: (spotId: string, direction: "up" | "down") => void
  onReplaceSpot?: (spotId: string) => void
  onToggleSpotLock?: (spotId: string) => void
  onReplaceMeal?: (mealType: "lunch" | "dinner") => void
  onReplaceHotel?: () => void
  onOptimizeDay?: () => void
}

export function DailyRouteCard({
  day,
  showDayHeader = true,
  highlightedSpotId,
  highlightedLegId,
  onSpotClick,
  onLegClick,
  domIdPrefix = "result",
  routeLegsOverride,
  displayMode,
  editable = false,
  lockedSpotIds = [],
  onMoveSpot,
  onReplaceSpot,
  onToggleSpotLock,
  onReplaceMeal,
  onReplaceHotel,
  onOptimizeDay,
}: DailyRouteCardProps) {
  const routeLegs = routeLegsOverride ?? day.routeLegs
  const lockedSet = new Set(lockedSpotIds)
  const weatherSuggestions =
    day.weather?.suggestions && day.weather.suggestions.length > 0
      ? day.weather.suggestions
      : day.weatherAdvice
      ? [day.weatherAdvice]
      : []

  return (
    <section className="space-y-4">
      {showDayHeader && (
        <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
          <p className="text-xs font-medium text-[var(--app-brand)]">{getDayLabel(day.day)}</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--app-text-strong)]">{getDayHeadline(day)}</h3>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            {day.startTime} - {day.endTime}
          </p>
        </section>
      )}

      {editable && (
        <section className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--app-text-secondary)]">编辑模式已开启，你可以微调当日节点。</p>
            <AppButton type="button" size="sm" variant="secondary" onClick={onOptimizeDay}>
              <RefreshCcw className="h-3.5 w-3.5" />
              重新优化当日
            </AppButton>
          </div>
        </section>
      )}

      {day.weather && (
        <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-sm)] bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
              <CloudSun className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">天气与出行提醒</h4>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">
                {day.weather.weather} {day.weather.temperatureText}
                {day.weather.windText ? `｜${day.weather.windText}` : ""}｜{day.weatherAdvice || day.weather.advice}
              </p>
              {weatherSuggestions.length > 0 && (
                <div className="mt-3 grid gap-2 text-xs text-[var(--app-text-secondary)]">
                  {weatherSuggestions.slice(0, 3).map((suggestion, index) => (
                    <p key={`${day.day}-weather-${index}`} className="flex items-start gap-2 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 leading-5">
                      {index === 0 ? (
                        <Umbrella className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-brand)]" />
                      ) : (
                        <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-brand)]" />
                      )}
                      <span>{suggestion}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">景点时间线</h4>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">按游玩顺序阅读，像翻阅当天行程手册。</p>
          </div>
          <AppTag tone="info">主内容</AppTag>
        </div>

        <div className="space-y-3">
          {day.spots.map((spot, index) => {
            const isSpotActive = highlightedSpotId === spot.id
            const isLocked = lockedSet.has(spot.id)
            return (
              <article
                key={spot.id}
                id={`${domIdPrefix}-spot-${spot.id}`}
                role={onSpotClick ? "button" : undefined}
                tabIndex={onSpotClick ? 0 : undefined}
                onClick={() => onSpotClick?.(spot.id)}
                onKeyDown={(event) => {
                  if (!onSpotClick) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSpotClick(spot.id)
                  }
                }}
                className={`rounded-[var(--app-radius-md)] border p-3 transition ${
                  isSpotActive
                    ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)]/55 ring-2 ring-[var(--app-brand)]/15"
                    : "border-[var(--app-line)] bg-[var(--app-surface)]"
                } ${onSpotClick ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="numeric mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-xs font-semibold text-[var(--app-brand)]">
                    {index + 1}
                  </div>
                  <PlacePhotoImage
                    name={spot.name}
                    city={spot.city}
                    province={spot.province}
                    type={spot.type}
                    alt={spot.name}
                    className="h-14 w-14 rounded-[0.8rem] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{spot.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-[var(--app-text-secondary)]">{spot.address}</p>
                    <div className="numeric mt-2 grid grid-cols-2 gap-2 text-[11px] text-[var(--app-text-secondary)]">
                      <span className="inline-flex items-center gap-1 rounded-[0.65rem] bg-[var(--app-surface-elevated)] px-2 py-1">
                        <Clock3 className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                        {spot.arrivalTime || "--:--"} - {spot.leaveTime || "--:--"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-[0.65rem] bg-[var(--app-surface-elevated)] px-2 py-1">
                        <Timer className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                        停留 {spot.suggestedDurationText || "--"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {(spot.tags || []).slice(0, 3).map((tag) => (
                        <span key={`${spot.id}-${tag}`} className="rounded-full bg-[var(--app-surface-elevated)] px-2 py-0.5 text-[var(--app-text-secondary)]">
                          {tag}
                        </span>
                      ))}
                      <span className="numeric inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-elevated)] px-2 py-0.5 text-[var(--app-text-secondary)]">
                        <Wallet className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                        {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                      </span>
                    </div>
                    {spot.plannerReason && (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] leading-5 text-[var(--app-text-secondary)]">
                        <Tag className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                        {spot.plannerReason}
                      </p>
                    )}
                  </div>
                </div>

                {editable && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation()
                        onMoveSpot?.(spot.id, "up")
                      }}
                      disabled={index === 0 || isLocked}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      上移
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation()
                        onMoveSpot?.(spot.id, "down")
                      }}
                      disabled={index === day.spots.length - 1 || isLocked}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      下移
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation()
                        onReplaceSpot?.(spot.id)
                      }}
                      disabled={isLocked}
                    >
                      替换景点
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleSpotLock?.(spot.id)
                      }}
                    >
                      {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                      {isLocked ? "已锁定" : "锁定"}
                    </AppButton>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">路线段（辅助）</h4>
          <AppTag>服务于景点顺序</AppTag>
        </div>
        {routeLegs.length === 0 ? (
          <p className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
            当前路线段暂未生成，可切换出行方式或重新优化。
          </p>
        ) : (
          <div className="space-y-2">
            {routeLegs.map((leg) => (
              <RouteLegCard
                key={leg.id}
                leg={leg}
                displayMode={displayMode}
                active={highlightedLegId === leg.id}
                onClick={onLegClick}
                tone="subtle"
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
        <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">吃住安排</h4>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">顺着当天路线安排午餐、晚餐与住宿。</p>

        <div className="mt-3 space-y-2.5">
          <ResultLifestyleCard
            title="午餐建议"
            item={day.lunchSuggestion}
            emptyText="当前片区午餐候选不足，可放宽距离或切换商圈。"
            tone="meal"
            onAction={editable ? () => onReplaceMeal?.("lunch") : undefined}
            actionText="替换午餐"
          />
          <ResultLifestyleCard
            title="晚餐建议"
            item={day.dinnerSuggestion}
            emptyText="当前片区晚餐候选不足，可放宽距离或切换商圈。"
            tone="meal"
            onAction={editable ? () => onReplaceMeal?.("dinner") : undefined}
            actionText="替换晚餐"
          />
          <ResultLifestyleCard
            title="酒店建议"
            item={day.hotelSuggestion}
            emptyText="当前区域酒店候选不足，建议扩大半径或提高预算。"
            tone="hotel"
            onAction={editable ? onReplaceHotel : undefined}
            actionText="替换酒店"
          />
        </div>
      </section>
    </section>
  )
}
