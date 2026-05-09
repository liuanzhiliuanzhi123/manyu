"use client"

import { useMemo, useState } from "react"
import {
  Compass,
  Heart,
  LoaderCircle,
  MapPin,
  MapPinned,
  Route,
  Search,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppChip } from "@/components/ui/app-chip"
import { AppIconButton } from "@/components/ui/app-icon-button"
import { AppInput } from "@/components/ui/app-input"
import { AppPageHeader } from "@/components/ui/app-page-header"
import { AppSection } from "@/components/ui/app-section"
import { AppStatCard } from "@/components/ui/app-stat-card"
import { AppTag } from "@/components/ui/app-tag"
import { resolvePlaceImage } from "@/lib/place-image"
import { RECOMMENDED_CITIES } from "@/lib/planner-city-data"
import { Spot, sampleSpots, useTravel } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface HomePageProps {
  onNavigate: (
    tab: "explore" | "trips" | "ai",
    options?: {
      destination?: {
        province: string
        city: string
        cityTagline?: string
        tags?: string[]
      }
      source?: "home-city" | "trips" | "direct"
    }
  ) => void
  onViewSpot: (spot: Spot) => void
}

const categoryTabs = [
  { id: "all", label: "全部" },
  { id: "attraction", label: "景点" },
  { id: "restaurant", label: "美食" },
  { id: "hotel", label: "酒店" },
] as const

function getCityPreview(city: string, province: string) {
  const sample = sampleSpots.find((spot) => spot.city === city) ?? sampleSpots[0]
  return resolvePlaceImage({
    id: sample?.id,
    name: sample?.name || city,
    city,
    province,
    image: sample?.image,
    coverImage: sample?.image,
  })
}

