import "server-only"

import type {
  DayWeather,
  TravelWeatherAdvice,
  WeatherForecast,
  WeatherLive,
  WeatherPlanContext,
  WeatherRiskLevel,
  WeatherSummary,
} from "@/lib/weather-types"

const AMAP_WEATHER_URL = "https://restapi.amap.com/v3/weather/weatherInfo"
const CACHE_TTL_MS = 30 * 60 * 1000

type AmapWeatherLive = {
  province?: string
  city?: string
  adcode?: string
  weather?: string
  temperature?: string
  winddirection?: string
  windpower?: string
  humidity?: string
  reporttime?: string
}

type AmapWeatherForecast = {
  city?: string
  adcode?: string
  province?: string
  reporttime?: string
  casts?: Array<{
    date?: string
    week?: string
    dayweather?: string
    nightweather?: string
    daytemp?: string
    nighttemp?: string
    daywind?: string
    nightwind?: string
    daypower?: string
    nightpower?: string
  }>
}

type AmapWeatherResponse = {
  status?: string
  info?: string
  infocode?: string
  lives?: AmapWeatherLive[]
  forecasts?: AmapWeatherForecast[]
}

type CacheEntry = {
  expiresAt: number
  data: WeatherSummary
}

const weatherCache = new Map<string, CacheEntry>()

function normalizeCityKey(cityOrAdcode: string) {
  return cityOrAdcode.trim().replace(/\s+/g, "")
}

