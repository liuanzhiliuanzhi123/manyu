# Demo Script

## Demo Account

If no fixed demo account is available, register an email account during the demo. Do not share passwords, tokens, or provider keys in the recording or interview.

## 3-Minute Path

### 1. Home

Open https://manyu-self.vercel.app. Point out the three main entries:

- AI planning
- Explore Beijing places
- Saved trips / My page

Suggested line:

> This is a Beijing MVP AI travel agent. The main flow is to collect places, choose preferences, generate a structured multi-day plan, and save it.

### 2. Explore

Go to Explore. Show the three root categories:

- 景区
- 美食
- 酒店

Add one scenic spot, one food item, and one hotel. Favorite one item.

Suggested line:

> The POI catalog is separated into scenic, food and hotel categories, so restaurants and hotels are not used as main scenic activities.

### 3. AI Planner

Open AI planning. Use the fixed demo input:

- City: 北京
- Days: 4
- Budget: 5000-10000
- Traveler: 一个人
- Interests: 历史人文, 自然风光, 美食打卡, 夜生活
- Pace: 特种兵式

Show the confirmation summary and selected POI counts.

Suggested line:

> The planner converts these choices into structured constraints before calling DeepSeek. If the model fails, fallback still generates a usable plan.

### 4. Generate

Click generate. Wait for loading to finish. If DeepSeek is unavailable, explain fallback:

> The app has a deterministic fallback planner, so the demo can continue even when the provider is slow, rate limited, or out of quota.

### 5. Result

Show Travel Handbook:

- 4 days are present.
- Day tabs switch content.
- Each day has scenic timeline.
- Food and hotel suggestions are separate.
- Map and route segments update with the active day.
- Weather advice is included.

Suggested line:

> The result is not raw model text. It is validated JSON mapped back to known Beijing POIs and rendered as an editable travel handbook.

### 6. Save

Save the plan. Open Trips or My page and show the saved plan card. Reopen the saved plan and confirm the full 4-day detail is preserved.

Suggested line:

> Logged-in users sync plans to Supabase with RLS; anonymous users can still use local storage.

### 7. Auth

Open My page. If not logged in, show login entry. If logged in, show saved trip count, favorite count, current draft status, and logout.

Suggested line:

> Authentication is optional for planning, but useful for cloud sync.

## Interview Explanation

The key engineering decisions:

- Keep scope constrained to Beijing MVP.
- Separate POI categories before planner generation.
- Convert preferences into structured policy constraints.
- Validate and repair model output before rendering.
- Preserve deterministic fallback for reliability.
- Add eval and observability so AI quality is measurable.
- Use RLS and avoid logging prompts, responses or secrets.

## Common Questions

Q: What happens when DeepSeek fails?

A: The planner classifies the error, records a safe summary, and falls back to a deterministic Beijing itinerary generator.

Q: How do you prevent food or hotel from becoming main attractions?

A: POIs have root categories. Only scenic POIs count as main activities. Food and hotel are rendered as meal and lodging suggestions.

Q: How do you test the planner?

A: The offline eval suite covers 12 scenarios and checks day count, main activity counts, Beijing scope, category boundaries and fallback behavior.
