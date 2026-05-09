import { NextResponse } from "next/server"
import type { LngLatTuple } from "@/lib/amap-types"
import { planTransitByWebService } from "@/lib/amap-webservice"

interface TransitRequestBody {
  origin?: LngLatTuple
  destination?: LngLatTuple
  fromName?: string
  toName?: string
  city?: string
  cityd?: string
}

function isLngLatTuple(value: unknown): value is LngLatTuple {
  if (!Array.isArray(value) || value.length < 2) return false
  const lng = Number(value[0])
  const lat = Number(value[1])
  return Number.isFinite(lng) && Number.isFinite(lat)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TransitRequestBody
    if (!isLngLatTuple(body.origin) || !isLngLatTuple(body.destination)) {
      return NextResponse.json(
        { ok: false, message: "缺少有效起点或终点坐标" },
        { status: 400 }
      )
    }

    const result = await planTransitByWebService({
      origin: body.origin,
      destination: body.destination,
      fromName: body.fromName || "起点",
      toName: body.toName || "终点",
      city: body.city,
      cityd: body.cityd,
    })

    return NextResponse.json({
      ok: true,
      data: result.leg,
      upstreamInfo: result.upstreamInfo || "",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "公交路线服务异常",
      },
      { status: 500 }
    )
  }
}

