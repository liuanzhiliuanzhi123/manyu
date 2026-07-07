import type { PlannerDecisionRequestInput } from "@/lib/planner-json-schema"

import { buildPreferencePolicyFromRequest } from "@/lib/planner/preference-policy"

function summarizeInterests(interests: string[]) {
  return interests.length > 0 ? interests.join("、") : "无明确兴趣偏好"
}

function summarizeSpecialNeeds(specialNeeds: string[]) {
  return specialNeeds.length > 0 ? specialNeeds.join("、") : "无特殊需求"
}

export function buildPlannerSystemPrompt() {
  return [
    "你是北京旅行规划助手，也是严格的 JSON 决策引擎。",
    "你必须只输出严格 JSON，不要输出 Markdown，不要输出解释文字。",
    "Only use place IDs from provided candidates.",
    "Never invent new places, routes, opening hours, prices, images, or non-Beijing destinations.",
    "For scenic, food, and hotel items, include the candidate placeId when available.",
    "Main activity item types include scenic, attraction, museum, cultural, culture, temple, park, landmark, performance, exhibition, art, citywalk, and nature.",
    "Food, restaurant, hotel, transit, rest, note, and weather items never count as main activities.",
    "Every day must include the required number of main activity items from attraction candidates.",
    "The requested trip length is a hard constraint: return exactly the requested number of days.",
    "Day indexes must be contiguous and 1-based: 1, 2, 3 ... N. Never merge requested days into fewer days.",
    "If selected places are only food or hotel candidates, automatically schedule scenic/main activity candidates too.",
    "Respect constraints first: budget, pace, transport practicality, nearby food/hotel logic.",
    "If candidates are insufficient, keep the plan usable and add warnings.",
  ].join(" ")
}

export function buildPlannerUserPrompt(input: PlannerDecisionRequestInput) {
  const policy = buildPreferencePolicyFromRequest(input)
  const preferenceSummary = {
    destination: input.destination,
    city: input.city,
    province: input.province,
    startDate: input.startDate || "",
    endDate: input.endDate || "",
    totalDays: input.totalDays,
    budgetRange: input.budgetRange,
    companions: input.companions,
    pace: input.pace,
    interests: summarizeInterests(input.interests),
    specialNeeds: summarizeSpecialNeeds(input.specialNeeds),
    structuredPreferences: policy.normalizedPreferences,
    weatherContext: input.weatherContext
      ? {
          city: input.weatherContext.summary.city,
          source: input.weatherContext.summary.source,
          live: input.weatherContext.summary.live,
          forecastByDay: input.weatherContext.dayWeather,
          travelWeatherAdvice: input.weatherContext.summary.travelAdvice,
          itineraryRules: input.weatherContext.summary.travelAdvice.itineraryRules,
        }
      : null,
  }

  const outputContract = {
    title: "北京智能行程",
    city: "北京",
    days: input.totalDays,
    pace: "relaxed | balanced | intensive",
    budgetEstimate: {
      total: "number(optional)",
      currency: "CNY",
      notes: "string(optional)",
    },
    summary: "string(optional)",
    weatherAdvice: {
      summary: "string(optional)",
      tags: ["string"],
      suggestions: ["string"],
    },
    daysPlan: [
      {
        dayIndex: "number(1-based)",
        title: "string",
        summary: "string(optional)",
        weather: {
          weather: "string(optional)",
          temperature: "string(optional)",
          advice: "string(optional)",
        },
        items: [
          {
            type:
              "scenic | attraction | museum | cultural | culture | temple | park | landmark | performance | exhibition | art | citywalk | nature | food | restaurant | hotel | transit | rest | note",
            placeId: "string(candidate id for scenic/food/hotel)",
            name: "string(candidate name only)",
            address: "string(optional, candidate address only)",
            district: "string(optional)",
            startTime: "HH:mm(optional)",
            endTime: "HH:mm(optional)",
            durationMinutes: "number(optional)",
            reason: "string(optional)",
            tips: "string(optional)",
            lat: "number(optional, candidate lat only)",
            lng: "number(optional, candidate lng only)",
            estimatedCost: "number(optional)",
            transportToNext: {
              mode: "walking | transit | driving | mixed",
              durationMinutes: "number(optional, estimate only)",
              distanceKm: "number(optional, estimate only)",
              summary: "string(optional)",
            },
          },
        ],
      },
    ],
    foodAndStay: {
      lunchSuggestions: [],
      dinnerSuggestions: [],
      hotelSuggestions: [],
    },
    riskWarnings: ["string"],
    savePayload: {},
  }

  const content = {
    task: "Plan a Beijing itinerary with strict candidate-bound decisions.",
    preferences: preferenceSummary,
    preferencePolicy: {
      normalizedPreferences: policy.normalizedPreferences,
      hardConstraints: policy.hardConstraints,
      softPreferences: policy.softPreferences,
      dailyRules: policy.dailyRules,
      budgetRules: policy.budgetRules,
      transportRules: policy.transportRules,
      foodRules: policy.foodRules,
      hotelRules: policy.hotelRules,
      conflictWarnings: policy.conflictWarnings,
      validationRules: [
        `Return exactly ${input.totalDays} days in daysPlan.`,
        `daysPlan dayIndex values must be exactly 1..${input.totalDays}, with no missing or duplicate days.`,
        `Each day must include at least ${policy.hardConstraints.minMainActivitiesPerDay} scenic/main activity items.`,
        `Each day target total scenic/main activity items: ${policy.hardConstraints.targetTotalItemsPerDay}.`,
        "Use attraction candidate IDs for every scenic/main activity item. Museum, culture, park, temple, landmark, performance, exhibition, art, citywalk, and nature are valid main activity item types.",
        "Food, restaurant, hotel, transit, rest, note, and weather items cannot replace scenic/main activity items.",
        "Never return a day with only food, hotel, transit, rest, note, or weather items.",
        "Each day must include lunch, dinner, and hotel suggestions from candidates when candidates are available.",
        "If pace is intensive, return 4-6 total daily items and at least 3 scenic/main activity items for every day.",
        "If lessWalking or elderlyFriendly is present, prefer same-district or adjacent-district clustering.",
      ],
    },
    constraints: {
      useCandidateIdsOnly: true,
      outputMustContainJsonOnly: true,
      noFactFabrication: true,
      beijingOnly: true,
      optimizeForPreferences: true,
      keepTransportPracticality: true,
      keepNearbyFoodHotelLogic: true,
      provideExplanations: true,
      preserveManualPreferredPlacesWhenReasonable: true,
      mustConsiderWeather: true,
      weatherRules: [
        "Rain or thunderstorms: prefer museums, indoor exhibitions, shopping areas, restaurants; reduce parks, viewpoints, long walks; add transport buffer.",
        "Sunny weather: outdoor sights, city walks, parks and viewpoints can be prioritized, with sunscreen and hydration reminders.",
        "High temperature: reduce outdoor exposure from 12:00-15:00 and place restaurants, malls, museums or hotel rest in the middle of the day.",
        "Low temperature or snow: slow down the route, reduce early/late outdoor time, mention warmth and anti-slip.",
        "Strong wind or dust: reduce elevated, lakeside and open-area stops; prefer indoor and short-distance routing.",
        "If weather data is unavailable, keep the plan usable under normal travel conditions and state that weather is unavailable.",
      ],
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
    task: "Repair invalid DeepSeek planner JSON.",
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
