"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Loader2,
  MessageSquarePlus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Share2,
  Sparkles,
} from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppInput } from "@/components/ui/app-input"
import { AppTag } from "@/components/ui/app-tag"
import { CityPicker } from "@/components/travel/city-picker"
import { DailyRouteCard } from "@/components/travel/daily-route-card"
import { DayRouteMap } from "@/components/travel/day-route-map"
import { ItinerarySummary } from "@/components/travel/itinerary-summary"
import { ResultDayHeader } from "@/components/travel/result-day-header"
import { ResultBudgetSummary } from "@/components/travel/result-budget-summary"
import { ResultDiagnosticsPanel } from "@/components/travel/result-diagnostics-panel"
import { PlannerConflictDialog } from "@/components/travel/planner-conflict-dialog"
import { PlannerDateFields } from "@/components/travel/planner-date-fields"
import { PlannerStepper } from "@/components/travel/planner-stepper"
import { PlannerSummaryBar } from "@/components/travel/planner-summary-bar"
import { PlacePhotoImage } from "@/components/travel/place-photo-image"
import { PoiCart } from "@/components/travel/poi-cart"
import { ReplaceFoodSheet } from "@/components/travel/replace-food-sheet"
import { ReplaceHotelSheet } from "@/components/travel/replace-hotel-sheet"
import { ReplacePlaceSheet } from "@/components/travel/replace-place-sheet"
import { RecommendedBundles } from "@/components/travel/recommended-bundles"
import { RecommendedPoiSection } from "@/components/travel/recommended-poi-section"
import { RequirementPicker } from "@/components/travel/requirement-picker"
import { MobileSheet } from "@/components/travel/mobile-sheet"
import { getHotelRecommendations } from "@/lib/normalized-data"
import { getCitiesByProvince, RECOMMENDED_CITY_GROUPS } from "@/lib/planner-city-data"
import {
  detectCityConflict,
  filterSpotsByCity,
  findProvinceByCity,
  inferMajorityCity,
  isSpotInDestination,
} from "@/lib/planner-city-guard"
import {
  getRecommendedBundles,
  getRecommendedPoisByRequirement,
} from "@/lib/planner-recommendations"
import type { RouteLegResult } from "@/lib/amap-route-utils"
import type {
  GeneratedPlanDay,
  PlanFeedbackSentiment,
  PlanFeedbackTag,
  PlannerCandidate,
  PlannerDecisionRequest,
  PlannerDecisionResult,
  PoiBundle,
  SelectedPoiItem,
  TravelRequirement,
} from "@/lib/planner-types"
import { createPlanFeedbackRecord, deriveFeedbackActions } from "@/lib/plan-feedback"
import {
  applyDayPatch,
  getHotelReplacementCandidates,
  getMealReplacementCandidates,
  getSpotReplacementCandidates,
  moveSpotIdInMatrix,
  replaceSpotIdInMatrix,
  toDaySpotIdMatrix,
  toSuggestionFromSpot,
  toggleLockedSpot,
  updateDayHotel,
  updateDayMeal,
  type PlanReplaceCandidate,
} from "@/lib/plan-editor"
import { buildPlanShareSummary, toShareSummaryText } from "@/lib/plan-persistence"
import { calculatePlanQualityScore } from "@/lib/plan-quality-score"
import { validatePlan } from "@/lib/plan-validator"
import { buildAiItinerary } from "@/lib/route-planner"
import {
  type DaySuggestionItem,
  sampleSpots,
  type ItineraryDay,
  type RouteTransportMode,
  type Spot,
  type TripPlan,
  useTravel,
} from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface AIPlannnerPageProps {
  onNavigate: (
    tab: "explore" | "trips" | "ai",
    options?: {
      destination?: {
        province: string
        city: string
        cityTagline?: string
        tags?: string[]
      }
      source?: "home-city" | "trips" | "direct"
    }
  ) => void
  entryDestination?: {
    province: string
    city: string
    cityTagline?: string
    tags?: string[]
    source: "home-city" | "trips" | "direct"
    token: number
  } | null
}

const STEP_TITLES = ["目的地", "偏好", "预算", "完成", "结果"]
const DEFAULT_PROVINCE = RECOMMENDED_CITY_GROUPS[0]?.province ?? ""
const DEFAULT_CITY = getCitiesByProvince(DEFAULT_PROVINCE)[0]

const DEFAULT_REQUIREMENT: TravelRequirement = {
  province: DEFAULT_PROVINCE,
  city: DEFAULT_CITY?.city ?? "",
  cityTagline: DEFAULT_CITY?.tagline ?? "",
  days: 3,
  budgetRange: "3000-5000",
  companions: "friends",
  interests: ["历史人文", "美食打卡"],
  pace: "balanced",
  specialNeeds: [],
}

const COMPANION_LABEL: Record<TravelRequirement["companions"], string> = {
  solo: "一个人",
  couple: "情侣",
  friends: "朋友",
  family: "家庭亲子",
  elderly: "老人同行",
  team: "公司团建",
}

function toEnginePace(pace: TravelRequirement["pace"]) {
  if (pace === "fast") return "intensive"
  if (pace === "slow") return "relaxed"
  return "moderate"
}

function toPaceLabel(pace: TravelRequirement["pace"]) {
  if (pace === "fast") return "特种兵式"
  if (pace === "slow") return "慢节奏放松"
  return "轻松适中"
}

function uniqueSpots(spots: Spot[]) {
  const bucket = new Map<string, Spot>()
  for (const spot of spots) {
    if (!bucket.has(spot.id)) bucket.set(spot.id, spot)
  }
  return Array.from(bucket.values())
}

function mapSpotType(type: Spot["type"]): SelectedPoiItem["type"] {
  if (type === "restaurant") return "food"
  if (type === "hotel") return "hotel"
  return "spot"
}

function toSelectedPoiSnapshot(spot: Spot): SelectedPoiItem {
  return {
    id: spot.id,
    name: spot.name,
    type: mapSpotType(spot.type),
    district: spot.district,
    city: spot.city,
    lng: typeof spot.lng === "number" ? spot.lng : undefined,
    lat: typeof spot.lat === "number" ? spot.lat : undefined,
    estimatedVisitMinutes: spot.suggestedDurationMinutes,
    price: spot.ticketPrice,
    openingHours: spot.openTime,
    address: spot.address,
  }
}

function toPlannerCandidate(spot: Spot): PlannerCandidate {
  const rating = Number(spot.rating)
  const price = Number(spot.ticketPrice)
  const lng = Number(spot.lng)
  const lat = Number(spot.lat)
  return {
    placeId: spot.id,
    name: spot.name,
    type: spot.type === "attraction" ? "attraction" : spot.type === "hotel" ? "hotel" : "restaurant",
    city: spot.city || "北京",
    district: spot.district,
    address: spot.address,
    rating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    tags: spot.tags,
    lng: Number.isFinite(lng) ? lng : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    openTime: spot.openTime,
    source: spot.source,
    stayMinutes: spot.suggestedDurationMinutes,
  }
}

function getDistanceMeters(a: Spot, b: Spot) {
  const lng1 = Number(a.lng)
  const lat1 = Number(a.lat)
  const lng2 = Number(b.lng)
  const lat2 = Number(b.lat)
  if (![lng1, lat1, lng2, lat2].every((value) => Number.isFinite(value))) {
    return Number.POSITIVE_INFINITY
  }
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const rLat1 = toRad(lat1)
  const rLat2 = toRad(lat2)
  const k =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.max(0, 6371000 * 2 * Math.atan2(Math.sqrt(k), Math.sqrt(1 - k)))
}

function buildPlannerRouteHints(attractions: Spot[]) {
  const hints: PlannerDecisionRequest["routeHints"] = []
  for (let i = 0; i < attractions.length; i += 1) {
    for (let j = i + 1; j < attractions.length; j += 1) {
      const from = attractions[i]
      const to = attractions[j]
      const distance = getDistanceMeters(from, to)
      if (!Number.isFinite(distance) || distance <= 0 || distance > 45000) continue
      const durationSeconds = Math.round(distance / 13.5)
      hints.push({
        fromPlaceId: from.id,
        toPlaceId: to.id,
        distanceMeters: Math.round(distance),
        durationSeconds: Math.max(180, durationSeconds),
        mode: "transit",
      })
    }
  }
  return hints.slice(0, 180)
}

function toSuggestionItemFromSpot(
  spot: Spot | undefined,
  type: DaySuggestionItem["type"],
  reason?: string
): DaySuggestionItem | null {
  if (!spot) return null
  const rating = Number(spot.rating)
  const price = Number(spot.ticketPrice)
  return {
    id: `${type}-${spot.id}`,
    name: spot.name,
    type,
    address: spot.address || `${spot.city || "北京"}${spot.name}`,
    price:
      Number.isFinite(price) && price > 0
        ? Math.round(price)
        : type === "hotel"
        ? 380
        : 88,
    rating: Number.isFinite(rating) && rating > 0 ? rating : 4.5,
    image: spot.image,
    reason: reason || "基于候选与偏好决策",
    tags: spot.tags,
  }
}

