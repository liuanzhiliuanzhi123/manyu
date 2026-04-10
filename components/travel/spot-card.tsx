"use client"

import { MapPin, Star, Flame } from "lucide-react"

export interface SpotData {
  id: string
  name: string
  address: string
  rating: number
  heat: number
  price: number
  description: string
}

interface SpotCardProps {
  spot: SpotData
  onAdd: (spot: SpotData) => void
  isAdded?: boolean
}

export function SpotCard({ spot, onAdd, isAdded }: SpotCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] mb-3">
      <h3 className="font-bold text-[#1E293B] text-[16px] mb-2">{spot.name}</h3>
      <div className="flex items-center gap-1 text-[#64748B] text-[12px] mb-2">
        <MapPin className="w-3 h-3 text-[#EF4444]" />
        <span className="line-clamp-1">{spot.address}</span>
      </div>
      <div className="flex items-center gap-3 text-[#64748B] text-[12px] mb-2">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          {spot.rating}
        </span>
        <span className="flex items-center gap-1">
          <Flame className="w-3 h-3 text-orange-400" />
          {spot.heat}
        </span>
        <span>门票：¥{spot.price}</span>
      </div>
      <p className="text-[#64748B] text-[12px] line-clamp-2 mb-3">{spot.description}</p>
      <button
        onClick={() => onAdd(spot)}
        disabled={isAdded}
        className={`w-full py-2 rounded-xl text-white text-[14px] font-medium transition-all ${
          isAdded
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#22C55E] hover:bg-[#16A34A] active:scale-[0.98]"
        }`}
      >
        {isAdded ? "✓ 已添加" : "+ 添加到行程"}
      </button>
    </div>
  )
}
