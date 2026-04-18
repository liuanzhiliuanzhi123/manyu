import type { LngLatTuple } from "@/lib/amap-types"

export type MapRouteMode = "driving" | "walking" | "transit"

interface BuildRouteUrlParams {
  mode: MapRouteMode
  destination: LngLatTuple
  destinationName?: string
  origin?: LngLatTuple | null
  originName?: string
}

const MODE_TO_AMAP: Record<MapRouteMode, string> = {
  driving: "car",
  walking: "walk",
  transit: "bus",
}

function encodeName(name: string) {
  return encodeURIComponent(name || "目的地")
}

function formatPoint(point: LngLatTuple, name: string) {
  return `${point[0]},${point[1]},${encodeName(name)}`
}

export function buildAmapRouteUrl({
  mode,
  destination,
  destinationName = "目的地",
  origin,
  originName = "我的位置",
}: BuildRouteUrlParams) {
  const base = "https://uri.amap.com/navigation"
  const query = new URLSearchParams({
    to: formatPoint(destination, destinationName),
    mode: MODE_TO_AMAP[mode],
    policy: "1",
    src: "manyu-web",
    coordinate: "gaode",
    callnative: "0",
  })

  if (origin) {
    query.set("from", formatPoint(origin, originName))
  }

  return `${base}?${query.toString()}`
}

export function openRouteInAmapWeb(url: string) {
  if (typeof window === "undefined") return false
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}

