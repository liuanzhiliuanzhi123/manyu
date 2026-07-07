# Planner Observability

The Beijing MVP planner now records safe operational summaries around `/api/planner`.
The goal is to make AI planning diagnosable without storing sensitive inputs or model output.

## Why This Exists

The planner has multiple failure modes: provider errors, missing configuration, invalid JSON,
schema failures, fallback generation, and repair. Observability gives the project a repeatable
way to inspect reliability, latency, usage, and quality signals after planner changes.

## Recorded Metrics

Each planner run summary can include:

- Environment: development, preview, production, or test.
- Planner source: DeepSeek or fallback.
- Fallback and repair flags.
- Error taxonomy value.
- Provider status, provider model, timeout, and duration.
- Requested and final day counts.
- Requested and normalized pace.
- Traveler group and budget tier.
- Interest and special-need counts.
- Selected scenic, food, and hotel counts.
- Final per-day item counts.
- DeepSeek usage when the provider returns prompt, completion, and total token counts.
- Estimated cost with a clear estimate-only note.

## Never Recorded

The observability layer does not record:

- API keys or service role keys.
- Access tokens, refresh tokens, sessions, JWTs, or authorization headers.
- User email or user id.
- Full prompts.
- Full model responses.
- Raw model output.
- Raw selectedPlaces arrays.
- Raw localStorage content.

## Error Taxonomy

Planner errors are classified into stable values:

- `none`
- `env_missing`
- `provider_400`
- `provider_401`
- `provider_402`
- `provider_403`
- `provider_404`
- `provider_408`
- `provider_422`
- `provider_429`
- `provider_500`
- `provider_502`
- `provider_503`
- `provider_timeout`
- `network_error`
- `invalid_json`
- `schema_validation_failed`
- `repair_failed`
- `fallback_used`
- `rate_limited`
- `unknown`

`provider_402` usually points to account balance, billing, or model access. `provider_429`
usually points to rate limiting. Timeout, JSON, schema, and repair failures are separated so
they can be investigated independently.

## Reading The Signals

- `fallbackRate`: share of runs served by the fallback planner.
- `repairRate`: share of runs that required model or policy repair.
- `durationMs`: end-to-end `/api/planner` server duration for the run.
- `usage`: provider-reported prompt, completion, and total token counts when available.
- `estimatedCost`: rough estimate only. The real bill must come from the provider invoice.
- `qualitySignals`: day mismatch, zero-main-activity days, and per-day density summaries.

## Local Report

Run:

```bash
corepack pnpm run observe:planner
```

The script reads:

- `reports/planner-runs.local.jsonl`
- `reports/planner-eval-report.json` when present

It writes:

- `reports/planner-observability-report.json`
- `reports/planner-observability-report.md`

If no local planner run JSONL exists, the script still creates an empty report and explains that
no local run log was found.

## Using With Eval

Planner evals answer quality questions such as day count, main activities, Beijing-only POIs,
food placement, and hotel placement. Planner observability answers operational questions such
as fallback rate, repair rate, latency, provider error type, and token usage.

Run both before shipping planner changes:

```bash
corepack pnpm run eval:planner
corepack pnpm run observe:planner
```

## Current Limits

- Vercel serverless file writes are not long-term persistence.
- Cost estimation is not a formal invoice.
- Online persistence needs a dedicated logging service or a Supabase table with strict RLS.
- This phase does not add a `planner_runs` Supabase table to avoid creating a weak RLS boundary.

## Future Extensions

- Supabase `planner_runs` table with authenticated-only insert/select RLS.
- Admin dashboard for planner reliability.
- Redis-backed rate limits and budgets.
- OpenTelemetry spans for provider calls.
