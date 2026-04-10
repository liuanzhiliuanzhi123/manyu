"use client"

import { useState } from "react"
import { Search, MapPin, Star, TrendingUp, ChevronRight, Heart } from "lucide-react"
import { useTravel, sampleSpots, Spot } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface HomePageProps {
  onNavigate: (tab: "explore" | "trips" | "ai") => void
  onViewSpot: (spot: Spot) => void
}

const categories = [
  { id: "all", label: "全部", emoji: "🌟" },
  { id: "attraction", label: "景点", emoji: "🏛️" },
  { id: "restaurant", label: "美食", emoji: "🍜" },
  { id: "hotel", label: "住宿", emoji: "🏨" },
]

export function HomePage({ onNavigate, onViewSpot }: HomePageProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite } = useTravel()
  const [activeCategory, setActiveCategory] = useState("all")

  const featuredSpots = sampleSpots.slice(0, 3)
  const trendingSpots = sampleSpots.filter((s) => s.heat >= 90).slice(0, 4)

  const isInTrip = (id: string) => selectedSpots.some((s) => s.id === id)

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
        <div className="relative px-6 pt-12 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-muted-foreground text-sm font-medium">欢迎来到</p>
              <h1 className="text-3xl font-bold text-foreground mt-1">
                途境<span className="gradient-text">漫语</span>
              </h1>
            </div>
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-2xl">🌏</span>
            </div>
          </div>

          {/* 搜索栏 */}
          <div
            onClick={() => onNavigate("explore")}
            className="flex items-center gap-3 bg-card rounded-2xl px-4 py-4 shadow-sm border border-border/50 cursor-pointer hover:shadow-md transition-shadow"
          >
            <Search className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground">搜索目的地、景点、美食...</span>
          </div>
        </div>
      </header>

      {/* 快捷入口 */}
      <section className="px-6 py-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onNavigate("explore")}
            className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl border border-border/50 hover:border-primary/30 transition-all card-hover btn-press"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🗺️</span>
            </div>
            <span className="text-sm font-medium text-foreground">发现景点</span>
          </button>
          <button
            onClick={() => onNavigate("ai")}
            className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl border border-border/50 hover:border-primary/30 transition-all card-hover btn-press"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
            <span className="text-sm font-medium text-foreground">AI规划</span>
          </button>
          <button
            onClick={() => onNavigate("trips")}
            className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl border border-border/50 hover:border-primary/30 transition-all card-hover btn-press"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <span className="text-sm font-medium text-foreground">我的行程</span>
          </button>
        </div>
      </section>

      {/* 分类标签 */}
      <section className="px-6 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all btn-press",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              )}
            >
              <span>{cat.emoji}</span>
              <span className="text-sm font-medium">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 精选推荐 */}
      <section className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">精选推荐</h2>
          <button
            onClick={() => onNavigate("explore")}
            className="flex items-center gap-1 text-primary text-sm font-medium hover:underline"
          >
            查看更多
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-2 px-2">
          {featuredSpots.map((spot, index) => (
            <div
              key={spot.id}
              className="flex-shrink-0 w-72 bg-card rounded-2xl overflow-hidden border border-border/50 card-hover cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => onViewSpot(spot)}
            >
              <div className="relative h-40">
                <img
                  src={spot.image}
                  alt={spot.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(spot.id)
                  }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                >
                  <Heart
                    className={cn(
                      "w-4 h-4",
                      favorites.includes(spot.id)
                        ? "fill-red-500 text-red-500"
                        : "text-muted-foreground"
                    )}
                  />
                </button>
                <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/90 px-2 py-1 rounded-lg">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">{spot.rating}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-foreground text-lg mb-1">{spot.name}</h3>
                <div className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{spot.address}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {spot.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-secondary text-xs font-medium text-foreground rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addSpot(spot)
                    }}
                    disabled={isInTrip(spot.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all btn-press",
                      isInTrip(spot.id)
                        ? "bg-muted text-muted-foreground cursor-default"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {isInTrip(spot.id) ? "已添加" : "加入行程"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 热门榜单 */}
      <section className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">热门榜单</h2>
          </div>
        </div>

        <div className="space-y-3">
          {trendingSpots.map((spot, index) => (
            <div
              key={spot.id}
              onClick={() => onViewSpot(spot)}
              className="flex items-center gap-4 p-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                  index === 0
                    ? "bg-amber-100 text-amber-600"
                    : index === 1
                    ? "bg-gray-100 text-gray-600"
                    : index === 2
                    ? "bg-orange-100 text-orange-600"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {index + 1}
              </div>
              <img
                src={spot.image}
                alt={spot.name}
                className="w-14 h-14 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{spot.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm text-muted-foreground">{spot.rating}</span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-accent font-medium">热度 {spot.heat}%</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addSpot(spot)
                }}
                disabled={isInTrip(spot.id)}
                className={cn(
                  "p-2 rounded-lg transition-all btn-press",
                  isInTrip(spot.id)
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                )}
              >
                {isInTrip(spot.id) ? "已添加" : "+"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 底部提示 */}
      <section className="px-6 py-6">
        <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-secondary rounded-2xl p-6 text-center">
          <h3 className="text-lg font-bold text-foreground mb-2">开始规划您的旅程</h3>
          <p className="text-muted-foreground text-sm mb-4">
            让AI为您打造专属旅行计划，省时省心
          </p>
          <button
            onClick={() => onNavigate("ai")}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors btn-press"
          >
            立即体验AI规划
          </button>
        </div>
      </section>
    </div>
  )
}
