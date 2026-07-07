# Final Checklist

## Functional Checks

- [ ] Home page opens normally.
- [ ] Explore page opens normally.
- [ ] Scenic / food / hotel categories are visible.
- [ ] Category lists do not mix scenic, food and hotel items.
- [ ] Search works.
- [ ] Secondary filters work.
- [ ] Add to trip works.
- [ ] Favorite works.
- [ ] AI planner page opens normally.
- [ ] Selected scenic / food / hotel counts are visible.
- [ ] 4-day Beijing planning works.
- [ ] Result page opens normally.
- [ ] Result page shows complete 4 days.
- [ ] Day tabs switch content.
- [ ] Each day has scenic timeline.
- [ ] Each day has food and lodging suggestions when available.
- [ ] Map renders and changes with the active day.
- [ ] Save plan works.
- [ ] Trips page shows saved plan.
- [ ] My page shows login entry when logged out.
- [ ] My page shows saved plans, favorite count and draft status when logged in.
- [ ] Logout works and does not show the previous user's cloud data.

## AI Checks

- [ ] `/api/planner` can return `source:"deepseek"` in Production when provider quota is available.
- [ ] fallback is available.
- [ ] repair is available.
- [ ] requested days equal final days.
- [ ] mainActivities are counted from scenic POIs only.
- [ ] food does not count as main scenic activity.
- [ ] hotel does not count as main scenic activity.
- [ ] generated itinerary remains within Beijing MVP scope.
- [ ] provider errors do not expose raw API errors to users.

## Security Checks

- [ ] `.env.local` is not committed.
- [ ] `.vercel` is not committed.
- [ ] No API key, token or secret is committed.
- [ ] No token, session or JWT appears in logs.
- [ ] RLS remains enabled for user-owned tables.
- [ ] Service role key is not used for ordinary user flows.
- [ ] Planner logs do not include full prompt or full model response.

## Deployment Checks

- [ ] `corepack pnpm run eval:planner` passes.
- [ ] `corepack pnpm run observe:planner` passes.
- [ ] `corepack pnpm run typecheck` passes.
- [ ] `corepack pnpm run lint` passes or only has known historical warnings.
- [ ] `corepack pnpm run test` passes.
- [ ] `corepack pnpm run build` passes.
- [ ] Vercel Production is ready.
- [ ] https://manyu-self.vercel.app opens.
- [ ] `/api/db/health` is normal.
- [ ] `/auth` is normal.
- [ ] `/api/planner` is normal.

## Demo Readiness

- [ ] README is complete.
- [ ] Architecture doc is complete.
- [ ] AI planner doc is complete.
- [ ] Data pipeline doc is complete.
- [ ] Security doc is complete.
- [ ] Eval report doc is complete.
- [ ] Demo script is complete.
- [ ] Resume project doc is complete.
- [ ] Portfolio screenshots are prepared or TODO placeholders are documented.
