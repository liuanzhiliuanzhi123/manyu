"use client"

import { ReceiptText, Wallet } from "lucide-react"
import { AppCard } from "@/components/ui/app-card"
import type { ItineraryDay } from "@/lib/travel-context"

interface ResultBudgetSummaryProps {
  day: ItineraryDay
}

export function ResultBudgetSummary({ day }: ResultBudgetSummaryProps) {
  const mealCost = day.totalMealCost || 0
  const hotelCost = day.totalHotelCost || 0
  const ticketCost = Math.max(0, day.totalEstimatedCost - mealCost - hotelCost)

  return (
    <AppCard tone="elevated" padding="md">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-text-strong)]">
            <Wallet className="h-4 w-4 text-[var(--app-brand)]" />
            预算与备注
          </h4>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            作为当日手册尾注，便于快速评估花费与注意事项。
          </p>
        </div>
        <span className="numeric rounded-full bg-[var(--app-brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-brand)]">
          合计 ¥{Math.round(day.totalEstimatedCost)}
        </span>
      </header>

      <div className="numeric mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--app-text-secondary)]">
        <div className="rounded-[0.75rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">景点预算 ¥{Math.round(ticketCost)}</div>
        <div className="rounded-[0.75rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">餐饮预算 ¥{Math.round(mealCost)}</div>
        <div className="rounded-[0.75rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">酒店预算 ¥{Math.round(hotelCost)}</div>
        <div className="rounded-[0.75rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2">点位数量 {day.spots.length} 个</div>
      </div>

      <div className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
        <p className="inline-flex items-center gap-1.5 font-medium text-[var(--app-text-primary)]">
          <ReceiptText className="h-3.5 w-3.5 text-[var(--app-brand)]" />
          今日备注
        </p>
        {day.warnings && day.warnings.length > 0 ? (
          <div className="mt-1 space-y-1">
            {day.warnings.slice(0, 2).map((warning, index) => (
              <p key={`${warning}-${index}`}>• {warning}</p>
            ))}
          </div>
        ) : (
          <p className="mt-1">整体节奏稳定，建议预留少量弹性预算应对临时排队与交通波动。</p>
        )}
      </div>
    </AppCard>
  )
}