function applyStructuredSuggestions(
  days: ItineraryDay[],
  generatedDays: GeneratedPlanDay[] | undefined,
  restaurantMap: Map<string, Spot>,
  hotelMap: Map<string, Spot>
) {
  if (!generatedDays || generatedDays.length === 0) return days
  const byDay = new Map(generatedDays.map((day) => [day.day, day]))

  return days.map((day) => {
    const generated = byDay.get(day.day)
    if (!generated) return day

    const lunchCandidate = generated.lunch?.placeId
      ? toSuggestionItemFromSpot(
          restaurantMap.get(generated.lunch.placeId),
          "food",
          generated.lunch.reason
        )
      : null
    const dinnerCandidate = generated.dinner?.placeId
      ? toSuggestionItemFromSpot(
          restaurantMap.get(generated.dinner.placeId),
          "food",
          generated.dinner.reason
        )
      : null
    const hotelCandidate = generated.hotel?.placeId
      ? toSuggestionItemFromSpot(
          hotelMap.get(generated.hotel.placeId),
          "hotel",
          generated.hotel.reason
        )
      : null

    const lunch = lunchCandidate || day.lunchSuggestion || null
    const dinner = dinnerCandidate || day.dinnerSuggestion || null
    const hotel = hotelCandidate || day.hotelSuggestion || null

    const mealCost = (lunch?.price || 0) + (dinner?.price || 0)
    const hotelCost = hotel?.price || 0
    const ticketCost = day.spots.reduce((sum, spot) => sum + (spot.ticketPrice || 0), 0)
    const warnings = Array.from(new Set([...(day.warnings || []), ...(generated.warnings || [])]))
    const weather = generated.weather || day.weather
    const weatherAdvice = generated.weatherAdvice || weather?.advice || day.weatherAdvice
    const weatherTags = generated.weatherTags || weather?.tags || day.weatherTags

    return {
      ...day,
      theme: generated.theme || day.theme,
      districtSummary: generated.districtSummary || day.districtSummary,
      weather,
      weatherAdvice,
      weatherTags,
      lunchSuggestion: lunch,
      dinnerSuggestion: dinner,
      hotelSuggestion: hotel,
      totalMealCost: mealCost,
      totalHotelCost: hotelCost,
      totalEstimatedCost: ticketCost + mealCost + hotelCost,
      warnings,
    }
  })
}

async function requestPlannerDecision(payload: PlannerDecisionRequest): Promise<PlannerDecisionResult> {
  const response = await fetch("/api/planner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const result = (await response.json()) as {
    ok: boolean
    data?: PlannerDecisionResult
    message?: string
  }
  if (!response.ok || !result.ok || !result.data) {
    throw new Error(result.message || "规划决策请求失败")
  }
  return result.data
}

function addDays(startDate: string, days: number) {
  if (!startDate) return ""
  const date = new Date(startDate)
  if (Number.isNaN(date.getTime())) return ""
  date.setDate(date.getDate() + Math.max(0, days - 1))
  return date.toISOString().slice(0, 10)
}

function buildDisplayRouteLegsForDay(
  day: ItineraryDay,
  mode: RouteTransportMode,
  legs: RouteLegResult[]
): ItineraryDay["routeLegs"] {
  if (legs.length === 0) return []

  const pairMap = new Map(
    day.routeLegs.map((leg) => [`${leg.fromName}__${leg.toName}`, leg] as const)
  )

  return legs.map((leg, index) => {
    const matched =
      pairMap.get(`${leg.fromName}__${leg.toName}`) || day.routeLegs[index] || null
    const fallbackStart =
      index === 0
        ? day.spots[0]?.leaveTime || day.spots[0]?.arrivalTime || day.startTime
        : day.spots[index]?.leaveTime || matched?.startTime || day.startTime
    const fallbackArrival =
      day.spots[index + 1]?.arrivalTime || matched?.arrivalTime || day.endTime

    return {
      id: matched?.id || `map-${day.day}-${index}-${leg.fromName}-${leg.toName}`,
      fromName: leg.fromName,
      toName: leg.toName,
      transportMode: mode,
      distanceMeters: leg.distanceMeters,
      durationSeconds: leg.durationSeconds,
      startTime: matched?.startTime || fallbackStart,
      arrivalTime: matched?.arrivalTime || fallbackArrival,
      readableDistance: leg.readableDistance,
      readableDuration: leg.readableDuration,
      isEstimated: leg.isEstimated || leg.status !== "success",
      estimateReason: leg.message || matched?.estimateReason,
      transitLineSummary: leg.transitLineSummary,
      transitTransferCount: leg.transitTransferCount,
      transitSteps: leg.transitSteps,
      recommendedMode: mode === "transit" ? undefined : matched?.recommendedMode,
      recommendedReason: mode === "transit" ? undefined : matched?.recommendedReason,
    }
  })
}

function validateDates(startDate: string, endDate: string) {
  if (!startDate || !endDate) return ""
  if (endDate < startDate) return "结束日期不能早于出发日期"
  return ""
}

function initialRequirementFromSpots(spots: Spot[]) {
  const majorityCity = inferMajorityCity(spots)
  if (!majorityCity) return DEFAULT_REQUIREMENT
  const cityConfig = findProvinceByCity(majorityCity)
  if (!cityConfig) {
    return {
      ...DEFAULT_REQUIREMENT,
      city: majorityCity,
    }
  }
  return {
    ...DEFAULT_REQUIREMENT,
    province: cityConfig.province,
    city: cityConfig.city,
    cityTagline: cityConfig.tagline,
  }
}

function buildRequirementFromEntryDestination(
  destination: NonNullable<AIPlannnerPageProps["entryDestination"]>,
  base: TravelRequirement
) {
  const normalizedCity = destination.city.trim()
  const normalizedProvince = destination.province.trim() || normalizedCity
  const cityConfig = findProvinceByCity(normalizedCity)
  return {
    ...base,
    province: normalizedProvince,
    city: normalizedCity,
    cityTagline:
      destination.cityTagline ||
      cityConfig?.tagline ||
      base.cityTagline ||
      `${normalizedCity}热门目的地`,
  }
}

function withPlanDiagnostics(plan: TripPlan): TripPlan {
  const validationResult = validatePlan(plan, plan.requirement)
  const qualityScore = calculatePlanQualityScore(plan, validationResult, plan.requirement)
  const withMeta = {
    ...plan,
    validationResult,
    qualityScore,
  }
  return {
    ...withMeta,
    shareSummary: buildPlanShareSummary(withMeta),
  }
}

function computePlanTotals(days: ItineraryDay[]) {
  const totalDistanceMeters = days.reduce((sum, day) => sum + day.totalDistanceMeters, 0)
  const totalTravelSeconds = days.reduce((sum, day) => sum + day.totalTravelSeconds, 0)
  const totalPlayMinutes = days.reduce((sum, day) => sum + day.totalPlayMinutes, 0)
  const totalEstimatedCost = days.reduce((sum, day) => sum + day.totalEstimatedCost, 0)
  return {
    totalDistanceMeters,
    totalTravelSeconds,
    totalPlayMinutes,
    totalEstimatedCost,
  }
}

function uniqueAttractionSpots(spots: Spot[]) {
  return uniqueSpots(spots.filter((spot) => spot.type === "attraction"))
}

