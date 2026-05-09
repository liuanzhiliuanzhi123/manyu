﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { searchCozeDatabase } from "./coze-api"
import { beijingSpotSeeds } from "@/lib/beijing-place-data"
import type { TransitStep } from "@/lib/amap-route-utils"
import type {
  GeneratedPlan,
  PlanFeedbackRecord,
  PlanQualityScore,
  PlanShareSummary,
  PlanValidationResult,
  PlannerEngineMode,
  PlannerWarning,
  SelectedPoiItem,
  TransportSuggestionMode,
  TravelRequirement,
} from "@/lib/planner-types"
import {
  loadCurrentPlanIdFromStorage,
  loadSavedPlansFromStorage,
  persistCurrentPlanIdToStorage,
  persistSavedPlansToStorage,
} from "@/lib/plan-persistence"

export interface Spot {
  id: string
  name: string
  type: "attraction" | "restaurant" | "hotel"
  address: string
  rating: number
  heat: number
  ticketPrice: number
  description: string
  image: string
  tags: string[]
  openTime?: string
  phone?: string
  province?: string
  city?: string
  district?: string
  lng?: number | string
  lat?: number | string
  longitude?: number | string
  latitude?: number | string
  location?:
    | string
    | {
        lng?: number | string
        lat?: number | string
        longitude?: number | string
        latitude?: number | string
        city?: string
        address?: string
      }
  coordinates?:
    | [number | string, number | string]
    | string
    | {
        lng?: number | string
        lat?: number | string
        longitude?: number | string
        latitude?: number | string
      }
  arrivalTime?: string
  leaveTime?: string
  suggestedDurationMinutes?: number
  suggestedDurationText?: string
  source?: string
  imageConfidence?: "exact" | "city_related" | "fallback"
  plannerReason?: string
}

export type RouteTransportMode = "driving" | "walking" | "transit"

export interface DaySuggestionItem {
  id: string
  name: string
  type: "food" | "hotel"
  address: string
  price: number
  rating: number
  image: string
  reason: string
  tags?: string[]
}

export interface TravelLeg {
  id: string
  fromName: string
  toName: string
  transportMode: RouteTransportMode
  recommendedMode?: TransportSuggestionMode
  recommendedReason?: string
  distanceMeters: number
  durationSeconds: number
  startTime: string
  arrivalTime: string
  readableDistance: string
  readableDuration: string
  isEstimated?: boolean
  estimateReason?: string
  transitLineSummary?: string[]
  transitTransferCount?: number
  transitSteps?: TransitStep[]
}

export interface ItineraryDay {
  day: number
  title: string
  theme?: string
  districtSummary?: string
  startTime: string
  endTime: string
  spots: Spot[]
  routeLegs: TravelLeg[]
  totalDistanceMeters: number
  totalTravelSeconds: number
  totalPlayMinutes: number
  totalEstimatedCost: number
  warnings?: string[]
  startsFromDeparture?: boolean
  returnsToDeparture?: boolean
  departureName?: string
  lunchSuggestion?: DaySuggestionItem | null
  dinnerSuggestion?: DaySuggestionItem | null
  hotelSuggestion?: DaySuggestionItem | null
  totalMealCost?: number
  totalHotelCost?: number
}

export type PlanGenerationStatus = "success" | "partial" | "error"

export interface TripPlan {
  id: string
  name: string
  startDate: string
  endDate: string
  pace: string
  departure: string
  spots: Spot[]
  createdAt: string
  days?: ItineraryDay[]
  totalDays?: number
  totalSpots?: number
  totalDistanceMeters?: number
  totalTravelSeconds?: number
  totalPlayMinutes?: number
  totalEstimatedCost?: number
  generationStatus?: PlanGenerationStatus
  generationNotices?: string[]
  requirement?: TravelRequirement
  selectedPoisSnapshot?: SelectedPoiItem[]
  plannerWarnings?: PlannerWarning[]
  unplannedItems?: SelectedPoiItem[]
  manualSelectionCompleted?: boolean
  skipManualSelection?: boolean
  generationSource?: "manual" | "auto" | "mixed"
  plannerEngineMode?: PlannerEngineMode
  generatedPlan?: GeneratedPlan
  planExplanations?: string[]
  planMode?: "ai_original" | "user_edited"
  lockedSpotIds?: string[]
  validationResult?: PlanValidationResult
  qualityScore?: PlanQualityScore
  feedbackRecords?: PlanFeedbackRecord[]
  shareSummary?: PlanShareSummary
  sourcePlanId?: string
  lastEditedAt?: string
}

interface TravelContextType {
  selectedSpots: Spot[]
  addSpot: (spot: Spot) => void
  removeSpot: (id: string) => void
  clearSpots: () => void
  savedPlans: TripPlan[]
  savePlan: (plan: TripPlan) => void
  deletePlan: (id: string) => void
  openPlan: (id: string) => void
  currentPlan: TripPlan | null
  setCurrentPlan: (plan: TripPlan | null) => void
  favorites: string[]
  toggleFavorite: (id: string) => void
  searchResults: Spot[]
  isSearching: boolean
  searchSpots: (query: string) => Promise<void>
}

