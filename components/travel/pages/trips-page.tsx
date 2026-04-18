"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import {
  Bus,
  Calendar,
  Car,
  ChevronRight,
  Eye,
  Footprints,
  MapPin,
  Navigation,
  Plus,
  Route,
  Trash2,
} from "lucide-react"
import { useTravel, Spot } from "@/lib/travel-context"
import {
  MapView,
  RouteMode,
  RouteSummaryInfo,
  TransportMode,
} from "@/components/travel/map-view"
import type { SpotNavigationIntent } from "@/lib/navigation"
import { openRouteInAmapWeb } from "@/lib/open-map-route"
import { cn } from "@/lib/utils"

interface TripsPageProps {
  onViewSpot: (spot: Spot) => void
  onNavigate: (tab: "explore" | "ai") => void
  navigationIntent: SpotNavigationIntent | null
  onClearNavigationIntent: () => void
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

const MODE_LABEL: Record<TransportMode, string> = {
  driving: "驾车",
  walking: "步行",
  transit: "公交",
}

function createInitialSummary(mode: TransportMode): RouteSummaryInfo {
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
    message: "请选择行程点并开始路线规划",
    partialErrors: [],
    fallbackRouteUrl: "",
  }
}

export function TripsPage({
  onViewSpot,
  onNavigate,
  navigationIntent,
  onClearNavigationIntent,
}: TripsPageProps) {
  const { selectedSpots, removeSpot, clearSpots, savedPlans, deletePlan } =
    useTravel()
  const [activeTab, setActiveTab] = useState<"current" | "saved">("current")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [transportMode, setTransportMode] =
    useState<TransportMode>("driving")
  const [routeMode, setRouteMode] = useState<RouteMode>(
    navigationIntent ? "fromMe" : "trip"
  )
  const [fromMeSpotId, setFromMeSpotId] = useState<string | null>(
    navigationIntent?.spot.id ?? null
  )
  const [routeSummary, setRouteSummary] = useState<RouteSummaryInfo>(() =>
    createInitialSummary("driving")
  )

  useEffect(() => {
    if (navigationIntent) {
      setRouteMode("fromMe")
      setTransportMode(navigationIntent.mode)
      setFromMeSpotId(navigationIntent.spot.id)
    }
  }, [navigationIntent])

  const fromMeCandidates = useMemo(() => {
    const bucket = new Map<string, Spot>()
    if (navigationIntent?.spot) {
      bucket.set(navigationIntent.spot.id, navigationIntent.spot)
    }
    for (const spot of selectedSpots) {
      if (!bucket.has(spot.id)) {
        bucket.set(spot.id, spot)
      }
    }
    return Array.from(bucket.values())
  }, [navigationIntent?.spot, selectedSpots])

  useEffect(() => {
    if (fromMeCandidates.length === 0) {
      if (fromMeSpotId !== null) {
        setFromMeSpotId(null)
      }
      return
    }
    const exists = fromMeSpotId
      ? fromMeCandidates.some((spot) => spot.id === fromMeSpotId)
      : false
    if (!exists) {
      setFromMeSpotId(fromMeCandidates[0].id)
    }
  }, [fromMeCandidates, fromMeSpotId])

  const totalPrice = selectedSpots.reduce((sum, spot) => sum + spot.ticketPrice, 0)
  const hasSpots = selectedSpots.length > 0
  const isFromMeMode = routeMode === "fromMe"
  const fromMeSpot =
    fromMeCandidates.find((spot) => spot.id === fromMeSpotId) ?? null

  const startName =
    routeSummary.startName !== "--"
      ? routeSummary.startName
      : isFromMeMode
      ? "我的位置"
      : selectedSpots[0]?.name || "--"
  const endName =
    routeSummary.endName !== "--"
      ? routeSummary.endName
      : isFromMeMode
      ? fromMeSpot?.name || "--"
      : selectedSpots[selectedSpots.length - 1]?.name || "--"
  const waypointCount = isFromMeMode
    ? 0
    : Math.max(routeSummary.waypointCount, hasSpots ? selectedSpots.length - 2 : 0)

  const summaryToneClass =
    routeSummary.status === "route-error" || routeSummary.status === "map-error"
      ? "bg-red-50 text-red-600"
      : routeSummary.status === "partial-error" ||
        routeSummary.status === "transit-degraded"
      ? "bg-amber-50 text-amber-700"
      : "bg-secondary text-muted-foreground"

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      <header className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">我的行程</h1>
        <p className="text-muted-foreground">管理您的旅行计划与路线</p>
      </header>

      <div className="px-6 mb-5">
        <div className="flex bg-secondary rounded-xl p-1">
          <button
            onClick={() => setActiveTab("current")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === "current"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            当前行程 ({selectedSpots.length})
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === "saved"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            已保存 ({savedPlans.length})
          </button>
        </div>
      </div>

      {activeTab === "current" ? (
        <div className="px-6 pb-28 space-y-4">
          <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">路线规划</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  选择出行方式后，将根据当前行程点自动规划路线
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MODE_OPTIONS.map((modeOption) => {
                  const Icon = modeOption.icon
                  const active = transportMode === modeOption.id
                  return (
                  <button
                      key={modeOption.id}
                      onClick={() => {
                        setTransportMode(modeOption.id)
                        setRouteSummary((prev) => ({ ...prev, mode: modeOption.id }))
                      }}
                      className={cn(
                        "px-2 py-2 rounded-xl min-w-[56px] transition-all border",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/80 text-foreground border-transparent hover:bg-secondary"
                      )}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-xs font-medium">{modeOption.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRouteMode("trip")}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  routeMode === "trip"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                )}
              >
                行程点路线
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteMode("fromMe")
                }}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  routeMode === "fromMe"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                )}
              >
                我到景点导航
              </button>
            </div>

            {routeMode === "fromMe" && (
              <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground mb-2">导航目标</p>
                {fromMeCandidates.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {fromMeCandidates.map((spot) => (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => setFromMeSpotId(spot.id)}
                        className={cn(
                          "shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors",
                          fromMeSpotId === spot.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-foreground border-border hover:bg-secondary"
                        )}
                      >
                        {spot.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    还没有可导航的景点，请先在探索页添加行程点，或在景点详情点击“导航前往”。
                  </p>
                )}
              </div>
            )}

            {navigationIntent && (
              <div className="mt-3 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 text-xs text-foreground flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">当前导航目标：{navigationIntent.spot.name}</p>
                  {navigationIntent.notice && (
                    <p className="text-muted-foreground">{navigationIntent.notice}</p>
                  )}
                </div>
                <button
                  onClick={onClearNavigationIntent}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  清除
                </button>
              </div>
            )}

            <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {isFromMeMode
                  ? "已进入单点导航模式，地图将规划“我的位置 → 当前景点”路线"
                  : `已添加 ${selectedSpots.length} 个行程点，去探索页可继续添加具体位置`}
              </p>
              <button
                onClick={() => onNavigate("explore")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加行程点
              </button>
            </div>
          </section>

          <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-3">
            <MapView
              spots={selectedSpots}
              transportMode={transportMode}
              routeMode={routeMode}
              fromMeTarget={isFromMeMode ? fromMeSpot : null}
              fromMeOrigin={isFromMeMode ? navigationIntent?.origin || null : null}
              fromMeRequestId={isFromMeMode ? navigationIntent?.requestId : undefined}
              onSummaryChange={setRouteSummary}
            />
          </section>

          <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">路线摘要</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                  {isFromMeMode ? "我到景点导航" : "行程点路线"}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {MODE_LABEL[routeSummary.mode]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/70 p-3">
                <p className="text-xs text-muted-foreground mb-1">总距离</p>
                <p className="text-base font-semibold text-foreground">
                  {routeSummary.distanceText}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/70 p-3">
                <p className="text-xs text-muted-foreground mb-1">预计耗时</p>
                <p className="text-base font-semibold text-foreground">
                  {routeSummary.durationText}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-secondary/40 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground min-w-[46px]">起点</span>
                <span className="font-medium truncate">{startName}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground min-w-[46px]">终点</span>
                <span className="font-medium truncate">{endName}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground min-w-[46px]">途经点</span>
                <span className="font-medium">{Math.max(0, waypointCount)} 个</span>
              </div>
            </div>

            <div className={cn("mt-3 rounded-xl p-3 text-xs leading-5", summaryToneClass)}>
              {routeSummary.message}
            </div>

            {routeSummary.fallbackRouteUrl &&
              (routeSummary.status === "route-error" ||
                routeSummary.status === "map-error" ||
                routeSummary.status === "transit-degraded") && (
              <div className="mt-2 rounded-xl bg-secondary/50 p-3">
                <button
                  type="button"
                  onClick={() => openRouteInAmapWeb(routeSummary.fallbackRouteUrl || "")}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  打开高德地图导航（兜底）
                </button>
              </div>
            )}

            {routeSummary.partialErrors.length > 0 && (
              <div className="mt-2 rounded-xl bg-amber-50 text-amber-700 p-3 text-xs leading-5">
                {routeSummary.partialErrors[0]}
                {routeSummary.partialErrors.length > 1 &&
                  `（另有 ${routeSummary.partialErrors.length - 1} 个景点被跳过）`}
              </div>
            )}
          </section>

          <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">行程点列表</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  共 {selectedSpots.length} 个地点 · 预估花费 ¥{totalPrice}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate("explore")}
                  className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
                >
                  继续添加
                </button>
                {hasSpots && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-sm text-muted-foreground hover:text-destructive transition-colors"
                  >
                    清空全部
                  </button>
                )}
              </div>
            </div>

            {hasSpots ? (
              <div className="space-y-3">
                {selectedSpots.map((spot, index) => (
                  <article
                    key={spot.id}
                    className="rounded-xl border border-border/60 bg-background/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </div>
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">
                          {spot.name}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {spot.address}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">
                            {spot.type === "attraction"
                              ? "景点"
                              : spot.type === "restaurant"
                              ? "美食"
                              : "住宿"}
                          </span>
                          <span className="text-sm text-primary font-medium">
                            {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => onViewSpot(spot)}
                          className="h-8 w-8 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeSpot(spot.id)}
                          className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-secondary/40 p-6 text-center">
                <MapPin className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-foreground font-medium mb-1">
                  还没有添加行程点
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  去探索页面发现精彩目的地吧
                </p>
                <button
                  onClick={() => onNavigate("explore")}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  开始探索
                </button>
              </div>
            )}
          </section>

          <button
            onClick={() => onNavigate("ai")}
            className="w-full py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity btn-press flex items-center justify-center gap-2"
          >
            <span>使用AI智能规划行程</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          {savedPlans.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
                <Calendar className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">暂无保存的行程</h3>
              <p className="text-muted-foreground mb-6">
                使用AI规划功能生成并保存您的旅行计划
              </p>
              <button
                onClick={() => onNavigate("ai")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors btn-press"
              >
                开始AI规划
              </button>
            </div>
          ) : (
            <div className="px-6 space-y-4 pb-28">
              {savedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-card rounded-2xl p-5 border border-border/50 card-hover"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {plan.startDate} - {plan.endDate}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-secondary rounded-lg text-xs font-medium">
                      {plan.spots.length} 个地点
                    </span>
                    <span className="px-2 py-1 bg-secondary rounded-lg text-xs font-medium">
                      {plan.pace}节奏
                    </span>
                    <span className="px-2 py-1 bg-secondary rounded-lg text-xs font-medium">
                      {plan.departure}出发
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {plan.spots.slice(0, 4).map((spot) => (
                      <img
                        key={spot.id}
                        src={spot.image}
                        alt={spot.name}
                        className="w-10 h-10 rounded-full border-2 border-card object-cover"
                      />
                    ))}
                    {plan.spots.length > 4 && (
                      <div className="w-10 h-10 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-xs font-medium text-muted-foreground">
                        +{plan.spots.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 mx-6 max-w-sm w-full animate-scale-in">
            <h3 className="text-lg font-bold text-foreground mb-2">确认清空</h3>
            <p className="text-muted-foreground mb-6">
              确定要清空所有行程点吗？此操作无法撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors btn-press"
              >
                取消
              </button>
              <button
                onClick={() => {
                  clearSpots()
                  setShowClearConfirm(false)
                }}
                className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-xl font-medium hover:bg-destructive/90 transition-colors btn-press"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
