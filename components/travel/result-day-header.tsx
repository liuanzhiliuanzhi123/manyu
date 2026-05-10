"use client"

import { Clock3, CloudSun, MapPin, Route, Thermometer, Wind } from "lucide-react"
import { formatDistance, formatDuration } from "@/lib/amap-spot-utils"
import { getDayHeadline, getDayLabel } from "@/lib/result-layout"
import type { ItineraryDay } from "@/lib/travel-context"

interface ResultDayHeaderProps {
  day: ItineraryDay
}

export function ResultDayHeader({ day }: ResultDayHeaderProps) {
  const dayWeather = day.weather

  return (
    <section className="relative overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-5 shadow-[var(--app-shadow-soft)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[color:rgba(93,111,47,0.09)] blur-3xl" />

      <div className="relative">
        <p className="text-xs tracking-[0.07em] text-[var(--app-brand)]">{getDayLabel(day.day)}</p>
        <h3 className="mt-2 text-[1.4rem] font-semibold leading-8 text-[var(--app-text-strong)]">{getDayHeadline(day)}</h3>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-secondary)]">
          <span className="numeric rounded-full bg-[var(--app-surface)] px-2.5 py-1">
            {day.startTime} - {day.endTime}
          </span>
          <span className="rounded-full bg-[var(--app-surface)] px-2.5 py-1">
            {day.districtSummary || "核心片区"}
          </span>
        </div>

        {dayWeather && (
          <div className="mt-3 rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-secondary)]">
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--app-text-primary)]">
                <CloudSun className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                {dayWeather.weather}
              </span>
              <span className="numeric inline-flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                {dayWeather.temperatureText}
              </span>
              {dayWeather.windText && (
                <span className="inline-flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                  {dayWeather.windText}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[var(--app-text-secondary)]">
              {day.weatherAdvice || dayWeather.advice}
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <article className="rounded-[0.85rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5">
            <p className="inline-flex items-center gap-1 text-[var(--app-text-secondary)]">
              <Route className="h-3.5 w-3.5 text-[var(--app-brand)]" />
              总路程
            </p>
            <p className="numeric mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
              {formatDistance(day.totalDistanceMeters)}
            </p>
          </article>
          <article className="rounded-[0.85rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5">
            <p className="inline-flex items-center gap-1 text-[var(--app-text-secondary)]">
              <Clock3 className="h-3.5 w-3.5 text-[var(--app-brand)]" />
              交通时长
            </p>
            <p className="numeric mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
              {formatDuration(day.totalTravelSeconds)}
            </p>
          </article>
          <article className="rounded-[0.85rem] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5">
            <p className="inline-flex items-center gap-1 text-[var(--app-text-secondary)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--app-brand)]" />
              游玩时长
            </p>
            <p className="numeric mt-1 text-sm font-semibold text-[var(--app-text-strong)]">
              {Math.round(day.totalPlayMinutes)} 分钟
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
