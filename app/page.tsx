"use client"

import { useState } from "react"
import { TravelProvider, Spot, useTravel } from "@/lib/travel-context"
import { BottomNav, TabType } from "@/components/travel/bottom-nav"
import { HomePage } from "@/components/travel/pages/home-page"
import { ExplorePage } from "@/components/travel/pages/explore-page"
import { TripsPage } from "@/components/travel/pages/trips-page"
import { AIPlannnerPage } from "@/components/travel/pages/ai-planner-page"
import { ProfilePage } from "@/components/travel/pages/profile-page"
import { SpotDetailSheet } from "@/components/travel/spot-detail-sheet"
import {
  navigateToSpot,
  type NavigateToSpotResult,
  type SpotNavigationIntent,
} from "@/lib/navigation"

function TravelApp() {
  const [activeTab, setActiveTab] = useState<TabType>("home")
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [navigationIntent, setNavigationIntent] =
    useState<SpotNavigationIntent | null>(null)
  const { selectedSpots } = useTravel()

  const handleViewSpot = (spot: Spot) => {
    setSelectedSpot(spot)
  }

  const handleNavigate = (tab: "explore" | "trips" | "ai") => {
    setActiveTab(tab)
  }

  const handleNavigateToSpot = async (spot: Spot): Promise<NavigateToSpotResult> => {
    const result = await navigateToSpot(spot, { mode: "driving" })
    if (!result.ok || !result.intent) {
      return result
    }

    setNavigationIntent(result.intent)
    setActiveTab("trips")

    return result
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative overflow-hidden shadow-2xl">
      {/* Page Content */}
      <main className="min-h-screen">
        {activeTab === "home" && (
          <HomePage onNavigate={handleNavigate} onViewSpot={handleViewSpot} />
        )}
        {activeTab === "explore" && (
          <ExplorePage onViewSpot={handleViewSpot} />
        )}
        {activeTab === "trips" && (
          <TripsPage
            onViewSpot={handleViewSpot}
            onNavigate={handleNavigate}
            navigationIntent={navigationIntent}
            onClearNavigationIntent={() => setNavigationIntent(null)}
          />
        )}
        {activeTab === "ai" && (
          <AIPlannnerPage onNavigate={handleNavigate} />
        )}
        {activeTab === "profile" && (
          <ProfilePage onViewSpot={handleViewSpot} />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tripCount={selectedSpots.length}
      />

      {/* Spot Detail Sheet */}
      <SpotDetailSheet
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
        onNavigateToSpot={handleNavigateToSpot}
      />
    </div>
  )
}

export default function Page() {
  return (
    <TravelProvider>
      <TravelApp />
    </TravelProvider>
  )
}
