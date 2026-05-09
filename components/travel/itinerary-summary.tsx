"use client"

import { CalendarDays, Compass, MapPin, Sparkles } from "lucide-react"
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

function buildRouteSentence(plan: TripPlan) {
  const explanation = plan.planExplanations?.[0]
  if (explanation) return explanation

  const interests = plan.requirement?.interests || []
  if (interests.includes("历史人文") && interests.includes("美食打卡")) {
    return "以中轴线文化体验为主，兼顾夜间美食与舒适住宿。"
  }
  if (interests.includes("自然风光")) {
    return "围绕顺路片区展开自然与城市节奏并重的日程。"
  }
  return "聚焦经典北京与顺路餐饮安排，减少折返，提升旅行从容度。"
}

export function ItinerarySummary({ plan }: ItinerarySummaryProps) {
  const tags = buildStyleTags(plan)
  const routeSentence = buildRouteSentence(plan)

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

        <p className="mt-4 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-sm leading-6 text-[var(--app-text-secondary)]">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--app-text-primary)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--app-brand)]" />
            路线摘要
          </span>
          <span className="ml-1">{routeSentence}</span>
        </p>
      </div>
    </section>
  )
}
