"use client"

import { CircleUser, Compass, Home, MapPinned, Sparkles } from "lucide-react"
import { AppBottomTabBar } from "@/components/ui/app-bottom-tab-bar"
import { AppTabbar } from "@/components/ui/app-tabbar"
import { travelDesignTokens } from "@/lib/design-tokens"

export type TabType = "home" | "explore" | "trips" | "ai" | "profile"

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  tripCount?: number
}

const tabs = [
  { id: "home" as TabType, label: "首页", icon: Home },
  { id: "explore" as TabType, label: "探索", icon: Compass },
  { id: "ai" as TabType, label: "AI规划", icon: Sparkles, highlight: true },
  { id: "trips" as TabType, label: "行程", icon: MapPinned },
  { id: "profile" as TabType, label: "我的", icon: CircleUser },
]

export function BottomNav({ activeTab, onTabChange, tripCount = 0 }: BottomNavProps) {
  return (
    <AppBottomTabBar>
      <AppTabbar
        items={tabs.map((tab) => ({
          ...tab,
          badge: tab.id === "trips" && tripCount > 0 ? (tripCount > 99 ? "99+" : tripCount) : null,
        }))}
        activeId={activeTab}
        onChange={(id) => onTabChange(id as TabType)}
        iconStrokeWidth={travelDesignTokens.icon.stroke}
      />
    </AppBottomTabBar>
  )
}
