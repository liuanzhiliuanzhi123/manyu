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

type PlannerDestinationPayload = {
  province: string
  city: string
  cityTagline?: string
  tags?: string[]
}

type NavigateSource = "home-city" | "trips" | "direct"

type NavigateOptions = {
  destination?: PlannerDestinationPayload
  source?: NavigateSource
}

type PlannerEntryDestination = PlannerDestinationPayload & {
  source: NavigateSource
  token: number
}

function TravelApp() {
  const [activeTab, setActiveTab] = useState<TabType>("home")
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [navigationIntent, setNavigationIntent] =
    useState<SpotNavigationIntent | null>(null)
  const [plannerEntryDestination, setPlannerEntryDestination] =
    useState<PlannerEntryDestination | null>(null)
  const { selectedSpots, openPlan } = useTravel()

  const handleViewSpot = (spot: Spot) => {
    setSelectedSpot(spot)
  }

  const handleNavigate = (
    tab: "explore" | "trips" | "ai" | "profile",
    options?: NavigateOptions
  ) => {
    if (tab === "ai") {
      if (options?.destination) {
        setPlannerEntryDestination({
          ...options.destination,
          source: options.source ?? "direct",
          token: Date.now(),
        })
      } else {
        setPlannerEntryDestination(null)
      }
    }
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

  const handleOpenSavedPlan = (planId: string) => {
    openPlan(planId)
    handleNavigate("ai", { source: "trips" })
  }

  return (
    <div className="app-shell relative mx-auto min-h-screen max-w-[430px] overflow-hidden md:my-4 md:rounded-[32px]">
      <main className="min-h-screen">
        {activeTab === "home" && <HomePage onNavigate={handleNavigate} />}
        {activeTab === "explore" && (
          <ExplorePage onViewSpot={handleViewSpot} />
        )}
        {activeTab === "trips" && (
          <TripsPage
            onViewSpot={handleViewSpot}
            onNavigate={handleNavigate}
            navigationIntent={navigationIntent}
            onClearNavigationIntent={() => setNavigationIntent(null)}
            onOpenSavedPlan={handleOpenSavedPlan}
          />
        )}
        {activeTab === "ai" && (
          <AIPlannnerPage
            onNavigate={handleNavigate}
            entryDestination={plannerEntryDestination}
          />
        )}
        {activeTab === "profile" && (
          <ProfilePage
            onViewSpot={handleViewSpot}
            onOpenSavedPlan={handleOpenSavedPlan}
            onGoPlanner={() => handleNavigate("ai")}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "ai") {
            handleNavigate("ai")
            return
          }
          setPlannerEntryDestination(null)
          setActiveTab(tab)
        }}
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
