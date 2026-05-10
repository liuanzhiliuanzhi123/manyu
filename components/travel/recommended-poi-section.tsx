"use client"

import { useState } from "react"
import { ChevronDown, Plus } from "lucide-react"
import { PlacePhotoImage } from "@/components/travel/place-photo-image"
import { AppTag } from "@/components/ui/app-tag"
import type { RecommendedPoiCandidate } from "@/lib/planner-recommendations"
import { cn } from "@/lib/utils"

interface RecommendedPoiSectionProps {
  title: string
  subtitle: string
  items: RecommendedPoiCandidate[]
  inCart: (spotId: string) => boolean
  onAdd: (spotId: string) => void
}

export function RecommendedPoiSection({
  title,
  subtitle,
  items,
  inCart,
  onAdd,
}: RecommendedPoiSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</h4>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
          当前筛选下暂无推荐，下一步会根据你的需求自动补全。
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const active = expandedId === item.spot.id
            const carted = inCart(item.spot.id)
            return (
              <article
                key={item.spot.id}
                className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <PlacePhotoImage
                    name={item.spot.name}
                    city={item.spot.city}
                    province={item.spot.province}
                    type={item.spot.type}
                    alt={item.spot.name}
                    className="h-12 w-12 rounded-[0.75rem] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--app-text-strong)]">{item.spot.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.reasonTags.slice(0, 3).map((tag) => (
                        <AppTag key={tag}>{tag}</AppTag>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(item.spot.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-[0.65rem] px-2.5 text-xs font-medium",
                      carted
                        ? "bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                        : "bg-[var(--app-brand)] text-white"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {carted ? "已加入" : "加入"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(active ? null : item.spot.id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--app-text-secondary)]"
                >
                  查看简介
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", active && "rotate-180")} />
                </button>

                {active && (
                  <p className="mt-2 text-xs leading-5 text-[var(--app-text-secondary)]">{item.spot.description}</p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
