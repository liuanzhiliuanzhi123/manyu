"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart, MapPin, Star } from "lucide-react"
import { PlacePhotoImage } from "@/components/travel/place-photo-image"
import { AppButton } from "@/components/ui/app-button"
import { AppTag } from "@/components/ui/app-tag"
import type { Spot } from "@/lib/travel-context"
import { paginateItems } from "@/lib/planner-performance"
import { cn } from "@/lib/utils"

interface VirtualizedPlaceListProps {
  items: Spot[]
  favorites: string[]
  isInTrip: (id: string) => boolean
  onToggleFavorite: (id: string) => void
  onViewSpot: (spot: Spot) => void
  onAddSpot: (spot: Spot) => void
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 18

function SpotImage({ spot }: { spot: Spot }) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [spot.id])

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-[var(--app-radius-lg)] bg-[var(--app-surface-muted)]">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-[var(--app-surface-muted)]" />}
      <PlacePhotoImage
        name={spot.name}
        city={spot.city}
        province={spot.province}
        type={spot.rootCategory || spot.type}
        alt={spot.name}
        fallbackSrc={spot.image}
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/56 via-black/16 to-transparent" />
    </div>
  )
}

export function VirtualizedPlaceList({
  items,
  favorites,
  isInTrip,
  onToggleFavorite,
  onViewSpot,
  onAddSpot,
  pageSize = DEFAULT_PAGE_SIZE,
}: VirtualizedPlaceListProps) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [items])

  const visibleItems = useMemo(() => paginateItems(items, page, pageSize), [items, page, pageSize])
  const hasMore = visibleItems.length < items.length

  return (
    <div className="space-y-3">
      {visibleItems.map((spot) => (
        <article
          key={spot.id}
          onClick={() => onViewSpot(spot)}
          className="card-hover cursor-pointer rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3.5 transition-colors hover:border-[var(--app-line-strong)]"
        >
          <div className="relative">
            <SpotImage spot={spot} />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleFavorite(spot.id)
              }}
              className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-[var(--app-text-muted)] transition-colors hover:bg-white"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  favorites.includes(spot.id) && "fill-[var(--app-error)] text-[var(--app-error)]"
                )}
              />
            </button>
            <div className="absolute bottom-3 left-3 right-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="line-clamp-1 text-base font-semibold text-white">{spot.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-white/90">{spot.city || "未知城市"}</p>
                </div>
                <span className="numeric rounded-full bg-white/92 px-2 py-1 text-[11px] font-semibold text-[var(--brand-deep)]">
                  {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="line-clamp-2 text-xs leading-5 text-[var(--app-text-secondary)]">
              {spot.businessArea ? `${spot.businessArea} · ` : ""}
              {spot.address}
            </p>
            {spot.description && (
              <p className="line-clamp-2 text-xs leading-5 text-[var(--app-text-muted)]">
                {spot.description}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {spot.tags.slice(0, 3).map((tag) => (
                <AppTag key={tag}>{tag}</AppTag>
              ))}
              <AppTag tone="info">{spot.type === "attraction" ? "景点" : spot.type === "restaurant" ? "美食" : "酒店"}</AppTag>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="numeric inline-flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)]">
                <Star className="h-3.5 w-3.5 fill-[var(--app-gold)] text-[var(--app-gold)]" />
                {spot.rating.toFixed(1)}
                <MapPin className="ml-1 h-3.5 w-3.5" />
                {spot.district || spot.city || "未知区域"}
              </p>
              <AppButton
                type="button"
                size="sm"
                variant={isInTrip(spot.id) ? "secondary" : "primary"}
                onClick={(event) => {
                  event.stopPropagation()
                  onAddSpot(spot)
                }}
                disabled={isInTrip(spot.id)}
                className="min-w-20"
              >
                {isInTrip(spot.id) ? "已加入" : "加入行程"}
              </AppButton>
            </div>
          </div>
        </article>
      ))}

      {items.length > 0 && hasMore && (
        <AppButton
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => setPage((prev) => prev + 1)}
        >
          加载更多（{visibleItems.length}/{items.length}）
        </AppButton>
      )}
    </div>
  )
}
