"use client"

import { useMemo, useState } from "react"
import { Calendar, ChevronRight, Eye, MapPin, Trash2 } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppModal } from "@/components/ui/app-modal"
import { EmptyStateCard } from "@/components/ui/empty-state-card"
import { AppStatCard } from "@/components/ui/app-stat-card"
import { AppTag } from "@/components/ui/app-tag"
import { MapView, type RouteSummaryInfo } from "@/components/travel/map-view"
import { SavedPlanCard } from "@/components/travel/saved-plan-card"
import type { SpotNavigationIntent } from "@/lib/navigation"
import { buildPlanShareSummary, toShareSummaryText } from "@/lib/plan-persistence"
import { resolvePlaceImage } from "@/lib/place-image"
import { Spot, useTravel } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface TripsPageProps {
  onViewSpot: (spot: Spot) => void
  onNavigate: (tab: "explore" | "ai") => void
  navigationIntent: SpotNavigationIntent | null
  onClearNavigationIntent: () => void
  onOpenSavedPlan: (planId: string) => void
}

function createPreviewSummary(): RouteSummaryInfo {
  return {
    mode: "driving",
    status: "idle",
    distance: 0,
    duration: 0,
    distanceText: "--",
    durationText: "--",
    startName: "--",
    endName: "--",
    waypointCount: 0,
    resolvedCount: 0,
    message: "这里提供轻量预览，完整路线与交通建议请进入 AI 规划结果页。",
    partialErrors: [],
    fallbackRouteUrl: "",
  }
}