export function HomePage({ onNavigate, onViewSpot }: HomePageProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite, currentPlan } = useTravel()
  const [activeCategory, setActiveCategory] = useState<(typeof categoryTabs)[number]["id"]>("all")

  const recommendedCities = useMemo(() => RECOMMENDED_CITIES.slice(0, 6), [])
  const featuredSpots = useMemo(() => sampleSpots.slice(0, 10), [])

  const filteredFeaturedSpots = useMemo(() => {
    if (activeCategory === "all") return featuredSpots
    return featuredSpots.filter((spot) => spot.type === activeCategory)
  }, [activeCategory, featuredSpots])

  const isInTrip = (id: string) => selectedSpots.some((spot) => spot.id === id)
  const hasDraft = Boolean(currentPlan)

  return (
    <div className="app-page animate-fade-in space-y-6">
      <section className="space-y-4">
        <AppPageHeader
          label="AI TRAVEL ASSISTANT"
          title={<span className="gradient-text">途境漫语</span>}
          subtitle="让 AI 为你规划这次旅行，从灵感到行程一站完成。"
          trailing={
            <div className="relative mt-1">
              <AppIconButton
                type="button"
                variant="secondary"
                size="lg"
                aria-label="品牌图标"
                className="rounded-[16px]"
              >
                <MapPinned className="h-5 w-5 text-[var(--app-brand)]" />
              </AppIconButton>
              <Compass className="pointer-events-none absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[var(--app-brand)] p-[2px] text-white" />
            </div>
          }
        />

        <AppCard tone="elevated" padding="none" className="hero-scenic-bg relative overflow-hidden text-white">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(21,33,12,0.06)_0%,rgba(21,33,12,0.42)_100%)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(20,28,14,0.24)_100%)]" />
          <div className="pointer-events-none absolute -bottom-8 -left-6 h-28 w-44 rounded-[40px] bg-[rgba(205,221,170,0.32)]" />
          <div className="pointer-events-none absolute -bottom-10 right-6 h-32 w-44 rounded-[52px] bg-[rgba(148,170,86,0.3)]" />
          <div className="pointer-events-none absolute left-8 top-12 h-[1px] w-28 border-t border-dashed border-white/70" />
          <MapPin className="pointer-events-none absolute left-34 top-10 h-4 w-4 text-white/90" />

          <div className="relative space-y-4 px-5 py-5">
            <AppTag className="w-fit border-white/20 bg-white/14 text-white">AI 旅程主引擎</AppTag>
            <div className="space-y-2">
              <h2 className="text-[1.5rem] font-semibold leading-[1.22]">生成你的专属旅行手册</h2>
              <p className="max-w-[90%] text-[13px] leading-6 text-white/85">
                输入城市、天数和偏好，自动输出按天编排的路线、景点、吃住和地图建议。
              </p>
            </div>
            <AppButton
              type="button"
              size="lg"
              className="w-full border border-white/40 bg-white/92 text-[var(--brand-deep)] hover:bg-white"
              onClick={() => onNavigate("ai")}
            >
              <WandSparkles className="h-[1.06rem] w-[1.06rem]" />
              开始 AI 规划
            </AppButton>
            <AppButton
              type="button"
              variant="ghost"
              size="lg"
              className="w-full border border-white/28 bg-white/10 text-white hover:bg-white/18 hover:text-white"
              onClick={() => onNavigate("explore")}
            >
              <Compass className="h-[1.04rem] w-[1.04rem]" />
              浏览目的地
            </AppButton>
          </div>
        </AppCard>

        <AppCard tone="elevated" padding="md" className="space-y-2.5">
          <button type="button" onClick={() => onNavigate("explore")} className="block w-full text-left">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 text-[var(--app-text-muted)]" />
              <AppInput
                readOnly
                tone="subtle"
                value="搜索城市、景点、美食或酒店"
                className="cursor-pointer pl-10 text-[var(--app-text-secondary)]"
              />
            </div>
          </button>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onNavigate("ai")}
              className="btn-press rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-2 py-2 text-center transition-colors hover:bg-[var(--app-surface-elevated)]"
            >
              <Sparkles className="mx-auto h-4 w-4 text-[var(--app-brand)]" />
              <p className="mt-1 text-[11px] text-[var(--app-text-primary)]">智能规划</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("trips")}
              className="btn-press rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-2 py-2 text-center transition-colors hover:bg-[var(--app-surface-elevated)]"
            >
              <Route className="mx-auto h-4 w-4 text-[var(--app-brand)]" />
              <p className="mt-1 text-[11px] text-[var(--app-text-primary)]">行程管理</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="btn-press rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-2 py-2 text-center transition-colors hover:bg-[var(--app-surface-elevated)]"
            >
              <Compass className="mx-auto h-4 w-4 text-[var(--app-brand)]" />
              <p className="mt-1 text-[11px] text-[var(--app-text-primary)]">旅行灵感</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("trips")}
              className="btn-press rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-2 py-2 text-center transition-colors hover:bg-[var(--app-surface-elevated)]"
            >
              <Heart className="mx-auto h-4 w-4 text-[var(--app-brand)]" />
              <p className="mt-1 text-[11px] text-[var(--app-text-primary)]">我的收藏</p>
            </button>
          </div>
        </AppCard>

        <AppCard tone="soft" padding="md">
          <div className="grid grid-cols-3 gap-2">
            <AppStatCard label="已选地点" value={selectedSpots.length} />
            <AppStatCard label="生成耗时" value="3-5 分钟" />
            <AppStatCard label="规划草稿" value={hasDraft ? "可继续" : "暂无"} />
          </div>
        </AppCard>
      </section>

      <AppSection title="推荐城市" subtitle="点选城市，直接带入 AI 规划目标城市。">
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {recommendedCities.map((city) => (
            <button
              key={`${city.province}-${city.city}`}
              type="button"
              onClick={() =>
                onNavigate("ai", {
                  source: "home-city",
                  destination: {
                    province: city.province,
                    city: city.city,
                    cityTagline: city.tagline,
                    tags: city.tags,
                  },
                })
              }
              className="w-[11.7rem] shrink-0 overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] text-left transition-colors hover:border-[var(--app-line-strong)]"
            >
              <img src={getCityPreview(city.city, city.province)} alt={city.city} className="h-24 w-full object-cover" />
              <div className="space-y-2 p-3">
                <div>
                  <p className="text-[10px] text-[var(--app-text-secondary)]">{city.province}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--app-text-strong)]">{city.city}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--app-text-secondary)]">{city.tagline}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {city.tags.slice(0, 2).map((tag) => (
                    <AppTag key={tag}>{tag}</AppTag>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </AppSection>

      <AppSection
        title="旅行灵感"
        subtitle="先挑感兴趣地点，再由 AI 自动编排路线。"
        action={
          <button
            type="button"
            onClick={() => onNavigate("explore")}
            className="text-[11px] font-medium text-[var(--app-brand)]"
          >
            查看全部
          </button>
        }
      >
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categoryTabs.map((tab) => (
            <AppChip key={tab.id} type="button" selected={activeCategory === tab.id} onClick={() => setActiveCategory(tab.id)}>
              {tab.label}
            </AppChip>
          ))}
        </div>

        <div className="space-y-2.5">
          {filteredFeaturedSpots.slice(0, 4).map((spot, index) => (
            <AppCard
              key={spot.id}
              tone="default"
              padding="sm"
              interactive
              className="cursor-pointer"
              onClick={() => onViewSpot(spot)}
            >
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--app-radius-xs)] bg-[var(--app-surface-muted)] text-[11px] font-semibold text-[var(--app-text-primary)]">
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
                  className="h-[4.25rem] w-[4.25rem] rounded-[var(--app-radius-sm)] object-cover"
                  onError={(event) => {
                    event.currentTarget.src = resolvePlaceImage({
                      city: spot.city,
                      province: spot.province,
                      name: spot.name,
                    })
                  }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-[var(--app-text-strong)]">{spot.name}</h3>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleFavorite(spot.id)
                      }}
                      className="rounded-[var(--app-radius-xs)] p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)]"
                    >
                      <Heart
                        className={cn(
                          "h-4 w-4",
                          favorites.includes(spot.id) && "fill-[var(--app-error)] text-[var(--app-error)]"
                        )}
                      />
                    </button>
                  </div>

                  <p className="truncate text-[11px] text-[var(--app-text-secondary)]">{spot.address}</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-[var(--app-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-[var(--app-gold)] text-[var(--app-gold)]" />
                        <span className="numeric">{spot.rating.toFixed(1)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {spot.city}
                      </span>
                    </div>
                    <AppButton
                      type="button"
                      size="sm"
                      variant={isInTrip(spot.id) ? "secondary" : "primary"}
                      onClick={(event) => {
                        event.stopPropagation()
                        addSpot(spot)
                      }}
                      disabled={isInTrip(spot.id)}
                    >
                      {isInTrip(spot.id) ? (
                        <span className="inline-flex items-center gap-1">
                          <LoaderCircle className="h-3 w-3" />
                          已加入
                        </span>
                      ) : (
                        "加入行程"
                      )}
                    </AppButton>
                  </div>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      </AppSection>
    </div>
  )
}
