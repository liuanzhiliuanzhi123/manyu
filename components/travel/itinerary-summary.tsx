"use client"

import { CalendarDays, CloudSun, Compass, MapPin, Thermometer, Wind } from "lucide-react"
import type { TripPlan } from "@/lib/travel-context"

interface ItinerarySummaryProps {
  plan: TripPlan
}

function buildStyleTags(plan: TripPlan) {
  const interests = plan.requirement?.interests || []
  const pace = plan.requirement?.pace
  const needs = plan.requirement?.specialNeeds || []
  const tags = [...interests.slice(0, 2)]

  if (pace === "fast") tags.push("特种兵式")
  if (pace === "slow") tags.push("慢节奏")
  if (!pace || pace === "balanced") tags.push("轻松适中")

  if (needs.includes("公共交通优先")) tags.push("公共交通优先")
  else if (needs.includes("自驾优先")) tags.push("自驾优先")

  return Array.from(new Set(tags)).slice(0, 4)
}

function buildWeatherOverview(plan: TripPlan) {
  const weather = plan.weatherSummary
  if (!weather) return null

  const firstForecast = weather.forecasts?.[0]
  const label =
    weather.source === "fallback"
      ? "天气数据暂不可用"
      : weather.live?.weather || firstForecast?.dayweather || "天气数据暂不可用"
  const temp =
    firstForecast?.daytemp && firstForecast?.nighttemp
      ? `${firstForecast.nighttemp}-${firstForecast.daytemp}℃`
      : weather.live?.temperature
      ? `${weather.live.temperature}℃`
      : "--"
  const wind =
    weather.live?.winddirection || weather.live?.windpower
      ? `${weather.live.winddirection || ""}${weather.live.windpower || ""}`.trim()
      : firstForecast?.daywind || firstForecast?.daypower
      ? `${firstForecast.daywind || ""}${firstForecast.daypower || ""}`.trim()
      : "风力暂缺"

  return {
    label,
    temp,
    wind,
    summary:
      weather.source === "fallback"
        ? "天气数据暂不可用，本方案按常规出行条件生成。"
        : weather.travelAdvice.summary,
    tags: weather.travelAdvice.tags.slice(0, 4),
  }
}

export function ItinerarySummary({ plan }: ItinerarySummaryProps) {
  const tags = buildStyleTags(plan)
  const weatherOverview = buildWeatherOverview(plan)

  return (
    <section className="relative overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-5 shadow-[var(--app-shadow-soft)]">
      <div className="pointer-events-none absolute -right-16 -top-14 h-40 w-40 rounded-full bg-[color:rgba(93,111,47,0.1)] blur-3xl" />
      <div className="relative">
        <p className="text-[11px] tracking-[0.08em] text-[var(--app-text-secondary)]">TRAVEL HANDBOOK</p>
        <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[0.01em] text-[var(--app-text-strong)]">{plan.name}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface)] px-2.5 py-1 text-[var(--app-text-secondary)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--app-brand)]" />
            {plan.requirement?.city || "北京"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface)] px-2.5 py-1 text-[var(--app-text-secondary)]">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--app-brand)]" />
            {plan.totalDays || 0} 天
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface)] px-2.5 py-1 text-[var(--app-text-secondary)]">
            <Compass className="h-3.5 w-3.5 text-[var(--app-brand)]" />
            {plan.pace}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[var(--app-brand-soft)] px-2.5 py-1 text-[11px] text-[var(--app-brand)]">
              {tag}
            </span>
          ))}
        </div>

        {weatherOverview && (
          <div className="mt-4 rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] p-3">
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <span className="inline-flex items-center gap-1.5 text-[var(--app-text-secondary)]">
                <CloudSun className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                {weatherOverview.label}
              </span>
              <span className="numeric inline-flex items-center gap-1.5 text-[var(--app-text-secondary)]">
                <Thermometer className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                {weatherOverview.temp}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--app-text-secondary)]">
                <Wind className="h-3.5 w-3.5 text-[var(--app-brand)]" />
                {weatherOverview.wind}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--app-text-secondary)]">{weatherOverview.summary}</p>
            {weatherOverview.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {weatherOverview.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[var(--app-brand-soft)] px-2 py-0.5 text-[10px] text-[var(--app-brand)]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  )
}
