"use client"

import { useState } from "react"
import { MapPin, Trash2, Eye, X, Clock, Star, ChevronRight, Calendar, Plus } from "lucide-react"
import { useTravel, Spot } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface TripsPageProps {
  onViewSpot: (spot: Spot) => void
  onNavigate: (tab: "explore" | "ai") => void
}

export function TripsPage({ onViewSpot, onNavigate }: TripsPageProps) {
  const { selectedSpots, removeSpot, clearSpots, savedPlans, deletePlan } = useTravel()
  const [activeTab, setActiveTab] = useState<"current" | "saved">("current")
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const totalPrice = selectedSpots.reduce((sum, s) => sum + s.ticketPrice, 0)
  const attractionCount = selectedSpots.filter((s) => s.type === "attraction").length
  const restaurantCount = selectedSpots.filter((s) => s.type === "restaurant").length
  const hotelCount = selectedSpots.filter((s) => s.type === "hotel").length

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <header className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">我的行程</h1>
        <p className="text-muted-foreground">管理您的旅行计划</p>
      </header>

      {/* Tab 切换 */}
      <div className="px-6 mb-6">
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
        <>
          {selectedSpots.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
                <MapPin className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">还没有添加行程点</h3>
              <p className="text-muted-foreground mb-6">去探索页面发现精彩目的地吧</p>
              <button
                onClick={() => onNavigate("explore")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors btn-press"
              >
                开始探索
              </button>
            </div>
          ) : (
            <>
              {/* 行程统计 */}
              <div className="px-6 mb-6">
                <div className="bg-card rounded-2xl p-5 border border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-foreground text-lg">行程概览</h2>
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="text-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                      清空全部
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{selectedSpots.length}</div>
                      <div className="text-xs text-muted-foreground mt-1">总计</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{attractionCount}</div>
                      <div className="text-xs text-muted-foreground mt-1">景点</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{restaurantCount}</div>
                      <div className="text-xs text-muted-foreground mt-1">美食</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{hotelCount}</div>
                      <div className="text-xs text-muted-foreground mt-1">住宿</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-muted-foreground">预估总花费</span>
                    <span className="text-xl font-bold text-primary">¥{totalPrice}</span>
                  </div>
                </div>
              </div>

              {/* 行程点列表 */}
              <div className="px-6 space-y-3">
                <h3 className="font-semibold text-foreground mb-3">行程点列表</h3>
                {selectedSpots.map((spot, index) => (
                  <div
                    key={spot.id}
                    className="bg-card rounded-xl p-4 border border-border/50 animate-slide-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {index + 1}
                      </div>
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{spot.name}</h4>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{spot.address}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-secondary rounded">
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
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => onViewSpot(spot)}
                          className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors btn-press"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeSpot(spot.id)}
                          className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors btn-press"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI规划入口 */}
              <div className="px-6 mt-6">
                <button
                  onClick={() => onNavigate("ai")}
                  className="w-full py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity btn-press flex items-center justify-center gap-2"
                >
                  <span>使用AI智能规划行程</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {savedPlans.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
                <Calendar className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">暂无保存的行程</h3>
              <p className="text-muted-foreground mb-6">使用AI规划功能生成并保存您的旅行计划</p>
              <button
                onClick={() => onNavigate("ai")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors btn-press"
              >
                开始AI规划
              </button>
            </div>
          ) : (
            <div className="px-6 space-y-4">
              {savedPlans.map((plan, index) => (
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

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 mx-6 max-w-sm w-full animate-scale-in">
            <h3 className="text-lg font-bold text-foreground mb-2">确认清空</h3>
            <p className="text-muted-foreground mb-6">确定要清空所有行程点吗？此操作无法撤销。</p>
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
