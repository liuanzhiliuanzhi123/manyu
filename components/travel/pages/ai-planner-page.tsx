"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import {
  Bus,
  Calendar,
  Car,
  CheckCircle,
  ChevronRight,
  Clock,
  Footprints,
  Loader2,
  MapPin,
  RefreshCcw,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { MapView, RouteSummaryInfo, TransportMode } from "@/components/travel/map-view"
import { DailyRouteCard } from "@/components/travel/daily-route-card"
import { ItinerarySummary } from "@/components/travel/itinerary-summary"
import { buildAiItinerary } from "@/lib/route-planner"
import { openRouteInAmapWeb } from "@/lib/open-map-route"
import { useTravel, type TripPlan } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface AIPlannnerPageProps {
  onNavigate: (tab: "explore" | "trips") => void
}

const paceOptions = [
  { id: "relaxed", label: "轻松", desc: "每天 2-3 个地点" },
  { id: "moderate", label: "适中", desc: "每天 3-4 个地点" },
  { id: "intensive", label: "紧凑", desc: "每天 4-5 个地点" },
] as const

const modeOptions: Array<{
  id: TransportMode
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
  { id: "driving", label: "驾车", icon: Car },
  { id: "walking", label: "步行", icon: Footprints },
  { id: "transit", label: "公交", icon: Bus },
]

function createInitialMapSummary(mode: TransportMode): RouteSummaryInfo {
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
    message: "请选择当天行程后查看路线",
    partialErrors: [],
    fallbackRouteUrl: "",
  }
}

