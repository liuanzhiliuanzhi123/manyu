"use client"

import { CheckCircle, Smile, Wallet, Lightbulb } from "lucide-react"
import { SpotData } from "./spot-card"

interface TravelPlanProps {
  isVisible: boolean
  spots: SpotData[]
}

export function TravelPlan({ isVisible, spots }: TravelPlanProps) {
  if (!isVisible) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] text-[#64748B]">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#4A6CF7] to-[#7B61FF] opacity-20 mb-3 animate-pulse" />
        <p className="text-[13px]">设置参数后点击"生成智能规划"</p>
        <p className="text-[12px] mt-1">即可生成您的专属旅行计划</p>
      </div>
    )
  }

  const totalTicketPrice = spots.reduce((sum, spot) => sum + spot.price, 0)
  const attractionCount = spots.filter((s) => s.price > 0).length
  const restaurantCount = spots.filter((s) => s.price === 0).length || 1

  const tips = [
    "建议提前在网上预约故宫门票，避免排队",
    "天坛公园早晨去可以看到当地老人晨练，别有风味",
    "颐和园很大，建议安排半天时间游览",
    "北京夏季炎热，请注意防晒和补充水分",
  ]

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* 完成提示条 */}
      <div className="bg-gradient-to-r from-[#7B61FF] to-[#4A6CF7] px-3 py-2 flex items-center gap-2">
        <Smile className="w-4 h-4 text-yellow-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-white">
            <CheckCircle className="w-3 h-3" />
            <span className="font-medium text-[12px]">规划生成完成</span>
          </div>
          <p className="text-white/80 text-[10px] truncate">已为您生成完整的旅行规划</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        {/* 行程总览 */}
        <div className="bg-gradient-to-r from-[#7B61FF] to-[#4A6CF7] rounded-lg p-2.5 text-white">
          <p className="text-[11px] leading-relaxed">
            为期<span className="font-bold">3天</span>的精彩旅行，将带您游览
            <span className="font-bold">{attractionCount}个</span>景点，品尝
            <span className="font-bold">{restaurantCount}家</span>
            特色餐厅。
          </p>
        </div>

        {/* 预算估算 */}
        <div className="bg-[#FEF3C7] rounded-lg p-2.5">
          <h3 className="flex items-center gap-1.5 font-bold text-[#1E293B] text-[12px] mb-1">
            <Wallet className="w-3.5 h-3.5 text-[#F59E0B]" />
            预算估算
          </h3>
          <p className="text-[#EF4444] font-bold text-[14px]">
            总预算：{totalTicketPrice.toFixed(1)}元
          </p>
          <p className="text-[#64748B] text-[10px]">
            门票：{totalTicketPrice.toFixed(1)}元
          </p>
        </div>

        {/* 贴心小贴士 */}
        <div className="bg-[#0EA5E9] rounded-lg p-2.5 text-white">
          <h3 className="flex items-center gap-1.5 font-bold text-[12px] mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-300" />
            贴心小贴士
          </h3>
          <ul className="space-y-1">
            {tips.slice(0, 2).map((tip, index) => (
              <li key={index} className="flex items-start gap-1.5 text-[10px]">
                <span className="w-1 h-1 rounded-full bg-yellow-300 mt-1 flex-shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* 每日行程 */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#4A6CF7] to-[#7B61FF] flex items-center justify-center text-white font-bold text-[11px]">
              1
            </div>
            <div>
              <h4 className="font-bold text-[#1E293B] text-[12px]">历史文化探索之旅</h4>
              <p className="text-[#64748B] text-[10px]">当日预算：{Math.round(totalTicketPrice / 3)}元</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
