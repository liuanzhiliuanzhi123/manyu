import type { Spot } from "@/lib/travel-context"

export const MINUTES_PER_DAY = 24 * 60

function clampMinutes(totalMinutes: number) {
  const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return normalized
}

export function formatClock(totalMinutes: number) {
  const normalized = clampMinutes(totalMinutes)
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function parseClock(value: string, fallbackMinutes = 540) {
  const matcher = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!matcher) return fallbackMinutes
  const hour = Number(matcher[1])
  const minute = Number(matcher[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallbackMinutes
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallbackMinutes
  return hour * 60 + minute
}

export function estimatePlayMinutes(spot: Spot, pace: string) {
  const paceKey = pace.trim().toLowerCase()
  const type = spot.type

  const baseline = (() => {
    if (type === "restaurant") return 75
    if (type === "hotel") return 45
    return 150
  })()

  if (paceKey === "relaxed") return Math.round(baseline * 1.25)
  if (paceKey === "intensive") return Math.max(45, Math.round(baseline * 0.8))
  return baseline
}

export function formatStayDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "30 分钟"
  if (minutes < 60) return `${Math.round(minutes)} 分钟`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return `${hours} 小时`
  return `${hours.toFixed(1)} 小时`
}

export function resolveDayCount(
  startDate: string,
  endDate: string,
  spotsCount: number,
  pace: string
) {
  if (spotsCount <= 0) return 0

  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    if (diff >= 1) {
      return Math.max(1, Math.min(diff, spotsCount))
    }
  }

  const capacity = (() => {
    if (pace === "relaxed") return 3
    if (pace === "intensive") return 5
    return 4
  })()

  return Math.max(1, Math.min(spotsCount, Math.ceil(spotsCount / capacity)))
}

export function splitSpotsByDay(spots: Spot[], dayCount: number) {
  if (spots.length === 0 || dayCount <= 0) return []
  const finalDayCount = Math.max(1, Math.min(dayCount, spots.length))
  const result: Spot[][] = []
  let cursor = 0

  for (let dayIndex = 0; dayIndex < finalDayCount; dayIndex += 1) {
    const remainingDays = finalDayCount - dayIndex
    const remainingSpots = spots.length - cursor
    const chunkSize = Math.ceil(remainingSpots / remainingDays)
    result.push(spots.slice(cursor, cursor + chunkSize))
    cursor += chunkSize
  }

  return result
}

export function getDefaultDayStartMinutes(pace: string, dayIndex = 0) {
  const base = pace === "intensive" ? 8 * 60 : pace === "relaxed" ? 9 * 60 : 8 * 60 + 30
  return base + Math.min(dayIndex, 3) * 5
}

export function getDayTheme(day: number) {
  const themes = [
    "经典地标探索",
    "人文与美食体验",
    "自然景观漫游",
    "城市风情打卡",
    "自由深度游",
  ]
  return themes[(day - 1) % themes.length]
}
