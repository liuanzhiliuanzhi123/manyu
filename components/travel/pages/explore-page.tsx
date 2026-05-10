"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { ArrowDownUp, Compass, Search, SlidersHorizontal, X } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppChip } from "@/components/ui/app-chip"
import { AppInput } from "@/components/ui/app-input"
import { AppPageHeader } from "@/components/ui/app-page-header"
import { AppTag } from "@/components/ui/app-tag"
import { VirtualizedPlaceList } from "@/components/travel/virtualized-place-list"
import { getPlaceRegion } from "@/lib/place-region"
import { useDebouncedValue } from "@/lib/planner-performance"
import { Spot, sampleSpots, useTravel } from "@/lib/travel-context"

interface ExplorePageProps {
  onViewSpot: (spot: Spot) => void
}

type SpotCategory = "all" | "attraction" | "restaurant" | "hotel"
type SortMode = "heat" | "rating" | "price-low" | "price-high"
type ThemeTab = "recommended" | "domestic" | "asia" | "europe" | "nature" | "culture"

const categories: Array<{ id: SpotCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "attraction", label: "景点" },
  { id: "restaurant", label: "美食" },
  { id: "hotel", label: "酒店" },
]

const themeTabs: Array<{ id: ThemeTab; label: string }> = [
  { id: "recommended", label: "推荐" },
  { id: "domestic", label: "国内" },
  { id: "asia", label: "亚洲" },
  { id: "europe", label: "欧洲" },
  { id: "nature", label: "自然" },
  { id: "culture", label: "文化" },
]

const sortOptions: Array<{ id: SortMode; label: string }> = [
  { id: "heat", label: "热度优先" },
  { id: "rating", label: "评分优先" },
  { id: "price-low", label: "价格从低到高" },
  { id: "price-high", label: "价格从高到低" },
]

function normalizeKeyword(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "")
}

function matchesKeyword(spot: Spot, keyword: string) {
  if (!keyword) return true
  const source = [
    spot.name,
    spot.address,
    spot.city,
    spot.province,
    spot.district,
    spot.tags.join(" "),
    spot.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "")
  return source.includes(keyword)
}

function matchesTheme(spot: Spot, theme: ThemeTab) {
  if (theme === "recommended") {
    return true
  }
  if (theme === "domestic") {
    return getPlaceRegion(spot) === "domestic"
  }
  if (theme === "asia") {
    return getPlaceRegion(spot) === "asia"
  }
  if (theme === "europe") {
    return getPlaceRegion(spot) === "europe"
  }
  const joined = `${spot.name} ${spot.description} ${spot.tags.join(" ")}`
  if (theme === "nature") {
    return /自然|公园|山|湖|森林|户外|风景|生态/u.test(joined)
  }
  if (theme === "culture") {
    return /历史|文化|古迹|博物馆|艺术|人文|宫|寺/u.test(joined)
  }
  return true
}

function getEmptyStateDescription(theme: ThemeTab, category: SpotCategory, themedCount: number, categorizedCount: number) {
  if (theme === "europe" && themedCount === 0) {
    return "当前暂无欧洲目的地候选，可以切换其他地区，或继续补充欧洲目的地数据。"
  }
  if (theme === "asia" && themedCount === 0) {
    return "当前暂无亚洲目的地候选，可以先切换到国内，或继续补充目的地数据。"
  }
  if (theme === "domestic" && themedCount === 0) {
    return "当前暂无国内目的地候选，可以切换到推荐，或调整筛选条件。"
  }
  if (category === "hotel" && categorizedCount === 0) {
    return "当前暂无酒店候选，可以清除类型筛选或调整价格范围。"
  }
  if (category === "restaurant" && categorizedCount === 0) {
    return "当前暂无美食候选，可以清除类型筛选或调整关键词。"
  }
  if (category === "attraction" && categorizedCount === 0) {
    return "当前暂无景点候选，可以清除类型筛选或调整关键词。"
  }
  return "当前筛选下暂无匹配候选，可以清除筛选后重新浏览。"
}

