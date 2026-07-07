# Security

## Authentication

The project uses Supabase Auth for email registration, login, password reset, and logout. The UI reads the current user through a browser-safe auth hook and never displays raw user id, session, access token, refresh token, or JWT.

## Row Level Security

Supabase tables for saved travel data are protected by RLS. Authenticated users can read and write their own saved trips and places. Public users do not get access to other users' cloud data.

## Local Fallback

Unauthenticated users can still use the planner. Their selected places and saved plans fall back to local storage. After login, local data can sync to Supabase using authenticated client access.

## Secret Handling

The following values must never be committed:

- `.env`
- `.env.local`
- `.vercel`
- DeepSeek API key
- Supabase service role key
- Supabase access token
- Vercel token
- 高德 API key
- JWT, session, access token or refresh token

The frontend only receives public Supabase URL and anon key. Server-only keys stay in environment variables.

## Planner Logging

Planner observability is intentionally redacted. It records safe summaries such as source, fallback, error type, provider status, duration, token usage, selected POI counts and day counts.

It does not record:

- full prompt
- full model response
- raw model output
- API key
- token
- session
- JWT
- email
- user id
- raw localStorage

## Service Role Boundary

The app does not use Supabase service role key for ordinary user flows. If an admin workflow is added later, it should be isolated in server-only code with explicit authorization and audit logging.

## Deployment Boundary

Vercel environment variables are managed outside Git. Changing model keys, Supabase keys, or 高德 keys should happen through the provider dashboard or CLI with interactive secret input, not through code.

## Current Checks

Before committing, verify:

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
```

Do not disable RLS, do not enable `ignoreBuildErrors`, and do not print real secrets during debugging.
