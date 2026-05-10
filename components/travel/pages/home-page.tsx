"use client"

import {
  ArrowRight,
  Bookmark,
  CalendarCheck2,
  Compass,
  MapPinned,
  Route,
  Search,
  ShoppingBag,
} from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppInput } from "@/components/ui/app-input"
import { AppPageHeader } from "@/components/ui/app-page-header"
import { AppTag } from "@/components/ui/app-tag"
import { useTravel } from "@/lib/travel-context"

type HomeTargetTab = "explore" | "trips" | "ai"

interface HomePageProps {
  onNavigate: (
    tab: HomeTargetTab,
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
}

function HomeMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-[20px] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-3">
      <p className="text-[11px] font-medium text-[var(--app-text-muted)]">{label}</p>
      <p className="numeric mt-1 text-[1.05rem] font-semibold leading-none text-[var(--app-text-strong)]">
        {value}
      </p>
      <p className="mt-1.5 truncate text-[10px] text-[var(--app-text-secondary)]">{detail}</p>
    </div>
  )
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { selectedSpots, favorites, currentPlan } = useTravel()
  const selectedCount = selectedSpots.length
  const hasDraft = Boolean(currentPlan) || selectedCount > 0
  const favoriteCount = favorites.length

  return (
    <div className="app-page animate-fade-in space-y-4">
      <section className="space-y-4">
        <AppPageHeader
          className="items-center pt-1"
          label={
            <span className="font-semibold tracking-[0.16em] text-[var(--app-brand)]">
              AI TRAVEL ASSISTANT
            </span>
          }
          title={<span className="gradient-text block text-[1.72rem] tracking-normal">拾景拼途</span>}
          subtitle={
            <span className="block max-w-[18rem] text-[0.86rem] leading-6">
              心动风景一键收藏，像加购物车一样拼出专属旅程。
            </span>
          }
          trailing={
            <div
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] shadow-[var(--app-shadow-soft)]"
            >
              <MapPinned className="h-5 w-5 text-[var(--app-brand)]" strokeWidth={1.8} />
            </div>
          }
        />

        <AppCard
          tone="elevated"
          padding="none"
          className="relative overflow-hidden border-[rgba(222,229,211,0.72)] bg-[radial-gradient(circle_at_86%_16%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(145deg,#253a25_0%,#405b33_58%,#697a4d_100%)] text-white shadow-[0_18px_40px_rgba(48,65,31,0.2)]"
        >
          <div className="pointer-events-none absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-white/[0.055]" />
          <div className="pointer-events-none absolute left-5 right-5 top-5 h-px bg-white/12" />

          <div className="relative space-y-5 px-5 py-6">
            <div className="flex items-start justify-between gap-4">
              <AppTag className="w-fit border-white/16 bg-white/12 text-white">旅程规划主引擎</AppTag>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-white/10 text-white/90 ring-1 ring-white/12">
                <MapPinned className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.7} />
              </span>
            </div>

            <div className="max-w-[18rem] space-y-2.5">
              <h2 className="text-[1.58rem] font-semibold leading-[1.2] tracking-normal text-white">
                生成你的专属旅行手册
              </h2>
              <p className="text-[13px] leading-6 text-white/84">
                收藏景点、美食与酒店，自动整理路线、吃住和每日安排。
              </p>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2.5">
              <AppButton
                type="button"
                size="lg"
                className="border border-white/45 bg-white text-[var(--brand-deep)] shadow-[0_10px_20px_rgba(17,29,12,0.18)] hover:bg-[#fbfaf5]"
                onClick={() => onNavigate("ai")}
              >
                <Route className="h-[1.06rem] w-[1.06rem]" strokeWidth={1.85} />
                开始规划旅程
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                size="lg"
                className="border border-white/24 bg-white/10 px-3.5 text-white hover:bg-white/16 hover:text-white"
                onClick={() => onNavigate("explore")}
              >
                <Compass className="h-[1.04rem] w-[1.04rem]" strokeWidth={1.8} />
                浏览目的地
              </AppButton>
            </div>
          </div>
        </AppCard>

        <AppCard tone="elevated" padding="md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 text-[var(--app-text-muted)]" />
            <AppInput
              readOnly
              tone="subtle"
              density="lg"
              placeholder="搜索城市、景点、美食或酒店"
              className="cursor-pointer rounded-[22px] border-[var(--app-line)] bg-[var(--app-surface)] pl-10 text-[var(--app-text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
              onClick={() => onNavigate("explore")}
              onFocus={() => onNavigate("explore")}
            />
          </div>
        </AppCard>

        <AppCard tone="soft" padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">当前行程状态</p>
              <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">
                先收集，再交给 AI 串成顺路方案。
              </p>
            </div>
            <CalendarCheck2 className="h-5 w-5 text-[var(--app-brand)]" strokeWidth={1.75} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HomeMetric label="已选地点" value={selectedCount} detail={selectedCount > 0 ? "待编排" : "未添加"} />
            <HomeMetric label="生成耗时" value="10 秒" detail="智能整理" />
            <HomeMetric label="规划草稿" value={hasDraft ? "可继续" : "暂无"} detail={hasDraft ? "保留中" : "待生成"} />
          </div>
        </AppCard>

        <AppCard tone="elevated" padding="lg" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--app-brand)_0%,#c6d19e_55%,transparent_100%)]" />
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-normal text-[var(--app-text-strong)]">你的旅程清单</h2>
                <p className="text-[12px] leading-5 text-[var(--app-text-secondary)]">
                  先把想去的地方加入行程，再让 AI 帮你拼成顺路方案。
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[var(--app-text-secondary)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-muted)] px-2.5 py-1">
                  <MapPinned className="h-3.5 w-3.5 text-[var(--app-brand)]" strokeWidth={1.75} />
                  <span className="numeric">{selectedCount}</span> 个已选地点
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-muted)] px-2.5 py-1">
                  <Bookmark className="h-3.5 w-3.5 text-[var(--app-brand)]" strokeWidth={1.75} />
                  <span className="numeric">{favoriteCount}</span> 个收藏
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <AppButton type="button" size="md" onClick={() => onNavigate("trips")}>
                  查看行程清单
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </AppButton>
                <AppButton type="button" variant="secondary" size="md" onClick={() => onNavigate("explore")}>
                  继续添加地点
                </AppButton>
              </div>
            </div>
          </div>
        </AppCard>
      </section>
    </div>
  )
}
