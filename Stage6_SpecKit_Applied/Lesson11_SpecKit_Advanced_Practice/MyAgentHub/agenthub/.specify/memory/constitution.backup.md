# AgentHub 项目宪法

## 项目基本原则

- **项目名**：AgentHub
- **核心理念**：AI Agent 的商店、Playground 与编排平台
- **技术底座**：Next.js 15 App Router + Vercel AI SDK

## 基础约束

- 所有数据契约必须可校验（Zod schema 优先）
- 服务端与客户端边界清晰（"use client" 标注到位）
- 流式响应场景走 Edge Runtime

> 本宪法由 `/speckit.constitution` 初始化生成，可被 `/spec-kit-patch` 等命令追加扩展。
