# AI Planner

## Goal

The planner turns user intent into an executable Beijing itinerary. It must preserve selected day count, keep the plan inside Beijing, separate scenic activities from food and hotel suggestions, and provide a usable fallback when DeepSeek is unavailable.

## Preference Strategy

The planner normalizes preferences into structured fields:

- `travelerGroup`: solo, couple, friends, family, elderly, company.
- `interestTags`: history, nature, citywalk, food, photo, museum, nightlife and others.
- `pace`: intensive, balanced, relaxed.
- `specialNeeds`: less walking, kid friendly, elderly friendly, public transit, driving, low budget, hotel comfort and others.
- `budgetTier`: under1000, 1000-3000, 3000-5000, 5000-10000, over10000.

These fields are converted into policy constraints such as minimum main activities per day, preferred categories, budget-sensitive POI ranking, and transportation hints.

## DeepSeek Call

`/api/planner` builds a server-side payload and calls DeepSeek through `lib/planner/deepseek-client.ts`. The client reads model configuration from environment variables and never logs the API key.

The model is asked to return JSON. The response is parsed and mapped back to known POI candidates. Unknown or non-Beijing POIs are filtered instead of displayed directly.

## JSON Schema And Validation

The planner validates:

- requested day count
- daysPlan length
- scenic, food, hotel categories
- known candidate IDs
- Beijing-only scope
- minimum main activities per day
- food and hotel not counted as main scenic activity

Invalid JSON is classified separately from schema failures.

## Repair

Repair is used when model output is close but incomplete. The repair layer can fill missing days, enforce policy minimums, and normalize final day counts. For longer plans, model repair is intentionally limited to control latency and cost.

## Fallback

Fallback planner is deterministic. It keeps the demo path available when:

- DeepSeek key is missing.
- DeepSeek returns provider errors.
- DeepSeek times out.
- JSON or schema validation fails.
- Policy validation blocks the model output.

Fallback still uses Beijing POI candidates and preference policy.

## Eval

Planner evals cover 12 offline scenarios, including 4-day intensive planning, relaxed less-walking, family, elderly, low budget, premium hotel, halal/food, nightlife, food-only selected places, hotel-only selected places, empty selection, and public transit.

Current offline report:

- 12 total cases
- 12 passed
- 0 failed
- average score 100
- 0 hard failures

Run:

```bash
corepack pnpm run eval:planner
```

## Observability

Planner observability records safe summaries:

- source and fallback flag
- error type
- provider status and model
- duration and timeout
- requested and final day count
- final day activity counts
- token usage when returned by provider
- estimated cost note

Run:

```bash
corepack pnpm run observe:planner
```

## Privacy Boundary

The planner does not send or log user email, user id, token, session, JWT, Supabase service role key, complete prompt, complete response, or raw localStorage. Selected places are summarized by counts in observability instead of raw arrays.