export function AIPlannnerPage({
  onNavigate,
  entryDestination,
}: AIPlannnerPageProps) {
  const {
    selectedSpots,
    addSpot,
    removeSpot,
    clearSpots,
    savePlan,
    currentPlan,
    setCurrentPlan,
  } = useTravel()
  const didHydrateRef = useRef(false)
  const latestEntryTokenRef = useRef<number | null>(null)
  const manualSearchInputRef = useRef<HTMLInputElement | null>(null)

  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachableStep, setMaxReachableStep] = useState(1)
  const [citySearch, setCitySearch] = useState("")
  const [manualSearch, setManualSearch] = useState("")
  const [tripName, setTripName] = useState("")
  const [departure, setDeparture] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [manualEndDate, setManualEndDate] = useState(false)
  const [requirement, setRequirement] = useState<TravelRequirement>(() => {
    const base = initialRequirementFromSpots(selectedSpots)
    if (!entryDestination) return base
    return buildRequirementFromEntryDestination(entryDestination, base)
  })
  const [selectedPois, setSelectedPois] = useState<Spot[]>([])
  const [manualSelectionCompleted, setManualSelectionCompleted] = useState(false)
  const [skipManualSelection, setSkipManualSelection] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [buildError, setBuildError] = useState("")
  const [generatedPlan, setGeneratedPlan] = useState<TripPlan | null>(null)
  const [generationNotices, setGenerationNotices] = useState<string[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shareFeedback, setShareFeedback] = useState("")
  const [replaceSpotSheetOpen, setReplaceSpotSheetOpen] = useState(false)
  const [replaceFoodSheetOpen, setReplaceFoodSheetOpen] = useState(false)
  const [replaceHotelSheetOpen, setReplaceHotelSheetOpen] = useState(false)
  const [activeEditSpotId, setActiveEditSpotId] = useState<string | null>(null)
  const [activeMealType, setActiveMealType] = useState<"lunch" | "dinner">("lunch")
  const [feedbackSentiment, setFeedbackSentiment] = useState<PlanFeedbackSentiment>("neutral")
  const [feedbackTags, setFeedbackTags] = useState<PlanFeedbackTag[]>([])
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackDay, setFeedbackDay] = useState<number | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [importNotice, setImportNotice] = useState("")
  const [activeResultDayIndex, setActiveResultDayIndex] = useState(0)
  const [activeMapSpotId, setActiveMapSpotId] = useState<string | null>(null)
  const [activeMapLegId, setActiveMapLegId] = useState<string | null>(null)
  const [activeRouteMode, setActiveRouteMode] =
    useState<RouteTransportMode>("driving")
  const [mapRouteLegOverrides, setMapRouteLegOverrides] = useState<
    Record<number, ItineraryDay["routeLegs"]>
  >({})
  const [pendingCity, setPendingCity] = useState<{
    province: string
    city: string
    cityTagline?: string
    mismatched: Spot[]
  } | null>(null)

  const closeActiveField = useCallback(() => {
    if (typeof document === "undefined") return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }, [])

  useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true
    if (selectedSpots.length > 0) {
      setSelectedPois(uniqueSpots(selectedSpots))
      setManualSelectionCompleted(true)
      const majorityCity = inferMajorityCity(selectedSpots)
      const suggestText = majorityCity
        ? `，检测到你已选内容主要在“${majorityCity}”`
        : ""
      setImportNotice(`已从行程页自动导入 ${selectedSpots.length} 个已选地点${suggestText}`)
    }
  }, [selectedSpots])

  useEffect(() => {
    if (!entryDestination) return
    if (latestEntryTokenRef.current === entryDestination.token) return
    latestEntryTokenRef.current = entryDestination.token
    setRequirement((prev) => buildRequirementFromEntryDestination(entryDestination, prev))
    setCurrentStep(1)
    setMaxReachableStep((prev) => Math.max(prev, 1))
    setImportNotice(
      `已从${
        entryDestination.source === "home-city" ? "首页推荐城市" : "外部入口"
      }带入目的地：${entryDestination.city}`
    )
  }, [entryDestination])

  useEffect(() => {
    if (!currentPlan) return
    const hydrated = withPlanDiagnostics(currentPlan)
    setGeneratedPlan(hydrated)
    setGenerationNotices(hydrated.generationNotices || [])
    setTripName(hydrated.name || "")
    setDeparture(hydrated.departure === "未设置" ? "" : hydrated.departure || "")
    setStartDate(hydrated.startDate || "")
    setEndDate(hydrated.endDate || "")
    if (hydrated.requirement) {
      setRequirement(hydrated.requirement)
    }
    setCurrentStep(5)
    setMaxReachableStep((prev) => Math.max(prev, 5))
    setIsEditMode(hydrated.planMode === "user_edited" || hydrated.feedbackRecords?.length ? true : false)
    setActiveResultDayIndex(0)
    setActiveMapSpotId(null)
    setActiveMapLegId(null)
    setMapRouteLegOverrides({})
  }, [currentPlan])

  useEffect(() => {
    if (!manualEndDate) {
      setEndDate(addDays(startDate, requirement.days))
    }
  }, [manualEndDate, requirement.days, startDate])

  useEffect(() => {
    closeActiveField()
  }, [closeActiveField, currentStep])

  useEffect(() => {
    if (!requirement.city || selectedPois.length === 0) return
    const conflict = detectCityConflict(selectedPois, requirement.city, requirement.province)
    if (conflict.mismatched.length > 0) {
      setImportNotice(
        `当前目的地为“${requirement.city}”，已选清单中有 ${conflict.mismatched.length} 个异地地点待处理`
      )
    }
  }, [requirement.city, requirement.province, selectedPois])

  const dateError = useMemo(
    () => validateDates(startDate, endDate),
    [startDate, endDate]
  )

  const citySpots = useMemo(
    () =>
      sampleSpots.filter((spot) =>
        isSpotInDestination(spot, {
          city: requirement.city,
          province: requirement.province,
        })
      ),
    [requirement.city, requirement.province]
  )

  const allSelectableSpots = useMemo(
    () =>
      uniqueSpots(
        [...selectedSpots, ...citySpots].filter((spot) =>
          isSpotInDestination(spot, {
            city: requirement.city,
            province: requirement.province,
          })
        )
      ),
    [citySpots, requirement.city, requirement.province, selectedSpots]
  )

  const recommendationBase = useMemo(
    () => getRecommendedPoisByRequirement(requirement, requirement.city, allSelectableSpots, 12),
    [allSelectableSpots, requirement]
  )

  const recommendedBundles = useMemo(
    () => getRecommendedBundles(requirement, requirement.city, allSelectableSpots),
    [allSelectableSpots, requirement]
  )

  const manualSearchResult = useMemo(() => {
    const keyword = manualSearch.trim().toLowerCase()
    if (!keyword) return []
    return allSelectableSpots.filter((spot) =>
      `${spot.name}${spot.address}${spot.tags.join("")}`
        .toLowerCase()
        .includes(keyword)
    )
  }, [allSelectableSpots, manualSearch])

  const hasManualSearchKeyword = manualSearch.trim().length > 0

  const selectedPoiIdSet = useMemo(
    () => new Set(selectedPois.map((item) => item.id)),
    [selectedPois]
  )

  const isBundleFullyAdded = useCallback(
    (bundle: PoiBundle) => {
      const destinationIds = bundle.poiIds.filter((id) => {
        const found = allSelectableSpots.find((spot) => spot.id === id)
        return found
          ? isSpotInDestination(found, {
              city: requirement.city,
              province: requirement.province,
            })
          : false
      })
      return (
        destinationIds.length > 0 &&
        destinationIds.every((id) => selectedPoiIdSet.has(id))
      )
    },
    [allSelectableSpots, requirement.city, requirement.province, selectedPoiIdSet]
  )

  const canGoNext = useMemo(() => {
    if (currentStep === 1) return Boolean(requirement.province && requirement.city)
    if (currentStep === 2) return requirement.interests.length > 0
    if (currentStep === 4) return !isGenerating && !dateError
    return true
  }, [
    currentStep,
    dateError,
    isGenerating,
    requirement.interests.length,
    requirement.province,
    requirement.city,
  ])

  const stepThreeStatusText =
    selectedPois.length > 0
      ? `你已手动添加 ${selectedPois.length} 项，生成时会优先保留`
      : "当前未手动添加内容，下一步将按城市、预算与偏好自动推荐"

  const resultDays = generatedPlan?.days || []
  const activeResultDay =
    resultDays[activeResultDayIndex] || resultDays[0] || null

  const editableAttractionPool = useMemo(() => {
    const planSpots = generatedPlan?.spots || []
    const daySpots = resultDays.flatMap((day) => day.spots)
    return uniqueAttractionSpots([...allSelectableSpots, ...planSpots, ...daySpots])
  }, [allSelectableSpots, generatedPlan?.spots, resultDays])

  const editableRestaurantPool = useMemo(() => {
    const planSpots = generatedPlan?.spots || []
    const daySpots = resultDays.flatMap((day) => day.spots)
    return uniqueSpots([...allSelectableSpots, ...planSpots, ...daySpots]).filter(
      (spot) => spot.type === "restaurant"
    )
  }, [allSelectableSpots, generatedPlan?.spots, resultDays])

  const editableHotelPool = useMemo(() => {
    const planSpots = generatedPlan?.spots || []
    const daySpots = resultDays.flatMap((day) => day.spots)
    return uniqueSpots([...allSelectableSpots, ...planSpots, ...daySpots]).filter(
      (spot) => spot.type === "hotel"
    )
  }, [allSelectableSpots, generatedPlan?.spots, resultDays])

  const replaceSpotCandidates = useMemo(() => {
    if (!activeResultDay || !activeEditSpotId) return []
    return getSpotReplacementCandidates({
      day: activeResultDay,
      spotId: activeEditSpotId,
      pool: editableAttractionPool,
      lockedSpotIds: generatedPlan?.lockedSpotIds || [],
      max: 10,
    })
  }, [activeResultDay, activeEditSpotId, editableAttractionPool, generatedPlan?.lockedSpotIds])

  const replaceFoodCandidates = useMemo(() => {
    if (!activeResultDay) return []
    return getMealReplacementCandidates({
      day: activeResultDay,
      mealType: activeMealType,
      pool: editableRestaurantPool,
      max: 12,
    })
  }, [activeMealType, activeResultDay, editableRestaurantPool])

  const replaceHotelCandidates = useMemo(() => {
    if (!activeResultDay) return []
    const nextDay = resultDays[activeResultDayIndex + 1] || null
    return getHotelReplacementCandidates({
      day: activeResultDay,
      nextDay,
      pool: editableHotelPool,
      max: 12,
    })
  }, [activeResultDay, activeResultDayIndex, editableHotelPool, resultDays])

  const handleResultDayChange = useCallback((index: number) => {
    setActiveResultDayIndex(index)
    setActiveMapSpotId(null)
    setActiveMapLegId(null)
  }, [])

  const focusSpotCard = useCallback((spotId: string) => {
    if (typeof document === "undefined") return
    const target = document.getElementById(`result-day-${activeResultDay?.day ?? 1}-spot-${spotId}`)
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeResultDay?.day])

  const handleMapSpotSelect = useCallback((spotId: string) => {
    setActiveMapSpotId(spotId)
    setActiveMapLegId(null)
    focusSpotCard(spotId)
  }, [focusSpotCard])

  const handleMapLegSelect = useCallback((legId: string) => {
    setActiveMapLegId(legId)
  }, [])

  const applyGeneratedPlan = useCallback(
    (nextPlan: TripPlan) => {
      const enriched = withPlanDiagnostics(nextPlan)
      setGeneratedPlan(enriched)
      setGenerationNotices(Array.from(new Set(enriched.generationNotices || [])))
      setMapRouteLegOverrides({})
      setActiveMapSpotId(null)
      setActiveMapLegId(null)
      setCurrentPlan(enriched)
    },
    [setCurrentPlan]
  )

  const rebuildFromDaySpotMatrix = useCallback(
    async (
      matrix: string[][],
      reason: string,
      basePlan?: TripPlan
    ) => {
      const seedPlan = basePlan || generatedPlan
      if (!seedPlan) return
      const sourceDays = seedPlan.days || []
      const dayMetas = sourceDays.map((day) => ({
        theme: day.theme,
        districtSummary: day.districtSummary,
        warnings: day.warnings,
      }))
      const availableSpotMap = new Map(
        uniqueAttractionSpots([
          ...editableAttractionPool,
          ...(seedPlan.spots || []),
          ...sourceDays.flatMap((day) => day.spots),
        ]).map((spot) => [spot.id, spot] as const)
      )

      const routeSpots = uniqueAttractionSpots(
        matrix
          .flatMap((ids) => ids)
          .map((id) => availableSpotMap.get(id))
          .filter((item): item is Spot => Boolean(item))
      )

      if (routeSpots.length === 0) {
        setBuildError("当前编辑结果缺少可用景点，无法重算路线。")
        return
      }

      setIsOptimizing(true)
      try {
        const itineraryResult = await buildAiItinerary({
          spots: routeSpots,
          startDate: seedPlan.startDate,
          endDate: seedPlan.endDate,
          pace: toEnginePace(seedPlan.requirement?.pace || requirement.pace),
          departure: seedPlan.departure === "未设置" ? "" : seedPlan.departure,
          transportMode: activeRouteMode,
          requirement: seedPlan.requirement || requirement,
          forcedDaySpotIds: matrix,
          forcedDayMetas: dayMetas,
        })

        const rebuiltDays = itineraryResult.days.map((day) => {
          const sourceDay = sourceDays.find((item) => item.day === day.day)
          return {
            ...day,
            weather: sourceDay?.weather,
            weatherAdvice: sourceDay?.weatherAdvice,
            weatherTags: sourceDay?.weatherTags,
          }
        })
        const totals = computePlanTotals(rebuiltDays)
        const nextPlan: TripPlan = {
          ...seedPlan,
          spots: routeSpots,
          days: rebuiltDays,
          totalDays: rebuiltDays.length,
          totalSpots: routeSpots.length,
          ...totals,
          generationStatus: itineraryResult.status,
          generationNotices: Array.from(
            new Set([...(seedPlan.generationNotices || []), ...itineraryResult.notices, reason])
          ),
          plannerWarnings: Array.from(
            new Set([...(seedPlan.generationNotices || []), ...itineraryResult.notices, reason])
          ).map((message) => ({ level: "info", message })),
          planMode: "user_edited",
          lastEditedAt: new Date().toISOString(),
        }

        applyGeneratedPlan(nextPlan)
      } catch (error) {
        setBuildError(error instanceof Error ? error.message : "重算失败，请稍后重试")
      } finally {
        setIsOptimizing(false)
      }
    },
    [
      activeRouteMode,
      applyGeneratedPlan,
      editableAttractionPool,
      generatedPlan,
      requirement,
    ]
  )

  const applyDayEdit = useCallback(
    (dayNumber: number, patcher: (day: ItineraryDay) => ItineraryDay, reason: string) => {
      if (!generatedPlan) return
      const patched = applyDayPatch(generatedPlan, dayNumber, patcher)
      applyGeneratedPlan({
        ...patched,
        generationNotices: Array.from(new Set([...(patched.generationNotices || []), reason])),
      })
    },
    [applyGeneratedPlan, generatedPlan]
  )

  const handleMoveSpot = useCallback(
    async (spotId: string, direction: "up" | "down") => {
      if (!activeResultDay) return
      const lockedSet = new Set(generatedPlan?.lockedSpotIds || [])
      if (lockedSet.has(spotId)) return
      const matrix = toDaySpotIdMatrix(resultDays)
      const updatedMatrix = moveSpotIdInMatrix(matrix, activeResultDayIndex, spotId, direction)
      await rebuildFromDaySpotMatrix(updatedMatrix, "已按你的操作重新调整顺序。")
    },
    [activeResultDay, activeResultDayIndex, generatedPlan?.lockedSpotIds, rebuildFromDaySpotMatrix, resultDays]
  )

  const handleReplaceSpotCandidate = useCallback(
    async (candidate: PlanReplaceCandidate) => {
      if (!activeEditSpotId) return
      const lockedSet = new Set(generatedPlan?.lockedSpotIds || [])
      if (lockedSet.has(activeEditSpotId)) return
      const matrix = toDaySpotIdMatrix(resultDays)
      const updatedMatrix = replaceSpotIdInMatrix(
        matrix,
        activeResultDayIndex,
        activeEditSpotId,
        candidate.spot.id
      )
      setReplaceSpotSheetOpen(false)
      await rebuildFromDaySpotMatrix(updatedMatrix, `已替换景点为：${candidate.spot.name}`)
    },
    [
      activeEditSpotId,
      activeResultDayIndex,
      generatedPlan?.lockedSpotIds,
      rebuildFromDaySpotMatrix,
      resultDays,
    ]
  )

  const handleReplaceMealCandidate = useCallback(
    (candidate: PlanReplaceCandidate) => {
      if (!activeResultDay) return
      const suggestion = toSuggestionFromSpot(candidate.spot, "food", candidate.reason)
      applyDayEdit(
        activeResultDay.day,
        (day) => updateDayMeal(day, activeMealType, suggestion),
        `已替换${activeMealType === "lunch" ? "午餐" : "晚餐"}：${candidate.spot.name}`
      )
      setReplaceFoodSheetOpen(false)
    },
    [activeMealType, activeResultDay, applyDayEdit]
  )

  const handleReplaceHotelCandidate = useCallback(
    (candidate: PlanReplaceCandidate) => {
      if (!activeResultDay) return
      const suggestion = toSuggestionFromSpot(
        candidate.spot,
        "hotel",
        "靠近当日终点/次日起点的替换候选"
      )
      applyDayEdit(
        activeResultDay.day,
        (day) => updateDayHotel(day, suggestion),
        `已替换酒店：${candidate.spot.name}`
      )
      setReplaceHotelSheetOpen(false)
    },
    [activeResultDay, applyDayEdit]
  )

  const handleToggleSpotLock = useCallback(
    (spotId: string) => {
      if (!generatedPlan) return
      const lockedSpotIds = toggleLockedSpot(generatedPlan.lockedSpotIds || [], spotId)
      applyGeneratedPlan({
        ...generatedPlan,
        lockedSpotIds,
        planMode: "user_edited",
        lastEditedAt: new Date().toISOString(),
      })
    },
    [applyGeneratedPlan, generatedPlan]
  )

  const handleOptimizeCurrentDay = useCallback(async () => {
    const matrix = toDaySpotIdMatrix(resultDays)
    await rebuildFromDaySpotMatrix(matrix, "已按当前偏好重新优化当天路线。")
  }, [rebuildFromDaySpotMatrix, resultDays])

  const toggleFeedbackTag = (tag: PlanFeedbackTag) => {
    setFeedbackTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag)
      return [...prev, tag]
    })
  }

  const handleSubmitFeedback = useCallback(async () => {
    if (!generatedPlan) return
    if (feedbackTags.length === 0) return

    const feedback = createPlanFeedbackRecord({
      sentiment: feedbackSentiment,
      tags: feedbackTags,
      comment: feedbackComment,
      day: feedbackDay || activeResultDay?.day,
    })
    const actions = deriveFeedbackActions({
      sentiment: feedbackSentiment,
      tags: feedbackTags,
      comment: feedbackComment,
      day: feedbackDay || activeResultDay?.day,
    })

    let nextPlan: TripPlan = {
      ...generatedPlan,
      feedbackRecords: [...(generatedPlan.feedbackRecords || []), feedback],
      planMode: "user_edited",
      lastEditedAt: new Date().toISOString(),
    }

    let shouldRebuild = false
    const matrix = toDaySpotIdMatrix(nextPlan.days || [])

    for (const action of actions) {
      const dayNumber = action.day || activeResultDay?.day || 1
      const dayIndex = Math.max(0, (nextPlan.days || []).findIndex((item) => item.day === dayNumber))
      const targetDay = nextPlan.days?.[dayIndex]
      if (!targetDay) continue

      if (action.action === "replace_restaurant") {
        const candidate = getMealReplacementCandidates({
          day: targetDay,
          mealType: "dinner",
          pool: editableRestaurantPool,
          max: 1,
        })[0]
        if (candidate) {
          nextPlan = applyDayPatch(nextPlan, dayNumber, (day) =>
            updateDayMeal(day, "dinner", toSuggestionFromSpot(candidate.spot, "food", candidate.reason))
          )
        }
      }

      if (action.action === "replace_hotel") {
        const candidate = getHotelReplacementCandidates({
          day: targetDay,
          nextDay: nextPlan.days?.[dayIndex + 1] || null,
          pool: editableHotelPool,
          max: 1,
        })[0]
        if (candidate) {
          nextPlan = applyDayPatch(nextPlan, dayNumber, (day) =>
            updateDayHotel(day, toSuggestionFromSpot(candidate.spot, "hotel", candidate.reason))
          )
        }
      }

      if (action.action === "rebalance_budget") {
        const lowFood = editableRestaurantPool
          .filter((spot) => spot.ticketPrice > 0)
          .sort((a, b) => a.ticketPrice - b.ticketPrice)[0]
        const lowHotel = editableHotelPool
          .filter((spot) => spot.ticketPrice > 0)
          .sort((a, b) => a.ticketPrice - b.ticketPrice)[0]
        if (lowFood) {
          nextPlan = applyDayPatch(nextPlan, dayNumber, (day) =>
            updateDayMeal(day, "dinner", toSuggestionFromSpot(lowFood, "food", "已按反馈替换为更省钱餐饮"))
          )
        }
        if (lowHotel) {
          nextPlan = applyDayPatch(nextPlan, dayNumber, (day) =>
            updateDayHotel(day, toSuggestionFromSpot(lowHotel, "hotel", "已按反馈替换为更省钱酒店"))
          )
        }
      }

      if (action.action === "rebalance_pace") {
        const dayIds = [...(matrix[dayIndex] || [])]
        if (dayIds.length > 2) {
          dayIds.pop()
          matrix[dayIndex] = dayIds
          shouldRebuild = true
        }
      }

      if (action.action === "optimize_day") {
        shouldRebuild = true
      }
    }

    nextPlan = {
      ...nextPlan,
      generationNotices: Array.from(new Set([...(nextPlan.generationNotices || []), "已根据反馈执行局部优化。"])),
    }

    if (shouldRebuild) {
      await rebuildFromDaySpotMatrix(matrix, "已根据你的反馈局部重算。", nextPlan)
    } else {
      applyGeneratedPlan(nextPlan)
    }

    setFeedbackComment("")
    setFeedbackTags([])
  }, [
    activeResultDay?.day,
    applyGeneratedPlan,
    editableHotelPool,
    editableRestaurantPool,
    feedbackComment,
    feedbackDay,
    feedbackSentiment,
    feedbackTags,
    generatedPlan,
    rebuildFromDaySpotMatrix,
  ])

  const handleShareSummary = useCallback(async () => {
    if (!generatedPlan) return
    const summaryText = toShareSummaryText(
      generatedPlan.shareSummary || buildPlanShareSummary(generatedPlan)
    )
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(summaryText)
        setShareFeedback("分享摘要已复制到剪贴板")
      } catch {
        setShareFeedback("复制失败，请稍后重试")
      }
    } else {
      setShareFeedback("当前环境不支持剪贴板复制")
    }
    window.setTimeout(() => setShareFeedback(""), 1800)
  }, [generatedPlan])

  const applyCitySelection = (province: string, city: string, cityTagline?: string) => {
    closeActiveField()
    const conflict = detectCityConflict(selectedPois, city, province)
    if (conflict.mismatched.length > 0) {
      setPendingCity({ province, city, cityTagline, mismatched: conflict.mismatched })
      return
    }
    setRequirement((prev) => ({ ...prev, province, city, cityTagline }))
  }

  const handleAddSpot = (spotId: string) => {
    const found = allSelectableSpots.find((spot) => spot.id === spotId)
    if (!found) return
    if (
      !isSpotInDestination(found, {
        city: requirement.city,
        province: requirement.province,
      })
    ) {
      setImportNotice(`“${found.name}”与当前目的地不一致，已阻止加入`)
      return
    }
    setSelectedPois((prev) => uniqueSpots([...prev, found]))
    addSpot(found)
    setManualSelectionCompleted(true)
    setSkipManualSelection(false)
  }

  const handleAddBundle = (bundle: PoiBundle) => {
    const byId = new Map(allSelectableSpots.map((spot) => [spot.id, spot]))
    const spots = bundle.poiIds
      .map((id) => byId.get(id))
      .filter((item): item is Spot => Boolean(item))
    if (spots.length === 0) {
      setImportNotice("当前组合暂无可加入地点，请稍后再试")
      return
    }
    const matched = spots.filter((spot) =>
      isSpotInDestination(spot, {
        city: requirement.city,
        province: requirement.province,
      })
    )
    const removedCount = spots.length - matched.length
    if (removedCount > 0) {
      setImportNotice(`组合中有 ${removedCount} 个异地地点已自动过滤`)
    }
    if (matched.length === 0) {
      setImportNotice("组合地点与当前目的地不一致，已阻止加入")
      return
    }
    const existingIds = new Set(selectedPois.map((spot) => spot.id))
    const newSpots = matched.filter((spot) => !existingIds.has(spot.id))
    if (newSpots.length === 0) {
      setImportNotice(`“${bundle.title}”已在当前行程清单中`)
      return
    }
    setSelectedPois((prev) => uniqueSpots([...prev, ...matched]))
    newSpots.forEach((spot) => addSpot(spot))
    setManualSelectionCompleted(true)
    setSkipManualSelection(false)
    setImportNotice(`已加入“${bundle.title}”中的 ${newSpots.length} 个地点`)
  }

  const handleSkipStepThree = () => {
    setSkipManualSelection(true)
    setManualSelectionCompleted(false)
    setMaxReachableStep((prev) => Math.max(prev, 4))
    setCurrentStep(4)
  }

  const handleGeneratePlan = async () => {
    if (dateError) {
      setBuildError(dateError)
      return
    }

    setBuildError("")
    setIsGenerating(true)
    try {
      closeActiveField()
      const filteredManual = filterSpotsByCity(
        selectedPois,
        requirement.city,
        requirement.province
      )
      const removedForCity = selectedPois.length - filteredManual.length

      const autoRecommend = getRecommendedPoisByRequirement(
        requirement,
        requirement.city,
        allSelectableSpots,
        Math.max(requirement.days * 4, 6)
      ).map((item) => item.spot)

      let finalSpots: Spot[] = []
      let generationSource: TripPlan["generationSource"] = "auto"

      if (filteredManual.length === 0) {
        finalSpots = uniqueSpots(autoRecommend)
      } else {
        const supplements = autoRecommend.filter(
          (spot) => !filteredManual.some((item) => item.id === spot.id)
        )
        finalSpots = uniqueSpots([...filteredManual, ...supplements.slice(0, requirement.days * 2)])
        generationSource = supplements.length > 0 ? "mixed" : "manual"
      }

      if (finalSpots.length === 0) {
        finalSpots = citySpots.slice(0, 8)
      }
      if (finalSpots.length === 0) {
        throw new Error("当前目的地下暂无可规划地点，请先切换城市或补充内容。")
      }

      const attractionCandidates = uniqueSpots(
        finalSpots.filter((spot) => spot.type === "attraction")
      )
      const restaurantCandidateSpots = uniqueSpots(
        [...allSelectableSpots, ...citySpots, ...autoRecommend, ...filteredManual].filter(
          (spot) => spot.type === "restaurant"
        )
      ).slice(0, 80)
      const hotelPreferenceBoostIds = new Set(
        getHotelRecommendations({
          city: requirement.city,
          budgetRange: requirement.budgetRange,
          companions: requirement.companions,
          interests: requirement.interests,
          limit: 30,
        }).map((hotel) => hotel.id)
      )
      const hotelCandidateSpots = uniqueSpots(
        [...allSelectableSpots, ...citySpots, ...filteredManual, ...finalSpots].filter(
          (spot) => spot.type === "hotel"
        )
      )
        .map((spot) =>
          hotelPreferenceBoostIds.has(spot.id)
            ? {
                ...spot,
                tags: Array.from(new Set([...(spot.tags || []), "评论偏好匹配"])),
              }
            : spot
        )
        .slice(0, 60)
      const plannerPayload: PlannerDecisionRequest = {
        destination: `${requirement.city} ${requirement.days}日游`,
        city: requirement.city,
        province: requirement.province,
        startDate,
        endDate,
        totalDays: requirement.days,
        budgetRange: requirement.budgetRange,
        companions: requirement.companions,
        interests: requirement.interests,
        pace: requirement.pace || "balanced",
        specialNeeds: requirement.specialNeeds || [],
        attractions: attractionCandidates.map((spot) => toPlannerCandidate(spot)),
        restaurants: restaurantCandidateSpots.map((spot) => toPlannerCandidate(spot)),
        hotels: hotelCandidateSpots.map((spot) => toPlannerCandidate(spot)),
        routeHints: buildPlannerRouteHints(attractionCandidates),
        manualPreferredPlaceIds: filteredManual.map((spot) => spot.id),
      }

      let plannerDecision: PlannerDecisionResult | null = null
      let plannerRequestFailed = ""
      try {
        plannerDecision = await requestPlannerDecision(plannerPayload)
      } catch (error) {
        plannerRequestFailed = error instanceof Error ? error.message : "规划决策服务不可用"
      }

      const attractionMap = new Map(attractionCandidates.map((spot) => [spot.id, spot]))
      const forcedDaySpotIds = plannerDecision?.plan.days.map((day) =>
        day.spots.map((spot) => spot.placeId)
      )
      const forcedDayMetas = plannerDecision?.plan.days.map((day) => ({
        theme: day.theme,
        districtSummary: day.districtSummary,
        warnings: Array.from(
          new Set([...(day.warnings || []), ...(day.weatherAdvice ? [`天气提醒：${day.weatherAdvice}`] : [])])
        ),
      }))
      const forcedSpotReasonMap: Record<string, string> = {}
      if (plannerDecision) {
        for (const day of plannerDecision.plan.days) {
          for (const spot of day.spots) {
            if (spot.reason) {
              forcedSpotReasonMap[spot.placeId] = spot.reason
            }
          }
        }
      }

      const plannedAttractions = plannerDecision
        ? uniqueSpots(
            plannerDecision.plan.days
              .flatMap((day) => day.spots.map((spot) => attractionMap.get(spot.placeId)))
              .filter((spot): spot is Spot => Boolean(spot))
          )
        : []
      const fallbackAttractions = uniqueSpots(
        citySpots.filter((spot) => spot.type === "attraction")
      ).slice(0, Math.max(requirement.days * 4, 6))

      const routeSpots =
        plannedAttractions.length > 0
          ? plannedAttractions
          : attractionCandidates.length > 0
          ? attractionCandidates
          : fallbackAttractions.length > 0
          ? fallbackAttractions
          : finalSpots

      const itineraryResult = await buildAiItinerary({
        spots: routeSpots,
        startDate,
        endDate,
        pace: toEnginePace(requirement.pace),
        departure,
        transportMode: "driving",
        requirement,
        forcedDaySpotIds,
        forcedDayMetas,
        forcedSpotReasonMap,
      })

      const restaurantMap = new Map(restaurantCandidateSpots.map((spot) => [spot.id, spot]))
      const hotelMap = new Map(hotelCandidateSpots.map((spot) => [spot.id, spot]))
      const resolvedDays = applyStructuredSuggestions(
        itineraryResult.days,
        plannerDecision?.plan.days,
        restaurantMap,
        hotelMap
      )

      const totals = computePlanTotals(resolvedDays)

      const notices = [...itineraryResult.notices]
      if (plannerRequestFailed) {
        notices.unshift(`智能决策层不可用，已降级为基础规则方案：${plannerRequestFailed}`)
      }
      if (plannerDecision?.source === "fallback") {
        notices.unshift("当前已使用基础规划方案（规则引擎），可配置Qwen后获得偏好增强决策。")
      }
      if (plannerDecision?.warnings?.length) {
        notices.push(...plannerDecision.warnings)
      }
      if (selectedPois.length === 0) {
        notices.unshift("你未手动添加内容，系统已按需求自动推荐并生成方案。")
      }
      if (removedForCity > 0) {
        notices.unshift(`已移除 ${removedForCity} 个与“${requirement.city}”不一致的地点。`)
      }

      const plan: TripPlan = {
        id: Date.now().toString(),
        name: tripName.trim() || `${requirement.city || "目的地"}智能行程`,
        startDate,
        endDate,
        pace: toPaceLabel(requirement.pace),
        departure: departure.trim() || "未设置",
        spots: routeSpots,
        createdAt: new Date().toISOString(),
        days: resolvedDays,
        totalDays: resolvedDays.length || itineraryResult.totalDays,
        totalSpots: routeSpots.length || itineraryResult.totalSpots,
        totalDistanceMeters: totals.totalDistanceMeters,
        totalTravelSeconds: totals.totalTravelSeconds,
        totalPlayMinutes: totals.totalPlayMinutes,
        totalEstimatedCost: totals.totalEstimatedCost,
        weatherSummary: plannerDecision?.plan.weatherSummary,
        generationStatus: itineraryResult.status,
        generationNotices: notices,
        requirement,
        selectedPoisSnapshot: filteredManual.map((spot) => toSelectedPoiSnapshot(spot)),
        manualSelectionCompleted: filteredManual.length > 0 || manualSelectionCompleted,
        skipManualSelection: filteredManual.length === 0 || skipManualSelection,
        generationSource,
        plannerWarnings: notices.map((message) => ({ level: "info", message })),
        plannerEngineMode: plannerDecision?.source || "fallback",
        generatedPlan: plannerDecision?.plan,
        planExplanations: plannerDecision?.plan.explanations || [],
        planMode: "ai_original",
        lockedSpotIds: [],
        feedbackRecords: [],
        lastEditedAt: new Date().toISOString(),
      }

      applyGeneratedPlan(plan)
      setActiveResultDayIndex(0)
      setActiveMapSpotId(null)
      setActiveMapLegId(null)
      setActiveRouteMode("driving")
      setMapRouteLegOverrides({})
      setIsEditMode(false)
      setMaxReachableStep((prev) => Math.max(prev, 5))
      setCurrentStep(5)
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "生成失败，请稍后重试")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleNext = () => {
    if (!canGoNext) return
    closeActiveField()
    if (currentStep === 3) {
      setSkipManualSelection(selectedPois.length === 0)
      setManualSelectionCompleted(selectedPois.length > 0)
    }
    if (currentStep === 4) {
      void handleGeneratePlan()
      return
    }
    setCurrentStep((prev) => prev + 1)
    setMaxReachableStep((prev) => Math.max(prev, currentStep + 1))
  }

  const handleSavePlan = () => {
    if (!generatedPlan) return
    const toSave = {
      ...withPlanDiagnostics(generatedPlan),
      lastEditedAt: new Date().toISOString(),
    }
    savePlan(toSave)
    setCurrentPlan(toSave)
    setShowSaveSuccess(true)
    setTimeout(() => setShowSaveSuccess(false), 1800)
  }

  const activeRouteLegsOverride = activeResultDay
    ? mapRouteLegOverrides[activeResultDay.day]
    : undefined
  const shareSummary =
    generatedPlan ? generatedPlan.shareSummary || buildPlanShareSummary(generatedPlan) : null

  return (
    <div className="app-page animate-fade-in space-y-4 pb-28">
      <AppCard tone="elevated" padding="md" className="soft-gradient relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:rgba(93,111,47,0.14)] blur-2xl" />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[var(--app-brand-soft)] text-[var(--app-brand)] ring-1 ring-[color:rgba(93,111,47,0.18)]">
                <Route className="h-5 w-5" strokeWidth={1.9} />
              </div>
              <div>
                <h1 className="text-[1.34rem] font-semibold leading-tight tracking-normal text-[var(--app-text-strong)]">AI 规划你的行程</h1>
              </div>
            </div>
            <AppTag tone="brand" className="numeric">
              Step {currentStep}/{STEP_TITLES.length}
            </AppTag>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2 py-2">
              <p className="text-[10px] text-[var(--app-text-muted)]">目的地</p>
              <p className="truncate text-xs font-semibold text-[var(--app-text-primary)]">{requirement.city || "未选择"}</p>
            </div>
            <div className="rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2 py-2">
              <p className="text-[10px] text-[var(--app-text-muted)]">天数</p>
              <p className="numeric text-xs font-semibold text-[var(--app-text-primary)]">{requirement.days} 天</p>
            </div>
            <div className="rounded-[0.7rem] bg-[var(--app-surface-elevated)] px-2 py-2">
              <p className="text-[10px] text-[var(--app-text-muted)]">偏好标签</p>
              <p className="numeric text-xs font-semibold text-[var(--app-text-primary)]">{requirement.interests.length}</p>
            </div>
          </div>
        </div>
      </AppCard>

      <div className="space-y-4">
        <PlannerStepper
          steps={STEP_TITLES}
          currentStep={currentStep}
          maxReachableStep={maxReachableStep}
          onStepChange={(target) => {
            closeActiveField()
            if (target <= maxReachableStep) setCurrentStep(target)
          }}
        />

        {importNotice && currentStep <= 3 && (
          <div className="rounded-[var(--app-radius-sm)] border border-[color:rgba(93,111,47,0.24)] bg-[var(--app-brand-soft)] px-3 py-2 text-[11px] text-[var(--app-brand)]">
            {importNotice}
          </div>
        )}

        {currentStep === 1 && (
          <AppCard tone="elevated" padding="md">
            <CityPicker
              province={requirement.province}
              city={requirement.city}
              cityTagline={requirement.cityTagline}
              citySearch={citySearch}
              onProvinceChange={(province) => {
                const firstCity = getCitiesByProvince(province)[0]
                applyCitySelection(province, firstCity?.city || "", firstCity?.tagline)
                setCitySearch("")
              }}
              onCitySearchChange={setCitySearch}
              onSelectCity={(city) =>
                applyCitySelection(city.province, city.city, city.tagline)
              }
            />
          </AppCard>
        )}

        {currentStep === 2 && (
          <AppCard tone="elevated" padding="md">
            <RequirementPicker requirement={requirement} onChange={setRequirement} />
          </AppCard>
        )}

        {currentStep === 3 && (
          <section className="space-y-3">
            <AppCard tone="elevated" padding="md" className="bg-[var(--app-brand-soft)]/45">
              <h3 className="text-base font-semibold text-[var(--app-text-strong)]">补充想去内容（可跳过）</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--app-text-secondary)]">
                这一步不是必须完成。你可以手动补充，也可以直接下一步交给系统自动推荐。
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AppButton
                  type="button"
                  onClick={handleSkipStepThree}
                  size="lg"
                >
                  跳过并继续
                </AppButton>
                <AppButton
                  type="button"
                  onClick={() => manualSearchInputRef.current?.focus()}
                  size="lg"
                  variant="secondary"
                >
                  继续手动添加
                </AppButton>
              </div>
            </AppCard>

            <AppCard tone="elevated" padding="md" className="space-y-4">
              <RecommendedPoiSection
                title="根据兴趣偏好推荐"
                subtitle="按你的城市和兴趣优先匹配。"
                items={recommendationBase.slice(0, 4)}
                inCart={(spotId) => selectedPoiIdSet.has(spotId)}
                onAdd={handleAddSpot}
              />
              <RecommendedPoiSection
                title="根据节奏和预算推荐"
                subtitle="慢节奏更注重体验，快节奏更注重效率。"
                items={recommendationBase.slice(4, 8)}
                inCart={(spotId) => selectedPoiIdSet.has(spotId)}
                onAdd={handleAddSpot}
              />
            </AppCard>

            <AppCard tone="elevated" padding="md">
              <RecommendedBundles
                bundles={recommendedBundles}
                onAddBundle={handleAddBundle}
                isBundleAdded={isBundleFullyAdded}
              />
            </AppCard>

            <AppCard tone="elevated" padding="md" className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
                <AppInput
                  ref={manualSearchInputRef}
                  type="text"
                  value={manualSearch}
                  onChange={(event) => setManualSearch(event.target.value)}
                  placeholder="搜索景点、美食或住宿"
                  tone="subtle"
                  density="lg"
                  className="pl-10"
                />
              </div>
              {hasManualSearchKeyword && (
                <div className="space-y-2">
                  {manualSearchResult.slice(0, 6).map((spot) => (
                    <article
                      key={spot.id}
                      className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <PlacePhotoImage
                          name={spot.name}
                          city={spot.city}
                          province={spot.province}
                          type={spot.type}
                          alt={spot.name}
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--app-text-strong)]">{spot.name}</p>
                          <p className="mt-0.5 truncate text-xs text-[var(--app-text-secondary)]">{spot.address}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSpot(spot.id)}
                          className={cn(
                            "rounded-[0.65rem] px-2.5 py-1.5 text-xs font-medium",
                            selectedPoiIdSet.has(spot.id)
                              ? "bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                              : "bg-[var(--app-brand)] text-white"
                          )}
                        >
                          {selectedPoiIdSet.has(spot.id) ? "已加入" : "加入"}
                        </button>
                      </div>
                    </article>
                  ))}
                  {manualSearchResult.length === 0 && (
                    <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
                      暂无匹配地点，可以换个关键词试试。
                    </div>
                  )}
                </div>
              )}
            </AppCard>

            <AppCard tone="elevated" padding="md">
              <PoiCart
                selectedPois={selectedPois}
                onRemove={(spotId) => {
                  setSelectedPois((prev) => prev.filter((spot) => spot.id !== spotId))
                  removeSpot(spotId)
                }}
                onClear={() => {
                  setSelectedPois([])
                  clearSpots()
                }}
              />
              <p className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-secondary)]">
                {stepThreeStatusText}
              </p>
            </AppCard>
          </section>
        )}

        {currentStep === 4 && (
          <section className="space-y-3">
            <AppCard tone="elevated" padding="md">
              <h3 className="text-base font-semibold text-[var(--app-text-strong)]">确认并生成</h3>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                确认目的地、需求与导入内容后再生成方案。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-text-secondary)]">
                  目的地 <span className="font-medium text-[var(--app-text-strong)]">{requirement.city}</span>
                </div>
                <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-text-secondary)]">
                  天数 <span className="font-medium text-[var(--app-text-strong)]">{requirement.days} 天</span>
                </div>
                <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-text-secondary)]">
                  预算 <span className="font-medium text-[var(--app-text-strong)]">{requirement.budgetRange}</span>
                </div>
                <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-text-secondary)]">
                  同行 <span className="font-medium text-[var(--app-text-strong)]">{COMPANION_LABEL[requirement.companions]}</span>
                </div>
              </div>
            </AppCard>

            <PlannerDateFields
              tripName={tripName}
              departure={departure}
              startDate={startDate}
              endDate={endDate}
              dayCount={requirement.days}
              manualEndDate={manualEndDate}
              dateError={dateError}
              onTripNameChange={setTripName}
              onDepartureChange={setDeparture}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onManualEndDateChange={setManualEndDate}
            />

            {buildError && (
              <article className="surface-error rounded-[var(--app-radius-lg)] border border-[color:rgba(187,85,75,0.35)] px-4 py-3 text-sm text-[var(--app-error)]">
                {buildError}
              </article>
            )}
          </section>
        )}

        {currentStep === 5 && generatedPlan && (
          <section className="space-y-4">
            <ItinerarySummary plan={generatedPlan} />

            <AppCard tone="elevated" padding="md" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">阅读章节</h4>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    当前阅读：第{activeResultDay?.day || 1}天
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditMode((prev) => !prev)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {isEditMode ? "退出编辑" : "进入编辑"}
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleOptimizeCurrentDay()}
                    disabled={isOptimizing}
                  >
                    <RefreshCcw className={cn("h-3.5 w-3.5", isOptimizing && "animate-spin")} />
                    {isOptimizing ? "优化中" : "优化当天"}
                  </AppButton>
                  <AppButton type="button" variant="secondary" size="sm" onClick={() => setShareSheetOpen(true)}>
                    <Share2 className="h-3.5 w-3.5" />
                    分享摘要
                  </AppButton>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {resultDays.map((day, index) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => {
                      handleResultDayChange(index)
                      setFeedbackDay(day.day)
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      index === activeResultDayIndex
                        ? "border-[var(--app-brand)] bg-[var(--app-brand)] text-white"
                        : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
                    )}
                  >
                    第{day.day}天
                  </button>
                ))}
              </div>
            </AppCard>

            {activeResultDay && (
              <>
                <ResultDayHeader day={activeResultDay} />
                <DayRouteMap
                  days={resultDays}
                  activeDayIndex={activeResultDayIndex}
                  onDayChange={handleResultDayChange}
                  showDayTabs={false}
                  highlightedSpotId={activeMapSpotId}
                  highlightedLegId={activeMapLegId}
                  onSpotSelect={handleMapSpotSelect}
                  onLegSelect={handleMapLegSelect}
                  onModeChange={(mode) => {
                    setActiveRouteMode(mode)
                    setActiveMapLegId(null)
                    if (activeResultDay) {
                      setMapRouteLegOverrides((prev) => ({
                        ...prev,
                        [activeResultDay.day]: [],
                      }))
                    }
                  }}
                  onRouteLegsChange={({ dayIndex, mode, legs }) => {
                    const day = resultDays[dayIndex]
                    if (!day) return
                    setMapRouteLegOverrides((prev) => ({
                      ...prev,
                      [day.day]: buildDisplayRouteLegsForDay(day, mode, legs),
                    }))
                  }}
                />
                <DailyRouteCard
                  day={activeResultDay}
                  showDayHeader={false}
                  highlightedSpotId={activeMapSpotId}
                  highlightedLegId={activeMapLegId}
                  onSpotClick={(spotId) => {
                    setActiveMapSpotId(spotId)
                    setActiveMapLegId(null)
                  }}
                  onLegClick={(legId) => setActiveMapLegId(legId)}
                  domIdPrefix={`result-day-${activeResultDay.day}`}
                  routeLegsOverride={activeRouteLegsOverride}
                  displayMode={activeRouteMode}
                  editable={isEditMode}
                  lockedSpotIds={generatedPlan.lockedSpotIds || []}
                  onMoveSpot={(spotId, direction) => {
                    void handleMoveSpot(spotId, direction)
                  }}
                  onReplaceSpot={(spotId) => {
                    setActiveEditSpotId(spotId)
                    setReplaceSpotSheetOpen(true)
                  }}
                  onToggleSpotLock={handleToggleSpotLock}
                  onReplaceMeal={(mealType) => {
                    setActiveMealType(mealType)
                    setReplaceFoodSheetOpen(true)
                  }}
                  onReplaceHotel={() => setReplaceHotelSheetOpen(true)}
                  onOptimizeDay={() => void handleOptimizeCurrentDay()}
                />
                <ResultBudgetSummary day={activeResultDay} />
              </>
            )}

            <details className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--app-text-primary)]">
                查看诊断与质量评分（辅助信息）
              </summary>
              <div className="mt-3">
                <ResultDiagnosticsPanel
                  validationResult={generatedPlan.validationResult}
                  qualityScore={generatedPlan.qualityScore}
                  notices={generationNotices}
                  onAutoOptimize={() => void handleOptimizeCurrentDay()}
                />
              </div>
            </details>

            <details className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--app-text-strong)]">
                反馈并局部优化
              </summary>
              <div className="mt-3">
                <p className="text-xs text-[var(--app-text-secondary)]">
                  你的反馈会触发当天或局部模块的优化，而不是整份方案重来。
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { value: "satisfied", label: "满意" },
                    { value: "neutral", label: "一般" },
                    { value: "unsatisfied", label: "不满意" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFeedbackSentiment(item.value as PlanFeedbackSentiment)}
                      className={cn(
                        "rounded-[var(--app-radius-sm)] border px-2 py-2 text-xs",
                        feedbackSentiment === item.value
                          ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                          : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { id: "dislike_restaurant", label: "餐厅不喜欢" },
                    { id: "dislike_hotel", label: "酒店不合适" },
                    { id: "day_too_tight", label: "当天太赶" },
                    { id: "day_too_loose", label: "当天太松" },
                    { id: "lower_budget", label: "更省钱" },
                    { id: "more_food", label: "更多美食" },
                    { id: "more_relaxed", label: "更轻松" },
                    { id: "refresh_route", label: "重排路线" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleFeedbackTag(item.id as PlanFeedbackTag)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        feedbackTags.includes(item.id as PlanFeedbackTag)
                          ? "bg-[var(--app-brand)] text-white"
                          : "bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <AppInput
                    value={feedbackComment}
                    onChange={(event) => setFeedbackComment(event.target.value)}
                    placeholder="可选：补充你的反馈细节"
                    tone="subtle"
                  />
                </div>
                <AppButton
                  type="button"
                  className="mt-2"
                  variant="secondary"
                  onClick={() => void handleSubmitFeedback()}
                  disabled={feedbackTags.length === 0}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  提交反馈并局部优化
                </AppButton>
              </div>
            </details>

            <div className="grid grid-cols-3 gap-2">
              <AppButton
                type="button"
                onClick={() => setCurrentStep(4)}
                variant="secondary"
                size="lg"
              >
                返回调整
              </AppButton>
              <AppButton type="button" onClick={handleSavePlan} size="lg">
                <Save className="h-4 w-4" />
                保存方案
              </AppButton>
              <AppButton type="button" variant="secondary" size="lg" onClick={() => setShareSheetOpen(true)}>
                <Share2 className="h-4 w-4" />
                分享
              </AppButton>
            </div>
            <AppButton
              type="button"
              onClick={() => onNavigate("trips")}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              返回行程清单
            </AppButton>
          </section>
        )}

        {currentStep !== 5 && (
          <AppCard tone="elevated" padding="sm">
            <div className="flex items-center justify-between gap-2">
              <AppButton
                type="button"
                onClick={() => {
                  closeActiveField()
                  setCurrentStep((prev) => Math.max(1, prev - 1))
                }}
                disabled={currentStep === 1 || isGenerating}
                variant="secondary"
                size="md"
              >
                <ArrowLeft className="h-4 w-4" />
                上一步
              </AppButton>
              <AppButton
                type="button"
                onClick={handleNext}
                disabled={!canGoNext || isGenerating}
                size="md"
              >
                {currentStep === 4 ? (
                  isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在生成方案...
                    </>
                  ) : (
                    <>
                      生成专属行程
                      <Sparkles className="h-4 w-4" />
                    </>
                  )
                ) : (
                  <>
                    下一步
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </AppButton>
            </div>
          </AppCard>
        )}

        {currentStep !== 5 && (
          <PlannerSummaryBar
            requirement={requirement}
            selectedPois={selectedPois}
            actionText={currentStep === 3 ? "跳过并继续" : undefined}
            onAction={currentStep === 3 ? handleSkipStepThree : undefined}
            disabled={isGenerating}
          />
        )}
      </div>

      <PlannerConflictDialog
        open={Boolean(pendingCity)}
        targetCity={pendingCity?.city || requirement.city}
        mismatched={pendingCity?.mismatched || []}
        onKeepMatched={() => {
          if (!pendingCity) return
          setSelectedPois((prev) =>
            filterSpotsByCity(prev, pendingCity.city, pendingCity.province)
          )
          setRequirement((prev) => ({
            ...prev,
            province: pendingCity.province,
            city: pendingCity.city,
            cityTagline: pendingCity.cityTagline,
          }))
          setPendingCity(null)
        }}
        onClearAll={() => {
          if (!pendingCity) return
          setSelectedPois([])
          setRequirement((prev) => ({
            ...prev,
            province: pendingCity.province,
            city: pendingCity.city,
            cityTagline: pendingCity.cityTagline,
          }))
          setPendingCity(null)
        }}
        onBackToEdit={() => setPendingCity(null)}
      />

      <ReplacePlaceSheet
        open={replaceSpotSheetOpen}
        onClose={() => setReplaceSpotSheetOpen(false)}
        candidates={replaceSpotCandidates}
        currentName={activeResultDay?.spots.find((spot) => spot.id === activeEditSpotId)?.name}
        locked={Boolean(activeEditSpotId && (generatedPlan?.lockedSpotIds || []).includes(activeEditSpotId))}
        onReplace={(candidate) => {
          void handleReplaceSpotCandidate(candidate)
        }}
      />

      <ReplaceFoodSheet
        open={replaceFoodSheetOpen}
        onClose={() => setReplaceFoodSheetOpen(false)}
        mealType={activeMealType}
        candidates={replaceFoodCandidates}
        onReplace={handleReplaceMealCandidate}
      />

      <ReplaceHotelSheet
        open={replaceHotelSheetOpen}
        onClose={() => setReplaceHotelSheetOpen(false)}
        candidates={replaceHotelCandidates}
        onReplace={handleReplaceHotelCandidate}
      />

      <MobileSheet
        open={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        title="分享摘要"
        description="用于复制展示给同伴，不会泄露隐私设置。"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--app-text-strong)]">
            {shareSummary?.title || generatedPlan?.name}
          </p>
          <p className="text-xs text-[var(--app-text-secondary)]">
            {shareSummary?.destination || "北京"} · {shareSummary?.dayCount || 0} 天 ·{" "}
            {shareSummary?.totalSpots || 0} 个点位
          </p>
          <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)] whitespace-pre-wrap">
            {shareSummary ? toShareSummaryText(shareSummary) : ""}
          </div>
          <AppButton type="button" className="w-full" onClick={() => void handleShareSummary()}>
            <Share2 className="h-4 w-4" />
            复制摘要
          </AppButton>
        </div>
      </MobileSheet>

      {showSaveSuccess && (
        <div className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-[var(--app-radius-sm)] bg-[var(--app-text-strong)] px-4 py-2 text-sm text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4" />
          行程已保存
        </div>
      )}
      {shareFeedback && (
        <div className="fixed left-1/2 top-32 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-[var(--app-radius-sm)] bg-[var(--app-text-strong)] px-4 py-2 text-sm text-white shadow-lg">
          {shareFeedback}
        </div>
      )}
    </div>
  )
}
