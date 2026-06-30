"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Globe,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  MessageSquare,
  Moon,
  Settings,
  Shield,
  Sparkles,
  Star,
  User,
} from "lucide-react"
import { useTheme } from "next-themes"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { EmptyStateCard } from "@/components/ui/empty-state-card"
import { AppIconButton } from "@/components/ui/app-icon-button"
import { AppPageHeader } from "@/components/ui/app-page-header"
import { AppStatCard } from "@/components/ui/app-stat-card"
import { AppTag } from "@/components/ui/app-tag"
import { CalendarPage } from "@/components/travel/calendar-page"
import { MobileSheet } from "@/components/travel/mobile-sheet"
import { PlacePhotoImage } from "@/components/travel/place-photo-image"
import { ProfileSubpage } from "@/components/travel/profile-subpage"
import { SavedPlanCard } from "@/components/travel/saved-plan-card"
import { buildPlanShareSummary, toShareSummaryText } from "@/lib/plan-persistence"
import { useAuth } from "@/lib/auth/use-auth"
import {
  AppLanguage,
  getStoredLanguage,
  LANGUAGE_LABELS,
  setStoredLanguage,
} from "@/lib/theme-storage"
import { sampleSpots, type Spot, useTravel } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface ProfilePageProps {
  onViewSpot: (spot: Spot) => void
  onOpenSavedPlan: (planId: string) => void
  onGoPlanner: () => void
}

type ActionId =
  | "notification"
  | "favorites"
  | "reviews"
  | "language"
  | "darkMode"
  | "privacy"
  | "help"
  | "contact"
  | "settings"
  | "calendar"
  | "footprint"
  | "logout"

type ActiveSheet = "language" | "settings" | null
type ActiveSubpage =
  | "notification"
  | "favorites"
  | "reviews"
  | "privacy"
  | "help"
  | "contact"
  | "calendar"
  | "footprint"
  | null

const MENU_ITEMS: Array<{
  id: ActionId
  icon: typeof Bell
  label: string
  toggle?: boolean
}> = [
  { id: "notification", icon: Bell, label: "消息通知" },
  { id: "favorites", icon: Heart, label: "我的收藏" },
  { id: "reviews", icon: Star, label: "我的点评" },
  { id: "language", icon: Globe, label: "语言设置" },
  { id: "darkMode", icon: Moon, label: "深色模式", toggle: true },
  { id: "privacy", icon: Shield, label: "隐私设置" },
  { id: "help", icon: HelpCircle, label: "帮助与反馈" },
  { id: "contact", icon: MessageSquare, label: "联系客服" },
]

const SUBPAGE_TITLE: Record<Exclude<ActiveSubpage, null>, string> = {
  notification: "消息通知",
  favorites: "我的收藏",
  reviews: "我的点评",
  privacy: "隐私设置",
  help: "帮助与反馈",
  contact: "联系客服",
  calendar: "旅行日历",
  footprint: "旅行足迹",
}