export function ExplorePage({ onViewSpot }: ExplorePageProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite } = useTravel()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<SpotCategory>("all")
  const [activeTheme, setActiveTheme] = useState<ThemeTab>("recommended")
  const [sortBy, setSortBy] = useState<SortMode>("heat")
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
  const [activeCity, setActiveCity] = useState("all")

  const debouncedQuery = useDebouncedValue(searchQuery, 220)
  const keyword = useMemo(() => normalizeKeyword(debouncedQuery), [debouncedQuery])

  const themedSpots = useMemo(() => {
    return sampleSpots.filter((spot) => matchesTheme(spot, activeTheme))
  }, [activeTheme])

  const cityOptions = useMemo(() => {
    const cityMap = new Map<string, number>()
    for (const spot of themedSpots) {
      const city = spot.city?.trim()
      if (!city) continue
      cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
    }
    return [...cityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([city]) => city)
  }, [themedSpots])

  const categoryCounter = useMemo(() => {
    return themedSpots.reduce(
      (acc, spot) => {
        acc.all += 1
        if (spot.type === "attraction") acc.attraction += 1
        if (spot.type === "restaurant") acc.restaurant += 1
        if (spot.type === "hotel") acc.hotel += 1
        return acc
      },
      { all: 0, attraction: 0, restaurant: 0, hotel: 0 }
    )
  }, [themedSpots])

  const categorizedSpots = useMemo(() => {
    let base = themedSpots
    if (activeCategory !== "all") {
      base = base.filter((spot) => spot.type === activeCategory)
    }
    return base
  }, [activeCategory, themedSpots])

  const filteredSpots = useMemo(() => {
    let result = categorizedSpots

    if (activeCity !== "all") {
      result = result.filter((spot) => (spot.city || "").trim() === activeCity)
    }

    result = result.filter(
      (spot) => spot.ticketPrice >= priceRange[0] && spot.ticketPrice <= priceRange[1]
    )

    if (keyword) {
      result = result.filter((spot) => matchesKeyword(spot, keyword))
    }

    const sorted = [...result]
    switch (sortBy) {
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating)
        break
      case "price-low":
        sorted.sort((a, b) => a.ticketPrice - b.ticketPrice)
        break
      case "price-high":
        sorted.sort((a, b) => b.ticketPrice - a.ticketPrice)
        break
      default:
        sorted.sort((a, b) => b.heat - a.heat)
    }
    return sorted
  }, [activeCity, categorizedSpots, keyword, priceRange, sortBy])

  const deferredSpots = useDeferredValue(filteredSpots)
  const isInTrip = (id: string) => selectedSpots.some((spot) => spot.id === id)
  const emptyStateDescription = getEmptyStateDescription(
    activeTheme,
    activeCategory,
    themedSpots.length,
    categorizedSpots.length
  )

  function clearFilters() {
    setSearchQuery("")
    setActiveCategory("all")
    setSortBy("heat")
    setPriceRange([0, 2000])
    setActiveCity("all")
  }

  function returnToRecommended() {
    clearFilters()
    setActiveTheme("recommended")
  }

  return (
    <div className="app-page animate-fade-in space-y-4">
      <header className="space-y-3">
        <AppPageHeader title="发现目的地" />

        <AppCard tone="elevated" padding="md" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-[var(--app-text-muted)]" />
            <AppInput
              type="text"
              density="lg"
              tone="subtle"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索景点、美食、酒店、商圈"
              className="pl-10 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[var(--app-radius-xs)] p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {themeTabs.map((item) => (
              <AppChip
                key={item.id}
                type="button"
                selected={activeTheme === item.id}
                compact
                onClick={() => {
                  setActiveTheme(item.id)
                  setActiveCity("all")
                }}
              >
                {item.label}
              </AppChip>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map((item) => (
                <AppChip
                  key={item.id}
                  type="button"
                  selected={activeCategory === item.id}
                  onClick={() => setActiveCategory(item.id)}
                >
                  {item.label}
                  <span className="numeric ml-1 text-[10px] opacity-80">{categoryCounter[item.id]}</span>
                </AppChip>
              ))}
            </div>
            <AppButton
              type="button"
              variant={showFilters ? "primary" : "secondary"}
              size="icon"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label="切换筛选"
            >
              <SlidersHorizontal className="h-[1.05rem] w-[1.05rem]" />
            </AppButton>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface)] p-3">
              <div>
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-secondary)]">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  排序方式
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sortOptions.map((item) => (
                    <AppChip
                      key={item.id}
                      type="button"
                      compact
                      selected={sortBy === item.id}
                      onClick={() => setSortBy(item.id)}
                    >
                      {item.label}
                    </AppChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[var(--app-text-secondary)]">
                  城市筛选 {activeCity !== "all" ? `· ${activeCity}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <AppChip type="button" compact selected={activeCity === "all"} onClick={() => setActiveCity("all")}>
                    全部城市
                  </AppChip>
                  {cityOptions.map((city) => (
                    <AppChip
                      key={city}
                      type="button"
                      compact
                      selected={activeCity === city}
                      onClick={() => setActiveCity(city)}
                    >
                      {city}
                    </AppChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="numeric mb-2 text-xs font-medium text-[var(--app-text-secondary)]">
                  价格范围 ¥{priceRange[0]} - ¥{priceRange[1]}
                </p>
                <input
                  type="range"
                  min={0}
                  max={4000}
                  step={20}
                  value={priceRange[1]}
                  onChange={(event) => setPriceRange([priceRange[0], Number(event.target.value)])}
                  className="w-full accent-[var(--app-brand)]"
                />
              </div>
            </div>
          )}
        </AppCard>
      </header>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--app-text-secondary)]">
          共找到 <span className="numeric font-semibold text-[var(--app-text-strong)]">{filteredSpots.length}</span> 个候选
        </p>
        {deferredSpots !== filteredSpots ? (
          <span className="text-xs text-[var(--app-text-muted)]">列表更新中...</span>
        ) : (
          <AppTag tone="brand">{sortOptions.find((item) => item.id === sortBy)?.label}</AppTag>
        )}
      </div>

      <div className="pb-6">
        {deferredSpots.length === 0 ? (
          <AppCard tone="elevated" padding="lg" className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-[var(--app-brand-soft)] text-[var(--app-brand-strong)]">
                <Compass className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <h3 className="text-base font-semibold text-[var(--app-text-strong)]">暂无匹配候选</h3>
                <p className="text-sm leading-6 text-[var(--app-text-secondary)]">{emptyStateDescription}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AppButton type="button" variant="secondary" onClick={clearFilters}>
                清除筛选
              </AppButton>
              <AppButton type="button" variant="primary" onClick={returnToRecommended}>
                返回推荐
              </AppButton>
            </div>
          </AppCard>
        ) : (
          <VirtualizedPlaceList
            items={deferredSpots}
            favorites={favorites}
            isInTrip={isInTrip}
            onToggleFavorite={toggleFavorite}
            onViewSpot={onViewSpot}
            onAddSpot={addSpot}
          />
        )}
      </div>
    </div>
  )
}
