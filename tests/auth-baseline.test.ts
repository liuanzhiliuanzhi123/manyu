import { describe, expect, it } from "vitest"
import {
  getResetPasswordNeutralMessage,
  getSafeRelativePath,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "../lib/auth/auth-validation"
import { normalizeAuthError } from "../lib/auth/auth-errors"
import {
  dedupeSavedPlaces,
  dedupeSavedTrips,
  getTravelPersistenceTarget,
  mapLocalTripDraftToPayload,
} from "../lib/travel-data/local-sync"
import type { Spot, TripPlan } from "../lib/travel-context"
import type { Json, TripDraft } from "../lib/supabase/types"

function spot(overrides: Partial<Spot> & Pick<Spot, "id" | "name">): Spot {
  return {
    type: "attraction",
    address: "北京市东城区",
    rating: 4.8,
    heat: 90,
    ticketPrice: 60,
    description: "北京测试地点",
    image: "/images/placeholders/poi-default.jpg",
    tags: ["北京"],
    city: "北京",
    province: "北京",
    ...overrides,
  }
}

function plan(overrides: Partial<TripPlan> & Pick<TripPlan, "id" | "name">): TripPlan {
  return {
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    pace: "balanced",
    departure: "酒店",
    spots: [],
    createdAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  }
}

describe("Supabase 邮箱认证校验", () => {
  it("校验邮箱格式", () => {
    expect(validateEmail("traveler@example.com").ok).toBe(true)
    expect(validateEmail("bad-email").ok).toBe(false)
    expect(validateEmail("").ok).toBe(false)
  })

  it("校验密码强度", () => {
    expect(validatePassword("abc12345").ok).toBe(true)
    expect(validatePassword("abcdefghi").ok).toBe(false)
    expect(validatePassword("12345678").ok).toBe(false)
    expect(validatePassword("a1").ok).toBe(false)
  })

  it("校验确认密码一致性", () => {
    expect(validatePasswordConfirm("abc12345", "abc12345").ok).toBe(true)
    expect(validatePasswordConfirm("abc12345", "abc12346").ok).toBe(false)
  })

  it("归一化认证错误且不透出原始 Supabase 详情", () => {
    expect(
      normalizeAuthError({ message: "Invalid login credentials" }, "signIn")
    ).toEqual({
      code: "invalid_credentials",
      message: "登录失败，请检查邮箱或密码。",
    })
    expect(normalizeAuthError({ status: 429 }, "signIn").message).toBe(
      "请求过于频繁，请稍后再试。"
    )
  })

  it("使用忘记密码中性文案", () => {
    expect(getResetPasswordNeutralMessage()).toBe(
      "如果该邮箱已注册，我们会发送重置密码邮件，请检查邮箱。"
    )
  })

  it("只允许站内相对 callback next 路径", () => {
    expect(getSafeRelativePath("/profile", "/")).toBe("/profile")
    expect(getSafeRelativePath("//evil.example", "/")).toBe("/")
    expect(getSafeRelativePath("https://evil.example", "/")).toBe("/")
  })
})

describe("登录态旅行数据同步纯函数", () => {
  it("按地点 id 去重本地收藏", () => {
    const first = spot({ id: "forbidden-city", name: "故宫博物院" })
    const duplicate = spot({ id: "forbidden-city", name: "故宫" })
    const next = dedupeSavedPlaces([first, duplicate])

    expect(next).toEqual([first])
  })

  it("按本地方案 id 去重保存方案", () => {
    const first = plan({ id: "local-plan-1", name: "北京周末" })
    const duplicate = plan({ id: "local-plan-1", name: "北京周末更新" })
    const next = dedupeSavedTrips([first, duplicate])

    expect(next).toEqual([first])
  })

  it("把本地草稿映射为 Supabase upsert payload", () => {
    const draft: TripDraft = {
      id: "local-trip-draft",
      user_id: "local",
      city: "北京",
      title: "北京智能行程草稿",
      status: "draft",
      days: 2,
      budget_min: null,
      budget_max: null,
      pace: "balanced",
      preferences: ["历史人文"],
      selected_place_ids: [],
      draft_data: {
        selectedSpots: [spot({ id: "temple-of-heaven", name: "天坛公园" })],
        currentPlan: null,
      } as unknown as Json,
      created_at: "2026-06-30T00:00:00.000Z",
      updated_at: "2026-06-30T00:00:00.000Z",
    }

    const payload = mapLocalTripDraftToPayload(draft)

    expect(payload.city).toBe("北京")
    expect(payload.preferences).toEqual(["历史人文"])
    expect(payload.selectedSpots?.[0]?.id).toBe("temple-of-heaven")
  })

  it("根据登录态分流保存目标", () => {
    expect(getTravelPersistenceTarget(false)).toBe("local")
    expect(getTravelPersistenceTarget(true)).toBe("supabase")
  })
})
