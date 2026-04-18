"use client"

import { Bus, Car, Clock3, Footprints, MapPin, Navigation } from "lucide-react"
import type { TravelLeg } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface RouteLegCardProps {
  leg: TravelLeg
}

const modeConfig = {
  driving: { label: "驾车", icon: Car },
  walking: { label: "步行", icon: Footprints },
  transit: { label: "公交", icon: Bus },
} as const

export function RouteLegCard({ leg }: RouteLegCardProps) {
  const mode = modeConfig[leg.transportMode]
  const Icon = mode.icon

  return (
    <article
      className={cn(
        "rounded-xl border p-3",
        leg.isEstimated
          ? "bg-amber-50/70 border-amber-200"
          : "bg-secondary/40 border-border/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" />
            路线段
          </p>
          <p className="text-sm font-medium text-foreground mt-1 truncate">
            {leg.fromName} → {leg.toName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground">
          <Icon className="w-3.5 h-3.5" />
          {mode.label}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-card px-2.5 py-2 text-muted-foreground flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          {leg.readableDistance}
        </div>
        <div className="rounded-lg bg-card px-2.5 py-2 text-muted-foreground flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5 text-primary" />
          {leg.readableDuration}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>建议 {leg.startTime} 出发</span>
        <span>·</span>
        <span>预计 {leg.arrivalTime} 到达</span>
      </div>

      {leg.isEstimated && leg.estimateReason && (
        <p className="mt-2 text-[11px] text-amber-700">{leg.estimateReason}</p>
      )}
    </article>
  )
}
