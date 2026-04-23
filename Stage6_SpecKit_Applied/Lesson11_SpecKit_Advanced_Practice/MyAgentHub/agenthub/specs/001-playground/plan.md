# Implementation Plan: Playground 页（结构化流式 Agent 演练场）

**Feature Branch**: `001-playground`
**Spec**: [./spec.md](./spec.md)
**Created**: 2026-04-23
**Status**: Draft

---

## 0. Clarify 默认值（待用户确认）

用户跳过了 `/speckit.clarify` 的 8 个盲点回答，本 plan 采用以下**合理默认**推进。每项旁标注默认选择，用户可随时覆盖：

| 盲点 | 默认选择 | 理由 |
|---|---|---|
| 错误分类展示 | **B**（6 类完整分类：network / auth / rate_limit / context_too_long / upstream_timeout / schema_parse_error） | 课程演示价值高，错误码一眼看明白 |
| 速率限制 | **A**（发送按钮在流式未结束前 `disabled`） | 实现 1 行，覆盖 90% 误操作 |
| 上下文超限 | **C**（前端 token 估算软提示 + 错误态兜底） | 复用已有 `src/lib/token-estimator.ts`，双保险 |
| 流式中切模型 | **B**（流式中禁用模型选择器 + tooltip） | 与盲点 2 一致"一次做完再切"，最安全 |
| 数据持久化 | **A**（完全不存，RunHistory 负责显式另存） | 与 spec Assumptions 第 1 条一致，边界最干净 |
| cmd+enter 跨平台 | **采纳**（mac cmd+enter / 其他 ctrl+enter，占位文本按 `navigator.platform` 自适应） | 标准做法 |
| 复制 JSON 语义 | **采纳**（剪贴板时间点的 `partialObject` 深拷贝） | streamObject 天然语义 |
| 空卡是否渲染 | **B**（无内容的卡不渲染，Story 1 AC-3 从"3 张"改为"1-3 张"） | 避免视觉噪声 |

**如需推翻**：任一条发一句"盲点 X: Custom: ..."，我回填 spec + plan 对应段落。

---

## 1. 文件结构（新增 / 修改）

### 新增

| 路径 | 职责 |
|---|---|
| `src/lib/schemas/playground.ts` | Playground 响应的 Zod schema（thinking / toolCalls / finalAnswer / metadata），前后端共用 SSOT |
| `src/lib/playground/models.ts` | 5 个模型选项的静态常量表（id / displayName / provider / contextWindow / enabled） |
| `src/lib/playground/errors.ts` | 6 类错误的判别函数 + 面向用户的文案/图标映射 |
| `src/app/api/playground/stream/route.ts` | Edge Runtime 流式端点；`createOpenAI` 工厂接 OpenRouter；`streamObject` + `onError` |
| `src/app/playground/page.tsx` | Playground 页（Server Component 壳） |
| `src/app/playground/playground-client.tsx` | `"use client"` 主容器；组合 ModelSelector / PromptInput / ResponseArea |
| `src/app/playground/_components/model-selector.tsx` | 顶部模型选择器（shadcn Select），流式中 `disabled` |
| `src/app/playground/_components/prompt-input.tsx` | 多行输入框 + 清空/发送按钮 + token 估算条 + 跨平台快捷键 |
| `src/app/playground/_components/response-area.tsx` | 响应区容器；管 `useObject` 状态；调度三类卡片；错误分类渲染；复制 JSON |
| `src/app/playground/_components/thinking-card.tsx` | 思考过程 timeline 卡，支持字段级骨架屏 |
| `src/app/playground/_components/tool-calls-card.tsx` | 工具调用表格卡，行级骨架屏 |
| `src/app/playground/_components/final-answer-card.tsx` | 最终答案 markdown 卡（`react-markdown`，不启用 KaTeX） |
| `src/app/playground/_components/error-banner.tsx` | 错误展示组件，按 6 类分别给文案 + CTA |
| `src/app/playground/_components/copy-json-button.tsx` | 复制原始 JSON（`navigator.clipboard`，失败显式反馈） |

### 修改

| 路径 | 改什么 |
|---|---|
| `src/components/layout.tsx`（或导航文件） | 把已有 `/playground` 入口接到新页面 |
| `src/app/globals.css` | 若缺少"卡片间距 24px"的 token（`--spacing-card-gap`），补一个并同步 Figma Variables（第三法衣） |
| `.env.local.example` | 增加 `OPENROUTER_API_KEY`、`OPENROUTER_BASE_URL` 说明 |
| `src/lib/env.ts`（若存在） | 在 `serverSchema` 里加 `OPENROUTER_API_KEY: z.string().startsWith("sk-")` |

### 禁止改动

- `src/components/ui/**`（shadcn 原件，宪法 §1.1 NON-NEGOTIABLE）
- `src/components/figma/**`（只读）

