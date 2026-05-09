"use client"

import { AppInput } from "@/components/ui/app-input"

interface PlannerDateFieldsProps {
  tripName: string
  departure: string
  startDate: string
  endDate: string
  dayCount: number
  manualEndDate: boolean
  dateError?: string
  onTripNameChange: (value: string) => void
  onDepartureChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onManualEndDateChange: (value: boolean) => void
}

export function PlannerDateFields({
  tripName,
  departure,
  startDate,
  endDate,
  dayCount,
  manualEndDate,
  dateError,
  onTripNameChange,
  onDepartureChange,
  onStartDateChange,
  onEndDateChange,
  onManualEndDateChange,
}: PlannerDateFieldsProps) {
  return (
    <section className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4 shadow-[var(--app-shadow-soft)]">
      <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">补充信息（可选）</h4>
      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
        结束日期默认按天数自动计算，也支持手动指定。
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <AppInput
          type="text"
          value={tripName}
          onChange={(event) => onTripNameChange(event.target.value)}
          placeholder="行程名称（例如：杭州三日慢游）"
          tone="subtle"
        />
        <AppInput
          type="text"
          value={departure}
          onChange={(event) => onDepartureChange(event.target.value)}
          placeholder="出发地（例如：上海虹桥）"
          tone="subtle"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--app-text-secondary)]">出发日期</label>
          <AppInput
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            tone="subtle"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--app-text-secondary)]">
            结束日期{manualEndDate ? "（手动）" : "（自动）"}
          </label>
          <AppInput
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            disabled={!manualEndDate}
            tone="subtle"
            className="disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="numeric mt-2 flex items-center justify-between rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
        <span>当前天数：{dayCount} 天</span>
        <button
          type="button"
          onClick={() => onManualEndDateChange(!manualEndDate)}
          className="font-medium text-[var(--app-brand)]"
        >
          {manualEndDate ? "改为自动推导" : "手动指定结束日期"}
        </button>
      </div>

      {dateError ? (
        <p className="mt-2 text-xs text-[var(--app-error)]">{dateError}</p>
      ) : (
        <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
          未手动填写结束日期时，会按“出发日期 + 天数”自动计算。
        </p>
      )}
    </section>
  )
}
