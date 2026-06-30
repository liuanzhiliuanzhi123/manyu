import { describe, expect, it } from "vitest"
import { filterSpotsByCity, inferMajorityCity, isSpotInDestination } from "../lib/planner-city-guard"
import { getRecommendedBundles } from "../lib/planner-recommendations"
import { formatStayDuration } from "../lib/itinerary-utils"
import { buildPlanShareSummary, toShareSummaryText } from "../lib/plan-persistence"
import type { TravelRequirement } from "../lib/planner-types"
import type { ItineraryDay, Spot, TripPlan } from "../lib/travel-context"

function spot(overrides: Partial<Spot> & Pick<Spot, "id" | "name">): Spot {
  return {
    type: "attraction",
    address: "北京市东城区",
    rating: 4.8,
    heat: 90,
    ticketPrice: 60,
    description: "北京测试地点",
    image: "/images/placeholders/poi-default.jpg",
    tags: ["北京", "历史人文"],
    city: "北京",
    province: "北京",
    ...overrides,
  }
}

const baseRequirement: TravelRequirement = {
  province: "北京",
  city: "北京",
  days: 2,
  budgetRange: "1000-3000",
  companions: "friends",
  interests: ["历史人文", "美食打卡"],
  pace: "balanced",
  specialNeeds: [],
}

describe("北京 MVP 城市过滤", () => {
  it("只保留目标城市内的地点", () => {
    const beijingSpot = spot({ id: "bj-1", name: "故宫博物院" })
    const shanghaiSpot = spot({
      id: "sh-1",
      name: "外滩",
      city: "上海",
      province: "上海",
      address: "上海市黄浦区",
    })

    expect(isSpotInDestination(beijingSpot, { city: "北京", province: "北京" })).toBe(true)
    expect(isSpotInDestination(shanghaiSpot, { city: "北京", province: "北京" })).toBe(false)
    expect(filterSpotsByCity([beijingSpot, shanghaiSpot], "北京", "北京")).toEqual([beijingSpot])
  })

  it("能从已选地点推断北京为主城市", () => {
    const spots = [
      spot({ id: "bj-1", name: "故宫博物院" }),
      spot({ id: "bj-2", name: "天坛公园" }),
      spot({ id: "sh-1", name: "外滩", city: "上海", province: "上海", address: "上海市黄浦区" }),
    ]

    expect(inferMajorityCity(spots)).toBe("北京")
  })
})

describe("推荐路线一键加入逻辑", () => {
  it("为北京候选生成可一键加入的经典组合", () => {
    const pois = [
      spot({ id: "forbidden-city", name: "故宫博物院" }),
      spot({ id: "nanluoguxiang", name: "南锣鼓巷", address: "北京市东城区南锣鼓巷" }),
      spot({
        id: "quanjude",
        name: "全聚德烤鸭店",
        type: "restaurant",
        address: "北京市东城区前门大街",
        ticketPrice: 180,
        tags: ["北京", "美食打卡", "烤鸭"],
      }),
    ]

    const bundles = getRecommendedBundles(baseRequirement, "北京", pois)
    const classic = bundles.find((bundle) => bundle.id === "beijing-classic-first")

    expect(classic?.poiIds).toEqual(["forbidden-city", "nanluoguxiang", "quanjude"])
  })
})

describe("行程文案与保存结构转换", () => {
  it("格式化停留耗时文案", () => {
    expect(formatStayDuration(45)).toBe("45 分钟")
    expect(formatStayDuration(120)).toBe("2 小时")
    expect(formatStayDuration(90)).toBe("1.5 小时")
  })

  it("把 TripPlan 转换成分享摘要", () => {
    const day: ItineraryDay = {
      day: 1,
      title: "第1天",
      startTime: "09:00",
      endTime: "18:00",
      spots: [spot({ id: "bj-1", name: "故宫博物院" })],
      routeLegs: [],
      totalDistanceMeters: 5200,
      totalTravelSeconds: 1800,
      totalPlayMinutes: 180,
      totalEstimatedCost: 360,
    }
    const plan: TripPlan = {
      id: "plan-1",
      name: "北京周末行程",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      pace: "balanced",
      departure: "酒店",
      spots: day.spots,
      createdAt: "2026-06-30T00:00:00.000Z",
      days: [day],
      totalDays: 1,
      totalEstimatedCost: 360,
      totalDistanceMeters: 5200,
      requirement: baseRequirement,
    }

    const summary = buildPlanShareSummary(plan)

    expect(summary.destination).toBe("北京")
    expect(summary.highlights).toEqual(["故宫博物院"])
    expect(toShareSummaryText(summary)).toContain("北京 · 1天 · 1个点位")
  })
})
