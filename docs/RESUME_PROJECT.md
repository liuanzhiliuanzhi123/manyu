# Resume Project

## 中文项目名

拾景拼途

## English Name

Manyu Travel Agent

## One-Line Description

基于 Next.js、Supabase、高德 POI 和 DeepSeek 构建的北京 AI Travel Agent，支持地点探索、偏好约束、多日行程生成、地图路线联动和方案保存。

## Resume Bullets

- 基于 Next.js、Supabase、Vercel、高德 Web API 和 DeepSeek 搭建北京 AI Travel Agent，实现 POI 探索、偏好选择、智能行程生成、地图联动和用户方案保存。
- 设计用户偏好策略引擎，将同行人群、预算、兴趣标签、旅行节奏和特殊需求转换为结构化规划约束，并通过 schema validation、repair 和 fallback 提升生成结果可执行性。
- 构建北京 POI 数据管线，基于高德 API 扩充景区、美食、酒店数据，完成三大主类分类、多标签筛选、图片兜底、去重和低置信度隔离。
- 建立 AI planner eval 与 observability 体系，覆盖天数一致性、POI 分类、预算匹配、偏好执行、fallback 率和响应耗时，提升生成稳定性与可解释性。

## Interview Version

这个项目的目标不是做一个泛泛的聊天式旅游助手，而是把 AI 规划结果变成能直接演示和保存的旅行手册。我把范围收敛到北京 MVP，先建立景区、美食、酒店三类 POI 数据，再把用户偏好转成结构化约束，交给 DeepSeek 生成 JSON 行程。模型输出不会直接展示，而是经过 schema 校验、北京 POI 映射、repair 和 fallback。这样即使模型超时、余额异常或返回格式不稳定，用户仍能拿到可用方案。

项目还补了工程质量层: Supabase Auth 和 RLS 管理用户方案，planner eval 覆盖 12 个关键场景，observability 记录安全摘要、错误归因、耗时和 usage。整个项目可以作为 AI 应用从原型走向可演示产品的案例。

## Keywords

Next.js, React, TypeScript, Tailwind CSS, Supabase, RLS, Supabase Auth, DeepSeek, 高德 Web API, Vercel, AI Agent, Travel Planner, JSON Schema, Eval, Observability, Fallback, Data Pipeline
