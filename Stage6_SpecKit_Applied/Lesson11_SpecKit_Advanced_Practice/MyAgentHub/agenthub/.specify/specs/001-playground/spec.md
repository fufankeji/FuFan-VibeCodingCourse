# Playground 页 · Spec v1.0

## User Story
作为一个同时使用多个 AI 模型的开发者，我希望在 `/agent/[id]` 下有一个 Playground 页面：输入 prompt → 选模型 → 看 AI 响应；响应不是一坨纯文本，而是**流式生成的结构化 UI 卡片**（标题 + 分段正文 + 摘要）。

## Acceptance Criteria

### 功能维度
- AC-1: 页面顶部有模型选择器（GPT-4o / Claude 3.5 Sonnet / DeepSeek-V3）
- AC-2: 中间是 textarea 输入框 + “发送”按钮（空值禁用）
- AC-3: 下半部分是响应区，**流式**渲染 AI 返回的结构化内容
- AC-4: 结构化内容 = { title, sections[], summary }；section.type ∈ { heading | paragraph | bullet }
- AC-5: 每个字段**独立渲染**，未到齐的字段展示骨架屏
- AC-6: 支持失败态（后端 onError → 前端 error 态 → UI 显式提示，禁止静默）

### 工程维度
- AC-7: API Route 使用 Edge Runtime（`runtime = "edge"` + `maxDuration = 60`）
- AC-8: 流式必须使用 Vercel AI SDK v6 的 `streamObject` + `toTextStreamResponse()`
- AC-9: Zod schema 独立放在 `src/lib/schemas/agent-output.ts`，前后端共用
- AC-10: 前端消费使用 `experimental_useObject`（`@ai-sdk/react`），禁止自行解析 SSE

### 视觉维度
- AC-11: 复用已有 `@theme` tokens（`bg-bg-*`、`text-fg-*`、`border-border-*`）
- AC-12: 流式过程显式 loading/骨架态
- AC-13: 保留 Figma Make 迁来的左右栏视觉风格，不覆盖

## Constraints
- 技术栈：Next.js 16 + React 19 + Vercel AI SDK v6 + Zod v4
- Provider：OpenAI（默认 gpt-4o-mini），dummy key 下仍需可 build
- 无 DB（Turso 未接入），RunHistory 落库走内存 Map 或 localStorage，本 spec 不实现
- 响应式：≥ 768px 基本可用，1280px+ 为核心体验

## Out of Scope
- 历史对话 / RunHistory（Phase 2）
- 模型切换在响应中途的行为（disabled 即可，不做取消逻辑）
- Rate limiting / token 预估 / 请求签名（Phase 3）
- 真实 provider 切换（本 Phase 只跑 OpenAI；Anthropic/DeepSeek 是 UI 选项，后端固定 OpenAI）
