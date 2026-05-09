import type { PlanValidationIssue, PlanValidationResult, TravelRequirement } from "@/lib/planner-types"
import type { TripPlan } from "@/lib/travel-context"

function parseClockToMinutes(clock: string | undefined, fallback = 9 * 60) {
  if (!clock) return fallback
  const matcher = clock.match(/^(\d{1,2}):(\d{2})$/)
  if (!matcher) return fallback
  const hour = Number(matcher[1])
  const minute = Number(matcher[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback
  return Math.min(23 * 60 + 59, Math.max(0, hour * 60 + minute))
}

function parseBudgetUpperBound(budgetRange?: string) {
  if (!budgetRange) return Number.POSITIVE_INFINITY
  if (budgetRange.includes("以内")) {
    const value = Number(budgetRange.replace(/[^\d]/g, ""))
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  if (budgetRange.includes("以上")) return Number.POSITIVE_INFINITY
  const parts = budgetRange.split("-")
  const upper = Number((parts[1] || parts[0] || "").replace(/[^\d]/g, ""))
  return Number.isFinite(upper) ? upper : Number.POSITIVE_INFINITY
}

function toDistrictText(value: string | undefined) {
  if (!value) return ""
  const match = value.match(/[\u4e00-\u9fa5]{1,8}(?:区|县|市)/)
  return match?.[0] || ""
}

function hasHistoryTone(text: string) {
  return /历史|人文|古|博物|遗址|故宫|寺|坛|宫|胡同/u.test(text)
}

function pushIssue(
  issues: PlanValidationIssue[],
  issue: Omit<PlanValidationIssue, "id">
) {
  issues.push({
    id: `${issue.category}-${issues.length + 1}`,
    ...issue,
  })
}

export function validatePlan(
  plan: TripPlan,
  requirement?: TravelRequirement
): PlanValidationResult {
  const errors: PlanValidationIssue[] = []
  const warnings: PlanValidationIssue[] = []

  if (!plan.days || plan.days.length === 0) {
    pushIssue(errors, {
      level: "error",
      category: "completeness",
      title: "方案为空",
      message: "当前方案没有可展示的日程，请重新生成。",
    })
  }

  const allSpots = plan.days?.flatMap((day) => day.spots) || []
  const avgSpotsPerDay = plan.days && plan.days.length > 0 ? allSpots.length / plan.days.length : 0

  plan.days?.forEach((day) => {
    const startMinutes = parseClockToMinutes(day.startTime)
    const endMinutes = parseClockToMinutes(day.endTime, startMinutes + 9 * 60)

    if (endMinutes <= startMinutes) {
      pushIssue(errors, {
        level: "error",
        category: "time",
        title: `第${day.day}天时间异常`,
        message: "结束时间早于开始时间，请重新排程。",
        day: day.day,
      })
    }

    if (startMinutes > 10 * 60 + 30) {
      pushIssue(warnings, {
        level: "warning",
        category: "time",
        title: `第${day.day}天开场偏晚`,
        message: "建议更早开始，避免下午行程过于拥挤。",
        day: day.day,
      })
    }

    if (endMinutes > 22 * 60 + 30) {
      pushIssue(warnings, {
        level: "warning",
        category: "time",
        title: `第${day.day}天结束偏晚`,
        message: "建议减少当日点位或缩短跨区通勤。",
        day: day.day,
      })
    }

    day.spots.forEach((spot) => {
      const stay = spot.suggestedDurationMinutes || 0
      if (stay > 0 && stay < 30) {
        pushIssue(warnings, {
          level: "warning",
          category: "time",
          title: `第${day.day}天停留时间过短`,
          message: `${spot.name}建议停留不足 30 分钟，可能影响体验。`,
          day: day.day,
        })
      }
      if (stay > 320) {
        pushIssue(warnings, {
          level: "warning",
          category: "time",
          title: `第${day.day}天停留时间过长`,
          message: `${spot.name}停留时间过长，可能挤压其他行程。`,
          day: day.day,
        })
      }

      const lng = Number(spot.lng)
      const lat = Number(spot.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        pushIssue(warnings, {
          level: "warning",
          category: "completeness",
          title: `第${day.day}天坐标缺失`,
          message: `${spot.name}缺少精确坐标，地图路径可能降级为估算。`,
          day: day.day,
        })
      }
    })

    if (day.spots.length > 1 && day.routeLegs.length === 0) {
      pushIssue(warnings, {
        level: "warning",
        category: "completeness",
        title: `第${day.day}天路线缺失`,
        message: "多点位行程缺少路线段信息，建议重新计算路线。",
        day: day.day,
      })
    }

    const estimatedLegCount = day.routeLegs.filter((leg) => leg.isEstimated).length
    if (estimatedLegCount >= Math.max(2, Math.floor(day.routeLegs.length * 0.5))) {
      pushIssue(warnings, {
        level: "warning",
        category: "route",
        title: `第${day.day}天路线估算较多`,
        message: "多段路线处于估算状态，可切换出行方式或重算。",
        day: day.day,
      })
    }

    const overTransit = day.routeLegs.some(
      (leg) => leg.transportMode === "transit" && leg.durationSeconds > 90 * 60
    )
    if (overTransit) {
      pushIssue(warnings, {
        level: "warning",
        category: "route",
        title: `第${day.day}天公交通勤过长`,
        message: "存在单段公交超过 90 分钟，建议替换附近点位。",
        day: day.day,
      })
    }

    const heavyWalking = day.routeLegs.some(
      (leg) => leg.transportMode === "walking" && leg.distanceMeters > 5000
    )
    if (heavyWalking) {
      pushIssue(warnings, {
        level: "warning",
        category: "route",
        title: `第${day.day}天步行过量`,
        message: "存在长距离步行路线，建议改为公交或驾车。",
        day: day.day,
      })
    }

    const routeRatio = day.totalPlayMinutes > 0 ? day.totalTravelSeconds / (day.totalPlayMinutes * 60) : 0
    if (routeRatio > 1.15) {
      pushIssue(warnings, {
        level: "warning",
        category: "route",
        title: `第${day.day}天通勤占比过高`,
        message: "交通耗时已超过游玩时长，建议减少跨区点位。",
        day: day.day,
      })
    }

    const districts = day.spots
      .map((spot) => toDistrictText(spot.district || spot.address))
      .filter(Boolean)
    const uniqueDistrictCount = new Set(districts).size
    if (uniqueDistrictCount >= 4 && day.spots.length <= 5) {
      pushIssue(warnings, {
        level: "warning",
        category: "route",
        title: `第${day.day}天跨区过多`,
        message: "同一天跨越多个行政区，可能造成折返。",
        day: day.day,
      })
    }

    if (!day.lunchSuggestion) {
      pushIssue(warnings, {
        level: "warning",
        category: "meal_hotel",
        title: `第${day.day}天午餐缺失`,
        message: "建议补充午餐推荐，避免中午临时找店。",
        day: day.day,
      })
    }

    if (!day.dinnerSuggestion) {
      pushIssue(warnings, {
        level: "warning",
        category: "meal_hotel",
        title: `第${day.day}天晚餐缺失`,
        message: "建议补充晚餐推荐，保证当天节奏完整。",
        day: day.day,
      })
    }

    if (!day.hotelSuggestion) {
      pushIssue(warnings, {
        level: "warning",
        category: "meal_hotel",
        title: `第${day.day}天住宿缺失`,
        message: "建议补充住宿候选，避免跨日切换时无落脚点。",
        day: day.day,
      })
    }

    if (day.hotelSuggestion && day.spots.length > 0) {
      const lastDistrict = toDistrictText(
        day.spots[day.spots.length - 1]?.district || day.spots[day.spots.length - 1]?.address
      )
      const hotelDistrict = toDistrictText(day.hotelSuggestion.address)
      if (lastDistrict && hotelDistrict && lastDistrict !== hotelDistrict) {
        pushIssue(warnings, {
          level: "warning",
          category: "meal_hotel",
          title: `第${day.day}天酒店可能不顺路`,
          message: "酒店所在区域与当天终点差异较大，建议替换更近候选。",
          day: day.day,
        })
      }
    }
  })

  const budgetUpper = parseBudgetUpperBound(requirement?.budgetRange || plan.requirement?.budgetRange)
  if (Number.isFinite(budgetUpper) && budgetUpper > 0 && (plan.totalEstimatedCost || 0) > budgetUpper * 1.25) {
    pushIssue(warnings, {
      level: "warning",
      category: "budget",
      title: "总预算超出较多",
      message: `当前总预算约 ¥${Math.round(plan.totalEstimatedCost || 0)}，明显高于预算区间。`,
    })
  }

  if ((plan.totalEstimatedCost || 0) <= 0) {
    pushIssue(errors, {
      level: "error",
      category: "budget",
      title: "预算计算异常",
      message: "总预算结果异常，建议重新生成或重新计算。",
    })
  }

  const preferenceInterests = requirement?.interests || plan.requirement?.interests || []
  if (preferenceInterests.includes("历史人文")) {
    const attractionTexts = allSpots
      .filter((spot) => spot.type === "attraction")
      .map((spot) => `${spot.name} ${spot.tags.join(" ")}`)
    const historyHits = attractionTexts.filter((text) => hasHistoryTone(text)).length
    const ratio = attractionTexts.length > 0 ? historyHits / attractionTexts.length : 0
    if (ratio < 0.35) {
      pushIssue(warnings, {
        level: "warning",
        category: "preference",
        title: "历史偏好命中偏低",
        message: "历史人文景点占比偏低，可替换部分景点提升匹配度。",
      })
    }
  }

  if (preferenceInterests.includes("美食打卡")) {
    const withMeals =
      plan.days?.filter((day) => day.lunchSuggestion || day.dinnerSuggestion).length || 0
    if (plan.days && plan.days.length > 0 && withMeals < plan.days.length) {
      pushIssue(warnings, {
        level: "warning",
        category: "preference",
        title: "美食偏好命中不足",
        message: "部分日期缺少餐饮安排，可使用“替换餐厅”优化。",
      })
    }
  }

  const pace = requirement?.pace || plan.requirement?.pace
  if (pace === "slow" && avgSpotsPerDay > 4) {
    pushIssue(warnings, {
      level: "warning",
      category: "preference",
      title: "慢节奏但点位偏多",
      message: "当前日均点位偏高，建议减少单日打卡数量。",
    })
  }
  if (pace === "fast" && avgSpotsPerDay < 2.5) {
    pushIssue(warnings, {
      level: "warning",
      category: "preference",
      title: "快节奏但点位偏少",
      message: "当前点位偏少，可增加同片区候选。",
    })
  }

  const qualityIssues = Array.from(new Set(warnings.map((item) => item.title))).slice(0, 6)
  const suggestionHints = Array.from(
    new Set([
      ...warnings.map((item) => item.message),
      "可在编辑模式中替换景点、餐厅、酒店并即时重算路线。",
      "若公交估算较多，可切换驾车视图确认通勤时长。",
    ])
  ).slice(0, 8)

  return {
    errors,
    warnings,
    qualityIssues,
    suggestionHints,
    summary: {
      hasBlockingErrors: errors.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  }
}
