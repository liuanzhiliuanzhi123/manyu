import type { ItineraryDay } from "@/lib/travel-context"

export function getDayLabel(day: number) {
  return `第${day}天`
}

export function stripDayPrefix(title: string, day: number) {
  if (!title) return ""
  let value = title.trim()
  value = value.replace(/^第\s*\d+\s*天[\s:：\-—]*/u, "")
  value = value.replace(new RegExp(`^第\\s*${day}\\s*天[\\s:：\\-—]*`, "u"), "")
  value = value.replace(/^day\s*\d+[\s:：\-—]*/iu, "")
  return value.trim()
}

export function getDayHeadline(day: ItineraryDay) {
  const cleanedTitle = stripDayPrefix(day.title || "", day.day)
  const fallback = day.theme?.trim() || "当日路线"
  return cleanedTitle || fallback
}

export function getDaySubline(day: ItineraryDay) {
  const title = stripDayPrefix(day.title || "", day.day)
  const theme = (day.theme || "").trim()
  if (!title && !theme) return "城市路线安排"
  if (!title) return theme
  if (!theme || theme === title) return title
  return `${title} · ${theme}`
}

