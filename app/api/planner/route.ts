import { NextResponse } from "next/server"
import { normalizePlannerApiRequest, toPlannerApiError } from "@/lib/planner/planner-api-contract"
import { checkPlannerRateLimit } from "@/lib/planner/rate-limit"
import { runPlannerDecision } from "@/lib/planner-orchestrator"
import { createSupabaseRouteClient } from "@/lib/supabase/server"

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  const firstForwarded = forwarded.split(",")[0]?.trim()
  return firstForwarded || request.headers.get("x-real-ip") || "anonymous"
}

async function getRateLimitKey(request: Request) {
  try {
    const supabase = await createSupabaseRouteClient()
    if (supabase.available) {
      const { data } = await supabase.client.auth.getUser()
      if (data.user?.id) return `user:${data.user.id}`
    }
  } catch {
    // Session lookup is best-effort; fall back to IP-based limiting.
  }
  return `ip:${getClientIp(request)}`
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "method_not_allowed",
      message: "Planner API only accepts POST requests.",
    },
    { status: 405 }
  )
}

export async function POST(request: Request) {
  try {
    const limit = checkPlannerRateLimit(await getRateLimitKey(request))
    if (!limit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          code: "rate_limited",
          message: "请求过于频繁，请稍后再试。",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
          },
        }
      )
    }

    const payload = await request.json()
    const plannerRequest = normalizePlannerApiRequest(payload)
    const result = await runPlannerDecision(plannerRequest)
    const diagnostics = result.diagnostics
    return NextResponse.json({
      ok: true,
      data: result,
      meta: {
        source: result.source,
        fallback: result.source === "fallback",
        requestedDays: diagnostics?.requestedDays,
        normalizedDays: diagnostics?.normalizedDays,
        modelReturnedDays: diagnostics?.modelReturnedDays,
        finalDays: diagnostics?.finalDays,
        requestedPace: diagnostics?.requestedPace,
        normalizedPace: diagnostics?.normalizedPace,
        targetTotalItemsPerDay: diagnostics?.targetTotalItemsPerDay,
        minMainActivitiesPerDay: diagnostics?.minMainActivitiesPerDay,
        dayRepairApplied: diagnostics?.dayRepairApplied,
        missingDaysRepaired: diagnostics?.missingDaysRepaired,
        preferenceTrace: result.preferenceTrace,
        requestedPreferences: diagnostics?.requestedPreferences,
        normalizedPreferences: diagnostics?.normalizedPreferences,
        poiCatalogStats: diagnostics?.poiCatalogStats,
        rawModelDayCounts: diagnostics?.rawModelDayCounts,
        normalizedDayCounts: diagnostics?.normalizedDayCounts,
        finalDayCounts: diagnostics?.finalDayCounts,
        droppedItemReasons: diagnostics?.droppedItemReasons,
        repairApplied: diagnostics?.repairApplied,
        repairReason: diagnostics?.repairReason,
      },
    })
  } catch (error) {
    const normalized = toPlannerApiError(error)
    return NextResponse.json(
      {
        ok: false,
        code: normalized.code,
        message: normalized.message,
      },
      { status: normalized.status }
    )
  }
}