export function ProfilePage({ onViewSpot, onOpenSavedPlan, onGoPlanner }: ProfilePageProps) {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth()
  const {
    currentPlan,
    favorites,
    savedPlans,
    selectedSpots,
    toggleFavorite,
    deletePlan,
  } = useTravel()
  const { theme, resolvedTheme, setTheme } = useTheme()

  const [language, setLanguage] = useState<AppLanguage>("zh-CN")
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)
  const [activeSubpage, setActiveSubpage] = useState<ActiveSubpage>(null)
  const [feedback, setFeedback] = useState("")
  const [isSigningOut, setIsSigningOut] = useState(false)

  const isDarkMode = (resolvedTheme ?? theme) === "dark"

  useEffect(() => {
    setLanguage(getStoredLanguage())
  }, [])

  const favoriteSpots = useMemo(() => {
    const bucket = new Map<string, Spot>()
    ;[...selectedSpots, ...sampleSpots].forEach((spot) => {
      if (favorites.includes(spot.id) && !bucket.has(spot.id)) {
        bucket.set(spot.id, spot)
      }
    })
    return Array.from(bucket.values())
  }, [favorites, selectedSpots])

  const notifications = useMemo(
    () => [
      {
        id: "notice-plan",
        title:
          savedPlans.length > 0
            ? `你已保存 ${savedPlans.length} 个行程方案，可继续优化路线。`
            : "欢迎使用拾景拼途，先去探索页添加地点吧。",
        time: "刚刚",
      },
      {
        id: "notice-trip",
        title:
          selectedSpots.length > 0
            ? `当前行程清单有 ${selectedSpots.length} 个地点。`
            : "当前行程清单为空，可从探索页快速加入。",
        time: "今天",
      },
    ],
    [savedPlans.length, selectedSpots.length]
  )

  const footprintSpots = useMemo(() => {
    const bucket = new Map<string, Spot>()
    ;[...selectedSpots, ...favoriteSpots].forEach((spot) => {
      if (!bucket.has(spot.id)) bucket.set(spot.id, spot)
    })
    return Array.from(bucket.values())
  }, [favoriteSpots, selectedSpots])

  const footprintCities = useMemo(() => {
    const bucket = new Set<string>()
    footprintSpots.forEach((spot) => {
      if (spot.city?.trim()) bucket.add(spot.city.trim())
    })
    return Array.from(bucket)
  }, [footprintSpots])

  const stats = {
    trips: savedPlans.length,
    favorites: favorites.length,
    spots: selectedSpots.length,
  }
  const metadataDisplayName = user?.user_metadata?.display_name
  const displayName =
    typeof metadataDisplayName === "string" && metadataDisplayName.trim()
      ? metadataDisplayName.trim()
      : "旅行者"
  const userEmail = user?.email || ""
  const draftStatus = currentPlan
    ? "已有当前草稿"
    : selectedSpots.length > 0
      ? `当前清单 ${selectedSpots.length} 个地点`
      : "暂无草稿"

  const showFeedback = (message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(""), 1700)
  }

  const toggleDarkMode = () => {
    const nextTheme = isDarkMode ? "light" : "dark"
    setTheme(nextTheme)
    showFeedback(nextTheme === "dark" ? "已切换为深色模式" : "已切换为浅色模式")
  }

  const changeLanguage = (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage)
    setStoredLanguage(nextLanguage)
    showFeedback(`语言已切换为 ${LANGUAGE_LABELS[nextLanguage]}`)
    setActiveSheet(null)
  }

  const openSubpage = (target: ActiveSubpage) => {
    setActiveSheet(null)
    setActiveSubpage(target)
  }

  const handleAction = async (id: ActionId) => {
    if (id === "darkMode") {
      toggleDarkMode()
      return
    }
    if (id === "logout") {
      if (!isAuthenticated) {
        router.push("/auth")
        return
      }
      if (isSigningOut) return
      setIsSigningOut(true)
      const result = await signOut()
      setIsSigningOut(false)
      showFeedback(result.ok ? "已退出登录" : result.message)
      return
    }
    if (id === "language") {
      setActiveSubpage(null)
      setActiveSheet("language")
      return
    }
    if (id === "settings") {
      setActiveSubpage(null)
      setActiveSheet("settings")
      return
    }
    openSubpage(id as ActiveSubpage)
  }

  const closeAllOverlays = () => {
    setActiveSubpage(null)
    setActiveSheet(null)
  }

  const shareSavedPlan = async (planId: string) => {
    const plan = savedPlans.find((item) => item.id === planId)
    if (!plan) return
    const shareText = toShareSummaryText(buildPlanShareSummary(plan))
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText)
        showFeedback("分享摘要已复制到剪贴板")
      } catch {
        showFeedback("复制失败，请稍后重试")
      }
      return
    }
    showFeedback("当前环境不支持剪贴板复制")
  }

  return (
    <div className="app-page animate-fade-in space-y-4">
      <AppCard tone="elevated" padding="md" className="soft-gradient relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:rgba(93,111,47,0.14)] blur-2xl" />

        <div className="relative">
          <AppPageHeader
            label="TRAVEL IDENTITY"
            title="旅行者中心"
            subtitle="偏好、收藏、足迹和账号管理"
            trailing={
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/75 bg-white/88">
                  <User className="h-5 w-5 text-[var(--app-brand)]" />
                </div>
                <AppIconButton
                  type="button"
              onClick={() => void handleAction("settings")}
                  variant="secondary"
                  size="md"
                  aria-label="打开设置"
                  className="bg-white/92"
                >
                  <Settings className="h-[1rem] w-[1rem]" />
                </AppIconButton>
              </div>
            }
          />
        </div>

        {authLoading ? (
          <div className="mt-3.5 rounded-[var(--app-radius-md)] bg-white/70 px-3 py-3 text-sm text-[var(--app-text-secondary)]">
            正在读取账号状态...
          </div>
        ) : isAuthenticated ? (
          <>
            <div className="mt-3.5 rounded-[var(--app-radius-md)] border border-white/75 bg-white/82 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--app-text-strong)]">
                    {displayName}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--app-text-secondary)]">
                    {userEmail}
                  </p>
                </div>
                <AppTag tone="success">已登录</AppTag>
              </div>
              <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
                当前草稿状态：{draftStatus}
              </p>
            </div>
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <AppStatCard label="已保存行程" value={stats.trips} />
              <AppStatCard label="收藏地点" value={stats.favorites} />
              <AppStatCard label="当前清单" value={stats.spots} />
            </div>
          </>
        ) : (
          <div className="mt-3.5 space-y-3 rounded-[var(--app-radius-md)] border border-white/75 bg-white/82 px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">
                登录后同步你的旅行方案
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">
                收藏地点、行程草稿和已保存方案会安全同步到云端。
              </p>
            </div>
            <AppButton
              type="button"
              size="md"
              className="w-full"
              onClick={() => router.push("/auth")}
            >
              登录 / 注册
            </AppButton>
            <div className="grid grid-cols-3 gap-2">
              <AppStatCard label="本地行程" value={stats.trips} />
              <AppStatCard label="本地收藏" value={stats.favorites} />
              <AppStatCard label="当前清单" value={stats.spots} />
            </div>
          </div>
        )}
      </AppCard>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="app-section-title">旅行偏好与记录</h2>
          <AppTag tone="info">持续更新</AppTag>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleAction("favorites")}
            className="card-hover rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3 text-left"
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:rgba(183,91,80,0.14)] text-[var(--app-error)]">
              <Heart className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-[var(--app-text-primary)]">我的收藏</p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">已收藏 {favorites.length} 个地点</p>
          </button>
          <button
            type="button"
            onClick={() => void handleAction("calendar")}
            className="card-hover rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3 text-left"
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:rgba(108,131,118,0.14)] text-[var(--app-info)]">
              <CalendarDays className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-[var(--app-text-primary)]">旅行日历</p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">查看行程日期与安排</p>
          </button>
          <button
            type="button"
            onClick={() => void handleAction("footprint")}
            className="card-hover rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3 text-left"
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
              <MapPin className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-[var(--app-text-primary)]">旅行足迹</p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">覆盖 {footprintCities.length} 个城市</p>
          </button>
          <button
            type="button"
            onClick={() => void handleAction("notification")}
            className="card-hover rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3 text-left"
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-text-primary)]">
              <Bell className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-[var(--app-text-primary)]">消息通知</p>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{notifications.length} 条新提醒</p>
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="app-section-title">已保存方案</h2>
          <span className="numeric text-xs text-[var(--app-text-secondary)]">{savedPlans.length} 个</span>
        </div>
        {savedPlans.length === 0 ? (
          <EmptyStateCard
            title="还没有保存的旅行方案"
            description="先用 AI 生成一份专属行程吧"
            actionLabel="去 AI 规划"
            onAction={onGoPlanner}
            icon={CalendarDays}
          />
        ) : (
          savedPlans.slice(0, 3).map((plan) => (
            <SavedPlanCard
              key={plan.id}
              plan={plan}
              onOpen={() => onOpenSavedPlan(plan.id)}
              onDelete={() => {
                deletePlan(plan.id)
                showFeedback(`已删除：${plan.name}`)
              }}
              onShare={() => void shareSavedPlan(plan.id)}
            />
          ))
        )}
      </section>

      <section>
        <h2 className="mb-3 app-section-title">设置</h2>
        <AppCard tone="elevated" padding="none" className="overflow-hidden">
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon
            const badge = item.id === "notification" ? notifications.length : 0
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "w-full px-4 py-3.5 text-left transition-colors hover:bg-[var(--app-surface)]",
                  index !== MENU_ITEMS.length - 1 && "border-b border-[var(--app-line)]"
                )}
                onClick={() => void handleAction(item.id)}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-text-primary)]">
                    <Icon className="h-[1.125rem] w-[1.125rem]" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-[var(--app-text-primary)]">{item.label}</span>
                  {badge > 0 && (
                    <span className="numeric rounded-full bg-[var(--app-brand)] px-2 py-0.5 text-xs font-semibold text-white">
                      {badge}
                    </span>
                  )}
                  {item.id === "language" && (
                    <span className="text-xs text-[var(--app-text-secondary)]">{LANGUAGE_LABELS[language]}</span>
                  )}
                  {item.toggle ? (
                    <div
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        isDarkMode ? "bg-[var(--app-brand)]" : "bg-[var(--app-line)]"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                          isDarkMode ? "left-5.5" : "left-0.5"
                        )}
                      />
                    </div>
                  ) : (
                    <ChevronRight className="h-[1.125rem] w-[1.125rem] text-[var(--app-text-muted)]" />
                  )}
                </div>
              </button>
            )
          })}
        </AppCard>
      </section>

      <AppButton
        type="button"
        onClick={() => void handleAction("logout")}
        variant={isAuthenticated ? "danger" : "primary"}
        size="lg"
        className="w-full"
        disabled={authLoading || isSigningOut}
      >
        <LogOut className="h-[1.125rem] w-[1.125rem]" />
        {isAuthenticated ? (isSigningOut ? "退出中..." : "退出登录") : "登录 / 注册"}
      </AppButton>

      <div className="text-center">
        <p className="text-sm text-[var(--app-text-secondary)]">拾景拼途 AI 旅行助手</p>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">版本 1.0.0</p>
      </div>

      <MobileSheet
        open={activeSheet === "language"}
        onClose={() => setActiveSheet(null)}
        title="语言设置"
        description="切换后会自动保存，下次打开继续保持。"
      >
        <div className="space-y-2">
          {(Object.entries(LANGUAGE_LABELS) as Array<[AppLanguage, string]>).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => changeLanguage(code)}
              className={cn(
                "w-full rounded-[var(--app-radius-sm)] border px-3 py-3 text-left text-sm",
                language === code
                  ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                  : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-primary)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </MobileSheet>

      <MobileSheet
        open={activeSheet === "settings"}
        onClose={() => setActiveSheet(null)}
        title="账号设置"
        description="集中管理语言、主题和通知。"
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setActiveSheet("language")}
            className="flex w-full items-center justify-between rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-3 text-sm"
          >
            <span className="text-[var(--app-text-primary)]">语言设置</span>
            <span className="text-[var(--app-text-secondary)]">{LANGUAGE_LABELS[language]}</span>
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex w-full items-center justify-between rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-3 text-sm"
          >
            <span className="text-[var(--app-text-primary)]">深色模式</span>
            <span className="text-[var(--app-text-secondary)]">{isDarkMode ? "已开启" : "已关闭"}</span>
          </button>
          <button
            type="button"
            onClick={() => openSubpage("notification")}
            className="flex w-full items-center justify-between rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-3 text-sm"
          >
            <span className="text-[var(--app-text-primary)]">通知管理</span>
            <ChevronRight className="h-4 w-4 text-[var(--app-text-muted)]" />
          </button>
          <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
            关于：拾景拼途 v1.0.0
          </div>
        </div>
      </MobileSheet>

      <ProfileSubpage
        open={Boolean(activeSubpage)}
        onClose={closeAllOverlays}
        title={activeSubpage ? SUBPAGE_TITLE[activeSubpage] : ""}
      >
        {activeSubpage === "notification" && (
          <div className="space-y-2">
            {notifications.map((item) => (
              <article
                key={item.id}
                className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-3"
              >
                <p className="text-sm text-[var(--app-text-primary)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{item.time}</p>
              </article>
            ))}
          </div>
        )}

        {activeSubpage === "favorites" && (
          <div className="space-y-3">
            {favoriteSpots.length === 0 ? (
              <EmptyStateCard
                title="还没有收藏地点"
                description="去探索页浏览目的地，收藏后会自动出现在这里。"
                icon={Heart}
              />
            ) : (
              favoriteSpots.map((spot) => (
                <article
                  key={spot.id}
                  onClick={() => {
                    closeAllOverlays()
                    onViewSpot(spot)
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-2.5"
                >
                  <PlacePhotoImage
                    name={spot.name}
                    city={spot.city}
                    province={spot.province}
                    type={spot.type}
                    alt={spot.name}
                    className="h-12 w-12 rounded-[0.7rem] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--app-text-strong)]">{spot.name}</p>
                    <p className="truncate text-xs text-[var(--app-text-secondary)]">{spot.address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleFavorite(spot.id)
                      showFeedback(`已取消收藏：${spot.name}`)
                    }}
                    className="rounded-[0.65rem] p-1.5 text-[var(--app-error)] hover:bg-[color:rgba(183,91,80,0.1)]"
                  >
                    <Heart className="h-4 w-4 fill-current" />
                  </button>
                </article>
              ))
            )}
          </div>
        )}

        {activeSubpage === "calendar" && (
          <CalendarPage plans={savedPlans} onGoPlanner={() => showFeedback("请前往 AI 规划页创建行程")} />
        )}

        {activeSubpage === "footprint" && (
          <div className="space-y-3">
            <article className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-3">
              <p className="text-sm font-medium text-[var(--app-text-strong)]">足迹城市</p>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                {footprintCities.length > 0 ? footprintCities.join(" / ") : "暂无城市记录"}
              </p>
            </article>
            {footprintSpots.length === 0 ? (
              <article className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-6 text-center text-sm text-[var(--app-text-secondary)]">
                暂无足迹记录，去探索页添加地点后会自动沉淀。
              </article>
            ) : (
              footprintSpots.slice(0, 20).map((spot) => (
                <article key={spot.id} className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--app-text-strong)]">{spot.name}</p>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    {spot.city || "未知城市"} · {spot.address || "暂无地址"}
                  </p>
                </article>
              ))
            )}
          </div>
        )}

        {(activeSubpage === "reviews" ||
          activeSubpage === "privacy" ||
          activeSubpage === "help" ||
          activeSubpage === "contact") && (
          <article className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
            <p className="text-sm leading-6 text-[var(--app-text-secondary)]">
              {activeSubpage === "reviews" &&
                "点评系统正在完善中，当前已保留入口并支持后续扩展。"}
              {activeSubpage === "privacy" &&
                "隐私设置将支持定位授权、个性化推荐开关与缓存清理，当前版本先保留入口。"}
              {activeSubpage === "help" &&
                "如遇问题可先通过“联系客服”反馈，我们会持续补充帮助中心内容。"}
              {activeSubpage === "contact" &&
                "客服通道正在接入中，当前版本可先记录问题，我们会在后续版本补齐。"}
            </p>
            <AppButton
              type="button"
              onClick={() => showFeedback("已收到反馈，后续版本将持续补齐")}
              className="mt-3"
              size="sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              了解并继续
            </AppButton>
          </article>
        )}
      </ProfileSubpage>

      {feedback && (
        <div className="fixed left-1/2 top-16 z-[70] -translate-x-1/2 rounded-[var(--app-radius-sm)] bg-[var(--app-text-strong)] px-4 py-2 text-sm text-white shadow-lg">
          {feedback}
        </div>
      )}
    </div>
  )
}
