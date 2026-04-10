"use client"

import { SpotData } from "./spot-card"

interface MapViewProps {
  spots: SpotData[]
}

const markerColors = ["#4A6CF7", "#7B61FF", "#22C55E", "#EF4444", "#F59E0B", "#06B6D4", "#EC4899"]

export function MapView({ spots }: MapViewProps) {
  // 模拟北京地图坐标
  const spotPositions: Record<string, { x: number; y: number }> = {
    "1": { x: 55, y: 40 }, // 故宫
    "2": { x: 58, y: 55 }, // 天坛
    "3": { x: 25, y: 30 }, // 颐和园
    "4": { x: 70, y: 20 }, // 八达岭长城
    "5": { x: 65, y: 45 }, // 大董烤鸭店
    "6": { x: 45, y: 50 }, // 其他
    "7": { x: 35, y: 60 }, // 其他
  }

  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-2 flex-1">
      <div className="relative w-full h-full bg-gradient-to-br from-[#E8F4EA] to-[#F0F7F4] rounded-lg overflow-hidden">
        {/* 模拟地图背景 */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* 道路网格 */}
          <path d="M10 50 L90 50" stroke="#D1D5DB" strokeWidth="0.8" fill="none" />
          <path d="M50 10 L50 90" stroke="#D1D5DB" strokeWidth="0.8" fill="none" />
          <path d="M20 30 L80 30" stroke="#E5E7EB" strokeWidth="0.5" fill="none" />
          <path d="M20 70 L80 70" stroke="#E5E7EB" strokeWidth="0.5" fill="none" />
          <path d="M30 20 L30 80" stroke="#E5E7EB" strokeWidth="0.5" fill="none" />
          <path d="M70 20 L70 80" stroke="#E5E7EB" strokeWidth="0.5" fill="none" />
          {/* 环路 */}
          <circle cx="50" cy="45" r="20" stroke="#D1D5DB" strokeWidth="0.6" fill="none" />
          <circle cx="50" cy="45" r="35" stroke="#E5E7EB" strokeWidth="0.5" fill="none" />
        </svg>

        {/* 标记点 */}
        {spots.map((spot, index) => {
          const pos = spotPositions[spot.id] || { x: 50 + (index * 10) % 40, y: 30 + (index * 15) % 40 }
          const color = markerColors[index % markerColors.length]
          return (
            <div
              key={spot.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-bold transition-transform hover:scale-125"
                style={{ backgroundColor: color }}
              >
                {index + 1}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1E293B] text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {spot.name}
              </div>
            </div>
          )
        })}

        {/* 地图标签 */}
        <div className="absolute bottom-1 right-1 text-[9px] text-[#64748B] bg-white/80 px-1 rounded">
          北京城区
        </div>

        {spots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[#64748B] text-[12px]">
            添加行程点后显示地图标记
          </div>
        )}
      </div>
    </div>
  )
}