export function AIPlannnerPage({ onNavigate }: AIPlannnerPageProps) {
  const { selectedSpots, savePlan } = useTravel()
  const [step, setStep] = useState<"config" | "generating" | "result">("config")
  const [settings, setSettings] = useState({
    startDate: "",
    endDate: "",
    pace: "moderate",
    departure: "",
    tripName: "",
    transportMode: "driving" as TransportMode,
  })
  const [generatedPlan, setGeneratedPlan] = useState<TripPlan | null>(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [mapMode, setMapMode] = useState<TransportMode>("driving")
  const [mapSummary, setMapSummary] = useState<RouteSummaryInfo>(
    createInitialMapSummary("driving")
  )
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  const selectedDay = generatedPlan?.days?.[selectedDayIndex] ?? null

  useEffect(() => {
    setMapMode(settings.transportMode)
    setMapSummary(createInitialMapSummary(settings.transportMode))
  }, [settings.transportMode])

  useEffect(() => {
    if (!generatedPlan?.days?.length) {
      setSelectedDayIndex(0)
      return
    }
    if (selectedDayIndex > generatedPlan.days.length - 1) {
      setSelectedDayIndex(0)
    }
  }, [generatedPlan?.days, selectedDayIndex])

  const hasSpots = selectedSpots.length > 0
  const totalTicketPrice = useMemo(
    () => selectedSpots.reduce((sum, spot) => sum + spot.ticketPrice, 0),
    [selectedSpots]
  )

  const statusToneClass = useMemo(() => {
    if (!generatedPlan?.generationStatus) return "bg-secondary/40 text-muted-foreground"
    if (generatedPlan.generationStatus === "success")
      return "bg-emerald-50 text-emerald-700"
    if (generatedPlan.generationStatus === "partial")
      return "bg-amber-50 text-amber-700"
    return "bg-red-50 text-red-600"
  }, [generatedPlan?.generationStatus])

  const handleGenerate = async () => {
    if (!hasSpots) return
    setShowSaveSuccess(false)
    setStep("generating")

    const routeResult = await buildAiItinerary({
      spots: selectedSpots,
      startDate: settings.startDate,
      endDate: settings.endDate,
      pace: settings.pace,
      departure: settings.departure,
      transportMode: settings.transportMode,
    })

    const paceLabel =
      paceOptions.find((option) => option.id === settings.pace)?.label || "适中"
    const plan: TripPlan = {
      id: `draft-${Date.now()}`,
      name: settings.tripName || "AI 行程规划",
      startDate: settings.startDate || new Date().toISOString().slice(0, 10),
      endDate: settings.endDate || new Date().toISOString().slice(0, 10),
      pace: paceLabel,
      departure: settings.departure || "酒店/出发地",
      spots: selectedSpots,
      createdAt: new Date().toISOString(),
      days: routeResult.days,
      totalDays: routeResult.totalDays,
      totalSpots: routeResult.totalSpots,
      totalDistanceMeters: routeResult.totalDistanceMeters,
      totalTravelSeconds: routeResult.totalTravelSeconds,
      totalPlayMinutes: routeResult.totalPlayMinutes,
      totalEstimatedCost: routeResult.totalEstimatedCost,
      generationStatus: routeResult.status,
      generationNotices: routeResult.notices,
    }

    setGeneratedPlan(plan)
    setSelectedDayIndex(0)
    setMapMode(settings.transportMode)
    setMapSummary(createInitialMapSummary(settings.transportMode))
    setStep("result")
  }

  const handleSave = () => {
    if (!generatedPlan) return
    savePlan({
      ...generatedPlan,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    })
    setShowSaveSuccess(true)
    setTimeout(() => setShowSaveSuccess(false), 1800)
  }

  const handleReset = () => {
    setGeneratedPlan(null)
    setSelectedDayIndex(0)
    setStep("config")
  }

  if (!hasSpots) {
    return (
      <div className="min-h-screen pb-24 animate-fade-in">
        <header className="px-6 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">AI智能规划</h1>
          </div>
          <p className="text-muted-foreground">让 AI 为您生成详细行程路线</p>
        </header>

        <div className="px-6 py-12 text-center">
          <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
            <MapPin className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">请先添加行程点</h3>
          <p className="text-muted-foreground mb-6">
            去探索页面选择景点后，AI 才能生成详细时间线与导航路程
          </p>
          <button
            onClick={() => onNavigate("explore")}
            className="px-8 py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity btn-press"
          >
            去探索添加景点
          </button>
        </div>
      </div>
    )
  }

  if (step === "generating") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">正在生成详细行程</h2>
          <p className="text-muted-foreground">
            正在计算每日路线段、时间线和汇总信息，请稍候...
          </p>
        </div>
      </div>
    )
  }

  if (step === "result" && generatedPlan) {
    return (
      <div className="min-h-screen pb-28 animate-fade-in">
        <header className="sticky top-0 z-30 px-6 pt-12 pb-5 bg-gradient-to-r from-primary to-accent shadow-sm">
          <div className="flex items-center gap-2 text-primary-foreground/90 text-sm mb-2">
            {generatedPlan.generationStatus === "error" ? (
              <TriangleAlert className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>
              {generatedPlan.generationStatus === "success"
                ? "路线生成完成"
                : generatedPlan.generationStatus === "partial"
                ? "部分路段为预估"
                : "路线生成异常，已降级"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">
            {generatedPlan.name}
          </h1>
          <p className="text-primary-foreground/80 text-sm mt-1">
            {generatedPlan.totalDays ?? 0} 天 · {generatedPlan.totalSpots ?? 0} 个地点
          </p>
        </header>

        <div className="px-6 -mt-2 space-y-4">
          <ItinerarySummary plan={generatedPlan} />

          {generatedPlan.generationNotices && generatedPlan.generationNotices.length > 0 && (
            <section className={cn("rounded-2xl p-4 text-xs leading-6", statusToneClass)}>
              {generatedPlan.generationNotices.map((notice, index) => (
                <p key={`${notice}-${index}`}>• {notice}</p>
              ))}
            </section>
          )}

          {generatedPlan.days && generatedPlan.days.length > 0 ? (
            <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-foreground">当天地图路线</h3>
                <span className="text-xs text-muted-foreground">
                  与下方文字路线保持同顺序
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                {generatedPlan.days.map((day, index) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setSelectedDayIndex(index)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors",
                      selectedDayIndex === index
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-transparent hover:bg-secondary/80"
                    )}
                  >
                    第 {day.day} 天
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {modeOptions.map((option) => {
                  const Icon = option.icon
                  const active = mapMode === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setMapMode(option.id)
                        setMapSummary((prev) => ({ ...prev, mode: option.id }))
                      }}
                      className={cn(
                        "rounded-xl px-2 py-2 text-xs border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/70 text-foreground border-transparent"
                      )}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      {option.label}
                    </button>
                  )
                })}
              </div>

              {selectedDay ? (
                <>
                  <MapView
                    spots={selectedDay.spots}
                    transportMode={mapMode}
                    routeMode="trip"
                    onSummaryChange={setMapSummary}
                  />
                  <div className="mt-3 rounded-xl bg-secondary/40 p-3 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>总距离：{mapSummary.distanceText}</span>
                      <span>预计耗时：{mapSummary.durationText}</span>
                    </div>
                    <p className="mt-2 text-muted-foreground">{mapSummary.message}</p>
                    {mapSummary.fallbackRouteUrl &&
                      (mapSummary.status === "route-error" ||
                        mapSummary.status === "map-error" ||
                        mapSummary.status === "transit-degraded") && (
                        <button
                          type="button"
                          onClick={() => openRouteInAmapWeb(mapSummary.fallbackRouteUrl || "")}
                          className="mt-2 w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium"
                        >
                          打开高德地图导航（兜底）
                        </button>
                      )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
                  当前没有可展示的日程路线
                </div>
              )}
            </section>
          ) : (
            <section className="bg-card rounded-2xl border border-border/60 p-5 text-sm text-muted-foreground">
              未生成任何可展示的每日行程，请返回重新规划。
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">每日详细时间线</h2>
            {(generatedPlan.days || []).map((day) => (
              <DailyRouteCard key={day.day} day={day} />
            ))}
          </section>

          <section className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              重新规划
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存行程
            </button>
          </section>
        </div>

        {showSaveSuccess && (
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm shadow-lg">
            已保存到我的行程
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AI智能规划</h1>
        </div>
        <p className="text-muted-foreground">生成详细时间线与导航路线</p>
      </header>

      <div className="px-6 space-y-5">
        <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">已选景点</h2>
            <span className="text-sm text-primary font-medium">{selectedSpots.length} 个</span>
          </div>
          <div className="mt-3 flex -space-x-3">
            {selectedSpots.slice(0, 6).map((spot) => (
              <img
                key={spot.id}
                src={spot.image}
                alt={spot.name}
                className="w-11 h-11 rounded-full border-2 border-card object-cover"
              />
            ))}
            {selectedSpots.length > 6 && (
              <div className="w-11 h-11 rounded-full border-2 border-card bg-secondary flex items-center justify-center text-xs font-semibold text-muted-foreground">
                +{selectedSpots.length - 6}
              </div>
            )}
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            当前门票合计约 ¥{totalTicketPrice}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("trips")}
            className="mt-3 text-sm text-primary font-medium inline-flex items-center gap-1"
          >
            去管理行程点
            <ChevronRight className="w-4 h-4" />
          </button>
        </section>

        <section className="space-y-3">
          <label className="text-sm font-medium text-foreground">行程名称</label>
          <input
            type="text"
            placeholder="例如：北京三日路线"
            value={settings.tripName}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, tripName: event.target.value }))
            }
            className="w-full rounded-xl bg-secondary px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">开始日期</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={settings.startDate}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, startDate: event.target.value }))
                }
                className="w-full rounded-xl bg-secondary py-3 pl-10 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">结束日期</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={settings.endDate}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, endDate: event.target.value }))
                }
                className="w-full rounded-xl bg-secondary py-3 pl-10 pr-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium text-foreground">出发地/酒店</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="例如：北京饭店"
              value={settings.departure}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, departure: event.target.value }))
              }
              className="w-full rounded-xl bg-secondary py-3 pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium text-foreground">行程节奏</label>
          <div className="grid grid-cols-3 gap-2">
            {paceOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, pace: option.id }))}
                className={cn(
                  "rounded-xl border px-2 py-3 text-xs transition-colors",
                  settings.pace === option.id
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "bg-card text-foreground border-border"
                )}
              >
                <p className="font-semibold">{option.label}</p>
                <p className="text-[11px] mt-1 text-muted-foreground">{option.desc}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium text-foreground">默认出行方式</label>
          <div className="grid grid-cols-3 gap-2">
            {modeOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, transportMode: option.id }))
                  }
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs transition-colors",
                    settings.transportMode === option.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/70 text-foreground border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={handleGenerate}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity btn-press flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          生成详细行程路线
        </button>
      </div>
    </div>
  )
}
