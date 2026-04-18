"use client"

import { MapPin, Route, Wallet } from "lucide-react"
import { formatDistance, formatDuration } from "@/lib/amap-spot-utils"
import type { TripPlan } from "@/lib/travel-context"

interface ItinerarySummaryProps {
  plan: TripPlan
}

export function ItinerarySummary({ plan }: ItinerarySummaryProps) {
  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
      <h2 className="text-base font-semibold text-foreground mb-3">行程总览</h2>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-secondary/60 px-3 py-2 text-center">
          <p className="text-muted-foreground">总天数</p>
          <p className="text-lg font-semibold text-foreground mt-1">{plan.totalDays ?? 0}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-3 py-2 text-center">
          <p className="text-muted-foreground">总景点数</p>
          <p className="text-lg font-semibold text-foreground mt-1">{plan.totalSpots ?? plan.spots.length}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-3 py-2 text-center">
          <p className="text-muted-foreground">总预算</p>
          <p className="text-lg font-semibold text-foreground mt-1">¥{plan.totalEstimatedCost ?? 0}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-secondary/40 px-3 py-2">
          <p className="text-muted-foreground inline-flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5 text-primary" />
            总交通时长
          </p>
          <p className="font-semibold text-foreground mt-1">
            {formatDuration(plan.totalTravelSeconds ?? 0)}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/40 px-3 py-2">
          <p className="text-muted-foreground inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            总距离
          </p>
          <p className="font-semibold text-foreground mt-1">
            {formatDistance(plan.totalDistanceMeters ?? 0)}
          </p>
        </div>
      </div>
      <div className="mt-2 rounded-xl bg-secondary/20 px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5 text-primary" />
        总游玩时长 {Math.round(plan.totalPlayMinutes ?? 0)} 分钟
      </div>
    </section>
  )
}
