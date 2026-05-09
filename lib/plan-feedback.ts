import type {
  PlanFeedbackRecord,
  PlanFeedbackSentiment,
  PlanFeedbackTag,
} from "@/lib/planner-types"
import type { TripPlan } from "@/lib/travel-context"

export interface PlanFeedbackInput {
  sentiment: PlanFeedbackSentiment
  tags: PlanFeedbackTag[]
  comment?: string
  day?: number
}

export interface PlanFeedbackAction {
  action:
    | "optimize_day"
    | "replace_restaurant"
    | "replace_hotel"
    | "rebalance_budget"
    | "rebalance_pace"
  day?: number
  reason: string
}

export function createPlanFeedbackRecord(input: PlanFeedbackInput): PlanFeedbackRecord {
  return {
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sentiment: input.sentiment,
    tags: input.tags,
    comment: input.comment?.trim() || undefined,
    day: input.day,
    createdAt: new Date().toISOString(),
  }
}

export function appendPlanFeedback(
  plan: TripPlan,
  feedback: PlanFeedbackRecord
): TripPlan {
  const nextRecords = [...(plan.feedbackRecords || []), feedback]
  return {
    ...plan,
    feedbackRecords: nextRecords,
    lastEditedAt: new Date().toISOString(),
  }
}

function mapTagToAction(tag: PlanFeedbackTag, day?: number): PlanFeedbackAction {
  if (tag === "dislike_restaurant") {
    return {
      action: "replace_restaurant",
      day,
      reason: "用户不喜欢当前餐厅，建议优先更换顺路餐饮。",
    }
  }
  if (tag === "dislike_hotel") {
    return {
      action: "replace_hotel",
      day,
      reason: "用户反馈酒店不合适，建议更换靠近锚点的住宿。",
    }
  }
  if (tag === "day_too_tight" || tag === "refresh_route") {
    return {
      action: "optimize_day",
      day,
      reason: "用户反馈节奏偏赶或路线不顺，建议局部重算当天路线。",
    }
  }
  if (tag === "day_too_loose" || tag === "more_relaxed") {
    return {
      action: "rebalance_pace",
      day,
      reason: "用户希望调整节奏，建议重排当天点位密度。",
    }
  }
  if (tag === "lower_budget") {
    return {
      action: "rebalance_budget",
      day,
      reason: "用户希望更省钱，建议优先替换餐饮和住宿。",
    }
  }
  return {
    action: "replace_restaurant",
    day,
    reason: "用户希望增加美食体验，建议补强餐饮安排。",
  }
}

export function deriveFeedbackActions(input: PlanFeedbackInput): PlanFeedbackAction[] {
  const actions = input.tags.map((tag) => mapTagToAction(tag, input.day))
  const deduped = new Map<string, PlanFeedbackAction>()
  actions.forEach((item) => {
    const key = `${item.action}:${item.day || 0}`
    if (!deduped.has(key)) {
      deduped.set(key, item)
    }
  })
  return [...deduped.values()]
}
