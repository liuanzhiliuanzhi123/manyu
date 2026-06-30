import { loadSavedPlansFromStorage } from "@/lib/plan-persistence"
import type { Json, TripDraft } from "@/lib/supabase/types"
import type { Spot, TripPlan } from "@/lib/travel-context"
import {
  readLocalSavedPlaces,
  upsertSavedPlace,
} from "@/lib/travel-data/saved-places"
import { saveTrip } from "@/lib/travel-data/saved-trips"
import {
  readLocalTripDraft,
  upsertTripDraft,
} from "@/lib/travel-data/trip-drafts"
import { getTravelDataSupabaseContext } from "@/lib/travel-data/session"
import type { TravelDraftPayload } from "@/lib/travel-data/mappers"

export interface LocalTravelSnapshot {
  savedPlaces: Spot[]
  savedTrips: TripPlan[]
  tripDraft: TripDraft | null
}

export interface TravelSyncResult {
  ok: boolean
  skipped: boolean
  message: string
  synced: {
    savedPlaces: number
    savedTrips: number
    tripDrafts: number
  }
}

export function getTravelPersistenceTarget(isAuthenticated: boolean) {
  return isAuthenticated ? "supabase" : "local"
}

export function dedupeSavedPlaces(places: Spot[]) {
  const bucket = new Map<string, Spot>()
  places.forEach((place) => {
    const key = place.id || `${place.name}|${place.address}`
    if (!key || bucket.has(key)) return
    bucket.set(key, place)
  })
  return Array.from(bucket.values())
}

export function dedupeSavedTrips(plans: TripPlan[]) {
  const bucket = new Map<string, TripPlan>()
  plans.forEach((plan) => {
    const key = plan.id || `${plan.name}|${plan.createdAt}`
    if (!key || bucket.has(key)) return
    bucket.set(key, plan)
  })
  return Array.from(bucket.values())
}

function readDraftDataRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function mapLocalTripDraftToPayload(
  draft: TripDraft
): TravelDraftPayload {
  const draftData = readDraftDataRecord(draft.draft_data)
  const selectedSpots = Array.isArray(draftData.selectedSpots)
    ? (draftData.selectedSpots as Spot[])
    : []
  const currentPlan =
    draftData.currentPlan && typeof draftData.currentPlan === "object"
      ? (draftData.currentPlan as TripPlan)
      : null

  return {
    city: draft.city || "北京",
    title: draft.title || "北京智能行程草稿",
    days: draft.days,
    pace: draft.pace,
    preferences: draft.preferences || [],
    selectedSpots,
    currentPlan,
    draftData: draft.draft_data,
  }
}

export function readLocalTravelSnapshot(): LocalTravelSnapshot {
  return {
    savedPlaces: dedupeSavedPlaces(readLocalSavedPlaces()),
    savedTrips: dedupeSavedTrips(loadSavedPlansFromStorage()),
    tripDraft: readLocalTripDraft(),
  }
}

export async function syncLocalTravelDataToSupabase(): Promise<TravelSyncResult> {
  const context = await getTravelDataSupabaseContext()
  if (!context.available) {
    return {
      ok: false,
      skipped: true,
      message: "云端同步暂时失败，本地数据已保留",
      synced: { savedPlaces: 0, savedTrips: 0, tripDrafts: 0 },
    }
  }

  const snapshot = readLocalTravelSnapshot()
  if (
    snapshot.savedPlaces.length === 0 &&
    snapshot.savedTrips.length === 0 &&
    !snapshot.tripDraft
  ) {
    return {
      ok: true,
      skipped: true,
      message: "",
      synced: { savedPlaces: 0, savedTrips: 0, tripDrafts: 0 },
    }
  }

  const synced = { savedPlaces: 0, savedTrips: 0, tripDrafts: 0 }
  let failed = false

  for (const place of snapshot.savedPlaces) {
    const result = await upsertSavedPlace(place)
    if (result.source !== "supabase") {
      failed = true
    } else {
      synced.savedPlaces += 1
    }
  }

  for (const plan of snapshot.savedTrips) {
    const result = await saveTrip(plan)
    if (result.source !== "supabase") {
      failed = true
    } else {
      synced.savedTrips += 1
    }
  }

  if (snapshot.tripDraft) {
    const result = await upsertTripDraft(mapLocalTripDraftToPayload(snapshot.tripDraft))
    if (result.source !== "supabase") {
      failed = true
    } else {
      synced.tripDrafts += 1
    }
  }

  if (failed) {
    return {
      ok: false,
      skipped: false,
      message: "云端同步暂时失败，本地数据已保留",
      synced,
    }
  }

  return {
    ok: true,
    skipped: false,
    message: "已同步本地行程数据",
    synced,
  }
}
