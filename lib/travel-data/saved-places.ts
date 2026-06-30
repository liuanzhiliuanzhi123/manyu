import { getTravelDataSupabaseContext } from "@/lib/travel-data/session"
import {
  mapSavedPlaceToTravelPlace,
  mapTravelPlaceToSavedPlace,
  type TravelDataResult,
} from "@/lib/travel-data/mappers"
import type { Spot } from "@/lib/travel-context"

const LOCAL_SAVED_PLACES_KEY = "travel-assistant:beijing:saved-places:v1"

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readLocalSavedPlaces(): Spot[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(LOCAL_SAVED_PLACES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Spot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeLocalSavedPlaces(places: Spot[]) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(LOCAL_SAVED_PLACES_KEY, JSON.stringify(places))
  } catch {
    // Local guest data is best-effort and must not break the page.
  }
}

function upsertLocalSavedPlace(place: Spot) {
  const places = readLocalSavedPlaces()
  const index = places.findIndex((item) => item.id === place.id)
  if (index < 0) {
    const next = [place, ...places]
    writeLocalSavedPlaces(next)
    return next
  }
  const next = [...places]
  next[index] = place
  writeLocalSavedPlaces(next)
  return next
}

function removeLocalSavedPlace(placeId: string) {
  const next = readLocalSavedPlaces().filter((item) => item.id !== placeId)
  writeLocalSavedPlaces(next)
  return next
}

export async function listSavedPlaces(): Promise<TravelDataResult<Spot[]>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { data, error } = await context.client
        .from("saved_places")
        .select("*")
        .eq("user_id", context.user.id)
        .order("updated_at", { ascending: false })

      if (error) throw error
      return {
        data: (data || []).map(mapSavedPlaceToTravelPlace),
        source: "supabase",
      }
    }

    return {
      data: readLocalSavedPlaces(),
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    return {
      data: readLocalSavedPlaces(),
      source: "local",
      error: error instanceof Error ? error.message : "Failed to list saved places.",
    }
  }
}

export async function upsertSavedPlace(place: Spot): Promise<TravelDataResult<Spot>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const payload = mapTravelPlaceToSavedPlace(place, context.user.id)
      const { data, error } = await context.client
        .from("saved_places")
        .upsert(payload, { onConflict: "user_id,place_id" })
        .select("*")
        .single()

      if (error) throw error
      return {
        data: mapSavedPlaceToTravelPlace(data),
        source: "supabase",
      }
    }

    upsertLocalSavedPlace(place)
    return {
      data: place,
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    upsertLocalSavedPlace(place)
    return {
      data: place,
      source: "local",
      error: error instanceof Error ? error.message : "Failed to upsert saved place.",
    }
  }
}

export async function addSavedPlace(place: Spot): Promise<TravelDataResult<Spot>> {
  return upsertSavedPlace(place)
}

export async function removeSavedPlace(placeId: string): Promise<TravelDataResult<boolean>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { error } = await context.client
        .from("saved_places")
        .delete()
        .eq("user_id", context.user.id)
        .eq("place_id", placeId)

      if (error) throw error
      return {
        data: true,
        source: "supabase",
      }
    }

    removeLocalSavedPlace(placeId)
    return {
      data: true,
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    removeLocalSavedPlace(placeId)
    return {
      data: true,
      source: "local",
      error: error instanceof Error ? error.message : "Failed to remove saved place.",
    }
  }
}

export async function isPlaceSaved(placeId: string): Promise<TravelDataResult<boolean>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { data, error } = await context.client
        .from("saved_places")
        .select("id")
        .eq("user_id", context.user.id)
        .eq("place_id", placeId)
        .maybeSingle()

      if (error) throw error
      return {
        data: Boolean(data),
        source: "supabase",
      }
    }

    return {
      data: readLocalSavedPlaces().some((place) => place.id === placeId),
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    return {
      data: readLocalSavedPlaces().some((place) => place.id === placeId),
      source: "local",
      error: error instanceof Error ? error.message : "Failed to check saved place.",
    }
  }
}
