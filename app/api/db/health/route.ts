import { NextResponse } from "next/server"
import {
  createSupabaseRouteClient,
  getSupabaseServerConfig,
} from "@/lib/supabase/server"

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Supabase health check failed"
}

export async function GET() {
  const config = getSupabaseServerConfig()
  if (!config.configured) {
    return NextResponse.json({
      ok: false,
      supabaseConfigured: false,
      canConnect: false,
    })
  }

  try {
    const supabase = await createSupabaseRouteClient()
    if (!supabase.available) {
      return NextResponse.json({
        ok: false,
        supabaseConfigured: false,
        canConnect: false,
        error: supabase.reason,
      })
    }

    const { error } = await supabase.client
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1)

    if (error) {
      return NextResponse.json({
        ok: false,
        supabaseConfigured: true,
        canConnect: false,
        error: error.message,
      })
    }

    return NextResponse.json({
      ok: true,
      supabaseConfigured: true,
      canConnect: true,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      supabaseConfigured: true,
      canConnect: false,
      error: safeErrorMessage(error),
    })
  }
}
