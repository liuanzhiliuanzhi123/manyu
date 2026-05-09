"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import type { TripPlan } from "@/lib/travel-context"

interface CalendarPageProps {
  plans: TripPlan[]
  onGoPlanner?: () => void
}

interface CalendarMark {
  key: string
  name: string
}

function parseDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`
}

function getMonthMatrix(anchor: Date) {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - startOffset)

  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + i)
    days.push(day)
  }
  return days
}

function buildPlanDateMap(plans: TripPlan[]) {
  const map = new Map<string, CalendarMark[]>()
  for (const plan of plans) {
    const start = parseDate(plan.startDate)
    const end = parseDate(plan.endDate)
    if (!start) continue
    const last = end && end >= start ? end : start
    const cursor = new Date(start)
    while (cursor <= last) {
      const key = toDateKey(cursor)
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push({ key: plan.id, name: plan.name })
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return map
}

export function CalendarPage({ plans, onGoPlanner }: CalendarPageProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const dayMatrix = useMemo(() => getMonthMatrix(monthCursor), [monthCursor])
  const dateMap = useMemo(() => buildPlanDateMap(plans), [plans])
  const nowKey = toDateKey(new Date())

  return (
    <div className="space-y-4">
      <article className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
            className="rounded-[0.7rem] border border-[var(--app-line)] bg-[var(--app-surface)] p-2 text-[var(--app-text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-semibold text-[var(--app-text-strong)]">{formatMonthLabel(monthCursor)}</h3>
          <button
            type="button"
            onClick={() =>
              setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
            className="rounded-[0.7rem] border border-[var(--app-line)] bg-[var(--app-surface)] p-2 text-[var(--app-text-primary)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--app-text-secondary)]">
          {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
            <span key={day} className="py-1">
              周{day}
            </span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {dayMatrix.map((day) => {
            const key = toDateKey(day)
            const isCurrentMonth = day.getMonth() === monthCursor.getMonth()
            const marks = dateMap.get(key) || []
            const isToday = key === nowKey
            return (
              <div
                key={key}
                className={`rounded-[0.7rem] border px-1 py-2 text-center ${
                  isCurrentMonth
                    ? "border-[var(--app-line)] bg-[var(--app-surface)]"
                    : "border-transparent bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]"
                } ${isToday ? "ring-1 ring-[var(--app-brand)]/35" : ""}`}
              >
                <div className="numeric text-xs font-medium">{day.getDate()}</div>
                <div className="mt-1 flex min-h-3 items-center justify-center gap-1">
                  {marks.slice(0, 2).map((mark) => (
                    <span key={mark.key} className="h-1.5 w-1.5 rounded-full bg-[var(--app-brand)]" />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--app-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-brand)]" />
            已保存行程
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full ring-1 ring-[var(--app-brand)]/50" />
            今天
          </span>
        </div>
      </article>

      <article className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
        <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">行程日历清单</h4>
        {plans.length === 0 ? (
          <div className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-4 text-sm text-[var(--app-text-secondary)]">
            你还没有可展示的已保存行程。先去 AI 规划生成第一份方案吧。
            <AppButton
              type="button"
              onClick={onGoPlanner}
              className="mt-3"
              size="sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              去 AI 规划
            </AppButton>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {plans.slice(0, 12).map((plan) => (
              <div
                key={plan.id}
                className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5"
              >
                <p className="text-sm font-medium text-[var(--app-text-strong)]">{plan.name}</p>
                <p className="numeric mt-1 text-xs text-[var(--app-text-secondary)]">
                  {plan.startDate || "--"} ~ {plan.endDate || "--"} · {plan.totalDays || 0} 天
                </p>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
