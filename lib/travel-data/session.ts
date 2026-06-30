import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function getTravelDataSupabaseContext() {
  const supabase = createSupabaseBrowserClient()
  if (!supabase.available) {
    return {
      available: false as const,
      reason: supabase.reason,
    }
  }

  const { data, error } = await supabase.client.auth.getUser()
  if (error || !data.user) {
    return {
      available: false as const,
      reason: "No active Supabase session.",
    }
  }

  return {
    available: true as const,
    client: supabase.client as SupabaseClient,
    user: data.user,
  }
}
