"use client"

import { Home, Compass, MapPin, Sparkles, User } from "lucide-react"
import { cn } from "@/lib/utils"

export type TabType = "home" | "explore" | "trips" | "ai" | "profile"

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  tripCount?: number
}

const tabs = [
  { id: "home" as TabType, label: "首页", icon: Home },
  { id: "explore" as TabType, label: "探索", icon: Compass },
  { id: "trips" as TabType, label: "行程", icon: MapPin },
  { id: "ai" as TabType, label: "AI规划", icon: Sparkles },
  { id: "profile" as TabType, label: "我的", icon: User },
]

export function BottomNav({ activeTab, onTabChange, tripCount = 0 }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto">
        <div className="glass border-t border-border/50 px-2 py-2">
          <div className="flex items-center justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const showBadge = tab.id === "trips" && tripCount > 0

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 btn-press",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-[10px] font-bold text-accent-foreground rounded-full flex items-center justify-center">
                        {tripCount}
                      </span>
                    )}
                  </div>
                  <span className={cn("text-[11px]", isActive ? "font-semibold" : "font-medium")}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
