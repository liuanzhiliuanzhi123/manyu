"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { ArrowDownUp, Compass, Search, SlidersHorizontal, X } from "lucide-react"
import { VirtualizedPlaceList } from "@/components/travel/virtualized-place-list"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppChip } from "@/components/ui/app-chip"
import { AppInput } from "@/components/ui/app-input"
import { AppPageHeader } from "@/components/ui/app-page-header"
import { AppTag } from "@/components/ui/app-tag"
import { useDebouncedValue } from "@/lib/planner-performance"
import { beijingPois, beijingPoiToSpot } from "@/lib/places/beijing-poi-data"
import {
  countPoisByRoot,
  countPoisBySubTag,
  filterBeijingPois,
} from "@/lib/places/poi-filter"
import {
  BEIJING_ROOT_CATEGORIES,
  ROOT_CATEGORY_LABELS,
  SUB_TAG_LABELS,
  SUB_TAGS_BY_ROOT,
  type BeijingPoiRootCategory,
  type BeijingPoiSubTag,
} from "@/lib/places/poi-types"
import { type Spot, useTravel } from "@/lib/travel-context"

interface ExplorePageProps {
  onViewSpot: (spot: Spot) => void
}

type SortMode = "heat" | "rating" | "price-low" | "price-high"

const sortOptions: Array<{ id: SortMode; label: string }> = [
  { id: "heat", label: "综合优先" },
  { id: "rating", label: "评分优先" },
  { id: "price-low", label: "价格从低到高" },
  { id: "price-high", label: "价格从高到低" },
]

const PRICE_RANGE: [number, number] = [0, 4000]

function normalizeKeyword(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "")
}

function sortPois(spots: Spot[], sortBy: SortMode) {
  const sorted = [...spots]
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
}

function getEmptyStateDescription(rootCategory: BeijingPoiRootCategory) {
  if (rootCategory === "food") {
    return "当前筛选下暂无匹配美食，可以清除子标签、区域或价格范围后继续浏览。"
  }
  if (rootCategory === "hotel") {
    return "当前筛选下暂无匹配酒店，可以清除子标签、区域或价格范围后继续浏览。"
  }
  return "当前筛选下暂无匹配景区，可以清除子标签、区域或关键词后继续浏览。"
}

export function ExplorePage({ onViewSpot }: ExplorePageProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite } = useTravel()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeRootCategory, setActiveRootCategory] = useState<BeijingPoiRootCategory>("scenic")
  const [activeSubTag, setActiveSubTag] = useState<BeijingPoiSubTag | "all">("all")
  const [sortBy, setSortBy] = useState<SortMode>("heat")
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState<[number, number]>(PRICE_RANGE)
  const [activeDistrict, setActiveDistrict] = useState("all")

  const debouncedQuery = useDebouncedValue(searchQuery, 220)
  const keyword = useMemo(() => normalizeKeyword(debouncedQuery), [debouncedQuery])

  const allFormalPois = useMemo(() => filterBeijingPois(beijingPois), [])
  const categoryCounter = useMemo(() => countPoisByRoot(allFormalPois), [allFormalPois])

  const rootPois = useMemo(
    () => filterBeijingPois(beijingPois, { rootCategory: activeRootCategory }),
    [activeRootCategory]
  )

  const subTagCounter = useMemo(() => countPoisBySubTag(rootPois), [rootPois])
  const availableSubTags = useMemo(
    () => SUB_TAGS_BY_ROOT[activeRootCategory].filter((tag) => (subTagCounter.get(tag) || 0) > 0),
    [activeRootCategory, subTagCounter]
  )

  const districtOptions = useMemo(() => {
    const districtMap = new Map<string, number>()
    for (const poi of rootPois) {
      const district = poi.district?.trim()
      if (!district) continue
      districtMap.set(district, (districtMap.get(district) || 0) + 1)
    }
    return [...districtMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([district]) => district)
  }, [rootPois])

  const filteredSpots = useMemo(() => {
    const pois = filterBeijingPois(beijingPois, {
      rootCategory: activeRootCategory,
      subTag: activeSubTag,
      query: keyword,
      district: activeDistrict,
      priceRange,
    })
    return sortPois(pois.map(beijingPoiToSpot), sortBy)
  }, [activeDistrict, activeRootCategory, activeSubTag, keyword, priceRange, sortBy])

  const deferredSpots = useDeferredValue(filteredSpots)
  const isInTrip = (id: string) => selectedSpots.some((spot) => spot.id === id)
  const emptyStateDescription = getEmptyStateDescription(activeRootCategory)

  function clearFilters() {
    setSearchQuery("")
    setActiveSubTag("all")
    setSortBy("heat")
    setPriceRange(PRICE_RANGE)
    setActiveDistrict("all")
  }

  function switchRootCategory(rootCategory: BeijingPoiRootCategory) {
    setActiveRootCategory(rootCategory)
    setActiveSubTag("all")
    setActiveDistrict("all")
    setPriceRange(PRICE_RANGE)
  }

  return (
    <div className="app-page animate-fade-in space-y-4">
      <header className="space-y-3">
        <AppPageHeader title="发现北京地点" />

        <AppCard tone="elevated" padding="md" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-[var(--app-text-muted)]" />
            <AppInput
              type="text"
              density="lg"
              tone="subtle"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索北京景区、美食、酒店、商圈"
              className="pl-10 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[var(--app-radius-xs)] p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
                aria-label="清空搜索"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {BEIJING_ROOT_CATEGORIES.map((rootCategory) => (
                <AppChip
                  key={rootCategory}
                  type="button"
                  selected={activeRootCategory === rootCategory}
                  onClick={() => switchRootCategory(rootCategory)}
                >
                  {ROOT_CATEGORY_LABELS[rootCategory]}
                  <span className="numeric ml-1 text-[10px] opacity-80">
                    {categoryCounter[rootCategory]}
                  </span>
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

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <AppChip
              type="button"
              selected={activeSubTag === "all"}
              compact
              onClick={() => setActiveSubTag("all")}
            >
              全部{ROOT_CATEGORY_LABELS[activeRootCategory]}
            </AppChip>
            {availableSubTags.map((tag) => (
              <AppChip
                key={tag}
                type="button"
                selected={activeSubTag === tag}
                compact
                onClick={() => setActiveSubTag(tag)}
              >
                {SUB_TAG_LABELS[tag]}
                <span className="numeric ml-1 text-[10px] opacity-80">
                  {subTagCounter.get(tag) || 0}
                </span>
              </AppChip>
            ))}
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
                  北京范围 {activeDistrict !== "all" ? `· ${activeDistrict}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <AppChip
                    type="button"
                    compact
                    selected={activeDistrict === "all"}
                    onClick={() => setActiveDistrict("all")}
                  >
                    北京全部
                  </AppChip>
                  {districtOptions.map((district) => (
                    <AppChip
                      key={district}
                      type="button"
                      compact
                      selected={activeDistrict === district}
                      onClick={() => setActiveDistrict(district)}
                    >
                      {district}
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
                  min={PRICE_RANGE[0]}
                  max={PRICE_RANGE[1]}
                  step={50}
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
          共找到{" "}
          <span className="numeric font-semibold text-[var(--app-text-strong)]">
            {filteredSpots.length}
          </span>{" "}
          个{ROOT_CATEGORY_LABELS[activeRootCategory]}候选
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
                <p className="text-sm leading-6 text-[var(--app-text-secondary)]">
                  {emptyStateDescription}
                </p>
              </div>
            </div>
            <AppButton type="button" variant="secondary" onClick={clearFilters} className="w-full">
              清除筛选
            </AppButton>
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