---

## 2. 数据流（用户输入 → 结构化渲染）

```
[用户输入]
  └─ prompt-input.tsx：onChange → token-estimator.ts 估算 → 显示 N/8192 进度条
                     → 超 80% 黄字 · 超 100% 红字 + 按钮 disabled
                     → cmd/ctrl+enter 或点"发送"触发 submit
                         │
  [submit]              │
  └─ playground-client.tsx：调 useObject({ api: "/api/playground/stream", schema: playgroundResponseSchema })
                          │ — submit({ prompt, modelId }) 入参透传
                          │ — 立即把 model-selector / prompt-input 置 disabled（盲点 2/4 的 A+B）
                          │
  [HTTP POST → Edge]     │
  └─ /api/playground/stream/route.ts (runtime="edge", maxDuration=60)
          │ 1. 请求体用 playgroundRequestSchema 校验（Zod .safeParse）
          │ 2. createOpenAI({ apiKey: env.OPENROUTER_API_KEY, baseURL: env.OPENROUTER_BASE_URL })（宪法 §5.1）
          │ 3. streamObject({
          │      model: openaiClient(modelId),
          │      schema: playgroundResponseSchema,
          │      system: "输出必须严格符合 schema；thinking 先产出，toolCalls 次之，finalAnswer 最后",
          │      prompt,
          │      onError: (err) => log + 不吞（抛给客户端）
          │    })
          │ 4. return result.toTextStreamResponse()（宪法 §5.3）
          │
  [流式回程]
  └─ useObject：每收一个 partialObject 触发 re-render
          │
  └─ response-area.tsx 按 partialObject 字段存在性分发：
          ├─ partial.thinking 存在 → <ThinkingCard data={partial.thinking} />
          │     └─ steps 为 undefined → 整卡骨架
          │     └─ steps[i].content 为 undefined → 该行骨架（字段级渐进）
          ├─ partial.toolCalls 存在 → <ToolCallsCard rows={partial.toolCalls} />
          ├─ partial.finalAnswer 存在 → <FinalAnswerCard md={partial.finalAnswer} />
          └─ error 存在 → <ErrorBanner classify(error) /> （已渲染卡片保留，不清空）
                         │
  [完成 / 中止]          │
  └─ useObject isLoading=false → 启用 model-selector / prompt-input
  └─ CopyJsonButton 始终可点；点击时 JSON.stringify(partial ?? {}, null, 2)
```

**技术栈映射**：

- 输入侧：`react-hook-form`？—— **不用**，单字段文本 + 一个 modelId 上限，`useState` 足够
- 流式侧：`@ai-sdk/react` 的 `useObject` hook（AC-8 禁止手解 SSE）
- 服务端：`ai` 的 `streamObject` + `@ai-sdk/openai` 的 `createOpenAI` 工厂
- Schema：`zod` v4 + `z.describe()`（宪法 §5.5）
- Markdown：`react-markdown` + `remark-gfm`，不启用 KaTeX（spec Out of Scope）

---

## 3. Schema 设计（描述态，不实现代码）

### 3.1 请求 schema — `playgroundRequestSchema`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `prompt` | string | `.min(1).max(50_000)` | 去首尾空白后非空；硬上限防意外粘贴 |
| `modelId` | enum | 5 个模型 id 的字面量联合 | 必须是 `models.ts` 已列 id |

### 3.2 响应 schema — `playgroundResponseSchema`

顶层 4 个字段，**全部 optional**（流式任何时刻都可能只到一部分，盲点 8 默认 B 决定"空字段不渲染"）：

```
{
  thinking?:   ThinkingBlock,       // 思考过程
  toolCalls?:  ToolCall[],          // 工具调用（可缺省，不渲染空表）
  finalAnswer?: string,             // markdown 原文
  metadata?:   ResponseMetadata,    // 模型信息 / token 计数 / 耗时
}
```

**嵌套 1：`ThinkingBlock`**

| 字段 | 类型 | optional? | 约束 |
|---|---|---|---|
| `summary` | string | 是 | 思考总览，一句话 |
| `steps` | `ThinkingStep[]` | 是 | `min(1).max(20)` |

**嵌套 2：`ThinkingStep`**

| 字段 | 类型 | optional? | 约束 |
|---|---|---|---|
| `title` | string | 否 | 步骤标题 |
| `content` | string | 是 | 步骤正文（流式中可能晚到，触发字段级骨架） |
| `kind` | enum | 是 | `"analyze" \| "plan" \| "verify" \| "decide"` |

**嵌套 3：`ToolCall`**

| 字段 | 类型 | optional? | 约束 |
|---|---|---|---|
| `toolName` | string | 否 | 工具名 |
| `input` | `Record<string, unknown>` | 是 | JSON 入参 |
| `output` | string | 是 | JSON 或文本出参 |
| `durationMs` | number | 是 | `.int().min(0)` |
| `status` | enum | 是 | `"ok" \| "error" \| "timeout"` |

