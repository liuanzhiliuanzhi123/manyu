"use client"

import { useState } from "react"
import {
  Sparkles,
  Calendar,
  MapPin,
  Loader2,
  CheckCircle,
  Lightbulb,
  Wallet,
  Clock,
  ChevronDown,
  Save,
  Share2,
  RotateCcw,
  Map,
} from "lucide-react"
import { useTravel, TripPlan } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface AIPlannnerPageProps {
  onNavigate: (tab: "explore" | "trips") => void
}

const paceOptions = [
  { id: "relaxed", label: "轻松", desc: "每天2-3个地点" },
  { id: "moderate", label: "适中", desc: "每天3-4个地点" },
  { id: "intensive", label: "紧凑", desc: "每天4-5个地点" },
]

export function AIPlannnerPage({ onNavigate }: AIPlannnerPageProps) {
  const { selectedSpots, savePlan, clearSpots } = useTravel()
  const [step, setStep] = useState<"config" | "generating" | "result">("config")
  const [settings, setSettings] = useState({
    startDate: "",
    endDate: "",
    pace: "moderate",
    departure: "",
    tripName: "",
  })
  const [generatedPlan, setGeneratedPlan] = useState<any>(null)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  const totalPrice = selectedSpots.reduce((sum, s) => sum + s.ticketPrice, 0)
  const attractionCount = selectedSpots.filter((s) => s.type === "attraction").length
  const restaurantCount = selectedSpots.filter((s) => s.type === "restaurant").length

  const handleGenerate = () => {
    if (selectedSpots.length === 0) {
      return
    }

    setStep("generating")

    // 模拟AI生成过程
    setTimeout(() => {
      const plan = {
        days: 3,
        spots: selectedSpots,
        totalBudget: totalPrice + 500, // 加上其他开销
        tips: [
          "建议提前在官网预约故宫门票，避免现场排队",
          "八达岭长城建议乘坐缆车上山，节省体力",
          "南锣鼓巷最好傍晚前往，可以体验夜市氛围",
          "随身携带身份证，部分景点需要实名验证",
        ],
        itinerary: [
          {
            day: 1,
            theme: "历史文化探索",
            spots: selectedSpots.slice(0, Math.ceil(selectedSpots.length / 3)),
          },
          {
            day: 2,
            theme: "自然风光与美食",
            spots: selectedSpots.slice(
              Math.ceil(selectedSpots.length / 3),
              Math.ceil((selectedSpots.length * 2) / 3)
            ),
          },
          {
            day: 3,
            theme: "休闲漫步",
            spots: selectedSpots.slice(Math.ceil((selectedSpots.length * 2) / 3)),
          },
        ],
      }
      setGeneratedPlan(plan)
      setStep("result")
    }, 3000)
  }

  const handleSave = () => {
    if (!generatedPlan) return

    const plan: TripPlan = {
      id: Date.now().toString(),
      name: settings.tripName || "我的北京之旅",
      startDate: settings.startDate,
      endDate: settings.endDate,
      pace:
        paceOptions.find((p) => p.id === settings.pace)?.label || "适中",
      departure: settings.departure || "未设置",
      spots: selectedSpots,
      createdAt: new Date().toISOString(),
    }

    savePlan(plan)
    setShowSaveSuccess(true)

    setTimeout(() => {
      setShowSaveSuccess(false)
    }, 2000)
  }

  const handleReset = () => {
    setStep("config")
    setGeneratedPlan(null)
    setSettings({
      startDate: "",
      endDate: "",
      pace: "moderate",
      departure: "",
      tripName: "",
    })
  }

  if (selectedSpots.length === 0) {
    return (
      <div className="min-h-screen pb-24 animate-fade-in">
        <header className="px-6 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">AI智能规划</h1>
          </div>
          <p className="text-muted-foreground">让AI为您打造完美行程</p>
        </header>

        <div className="px-6 py-12 text-center">
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
            <MapPin className="w-14 h-14 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3">请先添加行程点</h3>
          <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
            前往探索页面，挑选您感兴趣的景点、美食和住宿，AI将为您智能规划行程路线
          </p>
          <button
            onClick={() => onNavigate("explore")}
            className="px-8 py-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity btn-press"
          >
            开始探索目的地
          </button>
        </div>
      </div>
    )
  }

  if (step === "generating") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent animate-pulse-soft" />
            <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">AI正在规划中</h2>
          <p className="text-muted-foreground mb-6">
            正在为您分析 {selectedSpots.length} 个地点的最佳游览路线...
          </p>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === "result" && generatedPlan) {
    return (
      <div className="min-h-screen pb-24 animate-fade-in">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-gradient-to-r from-primary to-accent px-6 pt-12 pb-6">
          <div className="flex items-center gap-3 text-white mb-4">
            <CheckCircle className="w-6 h-6" />
            <span className="font-semibold">规划完成</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {settings.tripName || "北京精彩之旅"}
          </h1>
          <p className="text-white/80">
            为期{generatedPlan.days}天 · {selectedSpots.length}个地点
          </p>
        </header>

        <div className="px-6 -mt-4 space-y-4">
          {/* 行程总览卡片 */}
          <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-lg">
            <h2 className="font-bold text-foreground text-lg mb-4">行程总览</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-secondary rounded-xl">
                <div className="text-2xl font-bold text-primary">{attractionCount}</div>
                <div className="text-xs text-muted-foreground mt-1">景点</div>
              </div>
              <div className="text-center p-3 bg-secondary rounded-xl">
                <div className="text-2xl font-bold text-primary">{restaurantCount}</div>
                <div className="text-xs text-muted-foreground mt-1">美食</div>
              </div>
              <div className="text-center p-3 bg-secondary rounded-xl">
                <div className="text-2xl font-bold text-primary">{generatedPlan.days}</div>
                <div className="text-xs text-muted-foreground mt-1">天</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-accent/10 rounded-xl">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-accent" />
                <span className="text-foreground font-medium">预估总花费</span>
              </div>
              <span className="text-xl font-bold text-primary">¥{generatedPlan.totalBudget}</span>
            </div>
          </div>

          {/* 每日行程 */}
          <div className="space-y-4">
            <h2 className="font-bold text-foreground text-lg">每日行程</h2>
            {generatedPlan.itinerary.map((day: any) => (
              <div
                key={day.day}
                className="bg-card rounded-2xl p-5 border border-border/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                    {day.day}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">第{day.day}天</h3>
                    <p className="text-sm text-muted-foreground">{day.theme}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {day.spots.map((spot: any, index: number) => (
                    <div
                      key={spot.id}
                      className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {index + 1}
                      </div>
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{spot.name}</h4>
                        <p className="text-xs text-muted-foreground">{spot.openTime}</p>
                      </div>
                      <span className="text-sm text-primary font-medium">
                        {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 贴心小贴士 */}
          <div className="bg-accent/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-foreground">贴心小贴士</h2>
            </div>
            <ul className="space-y-3">
              {generatedPlan.tips.map((tip: string, index: number) => (
                <li key={index} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleReset}
              className="flex-1 py-4 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors btn-press flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              重新规划
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity btn-press flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              保存行程
            </button>
          </div>
        </div>

        {/* 保存成功提示 */}
        {showSaveSuccess && (
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-xl shadow-lg animate-slide-in-up flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">行程已保存</span>
          </div>
        )}
      </div>
    )
  }

  // 配置阶段
  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AI智能规划</h1>
        </div>
        <p className="text-muted-foreground">设置您的旅行偏好</p>
      </header>

      <div className="px-6 space-y-6">
        {/* 已选行程点预览 */}
        <div className="bg-card rounded-2xl p-5 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground">已选行程点</h2>
            <span className="text-sm text-primary font-medium">{selectedSpots.length} 个</span>
          </div>
          <div className="flex -space-x-3 mb-4">
            {selectedSpots.slice(0, 5).map((spot) => (
              <img
                key={spot.id}
                src={spot.image}
                alt={spot.name}
                className="w-12 h-12 rounded-full border-3 border-card object-cover"
              />
            ))}
            {selectedSpots.length > 5 && (
              <div className="w-12 h-12 rounded-full bg-secondary border-3 border-card flex items-center justify-center text-sm font-bold text-muted-foreground">
                +{selectedSpots.length - 5}
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate("trips")}
            className="text-sm text-primary font-medium hover:underline"
          >
            管理行程点
          </button>
        </div>

        {/* 行程名称 */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground">行程名称</label>
          <input
            type="text"
            placeholder="例如：北京三日游"
            value={settings.tripName}
            onChange={(e) => setSettings({ ...settings, tripName: e.target.value })}
            className="w-full px-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* 日期选择 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">开始日期</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="date"
                value={settings.startDate}
                onChange={(e) => setSettings({ ...settings, startDate: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">结束日期</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="date"
                value={settings.endDate}
                onChange={(e) => setSettings({ ...settings, endDate: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>
        </div>

        {/* 出发地点 */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground">出发地点</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="例如：上海"
              value={settings.departure}
              onChange={(e) => setSettings({ ...settings, departure: e.target.value })}
              className="w-full pl-12 pr-4 py-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        </div>

        {/* 行程节奏 */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground">行程节奏</label>
          <div className="grid grid-cols-3 gap-3">
            {paceOptions.map((pace) => (
              <button
                key={pace.id}
                onClick={() => setSettings({ ...settings, pace: pace.id })}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all btn-press text-center",
                  settings.pace === pace.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div
                  className={cn(
                    "font-bold mb-1",
                    settings.pace === pace.id ? "text-primary" : "text-foreground"
                  )}
                >
                  {pace.label}
                </div>
                <div className="text-xs text-muted-foreground">{pace.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity btn-press flex items-center justify-center gap-2 mt-4"
        >
          <Sparkles className="w-5 h-5" />
          开始AI智能规划
        </button>
      </div>
    </div>
  )
}
