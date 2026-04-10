"use client"

import { ClipboardList, Eye, Trash2 } from "lucide-react"
import { SpotData } from "./spot-card"

interface MySpotsProps {
  spots: SpotData[]
  onRemove: (id: string) => void
  onView: (spot: SpotData) => void
}

export function MySpots({ spots, onRemove, onView }: MySpotsProps) {
  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 font-bold text-[#1E293B] text-[16px]">
            <ClipboardList className="w-4 h-4 text-[#4A6CF7]" />
            我的行程点
          </h2>
          <span className="text-[#4A6CF7] text-[13px]">已选择{spots.length}个</span>
        </div>
        {spots.length > 0 && (
          <button
            onClick={() => spots.forEach((s) => onRemove(s.id))}
            className="px-3 py-1 bg-[#EF4444] text-white text-[12px] rounded-lg hover:bg-[#DC2626] active:scale-[0.98] transition-all"
          >
            清空
          </button>
        )}
      </div>

      {/* Spot List */}
      <div className="flex-1 overflow-y-auto">
        {spots.length > 0 ? (
          spots.map((spot) => (
            <div
              key={spot.id}
              className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1E293B] text-[14px] truncate">{spot.name}</p>
                <p className="text-[#64748B] text-[12px] truncate">{spot.address}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => onView(spot)}
                  className="p-1.5 text-[#7B61FF] hover:bg-[#7B61FF]/10 rounded-lg transition-colors"
                  title="查看详情"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(spot.id)}
                  className="px-2 py-1 bg-[#EF4444] text-white text-[12px] rounded-lg hover:bg-[#DC2626] active:scale-[0.98] transition-all"
                >
                  移除
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#64748B] text-[13px] py-8">
            <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
            <p>暂无行程点</p>
            <p className="text-[12px]">从左侧添加您感兴趣的景点</p>
          </div>
        )}
      </div>
    </div>
  )
}
