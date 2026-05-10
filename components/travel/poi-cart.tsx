"use client"

import { MapPin, Trash2 } from "lucide-react"
import { PlacePhotoImage } from "@/components/travel/place-photo-image"
import type { Spot } from "@/lib/travel-context"

interface PoiCartProps {
  selectedPois: Spot[]
  onRemove: (spotId: string) => void
  onClear: () => void
}

function getPoiTypeLabel(type: Spot["type"]) {
  if (type === "restaurant") return "美食"
  if (type === "hotel") return "住宿"
  return "景点"
}

export function PoiCart({ selectedPois, onRemove, onClear }: PoiCartProps) {
  if (selectedPois.length === 0) {
    return (
      <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] p-5 text-center text-sm text-[var(--app-text-secondary)]">
        你还没有手动添加内容。可以继续从推荐里加入，也可以直接下一步自动生成。
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">已选清单</h4>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-error)]"
        >
          清空
        </button>
      </div>

      <div className="space-y-2">
        {selectedPois.map((spot, index) => (
          <article
            key={spot.id}
            className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] p-3"
          >
            <div className="flex items-center gap-3">
              <span className="numeric flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-xs font-semibold text-[var(--app-brand)]">
                {index + 1}
              </span>
              <PlacePhotoImage
                name={spot.name}
                city={spot.city}
                province={spot.province}
                type={spot.type}
                alt={spot.name}
                className="h-12 w-12 rounded-[0.75rem] object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--app-text-strong)]">{spot.name}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--app-text-secondary)]">
                  <MapPin className="h-3.5 w-3.5" />
                  {spot.address}
                </p>
                <div className="numeric mt-1 text-xs text-[var(--app-text-secondary)]">
                  {getPoiTypeLabel(spot.type)} · {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(spot.id)}
                className="rounded-[0.7rem] bg-[color:rgba(187,85,75,0.14)] p-2 text-[var(--app-error)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
