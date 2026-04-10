"use client"

import { useState } from "react"
import {
  User,
  Heart,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Bell,
  Moon,
  Globe,
  Shield,
  MessageSquare,
  Star,
  MapPin,
  Calendar,
} from "lucide-react"
import { useTravel, sampleSpots, Spot } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface ProfilePageProps {
  onViewSpot: (spot: Spot) => void
}

const menuItems = [
  { icon: Bell, label: "消息通知", badge: 3 },
  { icon: Heart, label: "我的收藏" },
  { icon: Star, label: "我的评价" },
  { icon: Globe, label: "语言设置", value: "简体中文" },
  { icon: Moon, label: "深色模式", toggle: true },
  { icon: Shield, label: "隐私设置" },
  { icon: HelpCircle, label: "帮助与反馈" },
  { icon: MessageSquare, label: "联系客服" },
]

export function ProfilePage({ onViewSpot }: ProfilePageProps) {
  const { favorites, savedPlans, selectedSpots, toggleFavorite } = useTravel()
  const [darkMode, setDarkMode] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)

  const favoriteSpots = sampleSpots.filter((s) => favorites.includes(s.id))

  // 统计数据
  const stats = {
    trips: savedPlans.length,
    favorites: favorites.length,
    spots: selectedSpots.length,
  }

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      {/* Header with Profile */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative px-6 pt-12 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 border-3 border-white/50 flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">旅行者</h1>
              <p className="text-white/80 text-sm">探索世界，发现美好</p>
            </div>
            <button className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-6 -mt-4 relative z-10">
        <div className="bg-card rounded-2xl p-4 shadow-lg border border-border/50">
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="text-center px-2">
              <div className="text-2xl font-bold text-primary">{stats.trips}</div>
              <div className="text-xs text-muted-foreground mt-1">已保存行程</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl font-bold text-primary">{stats.favorites}</div>
              <div className="text-xs text-muted-foreground mt-1">收藏地点</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl font-bold text-primary">{stats.spots}</div>
              <div className="text-xs text-muted-foreground mt-1">当前行程点</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 py-6">
        <h2 className="text-lg font-bold text-foreground mb-4">快捷功能</h2>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => setShowFavorites(true)}
            className="flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all btn-press"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-xs font-medium text-foreground">收藏</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all btn-press">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-foreground">评价</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all btn-press">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-foreground">日历</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all btn-press">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-xs font-medium text-foreground">足迹</span>
          </button>
        </div>
      </div>

      {/* Menu List */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-foreground mb-4">设置</h2>
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-4 hover:bg-secondary/50 transition-colors",
                  index !== menuItems.length - 1 && "border-b border-border/50"
                )}
                onClick={() => {
                  if (item.toggle) {
                    setDarkMode(!darkMode)
                  }
                }}
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <span className="flex-1 text-left font-medium text-foreground">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
                {item.value && (
                  <span className="text-sm text-muted-foreground">{item.value}</span>
                )}
                {item.toggle ? (
                  <div
                    className={cn(
                      "w-12 h-7 rounded-full transition-colors relative",
                      darkMode ? "bg-primary" : "bg-border"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow",
                        darkMode ? "left-6" : "left-1"
                      )}
                    />
                  </div>
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Logout */}
      <div className="px-6 py-6">
        <button className="w-full py-4 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/20 transition-colors btn-press flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" />
          退出登录
        </button>
      </div>

      {/* App Info */}
      <div className="px-6 pb-6 text-center">
        <p className="text-sm text-muted-foreground">途境漫语 AI旅游助手</p>
        <p className="text-xs text-muted-foreground mt-1">版本 1.0.0</p>
      </div>

      {/* Favorites Modal */}
      {showFavorites && (
        <div
          className="fixed inset-0 z-50 bg-black/50 animate-fade-in"
          onClick={() => setShowFavorites(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[80vh] overflow-hidden animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">我的收藏</h2>
              <button
                onClick={() => setShowFavorites(false)}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <span className="text-muted-foreground">关闭</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-60px)] p-6">
              {favoriteSpots.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">还没有收藏任何地点</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {favoriteSpots.map((spot) => (
                    <div
                      key={spot.id}
                      onClick={() => {
                        setShowFavorites(false)
                        onViewSpot(spot)
                      }}
                      className="flex items-center gap-4 p-3 bg-secondary/50 rounded-xl cursor-pointer hover:bg-secondary transition-colors"
                    >
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{spot.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{spot.address}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(spot.id)
                        }}
                        className="p-2"
                      >
                        <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
