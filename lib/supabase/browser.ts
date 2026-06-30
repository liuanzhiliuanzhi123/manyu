"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

let browserClient: SupabaseClient<Database> | null = null

export function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ""
  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  }
}

export function createSupabaseBrowserClient():
  | { available: true; client: SupabaseClient<Database> }
  | { available: false; reason: string } {
  const config = getSupabaseBrowserConfig()
  if (!config.configured) {
    return {
      available: false,
      reason: "Supabase browser environment variables are not configured.",
    }
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(config.url, config.anonKey)
  }

  return {
    available: true,
    client: browserClient,
  }
}

export async function getCurrentSupabaseUser(): Promise<User | null> {
  const supabase = createSupabaseBrowserClient()
  if (!supabase.available) return null

  const { data, error } = await supabase.client.auth.getUser()
  if (error) return null
  return data.user
}
