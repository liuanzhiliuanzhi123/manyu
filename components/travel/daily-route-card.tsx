"use client"

import { Clock3, MapPin, Wallet } from "lucide-react"
import { formatDistance, formatDuration } from "@/lib/amap-spot-utils"
import type { ItineraryDay } from "@/lib/travel-context"
import { RouteLegCard } from "@/components/travel/route-leg-card"

interface DailyRouteCardProps {
  day: ItineraryDay
}

function getLegByPosition(day: ItineraryDay, spotIndex: number) {
  if (spotIndex < day.spots.length - 1) {
    return day.routeLegs[day.startsFromDeparture ? spotIndex + 1 : spotIndex] || null
  }
  if (spotIndex === day.spots.length - 1 && day.returnsToDeparture) {
    return day.routeLegs[day.routeLegs.length - 1] || null
  }
  return null
}

export function DailyRouteCard({ day }: DailyRouteCardProps) {
  const startLeg = day.startsFromDeparture ? day.routeLegs[0] : null

  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{day.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{day.theme || "精选路线"}</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {day.startTime} - {day.endTime}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <p className="text-muted-foreground">总路程</p>
          <p className="font-semibold text-foreground mt-1">
            {formatDistance(day.totalDistanceMeters)}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <p className="text-muted-foreground">总交通时长</p>
          <p className="font-semibold text-foreground mt-1">
            {formatDuration(day.totalTravelSeconds)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {startLeg && <RouteLegCard leg={startLeg} />}

        {day.spots.map((spot, index) => {
          const followingLeg = getLegByPosition(day, index)
          return (
            <div key={spot.id} className="space-y-2">
              <article className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <img
                    src={spot.image}
                    alt={spot.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{spot.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {spot.address}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-card px-2.5 py-2 text-muted-foreground">
                    <p>到达 {spot.arrivalTime || "--:--"}</p>
                    <p className="mt-1">离开 {spot.leaveTime || "--:--"}</p>
                  </div>
                  <div className="rounded-lg bg-card px-2.5 py-2 text-muted-foreground">
                    <p>建议停留</p>
                    <p className="mt-1 text-foreground font-medium">
                      {spot.suggestedDurationText || "--"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 className="w-3.5 h-3.5 text-primary" />
                    {spot.openTime || "营业时间以现场为准"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                    <Wallet className="w-3.5 h-3.5" />
                    {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                  </span>
                </div>
              </article>

              {followingLeg && <RouteLegCard leg={followingLeg} />}
            </div>
          )
        })}
      </div>

      <footer className="mt-4 rounded-xl bg-secondary/40 p-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          当日景点 {day.spots.length} 个
        </div>
        <div className="mt-1 text-muted-foreground">
          游玩时长 {Math.round(day.totalPlayMinutes)} 分钟 · 预计花费 ¥{day.totalEstimatedCost}
        </div>
      </footer>
    </section>
  )
}
