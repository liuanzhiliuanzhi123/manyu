"use client"

import { useState, useMemo } from "react"
import { Search, Filter, MapPin, Star, Heart, SlidersHorizontal, X } from "lucide-react"
import { useTravel, sampleSpots, Spot } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface ExplorePageProps {
  onViewSpot: (spot: Spot) => void
}

const categories = [
  { id: "all", label: "全部", emoji: "🌟" },
  { id: "attraction", label: "景点", emoji: "🏛️" },
  { id: "restaurant", label: "美食", emoji: "🍜" },
  { id: "hotel", label: "住宿", emoji: "🏨" },
]

const sortOptions = [
  { id: "heat", label: "热度优先" },
  { id: "rating", label: "评分优先" },
  { id: "price-low", label: "价格从低到高" },
  { id: "price-high", label: "价格从高到低" },
]

export function ExplorePage({ onViewSpot }: ExplorePageProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite, searchResults, isSearching, searchSpots } = useTravel()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [sortBy, setSortBy] = useState("heat")
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000])

  // 处理搜索输入变化
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    await searchSpots(query)
  }

  const isInTrip = (id: string) => selectedSpots.some((s) => s.id === id)

  const filteredSpots = useMemo(() => {
    let result = searchQuery ? [...searchResults] : [...sampleSpots]

    // 分类过滤
    if (activeCategory !== "all") {
      result = result.filter((spot) => spot.type === activeCategory)
    }

    // 价格过滤
    result = result.filter(
      (spot) => spot.ticketPrice >= priceRange[0] && spot.ticketPrice <= priceRange[1]
    )

    // 排序
    switch (sortBy) {
      case "heat":
        result.sort((a, b) => b.heat - a.heat)
        break
      case "rating":
        result.sort((a, b) => b.rating - a.rating)
        break
      case "price-low":
        result.sort((a, b) => a.ticketPrice - b.ticketPrice)
        break
      case "price-high":
        result.sort((a, b) => b.ticketPrice - a.ticketPrice)
        break
    }

    return result
  }, [searchQuery, activeCategory, sortBy, priceRange, searchResults, isSearching])

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="px-6 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-foreground mb-4">探索目的地</h1>

          {/* 搜索栏 */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索景点、美食、住宿..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-4 py-3.5 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              {isSearching && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2 animate-spin">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              {searchQuery && (
                <button
                  onClick={async () => {
                    setSearchQuery("")
                    await searchSpots("")
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3.5 rounded-xl transition-all btn-press",
                showFilters
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              )}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 分类标签 */}
        <div className="px-6 pb-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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
        </div>

        {/* 筛选面板 */}
        {showFilters && (
          <div className="px-6 pb-4 animate-slide-in-up">
            <div className="bg-card rounded-xl p-4 border border-border/50 space-y-4">
              {/* 排序 */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">排序方式</label>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSortBy(opt.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all btn-press",
                        sortBy === opt.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 价格范围 */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  价格范围: ¥{priceRange[0]} - ¥{priceRange[1]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="50"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 结果统计 */}
      <div className="px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共找到 <span className="font-semibold text-foreground">{filteredSpots.length}</span> 个结果
        </p>
      </div>

      {/* 景点列表 */}
      <div className="px-6 space-y-4">
        {filteredSpots.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">未找到相关结果</h3>
            <p className="text-muted-foreground">试试其他关键词或调整筛选条件</p>
          </div>
        ) : (
          filteredSpots.map((spot, index) => (
            <div
              key={spot.id}
              onClick={() => onViewSpot(spot)}
              className="bg-card rounded-2xl overflow-hidden border border-border/50 card-hover cursor-pointer animate-slide-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <img
                    src={spot.image}
                    alt={spot.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(spot.id)
                    }}
                    className="absolute top-2 left-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
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
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-bold text-foreground text-lg leading-tight">{spot.name}</h3>
                      <div className="flex items-center gap-1 ml-2">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-foreground">{spot.rating}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{spot.address}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {spot.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-secondary text-xs font-medium text-foreground rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-primary font-bold">
                      {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        addSpot(spot)
                      }}
                      disabled={isInTrip(spot.id)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-sm font-medium transition-all btn-press",
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
            </div>
          ))
        )}
      </div>
    </div>
  )
}