export function TripsPage({
  onViewSpot,
  onNavigate,
  navigationIntent,
  onClearNavigationIntent,
  onOpenSavedPlan,
}: TripsPageProps) {
  const { selectedSpots, removeSpot, clearSpots, savedPlans, deletePlan, currentPlan } = useTravel()
  const [activeTab, setActiveTab] = useState<"current" | "saved">("current")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showMapPreview, setShowMapPreview] = useState(false)
  const [previewSummary, setPreviewSummary] = useState<RouteSummaryInfo>(() =>
    createPreviewSummary()
  )
  const [shareFeedback, setShareFeedback] = useState("")

  const totalPrice = useMemo(
    () => selectedSpots.reduce((sum, spot) => sum + spot.ticketPrice, 0),
    [selectedSpots]
  )

  const daySummaries = useMemo(() => {
    if (currentPlan?.days && currentPlan.days.length > 0) {
      return currentPlan.days.map((day) => ({
        day: day.day,
        title: day.theme || `${day.day}日行程`,
        spots: day.spots,
        budget: day.totalEstimatedCost,
      }))
    }
    if (selectedSpots.length === 0) return []
    const groups: Array<{ day: number; title: string; spots: Spot[]; budget: number }> = []
    for (let i = 0; i < selectedSpots.length; i += 4) {
      const chunk = selectedSpots.slice(i, i + 4)
      groups.push({
        day: groups.length + 1,
        title: `第${groups.length + 1}天候选路线`,
        spots: chunk,
        budget: chunk.reduce((sum, item) => sum + item.ticketPrice, 0),
      })
    }
    return groups
  }, [currentPlan?.days, selectedSpots])

  const planOverview = {
    destination: currentPlan?.requirement?.city || selectedSpots[0]?.city || "待定目的地",
    days: currentPlan?.totalDays || daySummaries.length || 0,
    dateRange:
      currentPlan?.startDate && currentPlan?.endDate
        ? `${currentPlan.startDate} - ${currentPlan.endDate}`
        : "待定日期",
    budget: currentPlan?.totalEstimatedCost || totalPrice,
    perCapita:
      currentPlan?.totalEstimatedCost && currentPlan?.requirement
        ? Math.round(currentPlan.totalEstimatedCost / Math.max(1, currentPlan.requirement.days))
        : 0,
    companions: currentPlan?.requirement?.companions || "friends",
  }

  const handleSharePlan = async (planId: string) => {
    const plan = savedPlans.find((item) => item.id === planId)
    if (!plan) return
    const shareText = toShareSummaryText(buildPlanShareSummary(plan))
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText)
        setShareFeedback("分享摘要已复制到剪贴板")
      } catch {
        setShareFeedback("复制失败，请稍后重试")
      }
    } else {
      setShareFeedback("当前环境不支持剪贴板复制")
    }
    window.setTimeout(() => setShareFeedback(""), 1600)
  }

  return (
    <div className="app-page animate-fade-in space-y-4">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="app-page-title">行程手册</h1>
          <p className="app-body">查看当前计划、地图预览和每日路线摘要，继续用 AI 深度优化行程。</p>
        </div>

        <AppCard tone="elevated" padding="lg" className="soft-gradient space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="app-label">CURRENT PLAN</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--app-text-strong)]">{planOverview.destination}</h2>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{planOverview.dateRange}</p>
            </div>
            <AppTag tone="brand" className="numeric">{planOverview.days} 天</AppTag>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <AppStatCard label="总预算" value={`¥${Math.round(planOverview.budget)}`} />
            <AppStatCard label="日均预算" value={`¥${Math.round(planOverview.perCapita)}`} />
            <AppStatCard label="已选点位" value={selectedSpots.length} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <AppButton type="button" size="lg" onClick={() => onNavigate("ai")}>
              继续 AI 规划
              <ChevronRight className="h-[1.05rem] w-[1.05rem]" />
            </AppButton>
            <AppButton type="button" variant="secondary" size="lg" onClick={() => onNavigate("explore")}>
              去添加地点
            </AppButton>
          </div>
        </AppCard>

        <div className="flex rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("current")}
            className={cn(
              "flex-1 rounded-[0.65rem] py-2.5 text-sm font-medium transition-all",
              activeTab === "current"
                ? "bg-[var(--app-surface-elevated)] text-[var(--app-text-strong)] shadow-sm"
                : "text-[var(--app-text-secondary)]"
            )}
          >
            当前计划
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={cn(
              "flex-1 rounded-[0.65rem] py-2.5 text-sm font-medium transition-all",
              activeTab === "saved"
                ? "bg-[var(--app-surface-elevated)] text-[var(--app-text-strong)] shadow-sm"
                : "text-[var(--app-text-secondary)]"
            )}
          >
            已保存方案 ({savedPlans.length})
          </button>
        </div>
      </header>

      {activeTab === "current" ? (
        <div className="space-y-4 pb-10">
          <AppCard tone="soft" padding="md" className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--app-text-primary)]">路线地图预览</p>
              <button
                type="button"
                onClick={() => setShowMapPreview((prev) => !prev)}
                className="text-xs font-medium text-[var(--app-brand)]"
              >
                {showMapPreview ? "收起" : "展开"}
              </button>
            </div>

            {navigationIntent && (
              <div className="flex items-center justify-between gap-2 rounded-[var(--app-radius-sm)] bg-[var(--app-brand-soft)] px-3 py-2 text-xs text-[var(--brand-deep)]">
                <span>已接收导航目标：{navigationIntent.spot.name}</span>
                <button type="button" onClick={onClearNavigationIntent} className="underline-offset-2 hover:underline">
                  清除
                </button>
              </div>
            )}

            {showMapPreview && selectedSpots.length > 0 && (
              <>
                <MapView
                  spots={selectedSpots}
                  transportMode="driving"
                  routeMode="trip"
                  onSummaryChange={setPreviewSummary}
                />
                <p className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
                  {previewSummary.message}
                </p>
              </>
            )}
          </AppCard>

          {daySummaries.length > 0 && (
            <AppCard tone="elevated" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">每日行程摘要</h3>
                <AppTag tone="info">旅行手册视图</AppTag>
              </div>
              <div className="space-y-2.5">
                {daySummaries.map((day) => (
                  <article key={`summary-${day.day}`} className="rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-[var(--app-text-muted)]">第 {day.day} 天</p>
                        <h4 className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{day.title}</h4>
                      </div>
                      <span className="numeric rounded-full bg-[var(--app-surface-elevated)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)]">
                        预算 ¥{Math.round(day.budget || 0)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--app-text-secondary)] line-clamp-2">
                      {day.spots.map((spot) => spot.name).join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
            </AppCard>
          )}

          <AppCard tone="elevated" padding="md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">候选地点清单</h3>
              {selectedSpots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-error)]"
                >
                  清空全部
                </button>
              )}
            </div>

            {selectedSpots.length === 0 ? (
              <EmptyStateCard
                title="还没有加入地点"
                description="去探索页添加景点、美食或酒店。"
                actionLabel="去探索"
                onAction={() => onNavigate("explore")}
                icon={MapPin}
              />
            ) : (
              <div className="space-y-3">
                {selectedSpots.map((spot, index) => (
                  <article
                    key={spot.id}
                    className="rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface)] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="numeric flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-[11px] font-semibold text-[var(--app-brand)]">
                        {index + 1}
                      </div>
                      <img
                        src={resolvePlaceImage({
                          id: spot.id,
                          name: spot.name,
                          city: spot.city,
                          province: spot.province,
                          image: spot.image,
                          coverImage: spot.image,
                        })}
                        alt={spot.name}
                        className="h-14 w-14 flex-shrink-0 rounded-[0.8rem] object-cover"
                        onError={(event) => {
                          event.currentTarget.src = resolvePlaceImage({
                            city: spot.city,
                            province: spot.province,
                            name: spot.name,
                          })
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{spot.name}</h4>
                        <p className="mt-1 truncate text-xs text-[var(--app-text-secondary)]">{spot.address}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <AppTag>
                            {spot.type === "attraction"
                              ? "景点"
                              : spot.type === "restaurant"
                              ? "美食"
                              : "酒店"}
                          </AppTag>
                          <span className="numeric text-sm font-medium text-[var(--app-brand)]">
                            {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => onViewSpot(spot)}
                          className="flex h-8 w-8 items-center justify-center rounded-[0.7rem] bg-[var(--app-surface-muted)] text-[var(--app-text-primary)]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSpot(spot.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-[0.7rem] bg-[color:rgba(184,90,77,0.12)] text-[var(--app-error)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </AppCard>
        </div>
      ) : savedPlans.length === 0 ? (
        <div className="py-8">
          <EmptyStateCard
            title="暂无已保存方案"
            description="先去 AI 规划页生成并保存你的旅行方案。"
            actionLabel="进入 AI 规划"
            onAction={() => onNavigate("ai")}
            icon={Calendar}
          />
        </div>
      ) : (
        <div className="space-y-4 pb-10">
          {savedPlans.map((plan) => (
            <SavedPlanCard
              key={plan.id}
              plan={plan}
              onOpen={() => onOpenSavedPlan(plan.id)}
              onDelete={() => deletePlan(plan.id)}
              onShare={() => void handleSharePlan(plan.id)}
            />
          ))}
        </div>
      )}

      <AppModal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="确认清空"
        description="确定要清空所有已选内容吗？"
      >
        <div className="grid grid-cols-2 gap-2.5">
          <AppButton type="button" onClick={() => setShowClearConfirm(false)} variant="secondary" size="lg">
            取消
          </AppButton>
          <AppButton
            type="button"
            onClick={() => {
              clearSpots()
              setShowClearConfirm(false)
            }}
            variant="danger"
            size="lg"
          >
            确认清空
          </AppButton>
        </div>
      </AppModal>

      {shareFeedback && (
        <div className="fixed left-1/2 top-16 z-[70] -translate-x-1/2 rounded-[var(--app-radius-sm)] bg-[var(--app-text-strong)] px-4 py-2 text-sm text-white shadow-lg">
          {shareFeedback}
        </div>
      )}
    </div>
  )
}