function toText(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function toNumber(value: unknown) {
  const parsed = Number(toText(value))
  return Number.isFinite(parsed) ? parsed : null
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function unique(values: string[]) {
  const result: string[] = []
  for (const value of values) {
    if (!value || result.includes(value)) continue
    result.push(value)
  }
  return result
}

function emptyWeatherAdvice(reason = "天气数据暂不可用"): TravelWeatherAdvice {
  return {
    summary: reason,
    tags: ["天气暂不可用"],
    riskLevel: "medium",
    suggestions: ["出发前再次确认天气，并预留机动时间。"],
    itineraryRules: ["按常规出行条件生成，保留室内备选安排。"],
  }
}

export function buildWeatherFallback(cityOrAdcode: string, reason = "天气数据暂不可用"): WeatherSummary {
  return {
    city: cityOrAdcode || "未知城市",
    source: "fallback",
    unavailableReason: reason,
    travelAdvice: emptyWeatherAdvice(reason),
  }
}

function normalizeLive(live?: AmapWeatherLive): WeatherLive | undefined {
  if (!live) return undefined
  return {
    weather: toText(live.weather),
    temperature: toText(live.temperature),
    winddirection: toText(live.winddirection),
    windpower: toText(live.windpower),
    humidity: toText(live.humidity),
    reporttime: toText(live.reporttime),
  }
}

function normalizeForecasts(forecast?: AmapWeatherForecast): WeatherForecast[] {
  return (forecast?.casts || []).map((item) => ({
    date: toText(item.date),
    week: toText(item.week) || undefined,
    dayweather: toText(item.dayweather),
    nightweather: toText(item.nightweather),
    daytemp: toText(item.daytemp),
    nighttemp: toText(item.nighttemp),
    daywind: toText(item.daywind),
    nightwind: toText(item.nightwind),
    daypower: toText(item.daypower),
    nightpower: toText(item.nightpower),
  }))
}

function buildWeatherText(weather: WeatherSummary | WeatherForecast) {
  if ("travelAdvice" in weather) {
    const liveText = weather.live?.weather || ""
    const forecastText = weather.forecasts?.[0]
      ? `${weather.forecasts[0].dayweather} ${weather.forecasts[0].nightweather}`
      : ""
    return `${liveText} ${forecastText}`
  }
  return `${weather.dayweather} ${weather.nightweather}`
}

function getTemperatureValues(weather: WeatherSummary | WeatherForecast) {
  if ("travelAdvice" in weather) {
    const liveTemp = toNumber(weather.live?.temperature)
    const dayTemp = toNumber(weather.forecasts?.[0]?.daytemp)
    const nightTemp = toNumber(weather.forecasts?.[0]?.nighttemp)
    return [liveTemp, dayTemp, nightTemp].filter((value): value is number => value !== null)
  }
  return [toNumber(weather.daytemp), toNumber(weather.nighttemp)].filter(
    (value): value is number => value !== null
  )
}

function getWindText(weather: WeatherSummary | WeatherForecast) {
  if ("travelAdvice" in weather) {
    return `${weather.live?.winddirection || ""}${weather.live?.windpower || ""}`
  }
  return `${weather.daywind || ""}${weather.daypower || ""} ${weather.nightwind || ""}${weather.nightpower || ""}`
}

function getWeatherFlags(weather: WeatherSummary | WeatherForecast) {
  const text = `${buildWeatherText(weather)} ${getWindText(weather)}`
  const temperatures = getTemperatureValues(weather)
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : null
  const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : null

  return {
    rainy: includesAny(text, ["雨", "阵雨", "雷阵雨", "暴雨"]),
    snowy: includesAny(text, ["雪", "雨夹雪", "暴雪"]),
    sunny: includesAny(text, ["晴"]),
    cloudy: includesAny(text, ["多云", "阴"]),
    hot: maxTemp !== null && maxTemp >= 32,
    cold: minTemp !== null && minTemp <= 2,
    windy: /[6-9]级|10级|11级|12级|大风|沙尘|扬沙|浮尘/u.test(text),
    dust: includesAny(text, ["沙尘", "扬沙", "浮尘"]),
  }
}

export function getTravelWeatherAdvice(weather: WeatherSummary | WeatherForecast): TravelWeatherAdvice {
  const flags = getWeatherFlags(weather)
  const tags: string[] = []
  const suggestions: string[] = []
  const itineraryRules: string[] = []
  let riskLevel: WeatherRiskLevel = "low"

  if (flags.rainy) {
    riskLevel = "medium"
    tags.push("雨天备选", "室内优先")
    suggestions.push("随身带伞或轻便雨衣，景点之间预留 15-30 分钟交通缓冲。")
    itineraryRules.push("雨天优先安排博物馆、室内展馆、商圈和餐厅，减少公园、登高与长距离步行。")
  }
  if (flags.snowy || flags.cold) {
    riskLevel = flags.snowy ? "high" : riskLevel === "low" ? "medium" : riskLevel
    tags.push(flags.snowy ? "雨雪防滑" : "低温保暖")
    suggestions.push("准备保暖外套、防滑鞋，早晚户外停留时间控制得更短。")
    itineraryRules.push("低温或雨雪时减少远距离移动，放慢节奏，优先短距离顺路路线。")
  }
  if (flags.sunny) {
    tags.push("适合户外", "注意防晒")
    suggestions.push("适合安排城市漫步、公园和观景点，午后注意防晒补水。")
    itineraryRules.push("晴天可优先安排户外景点与观景点，但中午保留休息或室内段落。")
  }
  if (flags.cloudy && !flags.rainy && !flags.snowy) {
    tags.push("城市漫步友好")
    suggestions.push("适合城市漫步和大多数户外安排，仍建议携带轻薄外套。")
    itineraryRules.push("多云或阴天可维持正常路线密度，户外与室内均衡安排。")
  }
  if (flags.hot) {
    riskLevel = riskLevel === "high" ? "high" : "medium"
    tags.push("高温避晒")
    suggestions.push("12:00-15:00 减少暴晒，安排餐厅、商场、博物馆或酒店休息。")
    itineraryRules.push("高温时减少中午户外，交通优先地铁或打车，避免连续暴晒步行。")
  }
  if (flags.windy || flags.dust) {
    riskLevel = flags.dust ? "high" : riskLevel === "low" ? "medium" : riskLevel
    tags.push(flags.dust ? "沙尘防护" : "大风避险")
    suggestions.push("减少登高、湖边和开阔地停留，口罩与防风外套更稳妥。")
    itineraryRules.push("大风或沙尘时优先室内和短距离路线，避开开阔暴露场景。")
  }

  if (tags.length === 0) {
    tags.push("常规出行")
    suggestions.push("天气条件整体平稳，可按常规路线推进。")
    itineraryRules.push("按常规节奏安排，保留一处室内备选以应对临时变化。")
  }

  const summary =
    riskLevel === "high"
      ? "天气对行程影响较高，建议降低移动强度。"
      : riskLevel === "medium"
      ? "天气对行程有一定影响，建议保留室内备选和交通缓冲。"
      : "天气整体适合出行，可按计划游玩。"

  return {
    summary,
    tags: unique(tags).slice(0, 5),
    riskLevel,
    suggestions: unique(suggestions).slice(0, 4),
    itineraryRules: unique(itineraryRules).slice(0, 5),
  }
}

async function fetchAmapWeather(cityOrAdcode: string, extensions: "base" | "all") {
  const key = process.env.AMAP_WEB_SERVICE_KEY
  if (!key) {
    throw new Error("AMAP_WEB_SERVICE_KEY is not configured")
  }

  const url = new URL(AMAP_WEATHER_URL)
  url.searchParams.set("key", key)
  url.searchParams.set("city", cityOrAdcode)
  url.searchParams.set("extensions", extensions)
  url.searchParams.set("output", "json")

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Amap weather request failed: ${response.status}`)
  }

  const payload = (await response.json()) as AmapWeatherResponse
  if (payload.status !== "1") {
    throw new Error(payload.info || payload.infocode || "Amap weather response invalid")
  }

  return payload
}

export async function getWeatherByCity(cityOrAdcode: string): Promise<WeatherSummary> {
  const cacheKey = normalizeCityKey(cityOrAdcode)
  if (!cacheKey) return buildWeatherFallback(cityOrAdcode, "天气数据暂不可用")

  const cached = weatherCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  if (!process.env.AMAP_WEB_SERVICE_KEY) {
    return buildWeatherFallback(cityOrAdcode, "天气数据暂不可用")
  }

  try {
    const [baseResult, forecastResult] = await Promise.allSettled([
      fetchAmapWeather(cacheKey, "base"),
      fetchAmapWeather(cacheKey, "all"),
    ])

    const livePayload = baseResult.status === "fulfilled" ? baseResult.value.lives?.[0] : undefined
    const forecastPayload =
      forecastResult.status === "fulfilled" ? forecastResult.value.forecasts?.[0] : undefined

    if (!livePayload && !forecastPayload) {
      const reason =
        baseResult.status === "rejected"
          ? baseResult.reason instanceof Error
            ? baseResult.reason.message
            : "天气数据暂不可用"
          : "天气数据暂不可用"
      return buildWeatherFallback(cityOrAdcode, reason)
    }

    const summary: WeatherSummary = {
      city: toText(livePayload?.city) || toText(forecastPayload?.city) || cityOrAdcode,
      adcode: toText(livePayload?.adcode) || toText(forecastPayload?.adcode) || undefined,
      live: normalizeLive(livePayload),
      forecasts: normalizeForecasts(forecastPayload),
      source: "amap",
      travelAdvice: emptyWeatherAdvice(),
    }
    summary.travelAdvice = getTravelWeatherAdvice(summary)

    weatherCache.set(cacheKey, {
      data: summary,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return summary
  } catch (error) {
    const reason = error instanceof Error ? error.message : "天气数据暂不可用"
    return buildWeatherFallback(cityOrAdcode, reason)
  }
}

function formatTemperatureText(forecast: WeatherForecast) {
  const day = toText(forecast.daytemp)
  const night = toText(forecast.nighttemp)
  if (day && night) return `${night}-${day}℃`
  if (day) return `${day}℃`
  return "--"
}

function formatWindText(forecast: WeatherForecast) {
  const day = `${forecast.daywind || ""}${forecast.daypower || ""}`.trim()
  const night = `${forecast.nightwind || ""}${forecast.nightpower || ""}`.trim()
  return unique([day, night]).join(" / ")
}

function findForecastStartIndex(forecasts: WeatherForecast[], startDate?: string) {
  if (!startDate) return 0
  const index = forecasts.findIndex((forecast) => forecast.date === startDate)
  return index >= 0 ? index : 0
}

export function buildWeatherPlanContext(
  weather: WeatherSummary,
  totalDays: number,
  startDate?: string
): WeatherPlanContext {
  const dayWeather: DayWeather[] = []
  const forecasts = weather.forecasts || []
  const startIndex = findForecastStartIndex(forecasts, startDate)

  for (let index = 0; index < totalDays; index += 1) {
    const forecast = forecasts[startIndex + index]
    if (forecast) {
      const advice = getTravelWeatherAdvice(forecast)
      dayWeather.push({
        date: forecast.date,
        weather:
          forecast.dayweather === forecast.nightweather
            ? forecast.dayweather
            : `${forecast.dayweather}转${forecast.nightweather}`,
        dayweather: forecast.dayweather,
        nightweather: forecast.nightweather,
        temperatureText: formatTemperatureText(forecast),
        windText: formatWindText(forecast),
        advice: advice.suggestions[0] || advice.summary,
        tags: advice.tags,
        riskLevel: advice.riskLevel,
        suggestions: advice.suggestions,
      })
      continue
    }

    if (index === 0 && weather.live) {
      const advice = weather.travelAdvice
      dayWeather.push({
        date: startDate,
        weather: weather.live.weather || "天气数据暂不可用",
        temperatureText: weather.live.temperature ? `${weather.live.temperature}℃` : "--",
        windText: `${weather.live.winddirection || ""}${weather.live.windpower || ""}`.trim(),
        advice: advice.suggestions[0] || advice.summary,
        tags: advice.tags,
        riskLevel: advice.riskLevel,
        suggestions: advice.suggestions,
      })
      continue
    }

    dayWeather.push({
      date: undefined,
      weather: weather.source === "fallback" ? "天气数据暂不可用" : "远期天气暂不可用",
      temperatureText: "--",
      advice:
        weather.source === "fallback"
          ? "天气数据暂不可用，本方案按常规出行条件生成。"
          : "远期天气暂不可用，建议出发前再次确认天气。",
      tags: weather.source === "fallback" ? ["天气暂不可用"] : ["远期天气"],
      riskLevel: "medium",
      suggestions:
        weather.source === "fallback"
          ? ["出发前重新查询天气，保留室内备选。"]
          : ["远期天气暂不可用，出发前再确认穿搭和交通安排。"],
    })
  }

  return { summary: weather, dayWeather }
}
