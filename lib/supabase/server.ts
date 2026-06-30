import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

export function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ""
  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  }
}

export async function createSupabaseRouteClient(): Promise<
  | { available: true; client: SupabaseClient<Database> }
  | { available: false; reason: string }
> {
  const config = getSupabaseServerConfig()
  if (!config.configured) {
    return {
      available: false,
      reason: "Supabase server environment variables are not configured.",
    }
  }

  const cookieStore = await cookies()
  const client = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Route handlers can set cookies; static server contexts may not.
        }
      },
    },
  })

  return {
    available: true,
    client,
  }
}
