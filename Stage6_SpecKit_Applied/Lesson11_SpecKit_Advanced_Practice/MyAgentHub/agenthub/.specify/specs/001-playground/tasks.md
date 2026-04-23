# Playground 页 · Tasks v1.0

颗粒度：每个 task 一次可 commit。依赖用 `→` 标注。

## P0（必须）
- T-1 (5m) · 创建 `src/lib/schemas/agent-output.ts`：Zod schema + type export
- T-2 (5m) · 创建 `src/app/api/agent-run/route.ts`：Edge Runtime + streamObject + onError  → 依赖 T-1
- T-3 (10m) · 改写 `src/app/agent/[id]/page.tsx`：接入 `experimental_useObject`，保留左侧 Agent 卡片 + 底部相似列表的视觉骨架  → 依赖 T-1, T-2
- T-4 (3m) · `pnpm build` 验证类型与打包通过  → 依赖 T-1, T-2, T-3

## P1（应该）
- T-5 (2m) · `.env.example` 添加 `OPENAI_API_KEY`（如缺）
- T-6 (3m) · `pnpm dev` 手工冒烟：`/agent/agent-1` 200，无 Hydration warning

## P2（可选，本 Phase 不做）
- T-7 · 历史对话（Phase 2 RunHistory）
- T-8 · Rate limiting / token 预估（Phase 3）
- T-9 · 真实多 provider 分流（本 Phase UI 选项即可）

## 备注
- tasks 只列动作，约束走 CLAUDE.md / constitution / 本 plan 的技术决策。
- P0 完成后做一次 `/speckit-analyze` 自查（本次走 MVP 路径，留给 reviewer 手动过）。
