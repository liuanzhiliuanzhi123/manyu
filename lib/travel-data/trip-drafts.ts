import { getTravelDataSupabaseContext } from "@/lib/travel-data/session"
import type {
  TravelDataResult,
  TravelDraftPayload,
} from "@/lib/travel-data/mappers"
import type { Json, TripDraft, TripDraftInsert } from "@/lib/supabase/types"

const LOCAL_TRIP_DRAFT_KEY = "travel-assistant:beijing:trip-draft:v1"

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json
}

function readLocalTripDraft(): TripDraft | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(LOCAL_TRIP_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TripDraft
  } catch {
    return null
  }
}

function writeLocalTripDraft(draft: TripDraft) {
  if (!isBrowser()) return
  window.localStorage.setItem(LOCAL_TRIP_DRAFT_KEY, JSON.stringify(draft))
}

function removeLocalTripDraft() {
  if (!isBrowser()) return
  window.localStorage.removeItem(LOCAL_TRIP_DRAFT_KEY)
}

function toDraftInsert(input: TravelDraftPayload, userId: string): TripDraftInsert {
  return {
    id: input.id,
    user_id: userId,
    city: input.city || "北京",
    title: input.title || "北京智能行程草稿",
    status: "draft",
    days: input.days ?? input.currentPlan?.totalDays ?? input.currentPlan?.days?.length ?? null,
    pace: input.pace ?? input.currentPlan?.pace ?? null,
    preferences:
      input.preferences ??
      input.currentPlan?.requirement?.interests ??
      [],
    selected_place_ids: [],
    draft_data:
      input.draftData ??
      toJson({
        selectedSpots: input.selectedSpots || [],
        currentPlan: input.currentPlan || null,
      }),
  }
}

function toLocalTripDraft(input: TravelDraftPayload): TripDraft {
  const now = new Date().toISOString()
  return {
    id: input.id || "local-trip-draft",
    user_id: "local",
    city: input.city || "北京",
    title: input.title || "北京智能行程草稿",
    status: "draft",
    days: input.days ?? input.currentPlan?.totalDays ?? input.currentPlan?.days?.length ?? null,
    budget_min: null,
    budget_max: null,
    pace: input.pace ?? input.currentPlan?.pace ?? null,
    preferences:
      input.preferences ??
      input.currentPlan?.requirement?.interests ??
      [],
    selected_place_ids: [],
    draft_data:
      input.draftData ??
      toJson({
        selectedSpots: input.selectedSpots || [],
        currentPlan: input.currentPlan || null,
      }),
    created_at: now,
    updated_at: now,
  }
}

export async function getLatestTripDraft(): Promise<TravelDataResult<TripDraft | null>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { data, error } = await context.client
        .from("trip_drafts")
        .select("*")
        .eq("user_id", context.user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return {
        data,
        source: "supabase",
      }
    }

    return {
      data: readLocalTripDraft(),
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    return {
      data: readLocalTripDraft(),
      source: "local",
      error: error instanceof Error ? error.message : "Failed to load trip draft.",
    }
  }
}

export async function upsertTripDraft(
  draft: TravelDraftPayload
): Promise<TravelDataResult<TripDraft | null>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const latest = draft.id ? null : await getLatestTripDraft()
      const latestId =
        latest?.source === "supabase" && latest.data?.id ? latest.data.id : undefined
      const payload = toDraftInsert(
        {
          ...draft,
          id: draft.id || latestId,
        },
        context.user.id
      )
      const { data, error } = await context.client
        .from("trip_drafts")
        .upsert(payload)
        .select("*")
        .single()

      if (error) throw error
      return {
        data,
        source: "supabase",
      }
    }

    const localDraft = toLocalTripDraft(draft)
    writeLocalTripDraft(localDraft)
    return {
      data: localDraft,
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    const localDraft = toLocalTripDraft(draft)
    writeLocalTripDraft(localDraft)
    return {
      data: localDraft,
      source: "local",
      error: error instanceof Error ? error.message : "Failed to save trip draft.",
    }
  }
}

export async function clearTripDraft(): Promise<TravelDataResult<boolean>> {
  try {
    const context = await getTravelDataSupabaseContext()
    if (context.available) {
      const { error } = await context.client
        .from("trip_drafts")
        .delete()
        .eq("user_id", context.user.id)
        .eq("status", "draft")

      if (error) throw error
      return {
        data: true,
        source: "supabase",
      }
    }

    removeLocalTripDraft()
    return {
      data: true,
      source: "local",
      error: context.reason,
    }
  } catch (error) {
    removeLocalTripDraft()
    return {
      data: true,
      source: "local",
      error: error instanceof Error ? error.message : "Failed to clear trip draft.",
    }
  }
}
