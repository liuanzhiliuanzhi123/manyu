import type {
  BeijingPlaceType,
  Json,
  SavedPlace,
  SavedPlaceInsert,
  SavedTrip,
  SavedTripInsert,
  TripDay,
  TripDayInsert,
  TripItem,
  TripItemInsert,
  TripItemType,
} from "@/lib/supabase/types"
import type {
  ItineraryDay,
  RouteTransportMode,
  Spot,
  TravelLeg,
  TripPlan,
} from "@/lib/travel-context"

export type TravelDataSource = "supabase" | "local"

export interface TravelDataResult<T> {
  data: T
  source: TravelDataSource
  error?: string
}

export interface TravelDraftPayload {
  id?: string
  city?: string
  title?: string
  days?: number | null
  pace?: string | null
  preferences?: string[]
  selectedSpots?: Spot[]
  currentPlan?: TripPlan | null
  draftData?: Json
}

export interface MappedSavedTripPayload {
  savedTrip: SavedTripInsert
  tripDays: Array<TripDayInsert & { clientDayIndex: number }>
  tripItems: Array<TripItemInsert & { clientDayIndex: number }>
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizeDate(value?: string | null) {
  const text = value?.trim()
  if (!text) return null
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null
}

function addDays(dateText: string | null, dayOffset: number) {
  if (!dateText) return null
  const date = new Date(`${dateText}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

export function isUuid(value?: string | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        value
      )
  )
}

export function mapSpotTypeToSavedPlaceType(type: Spot["type"]): BeijingPlaceType {
  if (type === "restaurant") return "food"
  if (type === "hotel") return "hotel"
  return "scenic"
}

export function mapSavedPlaceTypeToSpotType(type: BeijingPlaceType): Spot["type"] {
  if (type === "food") return "restaurant"
  if (type === "hotel") return "hotel"
  return "attraction"
}

export function mapSpotTypeToTripItemType(type: Spot["type"]): TripItemType {
  if (type === "restaurant") return "food"
  if (type === "hotel") return "hotel"
  return "scenic"
}

export function mapTravelPlaceToSavedPlace(
  place: Spot,
  userId: string
): SavedPlaceInsert {
  const lng = toFiniteNumber(place.lng ?? place.longitude)
  const lat = toFiniteNumber(place.lat ?? place.latitude)
  const price = toFiniteNumber(place.ticketPrice)
  const rating = toFiniteNumber(place.rating)

  return {
    user_id: userId,
    place_id: place.id,
    name: place.name,
    city: place.city || "北京",
    type: mapSpotTypeToSavedPlaceType(place.type),
    address: place.address || null,
    district: place.district || null,
    lat,
    lng,
    image_url: place.image || null,
    source: place.source || null,
    tags: place.tags || [],
    rating,
    price,
    duration_minutes: place.suggestedDurationMinutes ?? null,
    raw: toJson(place),
  }
}

export function mapSavedPlaceToTravelPlace(place: SavedPlace): Spot {
  const raw = place.raw && typeof place.raw === "object" ? (place.raw as Partial<Spot>) : {}

  return {
    id: place.place_id || place.id,
    name: place.name,
    type: mapSavedPlaceTypeToSpotType(place.type),
    address: place.address || raw.address || "",
    rating: Number(place.rating ?? raw.rating ?? 4.5),
    heat: Number(raw.heat ?? 70),
    ticketPrice: Number(place.price ?? raw.ticketPrice ?? 0),
    description: raw.description || "北京地点",
    image: place.image_url || raw.image || "/images/placeholders/poi-default.jpg",
    tags: place.tags || raw.tags || [],
    openTime: raw.openTime,
    phone: raw.phone,
    province: raw.province || "北京",
    city: place.city || raw.city || "北京",
    district: place.district || raw.district,
    lng: place.lng ?? raw.lng,
    lat: place.lat ?? raw.lat,
    longitude: place.lng ?? raw.longitude,
    latitude: place.lat ?? raw.latitude,
    location: raw.location,
    coordinates: raw.coordinates,
    suggestedDurationMinutes: place.duration_minutes ?? raw.suggestedDurationMinutes,
    suggestedDurationText: raw.suggestedDurationText,
    source: place.source || raw.source,
    imageConfidence: raw.imageConfidence,
    plannerReason: raw.plannerReason,
  }
}

function mapTripDay(
  day: ItineraryDay,
  plan: TripPlan,
  userId: string,
  tripId: string
): TripDayInsert & { clientDayIndex: number } {
  const dayIndex = Math.max(1, day.day)
  return {
    trip_id: tripId,
    user_id: userId,
    day_index: dayIndex,
    date: addDays(normalizeDate(plan.startDate), dayIndex - 1),
    title: day.title,
    summary: day.districtSummary || day.theme || null,
    weather: toJson(day.weather ?? {}),
    clientDayIndex: dayIndex,
  }
}

function mapSpotToTripItem(
  spot: Spot,
  plan: TripPlan,
  userId: string,
  tripId: string,
  dayIndex: number,
  itemIndex: number
): TripItemInsert & { clientDayIndex: number } {
  return {
    trip_id: tripId,
    user_id: userId,
    item_index: itemIndex,
    item_type: mapSpotTypeToTripItemType(spot.type),
    place_id: spot.id,
    name: spot.name,
    city: spot.city || plan.requirement?.city || "北京",
    address: spot.address || null,
    district: spot.district || null,
    lat: toFiniteNumber(spot.lat ?? spot.latitude),
    lng: toFiniteNumber(spot.lng ?? spot.longitude),
    start_time: spot.arrivalTime || null,
    end_time: spot.leaveTime || null,
    duration_minutes: spot.suggestedDurationMinutes ?? null,
    image_url: spot.image || null,
    notes: spot.plannerReason || null,
    raw: toJson(spot),
    clientDayIndex: dayIndex,
  }
}

function mapLegToTripItem(
  leg: TravelLeg,
  userId: string,
  tripId: string,
  dayIndex: number,
  itemIndex: number
): TripItemInsert & { clientDayIndex: number } {
  return {
    trip_id: tripId,
    user_id: userId,
    item_index: itemIndex,
    item_type: "transit",
    name: `${leg.fromName} → ${leg.toName}`,
    city: "北京",
    start_time: leg.startTime || null,
    end_time: leg.arrivalTime || null,
    duration_minutes: Math.round((leg.durationSeconds || 0) / 60),
    transport_mode: leg.transportMode as RouteTransportMode,
    route_data: toJson(leg),
    notes: leg.estimateReason || leg.recommendedReason || null,
    clientDayIndex: dayIndex,
  }
}

export function mapTravelPlanToSavedTrip(
  plan: TripPlan,
  userId: string,
  tripId?: string
): MappedSavedTripPayload {
  const resolvedTripId = tripId || (isUuid(plan.id) ? plan.id : undefined)
  const days = plan.days || []
  const savedTrip: SavedTripInsert = {
    id: resolvedTripId,
    user_id: userId,
    city: plan.requirement?.city || "北京",
    title: plan.name || "北京智能行程",
    start_date: normalizeDate(plan.startDate),
    end_date: normalizeDate(plan.endDate),
    days: plan.totalDays || days.length || 1,
    budget: plan.totalEstimatedCost ? Math.round(plan.totalEstimatedCost) : null,
    score: null,
    status: "saved",
    cover_image_url: plan.spots[0]?.image || days[0]?.spots[0]?.image || null,
    summary: plan.shareSummary?.highlights?.join(" / ") || null,
    weather_summary: toJson(plan.weatherSummary ?? {}),
    preferences: plan.requirement?.interests || [],
    plan_data: toJson(plan),
  }

  const tripDays = days.map((day) =>
    mapTripDay(day, plan, userId, resolvedTripId || "00000000-0000-0000-0000-000000000000")
  )
  const tripItems = days.flatMap((day) => {
    const dayIndex = Math.max(1, day.day)
    let itemIndex = 0
    const spotItems = day.spots.map((spot) =>
      mapSpotToTripItem(
        spot,
        plan,
        userId,
        resolvedTripId || "00000000-0000-0000-0000-000000000000",
        dayIndex,
        itemIndex++
      )
    )
    const legItems = day.routeLegs.map((leg) =>
      mapLegToTripItem(
        leg,
        userId,
        resolvedTripId || "00000000-0000-0000-0000-000000000000",
        dayIndex,
        itemIndex++
      )
    )
    return [...spotItems, ...legItems]
  })

  return {
    savedTrip,
    tripDays,
    tripItems,
  }
}

export function mapSavedTripToTravelPlan(
  trip: SavedTrip,
  _days: TripDay[] = [],
  _items: TripItem[] = []
): TripPlan {
  const planData =
    trip.plan_data && typeof trip.plan_data === "object" && !Array.isArray(trip.plan_data)
      ? (trip.plan_data as unknown as Partial<TripPlan>)
      : {}

  return {
    ...planData,
    id: trip.id,
    name: trip.title || planData.name || "北京智能行程",
    startDate: trip.start_date || planData.startDate || "",
    endDate: trip.end_date || planData.endDate || "",
    pace: planData.pace || "balanced",
    departure: planData.departure || "",
    spots: planData.spots || [],
    createdAt: trip.created_at || planData.createdAt || new Date().toISOString(),
    totalDays: trip.days || planData.totalDays,
    totalEstimatedCost: Number(trip.budget ?? planData.totalEstimatedCost ?? 0),
    weatherSummary: planData.weatherSummary,
    lastEditedAt: trip.updated_at,
  }
}
