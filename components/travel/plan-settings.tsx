"use client"

import { useState } from "react"
import { Settings, Calendar, ChevronDown, MapPin, Rocket, Loader2 } from "lucide-react"

interface PlanSettingsProps {
  onGenerate: (settings: PlanSettingsData) => void
  isGenerating: boolean
  spotsCount: number
}

export interface PlanSettingsData {
  startDate: string
  endDate: string
  pace: string
  departure: string
}

export function PlanSettings({ onGenerate, isGenerating, spotsCount }: PlanSettingsProps) {
  const [settings, setSettings] = useState<PlanSettingsData>({
    startDate: "",
    endDate: "",
    pace: "适中",
    departure: "",
  })

  const handleSubmit = () => {
    if (spotsCount === 0) {
      alert("请先添加行程点")
      return
    }
    onGenerate(settings)
  }

  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3">
      {/* Header */}
      <h2 className="flex items-center gap-2 font-bold text-[#1E293B] text-[14px] mb-2">
        <Settings className="w-4 h-4 text-[#4A6CF7]" />
        规划设置
      </h2>

      {/* Form - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B]" />
          <input
            type="date"
            placeholder="开始日期"
            value={settings.startDate}
            onChange={(e) => setSettings({ ...settings, startDate: e.target.value })}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A6CF7]/30 focus:border-[#4A6CF7] transition-all text-[#1E293B] placeholder:text-[#64748B]"
          />
        </div>

        <div className="relative">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B]" />
          <input
            type="date"
            placeholder="结束日期"
            value={settings.endDate}
            onChange={(e) => setSettings({ ...settings, endDate: e.target.value })}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A6CF7]/30 focus:border-[#4A6CF7] transition-all text-[#1E293B] placeholder:text-[#64748B]"
          />
        </div>

        <div className="relative">
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B]" />
          <select
            value={settings.pace}
            onChange={(e) => setSettings({ ...settings, pace: e.target.value })}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A6CF7]/30 focus:border-[#4A6CF7] transition-all text-[#1E293B] appearance-none bg-white cursor-pointer"
          >
            <option value="轻松">轻松</option>
            <option value="适中">适中</option>
            <option value="紧凑">紧凑</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B] pointer-events-none" />
        </div>

        <div className="relative">
          <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B]" />
          <input
            type="text"
            placeholder="出发地点"
            value={settings.departure}
            onChange={(e) => setSettings({ ...settings, departure: e.target.value })}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A6CF7]/30 focus:border-[#4A6CF7] transition-all text-[#1E293B] placeholder:text-[#64748B]"
          />
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleSubmit}
        disabled={isGenerating}
        className="w-full mt-2 py-2 bg-gradient-to-r from-[#4A6CF7] to-[#7B61FF] text-white text-[12px] font-medium rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在生成规划...
          </>
        ) : (
          <>
            <Rocket className="w-3.5 h-3.5" />
            生成智能规划
          </>
        )}
      </button>
    </div>
  )
}
