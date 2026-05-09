import { NextResponse } from "next/server"
import { searchNearbyFromAmap } from "@/lib/poi-nearby-search"
import type { LngLatTuple } from "@/lib/amap-types"
import type { PoiEntityType } from "@/lib/poi-normalizer"

interface NearbyRequestBody {
  city?: string
  type?: PoiEntityType
  anchor?: LngLatTuple
  radius?: number
  limit?: number
}

function isLngLatTuple(value: unknown): value is LngLatTuple {
  if (!Array.isArray(value) || value.length < 2) return false
  const lng = Number(value[0])
  const lat = Number(value[1])
  return Number.isFinite(lng) && Number.isFinite(lat)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NearbyRequestBody
    if (!isLngLatTuple(body.anchor)) {
      return NextResponse.json(
        { ok: false, message: "缺少有效的锚点坐标" },
        { status: 400 }
      )
    }

    const type: PoiEntityType =
      body.type === "food" || body.type === "hotel" || body.type === "spot"
        ? body.type
        : "food"
    const city = (body.city || "北京").trim()
    const result = await searchNearbyFromAmap({
      anchor: body.anchor,
      city,
      type,
      radius: Number.isFinite(Number(body.radius)) ? Number(body.radius) : 1600,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 12,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "附近检索失败",
      },
      { status: 500 }
    )
  }
}

