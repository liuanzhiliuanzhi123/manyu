"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Clock,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  X,
} from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppTag } from "@/components/ui/app-tag"
import { resolvePlaceImage } from "@/lib/place-image"
import { useTravel, type Spot } from "@/lib/travel-context"
import { cn } from "@/lib/utils"
import type { NavigateToSpotResult } from "@/lib/navigation"

interface SpotDetailSheetProps {
  spot: Spot | null
  onClose: () => void
  onNavigateToSpot: (spot: Spot) => Promise<NavigateToSpotResult>
}

export function SpotDetailSheet({
  spot,
  onClose,
  onNavigateToSpot,
}: SpotDetailSheetProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite } = useTravel()
  const [isNavigating, setIsNavigating] = useState(false)
  const [navigationMessage, setNavigationMessage] = useState("")

  const spotId = spot?.id ?? ""
  const isInTrip = useMemo(() => {
    if (!spotId) return false
    return selectedSpots.some((item) => item.id === spotId)
  }, [selectedSpots, spotId])

  const isFavorite = useMemo(() => {
    if (!spotId) return false
    return favorites.includes(spotId)
  }, [favorites, spotId])

  const navigationButtonText = useMemo(
    () => (isNavigating ? "正在规划路线..." : "导航前往"),
    [isNavigating]
  )

  useEffect(() => {
    setIsNavigating(false)
    setNavigationMessage("")
  }, [spotId])

  const handleNavigateToSpot = async () => {
    if (isNavigating || !spot) return
    setIsNavigating(true)
    setNavigationMessage("正在获取当前位置并规划路线...")
    try {
      const result = await onNavigateToSpot(spot)
      setNavigationMessage(result.message)
      if (result.ok) onClose()
    } finally {
      setIsNavigating(false)
    }
  }

  if (!spot) return null

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/38" />

      <div className="pointer-events-none relative mx-auto flex h-full w-full max-w-lg items-end">
        <section
          className="pointer-events-auto animate-slide-in-up w-full overflow-hidden rounded-t-[1.8rem] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] shadow-[var(--app-shadow-lifted)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-center pb-2 pt-3">
            <div className="h-1.5 w-12 rounded-full bg-[var(--app-line-strong)]" />
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-elevated)]/90 text-[var(--app-text-secondary)] transition-colors hover:bg-[var(--app-surface)]"
            aria-label="close"
          >
            <X className="h-[1.125rem] w-[1.125rem]" />
          </button>

          <div className="relative h-56">
            <img
              src={resolvePlaceImage({
                id: spot.id,
                name: spot.name,
                city: spot.city,
                province: spot.province,
                image: spot.image,
                coverImage: spot.image,
              })}
              alt={spot.name}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = resolvePlaceImage({
                  city: spot.city,
                  province: spot.province,
                  name: spot.name,
                })
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

            <div className="absolute left-4 top-4 flex gap-2">
              <button
                onClick={() => toggleFavorite(spot.id)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  isFavorite
                    ? "bg-[var(--app-error)] text-white"
                    : "bg-white/92 text-[var(--app-text-primary)] hover:bg-white"
                )}
              >
                <Heart className={cn("h-[1.125rem] w-[1.125rem]", isFavorite && "fill-current")} />
              </button>
              <button
                onClick={() => setNavigationMessage("分享功能即将上线")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[var(--app-text-primary)] transition-colors hover:bg-white"
              >
                <Share2 className="h-[1.125rem] w-[1.125rem]" />
              </button>
            </div>

            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="numeric flex items-center gap-1 rounded-full bg-white/94 px-3 py-1.5 text-sm text-[var(--app-text-strong)]">
                <Star className="h-3.5 w-3.5 fill-[var(--app-gold)] text-[var(--app-gold)]" />
                {spot.rating.toFixed(1)}
              </div>
              <div className="numeric rounded-full bg-[var(--app-brand)]/88 px-3 py-1.5 text-xs font-medium text-white">
                热度 {spot.heat}%
              </div>
            </div>
          </div>

          <div className="scrollbar-thin max-h-[calc(90vh-15rem)] overflow-y-auto px-5 pb-28 pt-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-[var(--app-text-strong)]">{spot.name}</h1>
                <AppTag tone="brand" className="mt-2">
                  {spot.type === "attraction" ? "景点" : spot.type === "restaurant" ? "美食" : "住宿"}
                </AppTag>
              </div>
              <span className="numeric whitespace-nowrap text-xl font-semibold text-[var(--app-brand)]">
                {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
              </span>
            </div>

            {spot.tags.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-1.5">
                {spot.tags.map((tag) => (
                  <AppTag key={tag}>{tag}</AppTag>
                ))}
              </div>
            )}

            <div className="mb-5 space-y-2.5">
              <AppCard tone="soft" padding="md" className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-[1.125rem] w-[1.125rem] flex-shrink-0 text-[var(--app-brand)]" />
                <div>
                  <p className="text-xs text-[var(--app-text-secondary)]">地址</p>
                  <p className="mt-1 text-sm text-[var(--app-text-primary)]">{spot.address || "暂无地址"}</p>
                </div>
              </AppCard>

              {spot.openTime && (
                <AppCard tone="soft" padding="md" className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-[1.125rem] w-[1.125rem] flex-shrink-0 text-[var(--app-brand)]" />
                  <div>
                    <p className="text-xs text-[var(--app-text-secondary)]">营业时间</p>
                    <p className="mt-1 text-sm text-[var(--app-text-primary)]">{spot.openTime}</p>
                  </div>
                </AppCard>
              )}

              {spot.phone && (
                <AppCard tone="soft" padding="md" className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-[1.125rem] w-[1.125rem] flex-shrink-0 text-[var(--app-brand)]" />
                  <div>
                    <p className="text-xs text-[var(--app-text-secondary)]">联系电话</p>
                    <p className="mt-1 text-sm text-[var(--app-text-primary)]">{spot.phone}</p>
                  </div>
                </AppCard>
              )}
            </div>

            <section className="mb-5">
              <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">地点简介</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--app-text-secondary)]">
                {spot.description || "暂无简介"}
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">地图导航</h3>
              <button
                type="button"
                onClick={handleNavigateToSpot}
                disabled={isNavigating}
                className="relative mt-2 h-32 w-full overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface)] disabled:opacity-70"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Navigation className="mx-auto mb-2 h-7 w-7 text-[var(--app-brand)]" />
                    <p className="text-sm text-[var(--app-text-secondary)]">
                      {isNavigating ? "正在规划路线..." : "点击查看地图导航"}
                    </p>
                  </div>
                </div>
              </button>
            </section>
          </div>

          <div className="pointer-events-auto sticky bottom-0 z-20 space-y-2 border-t border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] pt-3">
            {navigationMessage && (
              <p className="text-xs text-[var(--app-text-secondary)]">{navigationMessage}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <AppButton
                type="button"
                variant="secondary"
                size="lg"
                onClick={handleNavigateToSpot}
                disabled={isNavigating}
              >
                <Navigation className="h-[1.125rem] w-[1.125rem]" />
                {navigationButtonText}
              </AppButton>
              <AppButton
                type="button"
                variant={isInTrip ? "secondary" : "primary"}
                size="lg"
                onClick={() => addSpot(spot)}
                disabled={isInTrip}
              >
                {isInTrip ? "已在行程" : "加入行程"}
              </AppButton>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
