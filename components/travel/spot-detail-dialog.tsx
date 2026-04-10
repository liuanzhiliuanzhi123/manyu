"use client"

import { MapPin, Star, Flame, X } from "lucide-react"
import { SpotData } from "./spot-card"

interface SpotDetailDialogProps {
  spot: SpotData | null
  onClose: () => void
}

export function SpotDetailDialog({ spot, onClose }: SpotDetailDialogProps) {
  if (!spot) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-[#1E293B] text-[18px]">{spot.name}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#64748B]" />
          </button>
        </div>

        <div className="flex items-center gap-1 text-[#64748B] text-[13px] mb-3">
          <MapPin className="w-4 h-4 text-[#EF4444]" />
          <span>{spot.address}</span>
        </div>

        <div className="flex items-center gap-4 text-[#64748B] text-[13px] mb-4">
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            评分 {spot.rating}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-400" />
            热度 {spot.heat}
          </span>
        </div>

        <div className="bg-[#F8FAFC] rounded-xl p-4 mb-4">
          <p className="text-[#1E293B] text-[13px] leading-relaxed">{spot.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#64748B] text-[12px]">门票价格</span>
            <p className="text-[#EF4444] font-bold text-[20px]">¥{spot.price}</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-[#4A6CF7] to-[#7B61FF] text-white text-[14px] font-medium rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
