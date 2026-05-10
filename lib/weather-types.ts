export type WeatherRiskLevel = "low" | "medium" | "high"

export interface WeatherLive {
  weather: string
  temperature: string
  winddirection: string
  windpower: string
  humidity: string
  reporttime: string
}

export interface WeatherForecast {
  date: string
  week?: string
  dayweather: string
  nightweather: string
  daytemp: string
  nighttemp: string
  daywind: string
  nightwind: string
  daypower: string
  nightpower: string
}

export interface TravelWeatherAdvice {
  summary: string
  tags: string[]
  riskLevel: WeatherRiskLevel
  suggestions: string[]
  itineraryRules: string[]
}

export interface WeatherSummary {
  city: string
  adcode?: string
  live?: WeatherLive
  forecasts?: WeatherForecast[]
  source: "amap" | "fallback"
  unavailableReason?: string
  travelAdvice: TravelWeatherAdvice
}

export interface DayWeather {
  date?: string
  weather: string
  dayweather?: string
  nightweather?: string
  temperatureText: string
  windText?: string
  advice: string
  tags: string[]
  riskLevel: WeatherRiskLevel
  suggestions: string[]
}

export interface WeatherPlanContext {
  summary: WeatherSummary
  dayWeather: DayWeather[]
}