const TravelContext = createContext<TravelContextType | undefined>(undefined)

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function toNumberValue(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value.trim())
      : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .filter((item): item is string => item.length > 0)
  }
  const asText = toText(value)
  return asText ? [asText] : []
}

function normalizeSpotType(value: unknown): Spot["type"] {
  const text = toText(value).toLowerCase()
  if (text === "spot") return "attraction"
  if (text === "food") return "restaurant"
  if (text === "restaurant") return "restaurant"
  if (text === "hotel") return "hotel"
  return "attraction"
}

function normalizeLocation(value: unknown): Spot["location"] | undefined {
  if (typeof value === "string") {
    const text = value.trim()
    return text || undefined
  }
  if (value && typeof value === "object") {
    return value as Spot["location"]
  }
  return undefined
}

function normalizeCoordinates(value: unknown): Spot["coordinates"] | undefined {
  if (typeof value === "string") {
    const text = value.trim()
    return text || undefined
  }
  if (Array.isArray(value) && value.length >= 2) {
    return [value[0], value[1]] as [number | string, number | string]
  }
  if (value && typeof value === "object") {
    return value as Spot["coordinates"]
  }
  return undefined
}

function getAddressFromPayload(payload: Record<string, unknown>): string {
  const directAddress = toText(payload.address)
  if (directAddress) return directAddress

  const locationValue = payload.location
  if (typeof locationValue === "string" && locationValue.trim()) {
    return locationValue.trim()
  }

  if (locationValue && typeof locationValue === "object") {
    const locationRecord = locationValue as Record<string, unknown>
    const nestedAddress =
      toText(locationRecord.address) ||
      toText(locationRecord.name) ||
      toText(locationRecord.formattedAddress)
    if (nestedAddress) return nestedAddress
  }

  return "未知地址"
}

function getCityFromPayload(payload: Record<string, unknown>): string {
  const directCity = toText(payload.city) || toText(payload.cityName)
  if (directCity) return directCity

  const locationValue = payload.location
  if (locationValue && typeof locationValue === "object") {
    const locationRecord = locationValue as Record<string, unknown>
    return toText(locationRecord.city) || toText(locationRecord.adcode)
  }
  return ""
}

function getDistrictFromPayload(payload: Record<string, unknown>): string {
  const direct = toText(payload.district)
  if (direct) return direct

  const address = getAddressFromPayload(payload)
  const matched = address.match(/([\u4e00-\u9fa5]{1,8}(?:区|县|市))/)
  return matched?.[1] || ""
}

function getProvinceFromPayload(payload: Record<string, unknown>): string {
  const direct = toText(payload.province)
  if (direct) return direct

  const city = getCityFromPayload(payload)
  if (city === "北京" || city === "上海" || city === "天津" || city === "重庆") {
    return city
  }

  const address = getAddressFromPayload(payload)
  const matched = address.match(/([\u4e00-\u9fa5]{1,8}(?:省|自治区|特别行政区))/)
  return matched?.[1] || ""
}

function sanitizeSpotInput(spot: Spot): Spot {
  const payload = spot as unknown as Record<string, unknown>
  return {
    ...spot,
    name: toText(payload.name) || "未知景点",
    address: getAddressFromPayload(payload),
    province: getProvinceFromPayload(payload),
    city: getCityFromPayload(payload) || toText(payload.city),
    district: getDistrictFromPayload(payload),
    openTime: toText(payload.openTime) || toText(payload.openingHours),
    phone: toText(payload.phone) || toText(payload.contact),
    location: normalizeLocation(payload.location),
    coordinates: normalizeCoordinates(payload.coordinates),
    tags: toStringArray(payload.tags),
  }
}

// 示例景点数据
const FALLBACK_SPOTS: Spot[] = [
  {
    id: "fallback-1",
    name: "故宫博物院",
    type: "attraction",
    address: "北京市东城区景山前街4号",
    rating: 4.9,
    heat: 96,
    ticketPrice: 60,
    description: "全国热门历史文化景点",
    image: "/images/placeholders/poi-default.jpg",
    tags: ["历史人文", "热门"],
    city: "北京",
    province: "北京",
    location: { lng: 116.397428, lat: 39.90923 },
  },
]

export const sampleSpots: Spot[] =
  beijingSpotSeeds.length > 0
    ? beijingSpotSeeds.map((spot) => ({
        ...spot,
      }))
    : FALLBACK_SPOTS

