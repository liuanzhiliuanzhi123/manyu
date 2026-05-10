import { NextResponse } from "next/server"
import { getWeatherByCity } from "@/lib/weather-service"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get("city")?.trim()
  const adcode = searchParams.get("adcode")?.trim()
  const query = adcode || city

  if (!query) {
    return NextResponse.json(
      {
        ok: false,
        message: "缺少 city 或 adcode 参数",
      },
      { status: 400 }
    )
  }

  try {
    const weather = await getWeatherByCity(query)
    return NextResponse.json({
      ok: true,
      data: weather,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "天气数据暂不可用"
    return NextResponse.json({
      ok: true,
      data: {
        city: query,
        source: "fallback",
        unavailableReason: message,
        travelAdvice: {
          summary: "天气数据暂不可用",
          tags: ["天气暂不可用"],
          riskLevel: "medium",
          suggestions: ["出发前再次确认天气，并预留机动时间。"],
          itineraryRules: ["按常规出行条件生成，保留室内备选安排。"],
        },
      },
    })
  }
}