数组约束：`toolCalls` 本身 `.max(20)`，防止模型疯狂幻觉出上千行工具调用撑爆 UI。

**嵌套 4：`ResponseMetadata`**

| 字段 | 类型 | optional? | 说明 |
|---|---|---|---|
| `modelId` | string | 否 | 服务端回填，供复制 JSON 时留痕 |
| `promptTokens` | number | 是 | `.int().min(0)` |
| `completionTokens` | number | 是 | `.int().min(0)` |
| `elapsedMs` | number | 是 | `.int().min(0)` |

### 3.3 错误 schema — `playgroundErrorSchema`

**不走响应体**，走 streamObject 的 onError → HTTP 层错误。客户端侧的错误对象结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| `category` | enum | `network \| auth \| rate_limit \| context_too_long \| upstream_timeout \| schema_parse_error \| unknown` |
| `message` | string | 面向用户的文案（来自 `errors.ts` 的映射，非原始错误） |
| `retryable` | boolean | 是否允许一键重试 |
| `originalHint` | string (optional) | 原始错误摘要，供"查看详情"抽屉 |

### 3.4 与 Figma Variables 的对齐（第三法衣）

所有卡片 padding / gap 必须走 token：`--spacing-card-gap: 24px`、`--spacing-card-padding: 16px`。已在第三法衣双向同步范围内；若 `globals.css` 缺失需补写 + Figma 同步。

---

## 4. API 边界

### 4.1 `POST /api/playground/stream`

**Runtime**：`edge`（宪法 §5.3 NON-NEGOTIABLE）
**maxDuration**：`60`（宪法 §5.3）
**Content-Type**（请求）：`application/json`
**Content-Type**（响应）：`text/plain; charset=utf-8`（由 `toTextStreamResponse()` 生成，`useObject` 消费）

**请求体**：

```jsonc
{
  "prompt": "string (1..50000)",
  "modelId": "gpt-5.3" | "claude-4.7" | "gemini-3.1-flash" | "deepseek-v3.2" | "qwen-3.5-flash"
}
```

**响应体**：Vercel AI SDK Object Stream 格式（帧格式由 SDK 管理，前端只用 `useObject` 消费 partialObject）。

**错误码**：

| HTTP | category | 触发条件 | UI 行为 |
|---|---|---|---|
| 400 | `schema_parse_error` | 请求体 `.safeParse` 失败 | 红 banner，"请求格式错误"（用户应该看不到，开发兜底） |
| 400 | `context_too_long` | 上游返回 context length 相关错误 | 红 banner + "缩短输入或换个模型"+ 保留已渲染卡 |
| 401/403 | `auth` | 上游 401/403 | 红 banner + CTA "去 Settings 检查 API Key" |
| 429 | `rate_limit` | 上游 429 | 橙 banner + CTA "稍后重试"（含倒计时如上游给 Retry-After） |
| 504 | `upstream_timeout` | 超出 maxDuration 或上游 504 | 橙 banner + CTA "重试" |
| 500 | `unknown` | 兜底 | 红 banner + 展开详情 |

**不得用的模式**（宪法 §5.3）：
- ❌ 返回 JSON `{ error: ... }` 之外包装 stream
- ❌ `catch { /* 空 */ }`
- ❌ `onError` 不设置

---

## 5. 技术决策

### 决策 1：为什么选 `streamObject` 不选 `streamText`

`streamText` 输出纯文本串流，需要在客户端手工切成 "thinking / toolCalls / answer" 三段——要么约定分隔符（脆弱），要么让模型输出 JSON 再 parse（退化成 streamObject 的劣质版）。`streamObject` 天然绑 Zod schema，partialObject 就是字段级渐进的 SSOT，**AC-5（字段级骨架）几乎白送**。代价：模型必须支持结构化输出（5 个备选模型都支持）。

### 决策 2：为什么用 Edge Runtime

- 宪法 §5.3 NON-NEGOTIABLE
- Vercel Hobby 限制 Node runtime 10s，Edge 可拉到 60s，足够长输出
- Edge 更贴边缘节点，首 token 延迟低，直接支撑 SC-001（95% 首字段 ≤ 2s）
- 代价：不能用 Node-only 库（如文件系统），本 feature 不需要

### 决策 3：为什么 schema 放 `src/lib/schemas/playground.ts`

- 宪法 §1.1 NON-NEGOTIABLE："所有 Zod schema 必须放在 `src/lib/schemas/`"
- 前端 `useObject({ schema })` 和后端 `streamObject({ schema })` 共享同一导出，避免"两处 schema 漂移"（宪法 §5.5）
- `src/lib/schemas/` 已有 agent-output / model-pricing / my-agents / trace，习惯一致

