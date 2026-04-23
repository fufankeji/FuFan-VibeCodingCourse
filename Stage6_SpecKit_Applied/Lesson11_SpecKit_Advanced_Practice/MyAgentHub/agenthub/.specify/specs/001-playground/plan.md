# Playground 页 · Plan v1.0

## 1. 文件结构
- `src/lib/schemas/agent-output.ts` · Zod schema + `AgentOutput` type，前后端共用
- `src/app/api/agent-run/route.ts` · POST 流式路由（Edge Runtime + streamObject）
- `src/app/agent/[id]/page.tsx` · Playground 页，**改写**（保留视觉骨架，接入 useObject）
- `.env.local` · `OPENAI_API_KEY`（dummy 可）

## 2. 数据流
用户输入 prompt → `useObject.submit({ prompt, model })` → `POST /api/agent-run`（Edge）→ `streamObject({ schema, model: openai("gpt-4o-mini"), prompt, onError })` → `toTextStreamResponse()` → 前端 `object` 实时为 `DeepPartial<AgentOutput>` → 每个字段守卫后渐入渲染。

## 3. Schema 设计（描述，不实现）
顶层 `z.object({ title, sections, summary })`
- `title: z.string().min(2).max(80)`，必填
- `sections: z.array(sectionSchema).min(1).max(8)`，必填
- `sectionSchema = z.object({ type: z.enum(["heading","paragraph","bullet"]), content: z.string().min(1).max(500) })`
- `summary: z.string().min(10).max(200)`，必填
- 所有字段 `.describe()` 中文

## 4. API 边界
- `POST /api/agent-run`
  - req body: `{ prompt: string, model?: string }`
  - resp: text stream（`toTextStreamResponse()`）
  - 错误：`onError` 日志 + schema 校验失败由 SDK 处理，前端从 `useObject.error` 拿

## 5. 技术决策
- **streamObject 而非 streamText**：要结构化 UI，不是纯文本聊天
- **Edge Runtime 而非 Node**：冷启动快 10×，流式体验核心
- **schema 放 `src/lib/schemas/`**：遵循项目 `@/lib/*` 别名，前后端共用
- **useObject 而非手写 SSE 解析**：AI SDK v6 原生支持 DeepPartial，省掉一堆边界处理
- **provider 固定 OpenAI（gpt-4o-mini）**：dummy key 下 build 不崩，避免多 provider 引入 Anthropic SDK 依赖树问题

## 6. 风险预估
- **dummy OPENAI_API_KEY 下 runtime 请求会 401**：预期行为，前端 error 态兜底即可
- **Next 16 + React 19 下 `useParams` 需要 client component**：`page.tsx` 保留 `"use client"`
- **streamObject 的 `output: "object"` 默认模式** 与老版 `mode: "json"` 不同，严格按 v6 文档
- **schema 改动要同步前后端**：单一文件 `agent-output.ts` 导出，避免漂移
- **Edge 不兼容 tiktoken**：本 Phase 不做 token 估算，跳过
