# AI Planner Eval

This project uses planner evals to turn manual itinerary review into repeatable quality checks.
The current product scope is the Beijing MVP.

## Why Eval Exists

The planner combines POI candidates, preference policy, fallback planning, repair, and optional
DeepSeek calls. Manual visual checks are not enough to protect day count, category, route, budget,
food, hotel, fallback, and repair behavior. The eval suite provides a stable local signal before
shipping planner changes.

## Covered Scenarios

The default suite covers:

- 4-day intensive history, nature, food, and nightlife planning.
- Relaxed less-walking routes.
- Family and kid-friendly routes.
- Elderly-friendly routes.
- Low-budget and premium hotel-comfort routes.
- Halal or food-priority citywalk intent.
- Nightlife with friends.
- Food-only selected places.
- Hotel-only selected places.
- Empty selected places.
- Public transit preference.

## Evaluation Dimensions

Hard failures block a case:

- Requested day count is not preserved.
- Returned day plan length does not match the expected day count.
- Any day has fewer main activities than required.
- Any day has zero main activities.
- Unknown or non-Beijing POIs appear.
- Food is used as a main activity.
- Hotel is used as a main activity.
- A spot timeline is empty.
- Food-only or hotel-only selected places are not supplemented with scenic activities.

Soft warnings do not block a case:

- Food suggestions are missing.
- Hotel suggestions are missing.
- Budget behavior is weak or unclear.
- Preference signal is weak.
- Route density may conflict with less-walking intent.
- Repair was applied.
- Live fallback was triggered.

## Offline vs Live

Offline eval is the default:

```bash
corepack pnpm run eval:planner
```

Offline eval does not call DeepSeek, does not require API keys, does not require AMap keys, and
does not require Supabase service role access. It uses deterministic internal planner logic and
safe summaries.

Live eval is opt-in:

```bash
PLANNER_EVAL_LIVE=true corepack pnpm run eval:planner
```

Windows PowerShell:

```powershell
$env:PLANNER_EVAL_LIVE="true"
corepack pnpm run eval:planner
```

The package script also supports:

```bash
corepack pnpm run eval:planner:live
```

Live eval calls `/api/planner` and defaults to at most 3 cases. Increase with:

```bash
PLANNER_EVAL_MAX_CASES=10 corepack pnpm run eval:planner
```

## Reports

Offline reports:

- `reports/planner-eval-report.json`
- `reports/planner-eval-report.md`

Live reports:

- `reports/planner-eval-report.live.json`
- `reports/planner-eval-report.live.md`

Reports contain only structured summaries: scores, hard failures, soft warnings, and metrics.
They do not store API keys, tokens, sessions, full prompts, or full model responses.

## Reading The Report

Start with the summary:

- Total cases and pass/fail counts.
- Average score.
- Hard failure count.
- Fallback count.
- Repair applied count.

Then inspect case results:

- `finalDays / expectedDays`
- `mainActivitiesPerDay`
- `totalItemsPerDay`
- `fallback`
- `repairApplied`
- hard failures
- soft warnings

## Current Limits

- Live eval is affected by model latency, quota, and temporary API errors.
- Route compactness is heuristic until it is cross-checked with AMap route distances.
- Budget evaluation is heuristic and is not a real expense quote.
- Offline eval is not a replacement for live sampling before major planner releases.