### 决策 4：为什么用 `useObject` 不用 `useSWR` / `fetch`

- `useSWR` 面向 REST 请求-响应，**不流式**，硬套得自己解 SSE（违反 AC-8）
- 手写 `fetch` + `ReadableStream` + JSON patch diff = 重造 `useObject` 的轮子，且不会做得更好
- `useObject` 内置：流式 schema 校验、isLoading / error / stop、`partialObject`。正好覆盖 AC-5 / AC-10

### 决策 5：为什么不存历史（遵守 spec Out of Scope）

- spec Out of Scope 第 1 条已明确"历史对话交给 RunHistory"
- 宪法 §0.2："不是后端持久化系统，运行记录只存浏览器 IndexedDB/localStorage" —— 持久化由 RunHistory 统一管 IndexedDB，Playground 自己存会产生两处写入源
- 盲点 5 默认选 A：Playground 完全不写存储；后续 RunHistory feature 增加"另存为运行记录"按钮显式触发
- 代价：刷新即丢。用户如果是"跑完一次就想记下来"的场景，等 RunHistory 到位

---

## 6. 风险预估

### 风险 1：某些模型不支持结构化输出 / JSON mode 稳定性差

**表现**：Qwen / DeepSeek 的某些版本对复杂嵌套 schema 的 JSON mode 成功率不如 OpenAI。streamObject 可能返回 `schema_parse_error` 概率偏高。

**应对**：
- 在 `models.ts` 给每个模型标 `structuredOutputSupport: "native" | "prompt-engineered" | "unreliable"`
- system prompt 里显式贴 schema 结构（宪法 §5.3 要求）+ "如果无法满足 schema 请在 thinking.summary 里说明原因"
- 实现阶段对 5 个模型跑一遍冒烟，把不稳定的在选择器里灰显 + tooltip 提示

### 风险 2：用 OpenRouter 统一接入时不同模型的 `modelId` 不一致

**表现**：OpenRouter 把 GPT-5.3 标作 `openai/gpt-5.3`，Claude 标作 `anthropic/claude-4.7`。前端的"友好 id"（`gpt-5.3`）和 OpenRouter routing id 不是一一映射。

**应对**：
- `models.ts` 里为每条保留双 id：`uiId` / `providerRouteId`
- 请求体只传 `uiId`（保持 spec 层稳定），服务端用查找表翻译成 `providerRouteId` 给 `openaiClient(...)`
- Spec 永远不绑具体 provider route，换网关只改 `models.ts`

### 风险 3：`useObject` 的 partialObject 字段抖动

**表现**：流式过程中，partial.thinking.steps 可能从 `[{title:"A"}]` → `[{title:"A", content:"..."}]` → `[{title:"A", content:"... more"}]`。如果直接用 index 作 key，React 的动画/光标会抖。

**应对**：
- ThinkingCard / ToolCallsCard 内部用**稳定 key**（`${index}-${title.slice(0,8)}`）而不是纯 index
- 骨架屏和实内容切换用 `<motion.div>` 或 CSS transition 做淡入，不要硬切
- partialObject 用 `useDeferredValue` 降频渲染避免每 16ms 都重排

### 风险 4：错误分类在 OpenRouter/多厂商下"看起来都像 500"

**表现**：OpenRouter 对上游 401 有时返回自己的 500 包裹，错误体里才有 `upstream_status: 401`。用简单的 HTTP 状态码分类会错把 auth 归 unknown。

**应对**：
- `errors.ts` 的 classifier 实行"三级判定"：1) HTTP 状态 → 2) 错误体 JSON 的 `code` / `type` 字段 → 3) 错误 message 的关键词匹配（"rate limit" / "context length" / "invalid api key"）
- 写单测：mock 3 家厂商的原始错误响应各 5 条，保证分类正确率 ≥ 90%
- 兜底分类走 `unknown` + "查看详情"抽屉，不把错 classify 当成破坏性故障

### 风险 5：Edge Runtime 里 `navigator.platform` / `window` 不可用导致 SSR/CSR 分裂

**表现**：prompt-input 的占位文本"⌘+Enter 发送"需要 `navigator.platform`。在 Server Component 里取会 undefined，Client Component 初次渲染 hydration 时 mac 用户看到的可能是 "Ctrl+Enter"，再 flash 成 "⌘+Enter"。

**应对**：
- 占位文本切到 `useEffect` 里设置（SSR 给通用值如 "Enter 发送（⌘/Ctrl）"，水合后替换）
- 或用 CSS `@supports`（不靠谱）
- 用 `@/lib/hooks/useIsMac.ts`（若无则新建）集中封装，避免散落在组件里
- 此 feature 不是第一次踩这个坑，`src/lib/hooks/` 下可能已有，先 grep 复用（宪法 §6）
