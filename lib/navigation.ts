import type { LngLatTuple } from "@/lib/amap-types"
import {
  resolveSingleSpotCoordinate,
  getSpotLngLat,
} from "@/lib/amap-spot-utils"
import { loadAMap } from "@/lib/amap-loader"
import { getCurrentPositionSafe, getSafeLocationErrorMessage } from "@/lib/location"
import {
  buildAmapRouteUrl,
  openRouteInAmapWeb,
  type MapRouteMode,
} from "@/lib/open-map-route"
import type { Spot } from "@/lib/travel-context"

export type NavigationMode = MapRouteMode

export interface SpotNavigationIntent {
  requestId: string
  mode: NavigationMode
  spot: Spot
  destination: LngLatTuple
  origin: LngLatTuple | null
  notice?: string
  fallbackRouteUrl: string
}

export interface NavigateToSpotResult {
  ok: boolean
  intent?: SpotNavigationIntent
  message: string
}

interface NavigateToSpotOptions {
  mode?: NavigationMode
}

async function resolveSpotDestination(spot: Spot) {
  const direct = getSpotLngLat(spot)
  if (direct) {
    return { lngLat: direct, message: "", canResolve: true }
  }

  const AMap = await loadAMap(["AMap.Geocoder", "AMap.PlaceSearch"])
  const fallback = await resolveSingleSpotCoordinate(AMap, spot)
  if (fallback.ok && fallback.lngLat) {
    return { lngLat: fallback.lngLat, message: "", canResolve: true }
  }

  return {
    lngLat: null,
    message: "该景点缺少有效位置信息，暂时无法规划路线",
    canResolve: false,
  }
}

export async function navigateToSpot(
  spot: Spot,
  options: NavigateToSpotOptions = {}
): Promise<NavigateToSpotResult> {
  try {
    const mode = options.mode || "driving"
    const destinationResult = await resolveSpotDestination(spot)
    if (!destinationResult.canResolve || !destinationResult.lngLat) {
      return {
        ok: false,
        message: destinationResult.message,
      }
    }

    let origin: LngLatTuple | null = null
    let notice = ""

    try {
      const currentPosition = await getCurrentPositionSafe()
      origin = [currentPosition.lng, currentPosition.lat]
    } catch (error) {
      notice = `${getSafeLocationErrorMessage(error)}，已先定位到目的地`
    }

    const fallbackRouteUrl = buildAmapRouteUrl({
      mode,
      origin,
      destination: destinationResult.lngLat,
      destinationName: spot.name || "目的地",
      originName: "我的位置",
    })

    return {
      ok: true,
      message: notice || "正在打开路线规划...",
      intent: {
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode,
        spot,
        destination: destinationResult.lngLat,
        origin,
        notice,
        fallbackRouteUrl,
      },
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "导航启动失败，请稍后重试",
    }
  }
}

export function openExternalSpotRoute(intent: SpotNavigationIntent) {
  return openRouteInAmapWeb(intent.fallbackRouteUrl)
}
