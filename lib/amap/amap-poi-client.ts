import type { AmapPoiInput, BeijingPoiRootCategory } from "@/lib/places/poi-types"

export interface AmapPoiSearchOptions {
  apiKey: string
  keyword: string
  rootCategory: BeijingPoiRootCategory
  page?: number
  offset?: number
  city?: string
  timeoutMs?: number
}

export interface AmapPoiSearchResult {
  endpoint: "amap:v3/place/text"
  keyword: string
  rootCategory: BeijingPoiRootCategory
  page: number
  count: number
  pois: AmapPoiInput[]
  status?: string
  info?: string
  infocode?: string
}

interface AmapPlaceTextResponse {
  status?: string
  info?: string
  infocode?: string
  count?: string
  pois?: AmapPoiInput[]
}

function withTimeout(timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout),
  }
}

export async function fetchAmapPoiText(options: AmapPoiSearchOptions): Promise<AmapPoiSearchResult> {
  const page = options.page ?? 1
  const offset = options.offset ?? 20
  const city = options.city || "北京"
  const url = new URL("https://restapi.amap.com/v3/place/text")
  url.searchParams.set("key", options.apiKey)
  url.searchParams.set("keywords", options.keyword)
  url.searchParams.set("city", city)
  url.searchParams.set("citylimit", "true")
  url.searchParams.set("extensions", "all")
  url.searchParams.set("offset", String(offset))
  url.searchParams.set("page", String(page))
  url.searchParams.set("output", "json")

  const timeout = withTimeout(options.timeoutMs ?? 12_000)
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: timeout.signal,
    })

    if (!response.ok) {
      return {
        endpoint: "amap:v3/place/text",
        keyword: options.keyword,
        rootCategory: options.rootCategory,
        page,
        count: 0,
        pois: [],
        status: String(response.status),
        info: "http_error",
      }
    }

    const payload = (await response.json()) as AmapPlaceTextResponse
    const pois = payload.status === "1" && Array.isArray(payload.pois) ? payload.pois : []
    return {
      endpoint: "amap:v3/place/text",
      keyword: options.keyword,
      rootCategory: options.rootCategory,
      page,
      count: Number(payload.count || pois.length) || pois.length,
      pois,
      status: payload.status,
      info: payload.info,
      infocode: payload.infocode,
    }
  } catch (error) {
    return {
      endpoint: "amap:v3/place/text",
      keyword: options.keyword,
      rootCategory: options.rootCategory,
      page,
      count: 0,
      pois: [],
      status: "0",
      info: error instanceof Error ? error.name : "request_failed",
    }
  } finally {
    timeout.dispose()
  }
}
