"use client"

import type { ItineraryDay } from "@/lib/travel-context"

interface TransportRecommendationCardProps {
  day: ItineraryDay
  routeLegsOverride?: ItineraryDay["routeLegs"]
}

const MODE_LABEL: Record<string, string> = {
  walking: "步行",
  driving: "驾车",
  transit: "公交",
  subway: "地铁",
  bus: "公交",
  taxi: "打车",
  train: "高铁",
  flight: "飞机",
}

export function TransportRecommendationCard({
  day,
  routeLegsOverride,
}: TransportRecommendationCardProps) {
  const sourceLegs = routeLegsOverride ?? day.routeLegs
  const recommendations = sourceLegs
    .filter((leg) => Boolean(leg.recommendedMode))
    .map((leg) => ({
      id: leg.id,
      fromName: leg.fromName,
      toName: leg.toName,
      mode: leg.recommendedMode as string,
      reason: leg.recommendedReason || "",
    }))

  if (recommendations.length === 0) return null

  return (
    <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4 shadow-[var(--app-shadow-soft)]">
      <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">交通建议</h4>
      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
        根据路段距离与旅行节奏，给出更贴近现实的出行方式。
      </p>
      <div className="mt-3 space-y-2">
        {recommendations.map((item) => (
          <div
            key={item.id}
            className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-primary)]"
          >
            <p className="font-medium">
              {item.fromName} → {item.toName}：{MODE_LABEL[item.mode] || item.mode}
            </p>
            {item.reason && (
              <p className="mt-1 leading-5 text-[var(--app-text-secondary)]">{item.reason}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
