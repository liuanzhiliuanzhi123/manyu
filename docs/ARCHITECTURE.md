# Architecture

## System Overview

拾景拼途是一个部署在 Vercel 上的北京旅行规划应用。前端负责地点探索、偏好选择、结果展示和保存交互；Next.js API Routes 负责 planner、天气、地图路线、POI 和数据库健康检查；Supabase 提供认证、RLS 和用户方案持久化；DeepSeek 负责结构化行程决策。

## Main Components

- Frontend: Next.js App Router, React, Tailwind CSS, lucide-react.
- Backend: Next.js API Routes.
- Database: Supabase PostgreSQL.
- Auth: Supabase Auth email login.
- Map and POI: 高德 Web 服务 API、JS API、POI photos.
- LLM: DeepSeek Chat Completions.
- Deployment: Vercel Production.

## App Flow

```mermaid
flowchart LR
  A["User selects preferences"] --> B["POI candidate pool"]
  B --> C["Preference policy"]
  C --> D["DeepSeek planner"]
  D --> E["Schema validator"]
  E --> F["Repair or fallback"]
  F --> G["Travel Handbook result"]
  G --> H["Save trip"]
  H --> I["Local storage or Supabase"]
```

## Runtime Routes

- `/`: mobile-first travel app shell.
- `/auth`: login and registration.
- `/api/planner`: AI planner orchestration.
- `/api/db/health`: Supabase health check.
- `/api/amap/*`: route and POI API proxies.
- `/api/weather`: weather summary for planner context.
- `/api/place-photo`: photo fallback and matching.

## Planner Layer

The planner uses a layered design:

1. Normalize request from UI.
2. Restrict current scope to Beijing.
3. Build candidate pools for attractions, restaurants, and hotels.
4. Convert user preferences into structured policy constraints.
5. Call DeepSeek when available.
6. Validate JSON and schema.
7. Repair missing or weak plan structure.
8. Fall back to deterministic planner when needed.
9. Attach safe diagnostics and observability metadata.

## Persistence Layer

- Unauthenticated users can save trips and selected places locally.
- Authenticated users sync saved trips and places to Supabase.
- RLS keeps user-owned data isolated.
- The app does not use service role key for normal user flows.

## Data Flow

User choices and selected POIs feed into the planner candidate pool. The preference policy translates traveler group, budget, interests, pace, special needs, and selected places into constraints. DeepSeek returns structured days, which are validated, repaired if needed, mapped back to known Beijing POIs, and rendered in the result page. Saved plans are written to local storage or Supabase depending on auth state.

## Current Limits

- Product scope is Beijing MVP.
- Live DeepSeek quality depends on provider availability and account quota.
- Observability persistence is local JSONL or safe console summary; no Supabase planner_runs table is added yet.
- Cost estimation is not a provider invoice.
