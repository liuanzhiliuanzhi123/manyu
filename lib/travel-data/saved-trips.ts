import {
  loadSavedPlansFromStorage,
  persistSavedPlansToStorage,
} from "@/lib/plan-persistence"
import { getTravelDataSupabaseContext } from "@/lib/travel-data/session"
import {
  isUuid,
  mapSavedTripToTravelPlan,
  mapTravelPlanToSavedTrip,
  type TravelDataResult,
} from "@/lib/travel-data/mappers"
import type { Json, SavedTrip, SavedTripUpdate, TripDay } from "@/lib/supabase/types"
import type { TripPlan } from "@/lib/travel-context"

function getPlanDataRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isMatchingLocalTrip(row: SavedTrip, plan: TripPlan) {
  const planData = getPlanDataRecord(row.plan_data)
  const localId = toText(planData.id)
  const localCreatedAt = toText(planData.createdAt)
  const planId = toText(plan.id)
  const planCreatedAt = toText(plan.createdAt)

  if (planId && localId && planId === localId) return true
  return Boolean(
    row.title === plan.name &&
      planCreatedAt &&
      localCreatedAt &&
      planCreatedAt === localCreatedAt
  )
}

function upsertLocalSavedTrip(plan: TripPlan) {
  const plans = loadSavedPlansFromStorage()
  const index = plans.findIndex((item) => item.id === plan.id)
  const next =
    index < 0
      ? [plan, ...plans]
      : plans.map((item) => (item.id === plan.id ? plan : item))
  persistSavedPlansToStorage(next)
  return plan
}

function deleteLocalSavedTrip(id: string) {
  const next = loadSavedPlansFromStorage().filter((plan) => plan.id !== id)
  persistSavedPlansToStorage(next)
  return true
}

export async function listSavedTrips(): Promise<TravelDataResult<TripPlan[]>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { data, error } = await context.client
        .from("saved_trips")
        .select("*")
        .eq("user_id", context.user.id)
        .order("updated_at", { ascending: false })

      if (error) throw error
      return {
        data: (data || []).map((trip) => mapSavedTripToTravelPlan(trip)),
        source: "supabase",
      }
    }

    return {
      data: loadSavedPlansFromStorage(),
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    return {
      data: loadSavedPlansFromStorage(),
      source: "local",
      error: error instanceof Error ? error.message : "Failed to list saved trips.",
    }
  }
}

export async function getSavedTripById(
  id: string
): Promise<TravelDataResult<TripPlan | null>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { data, error } = await context.client
        .from("saved_trips")
        .select("*")
        .eq("user_id", context.user.id)
        .eq("id", id)
        .maybeSingle()

      if (error) throw error
      return {
        data: data ? mapSavedTripToTravelPlan(data) : null,
        source: "supabase",
      }
    }

    return {
      data: loadSavedPlansFromStorage().find((plan) => plan.id === id) || null,
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    return {
      data: loadSavedPlansFromStorage().find((plan) => plan.id === id) || null,
      source: "local",
      error: error instanceof Error ? error.message : "Failed to load saved trip.",
    }
  }
}

