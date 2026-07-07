# Planner Eval Report

## Summary
- Mode: offline
- Total cases: 12
- Passed cases: 12
- Failed cases: 0
- Average score: 100
- Hard failure count: 0
- Fallback count: 12
- Repair applied count: 0
- Generated at: 2026-07-07T07:00:36.597Z

## Case Results

### intensive_history_food_4d
- Name: Intensive 4-day history, nature, food, nightlife
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 4 / 4
- mainActivitiesPerDay: 6, 6, 6, 6
- totalItemsPerDay: 9, 9, 9, 9
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target, day_4_total_items_outside_target

### relaxed_less_walking_3d
- Name: Relaxed less-walking 3-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 3 / 3
- mainActivitiesPerDay: 3, 3, 3
- totalItemsPerDay: 6, 6, 6
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target

### family_kid_nature_2d
- Name: Family kid-friendly nature and museum 2-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 2 / 2
- mainActivitiesPerDay: 4, 4
- totalItemsPerDay: 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target

### elderly_friendly_3d
- Name: Elderly-friendly 3-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 3 / 3
- mainActivitiesPerDay: 3, 3, 3
- totalItemsPerDay: 6, 6, 6
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target

### low_budget_1d
- Name: Low-budget 1-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 1 / 1
- mainActivitiesPerDay: 4
- totalItemsPerDay: 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target

### premium_hotel_comfort_5d
- Name: Premium comfort hotel 5-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 5 / 5
- mainActivitiesPerDay: 4, 4, 4, 4, 4
- totalItemsPerDay: 7, 7, 7, 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target, day_4_total_items_outside_target, day_5_total_items_outside_target

### halal_food_citywalk_2d
- Name: Halal food and citywalk 2-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 2 / 2
- mainActivitiesPerDay: 4, 4
- totalItemsPerDay: 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target

### nightlife_friends_2d
- Name: Nightlife friends 2-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 2 / 2
- mainActivitiesPerDay: 4, 4
- totalItemsPerDay: 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target

### selected_food_only_3d
- Name: Food-only selected places 3-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 3 / 3
- mainActivitiesPerDay: 4, 4, 4
- totalItemsPerDay: 7, 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target

### selected_hotel_only_2d
- Name: Hotel-only selected places 2-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 2 / 2
- mainActivitiesPerDay: 3, 3
- totalItemsPerDay: 6, 6
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, budget_behavior_not_explicit_in_request

### empty_selected_places_3d
- Name: Empty selected places 3-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 3 / 3
- mainActivitiesPerDay: 4, 4, 4
- totalItemsPerDay: 7, 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target

### public_transit_3d
- Name: Public transit priority 3-day plan
- Status: PASS
- Score: 100/100
- finalDays / expectedDays: 3 / 3
- mainActivitiesPerDay: 4, 4, 4
- totalItemsPerDay: 7, 7, 7
- fallback: true
- repairApplied: false
- hardFailures: none
- softWarnings: day_1_total_items_outside_target, day_2_total_items_outside_target, day_3_total_items_outside_target

## Key Findings
- All offline planner cases passed hard constraints.
- Most common hard failure: none
- Stable scenarios are those with matched day counts and required main activity counts.
- Next step: add cost and route-distance observability before making live eval a release gate.
