"use client"

import { X, MapPin, Star, Clock, Phone, Heart, Share2, Navigation } from "lucide-react"
import { useTravel, Spot } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface SpotDetailSheetProps {
  spot: Spot | null
  onClose: () => void
}

export function SpotDetailSheet({ spot, onClose }: SpotDetailSheetProps) {
  const { addSpot, selectedSpots, favorites, toggleFavorite } = useTravel()

  if (!spot) return null

  const isInTrip = selectedSpots.some((s) => s.id === spot.id)
  const isFavorite = favorites.includes(spot.id)

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-hidden animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/20 text-white flex items-center justify-center hover:bg-black/30 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image */}
        <div className="relative h-56">
          <img
            src={spot.image}
            alt={spot.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Floating Actions */}
          <div className="absolute top-4 left-4 flex gap-2">
            <button
              onClick={() => toggleFavorite(spot.id)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isFavorite ? "bg-red-500 text-white" : "bg-white/90 text-foreground hover:bg-white"
              )}
            >
              <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* Rating Badge */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/95 px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-bold text-foreground">{spot.rating}</span>
            </div>
            <div className="px-3 py-1.5 bg-primary/90 text-primary-foreground rounded-full text-sm font-medium">
              热度 {spot.heat}%
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-14rem)] p-6 scrollbar-thin">
          {/* Title & Type */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-foreground">{spot.name}</h1>
              <span className="text-xl font-bold text-primary whitespace-nowrap">
                {spot.ticketPrice === 0 ? "免费" : `¥${spot.ticketPrice}`}
              </span>
            </div>
            <span className="inline-block mt-2 px-3 py-1 bg-secondary rounded-full text-sm font-medium text-foreground">
              {spot.type === "attraction" ? "景点" : spot.type === "restaurant" ? "美食" : "住宿"}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {spot.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-accent/20 text-accent-foreground rounded-lg text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Info Cards */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-4 bg-secondary rounded-xl">
              <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">地址</p>
                <p className="text-foreground">{spot.address}</p>
              </div>
            </div>

            {spot.openTime && (
              <div className="flex items-start gap-3 p-4 bg-secondary rounded-xl">
                <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">营业时间</p>
                  <p className="text-foreground">{spot.openTime}</p>
                </div>
              </div>
            )}

            {spot.phone && (
              <div className="flex items-start gap-3 p-4 bg-secondary rounded-xl">
                <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">联系电话</p>
                  <p className="text-foreground">{spot.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-bold text-foreground mb-3">简介</h3>
            <p className="text-muted-foreground leading-relaxed">{spot.description}</p>
          </div>

          {/* Map Preview */}
          <div className="mb-6">
            <h3 className="font-bold text-foreground mb-3">位置</h3>
            <div className="relative h-40 bg-secondary rounded-xl overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Navigation className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">点击查看地图导航</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="sticky bottom-0 p-4 bg-card border-t border-border flex gap-3">
          <button className="flex-1 py-4 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors btn-press flex items-center justify-center gap-2">
            <Navigation className="w-5 h-5" />
            导航前往
          </button>
          <button
            onClick={() => addSpot(spot)}
            disabled={isInTrip}
            className={cn(
              "flex-1 py-4 rounded-xl font-medium transition-all btn-press flex items-center justify-center gap-2",
              isInTrip
                ? "bg-muted text-muted-foreground cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isInTrip ? "已在行程中" : "加入我的行程"}
          </button>
        </div>
      </div>
    </div>
  )
}