export async function saveTrip(plan: TripPlan): Promise<TravelDataResult<TripPlan>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      let existingTripId: string | undefined
      if (!isUuid(plan.id)) {
        const { data: existingTrips, error: existingError } = await context.client
          .from("saved_trips")
          .select("*")
          .eq("user_id", context.user.id)
          .order("updated_at", { ascending: false })

        if (existingError) throw existingError
        existingTripId = (existingTrips || []).find((trip) =>
          isMatchingLocalTrip(trip as SavedTrip, plan)
        )?.id
      }

      const mapped = mapTravelPlanToSavedTrip(plan, context.user.id, existingTripId)
      const savedTripPayload = {
        ...mapped.savedTrip,
        id: isUuid(mapped.savedTrip.id) ? mapped.savedTrip.id : undefined,
      }
      const { data: trip, error: tripError } = await context.client
        .from("saved_trips")
        .upsert(savedTripPayload)
        .select("*")
        .single()

      if (tripError) throw tripError
      if (!trip) throw new Error("Saved trip was not returned.")

      await context.client.from("trip_items").delete().eq("trip_id", trip.id)
      await context.client.from("trip_days").delete().eq("trip_id", trip.id)

      const dayRows = mapped.tripDays.map(({ clientDayIndex: _clientDayIndex, ...day }) => ({
        ...day,
        trip_id: trip.id,
        user_id: context.user.id,
      }))
      const insertedDays: TripDay[] = []
      if (dayRows.length > 0) {
        const { data, error } = await context.client
          .from("trip_days")
          .insert(dayRows)
          .select("*")
        if (error) throw error
        insertedDays.push(...(data || []))
      }

      const dayIdByIndex = new Map(
        insertedDays.map((day) => [day.day_index, day.id])
      )
      const itemRows = mapped.tripItems.map(({ clientDayIndex, ...item }) => ({
        ...item,
        trip_id: trip.id,
        user_id: context.user.id,
        day_id: dayIdByIndex.get(clientDayIndex) || null,
      }))
      if (itemRows.length > 0) {
        const { error } = await context.client.from("trip_items").insert(itemRows)
        if (error) throw error
      }

      return {
        data: mapSavedTripToTravelPlan(trip as SavedTrip, insertedDays),
        source: "supabase",
      }
    }

    return {
      data: upsertLocalSavedTrip(plan),
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    return {
      data: upsertLocalSavedTrip(plan),
      source: "local",
      error: error instanceof Error ? error.message : "Failed to save trip.",
    }
  }
}

export async function updateSavedTrip(
  id: string,
  patch: Partial<TripPlan>
): Promise<TravelDataResult<TripPlan | null>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available && isUuid(id)) {
      const update: SavedTripUpdate = {
        title: patch.name,
        start_date: patch.startDate || undefined,
        end_date: patch.endDate || undefined,
        days: patch.totalDays,
        budget:
          typeof patch.totalEstimatedCost === "number"
            ? Math.round(patch.totalEstimatedCost)
            : undefined,
        plan_data: patch as unknown as Json,
      }
      const { data, error } = await context.client
        .from("saved_trips")
        .update(update)
        .eq("user_id", context.user.id)
        .eq("id", id)
        .select("*")
        .maybeSingle()

      if (error) throw error
      return {
        data: data ? mapSavedTripToTravelPlan(data) : null,
        source: "supabase",
      }
    }

    const plans = loadSavedPlansFromStorage()
    const existing = plans.find((plan) => plan.id === id)
    if (!existing) {
      return {
        data: null,
        source: "local",
        error: context.available ? undefined : context.reason,
      }
    }
    const updated = upsertLocalSavedTrip({ ...existing, ...patch })
    return {
      data: updated,
      source: "local",
      error: context.available ? undefined : context.reason,
    }
  } catch (error) {
    const plans = loadSavedPlansFromStorage()
    const existing = plans.find((plan) => plan.id === id)
    const updated = existing ? upsertLocalSavedTrip({ ...existing, ...patch }) : null
    return {
      data: updated,
      source: "local",
      error: error instanceof Error ? error.message : "Failed to update saved trip.",
    }
  }
}

export async function deleteSavedTrip(id: string): Promise<TravelDataResult<boolean>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available && isUuid(id)) {
      const { error } = await context.client
        .from("saved_trips")
        .delete()
        .eq("user_id", context.user.id)
        .eq("id", id)

      if (error) throw error
      return {
        data: true,
        source: "supabase",
      }
    }

    return {
      data: deleteLocalSavedTrip(id),
      source: "local",
      error: context.available ? undefined : context.reason,
    }
  } catch (error) {
    return {
      data: deleteLocalSavedTrip(id),
      source: "local",
      error: error instanceof Error ? error.message : "Failed to delete saved trip.",
    }
  }
}
