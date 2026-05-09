import type { PlannerDecisionRequestInput } from "@/lib/planner-json-schema"

function summarizeInterests(interests: string[]) {
  return interests.length > 0 ? interests.join("、") : "无明确兴趣偏好"
}

function summarizeSpecialNeeds(specialNeeds: string[]) {
  return specialNeeds.length > 0 ? specialNeeds.join("、") : "无特殊需求"
}

export function buildPlannerSystemPrompt() {
  return [
    "You are a strict Beijing travel planning decision engine.",
    "Only use place IDs from provided candidates.",
    "Never invent new places, routes, opening hours, prices, or images.",
    "You only decide ranking, inclusion, day grouping, meal and hotel choice, and explanations.",
    "Output must be valid JSON only. No markdown and no prose outside JSON.",
    "Respect constraints first: budget, pace, transport practicality, nearby food/hotel logic.",
    "If candidates are insufficient, keep the plan usable and add warnings.",
  ].join(" ")
}

export function buildPlannerUserPrompt(input: PlannerDecisionRequestInput) {
  const preferenceSummary = {
    destination: input.destination,
    city: input.city,
    province: input.province,
    totalDays: input.totalDays,
    budgetRange: input.budgetRange,
    companions: input.companions,
    pace: input.pace,
    interests: summarizeInterests(input.interests),
    specialNeeds: summarizeSpecialNeeds(input.specialNeeds),
  }

  const outputContract = {
    destination: "string",
    totalDays: "number",
    totalBudget: "number(optional)",
    days: [
      {
        day: "number(1-based)",
        theme: "string",
        districtSummary: "string(optional)",
        spots: [
          {
            placeId: "string(candidate attraction id only)",
            stayMinutes: "number(optional)",
            reason: "string(optional)",
          },
        ],
        lunch: {
          placeId: "string(candidate restaurant id optional)",
          area: "string(optional)",
          reason: "string(optional)",
        },
        dinner: {
          placeId: "string(candidate restaurant id optional)",
          area: "string(optional)",
          reason: "string(optional)",
        },
        hotel: {
          placeId: "string(candidate hotel id optional)",
          area: "string(optional)",
          reason: "string(optional)",
        },
        routeLegIds: ["string(optional)"],
        dayBudget: "number(optional)",
        warnings: ["string"],
      },
    ],
    droppedPlaceIds: ["string"],
    explanations: ["string"],
  }

  const content = {
    task: "Plan a Beijing itinerary with strict candidate-bound decisions.",
    preferences: preferenceSummary,
    constraints: {
      useCandidateIdsOnly: true,
      noFactFabrication: true,
      optimizeForPreferences: true,
      keepTransportPracticality: true,
      keepNearbyFoodHotelLogic: true,
      provideExplanations: true,
      preserveManualPreferredPlacesWhenReasonable: true,
    },
    candidates: {
      attractions: input.attractions,
      restaurants: input.restaurants,
      hotels: input.hotels,
      routeHints: input.routeHints ?? [],
      manualPreferredPlaceIds: input.manualPreferredPlaceIds ?? [],
    },
    requiredOutputSchema: outputContract,
  }

  return JSON.stringify(content)
}

export function buildPlannerRepairPrompt(rawOutput: string, validationIssues: string[]) {
  return JSON.stringify({
    task: "Repair invalid planner JSON.",
    instructions: [
      "Keep all facts candidate-bound.",
      "Do not add unknown place IDs.",
      "Return JSON only.",
      "Fix schema violations listed below.",
    ],
    validationIssues,
    rawOutput,
  })
}
