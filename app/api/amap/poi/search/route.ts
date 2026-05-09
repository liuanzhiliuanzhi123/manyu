import { NextResponse } from "next/server"
import { searchTextFromAmap } from "@/lib/poi-nearby-search"
import type { PoiEntityType } from "@/lib/poi-normalizer"

interface SearchRequestBody {
  city?: string
  type?: PoiEntityType
  keyword?: string
  limit?: number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SearchRequestBody
    const keyword = (body.keyword || "").trim()
    if (!keyword) {
      return NextResponse.json(
        { ok: false, message: "缺少搜索关键词" },
        { status: 400 }
      )
    }

    const type: PoiEntityType =
      body.type === "food" || body.type === "hotel" || body.type === "spot"
        ? body.type
        : "spot"
    const city = (body.city || "北京").trim()
    const result = await searchTextFromAmap({
      city,
      type,
      keyword,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 12,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "关键词检索失败",
      },
      { status: 500 }
    )
  }
}

