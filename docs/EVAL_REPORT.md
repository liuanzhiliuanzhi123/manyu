# Eval Report

## Goal

Planner evals protect the core AI itinerary behavior before shipping changes. They check whether the planner keeps the requested day count, returns enough main activities, stays inside Beijing, separates food and hotel from main scenic activities, and preserves fallback behavior.

## Coverage

The offline eval suite covers:

- 4-day intensive history, nature, food and nightlife.
- Relaxed less-walking route.
- Family and kid-friendly route.
- Elderly-friendly route.
- Low-budget route.
- Premium hotel-comfort route.
- Halal or food-priority route.
- Nightlife with friends.
- Food-only selected places.
- Hotel-only selected places.
- Empty selected places.
- Public transit priority.

## Hard Failures

Hard failures block a case:

- final day count mismatch
- days plan length mismatch
- insufficient main activities
- zero-main-activity day
- non-Beijing or unknown POI
- food as main activity
- hotel as main activity
- empty timeline

## Soft Warnings

Soft warnings indicate quality issues but do not block the case:

- total items outside target density
- missing food or hotel suggestions
- weak budget behavior
- weak preference signal
- route density concerns
- fallback or repair applied

## Current Summary

Latest committed offline report:

- Mode: offline
- Total cases: 12
- Passed cases: 12
- Failed cases: 0
- Average score: 100
- Hard failure count: 0
- Fallback count: 12
- Repair applied count: 0

The offline suite uses deterministic fallback mode and does not require DeepSeek, Supabase, 高德 or Vercel secrets.

## How To Run

```bash
corepack pnpm run eval:planner
```

Reports:

- `reports/planner-eval-report.json`
- `reports/planner-eval-report.md`

## How To Read

Start with the summary. Then check each case for:

- `finalDays / expectedDays`
- `mainActivitiesPerDay`
- `totalItemsPerDay`
- `fallback`
- `repairApplied`
- hard failures
- soft warnings

If any hard failure appears, fix the planner or repair layer before deployment.
