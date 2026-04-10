"use client"

import { useState } from "react"
import { MapPin, Search } from "lucide-react"
import { SpotCard, SpotData } from "./spot-card"

const defaultSpots: SpotData[] = [
  {
    id: "1",
    name: "故宫博物院",
    address: "北京市东城区景山前街4号",
    rating: 4.9,
    heat: 9856,
    price: 60,
    description: "中国明清两代的皇家宫殿，世界上现存规模最大、保存最完整的木质结构古建筑群。",
  },
  {
    id: "2",
    name: "天坛公园",
    address: "北京市东城区天坛内东里7号",
    rating: 4.8,
    heat: 7532,
    price: 15,
    description: "明清两代帝王祭天祈谷的场所，是中国现存最大的古代祭祀性建筑群。",
  },
  {
    id: "3",
    name: "颐和园",
    address: "北京市海淀区新建宫门路19号",
    rating: 4.8,
    heat: 8234,
    price: 30,
    description: "中国清朝时期皇家园林，是保存最完整的一座皇家行宫御苑，被誉为皇家园林博物馆。",
  },
]

interface BrowseSpotsProps {
  onAddSpot: (spot: SpotData) => void
  addedSpotIds: string[]
}

export function BrowseSpots({ onAddSpot, addedSpotIds }: BrowseSpotsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [spots] = useState<SpotData[]>(defaultSpots)

  const filteredSpots = spots.filter(
    (spot) =>
      spot.name.includes(searchTerm) ||
      spot.address.includes(searchTerm) ||
      spot.description.includes(searchTerm)
  )

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#E2E8F0]">
        <h2 className="flex items-center gap-2 font-bold text-[#1E293B] text-[16px] mb-3">
          <MapPin className="w-4 h-4 text-[#EF4444]" />
          浏览行程点
        </h2>
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="搜索景点、酒店、餐厅..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A6CF7]/30 focus:border-[#4A6CF7] transition-all"
            />
          </div>
          <button className="px-4 py-2 bg-gradient-to-r from-[#4A6CF7] to-[#7B61FF] text-white text-[13px] font-medium rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1">
            <Search className="w-4 h-4" />
            搜索
          </button>
        </div>
      </div>

      {/* Spot List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300">
        {filteredSpots.length > 0 ? (
          filteredSpots.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              onAdd={onAddSpot}
              isAdded={addedSpotIds.includes(spot.id)}
            />
          ))
        ) : (
          <div className="text-center text-[#64748B] py-8">
            未找到相关行程点
          </div>
        )}
      </div>
    </div>
  )
}