export function TravelProvider({ children }: { children: ReactNode }) {
  const [selectedSpots, setSelectedSpots] = useState<Spot[]>([])
  const [savedPlans, setSavedPlans] = useState<TripPlan[]>([])
  const [currentPlanState, setCurrentPlanState] = useState<TripPlan | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<Spot[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const plans = loadSavedPlansFromStorage()
    if (plans.length === 0) return
    setSavedPlans(plans)
    const currentPlanId = loadCurrentPlanIdFromStorage()
    if (!currentPlanId) return
    const matched = plans.find((item) => item.id === currentPlanId) || null
    setCurrentPlanState(matched)
  }, [])

  useEffect(() => {
    persistSavedPlansToStorage(savedPlans)
  }, [savedPlans])

  useEffect(() => {
    persistCurrentPlanIdToStorage(currentPlanState?.id || null)
  }, [currentPlanState?.id])

  useEffect(() => {
    setSelectedSpots((prev) => {
      if (prev.length === 0) return prev
      const normalized = prev.map((spot) => sanitizeSpotInput(spot))
      const changed = normalized.some((spot, index) => {
        const current = prev[index]
        return (
          spot.name !== current.name ||
          spot.address !== current.address ||
          spot.city !== current.city ||
          spot.openTime !== current.openTime ||
          spot.phone !== current.phone ||
          spot.location !== current.location ||
          spot.coordinates !== current.coordinates ||
          spot.tags.length !== current.tags.length ||
          spot.tags.some((tag, tagIndex) => tag !== current.tags[tagIndex])
        )
      })
      return changed ? normalized : prev
    })
  }, [])

  const addSpot = useCallback((spot: Spot) => {
    const normalizedSpot = sanitizeSpotInput(spot)
    setSelectedSpots((prev) => {
      if (prev.some((item) => item.id === normalizedSpot.id)) return prev
      return [...prev, normalizedSpot]
    })
  }, [])

  const removeSpot = useCallback((id: string) => {
    setSelectedSpots((prev) => prev.filter((spot) => spot.id !== id))
  }, [])

  const clearSpots = useCallback(() => {
    setSelectedSpots([])
  }, [])

  const savePlan = useCallback((plan: TripPlan) => {
    const normalized = {
      ...plan,
      lastEditedAt: plan.lastEditedAt || new Date().toISOString(),
    }
    setSavedPlans((prev) => {
      const index = prev.findIndex((item) => item.id === normalized.id)
      if (index < 0) {
        return [normalized, ...prev]
      }
      const next = [...prev]
      next[index] = normalized
      return next
    })
    setCurrentPlanState(normalized)
  }, [])

  const deletePlan = useCallback((id: string) => {
    setSavedPlans((prev) => prev.filter((plan) => plan.id !== id))
    setCurrentPlanState((prev) => (prev?.id === id ? null : prev))
  }, [])

  const openPlan = useCallback(
    (id: string) => {
      const matched = savedPlans.find((item) => item.id === id) || null
      setCurrentPlanState(matched)
    },
    [savedPlans]
  )

  const setCurrentPlan = useCallback((plan: TripPlan | null) => {
    setCurrentPlanState(plan)
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      return [...prev, id]
    })
  }, [])

  const searchSpots = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchCozeDatabase(query)
      // 转换结果为 Spot 类型
      const spots = results.map((item: unknown, index: number): Spot => {
        const payload =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {}

        const id =
          toText(payload.id) ||
          `coze-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`

        return {
          id,
          name: toText(payload.name) || toText(payload.title) || "未知景点",
          type: normalizeSpotType(payload.type),
          address: getAddressFromPayload(payload),
          rating: toNumberValue(payload.rating, 4.0),
          heat: toNumberValue(payload.heat, 50),
          ticketPrice: toNumberValue(payload.ticketPrice ?? payload.price, 0),
          description:
            toText(payload.description) || toText(payload.content) || "暂无描述",
          image:
            toText(payload.image) ||
            toText(payload.photo) ||
            "https://placehold.co/600x400?text=No+Image",
          tags: toStringArray(payload.tags ?? payload.keywords),
          openTime: toText(payload.openTime) || toText(payload.openingHours),
          phone: toText(payload.phone) || toText(payload.contact),
          city: getCityFromPayload(payload),
          province: getProvinceFromPayload(payload),
          district: getDistrictFromPayload(payload),
          lng: payload.lng as number | string | undefined,
          lat: payload.lat as number | string | undefined,
          longitude: payload.longitude as number | string | undefined,
          latitude: payload.latitude as number | string | undefined,
          location: normalizeLocation(payload.location),
          coordinates: normalizeCoordinates(payload.coordinates),
        }
      })
      setSearchResults(spots)
    } catch (error) {
      console.error("搜索失败:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      selectedSpots,
      addSpot,
      removeSpot,
      clearSpots,
      savedPlans,
      savePlan,
      deletePlan,
      openPlan,
      currentPlan: currentPlanState,
      setCurrentPlan,
      favorites,
      toggleFavorite,
      searchResults,
      isSearching,
      searchSpots,
    }),
    [
      selectedSpots,
      addSpot,
      removeSpot,
      clearSpots,
      savedPlans,
      savePlan,
      deletePlan,
      openPlan,
      currentPlanState,
      setCurrentPlan,
      favorites,
      toggleFavorite,
      searchResults,
      isSearching,
      searchSpots,
    ]
  )

  return (
    <TravelContext.Provider value={contextValue}>
      {children}
    </TravelContext.Provider>
  )
}

export function useTravel() {
  const context = useContext(TravelContext)
  if (context === undefined) {
    throw new Error("useTravel must be used within a TravelProvider")
  }
  return context
}
