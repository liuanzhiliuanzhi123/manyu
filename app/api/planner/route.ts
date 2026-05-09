import { NextResponse } from "next/server"
import { runPlannerDecision } from "@/lib/planner-orchestrator"

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const result = await runPlannerDecision(payload)
    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Planner request failed"
    const isBadRequest =
      message.includes("Required") ||
      message.includes("Invalid") ||
      message.includes("expected")

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: isBadRequest ? 400 : 500 }
    )
  }
}
