import { NextResponse, type NextRequest } from "next/server"
import { normalizeAuthError } from "@/lib/auth/auth-errors"
import { getSafeRelativePath } from "@/lib/auth/auth-validation"
import { createSupabaseRouteClient } from "@/lib/supabase/server"

function redirectToAuth(request: NextRequest, errorCode: string) {
  const redirectUrl = new URL("/auth", request.url)
  redirectUrl.searchParams.set("error", errorCode)
  return NextResponse.redirect(redirectUrl)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = getSafeRelativePath(requestUrl.searchParams.get("next"), "/")

  if (!code) {
    return redirectToAuth(request, "callback_missing_code")
  }

  const supabase = await createSupabaseRouteClient()
  if (!supabase.available) {
    return redirectToAuth(request, "auth_unavailable")
  }

  const { error } = await supabase.client.auth.exchangeCodeForSession(code)
  if (error) {
    const normalized = normalizeAuthError(error, "callback")
    return redirectToAuth(request, normalized.code)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
