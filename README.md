# 拾景拼途 / Manyu Travel Agent

拾景拼途是一个基于 DeepSeek、高德 POI、Supabase 和 Vercel 的北京智能旅行规划 Agent，支持地点探索、偏好选择、多日行程生成、地图路线联动、邮箱登录和方案保存。

线上 Demo: https://manyu-self.vercel.app

当前范围: 北京 MVP。项目不扩展全国城市，不在前端暴露服务端密钥。

## 技术栈

- Next.js 16 App Router
- React 19
- Tailwind CSS
- Supabase Auth / PostgreSQL / RLS
- DeepSeek Chat Completions API
- 高德 Web 服务 API / JS API
- Vercel Production 部署
- Vitest / TypeScript / ESLint

## 核心功能

- 北京 POI 探索: 景区、美食、酒店三大分类与二级标签筛选。
- 地点加入行程: 支持加入景点、美食、酒店，并在 AI 规划中读取已选地点。
- AI 多日规划: 将天数、预算、人群、兴趣、节奏和特殊需求转为结构化规划约束。
- 结果页展示: Travel Handbook、日程 tab、景点时间线、午餐/晚餐/酒店建议、地图路线和天气建议。
- 保存方案: 未登录用户保存到本地，登录用户同步到 Supabase。
- 账号系统: 邮箱注册、登录、退出和用户态同步。
- Planner Eval: 离线评估天数一致性、主活动点、分类边界、北京范围和 fallback 行为。
- Observability: 记录安全的 planner 运行摘要、错误归因、耗时、usage 和估算成本。

## 项目亮点

- 用偏好策略系统约束 LLM 输出，避免仅依赖自由文本生成。
- 将 food/hotel 与 scenic 分离，避免餐厅或酒店被当成主景点。
- 使用 schema validation、repair 和 fallback 保证 DeepSeek 异常时仍可生成可用方案。
- 高德 POI 数据管线完成北京景区、美食、酒店扩容、去重、分类过滤和图片兜底。
- 对 AI planner 建立 eval 与 observability，使质量、错误和成本更容易诊断。

## 本地运行

```bash
corepack pnpm install
corepack pnpm run dev
```

常用检查:

```bash
corepack pnpm run eval:planner
corepack pnpm run observe:planner
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
```

## 环境变量

只配置变量名，不要把真实值写进代码或文档。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `AMAP_WEB_SERVICE_KEY`
- `NEXT_PUBLIC_AMAP_JS_KEY`

不要将 `.env`、`.env.local`、`.vercel`、token、session、API key、Supabase service role key 提交到 Git。

## 固定演示路径

1. 打开首页。
2. 进入探索页。
3. 分别加入北京景区、美食、酒店。
4. 进入 AI 规划页。
5. 选择北京、4 天、预算 5000-10000、一个人、历史人文、自然风光、美食打卡、夜生活、特种兵式。
6. 生成专属行程。
7. 查看 Travel Handbook、4 天 tab、每日景点时间线、吃住建议、地图路线和天气建议。
8. 保存方案。
9. 进入“我的”或“行程”页查看已保存方案。
10. 打开已保存方案详情，确认仍保留完整天数。
11. 登录/退出后确认页面状态正常。

## 截图

作品集截图可后续补充:

- TODO: 首页截图
- TODO: 探索页三大分类截图
- TODO: AI 规划确认页截图
- TODO: Travel Handbook 结果页截图
- TODO: 我的页面保存方案截图

## 安全说明

- Supabase RLS 保证用户只能访问自己的云端方案。
- 未登录用户使用 localStorage fallback，不强制登录才能规划。
- 服务端密钥只通过服务端环境变量读取。
- Planner logs 不记录完整 prompt、完整 response、key、token、session、JWT、email 或 user id。
- 不使用 service role key 做普通业务访问。

更多文档见 `docs/`。
