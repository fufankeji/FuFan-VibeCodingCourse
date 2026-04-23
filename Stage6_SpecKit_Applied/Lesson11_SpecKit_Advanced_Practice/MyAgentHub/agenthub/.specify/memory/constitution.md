# AgentHub 项目宪法 · v2.0.0

> **宪法的受众是 AI，不是人**。本文件约束 `/speckit.*` 全链路：任何 spec / plan / tasks / implement 违反本宪法视为 Quality Gate 未通过，禁止进入下一阶段。
>
> **版本**：v2.0.0 · **最近校准**：2026-04-23 · **维护**：通过 `/spec-kit-patch` 追加，禁止覆盖。
>
> **v2.0.0 变更摘要**（MAJOR · 2026-04-23）：为 `specs/002-runhistory` 功能的需要，弱化 §0.2 "无数据库" NON-NEGOTIABLE，新增**有作用域的例外条款**（见 §0.3）。其他 NON-NEGOTIABLE 规则不受影响。v1.0.0 备份于 `.specify/memory/constitution.v1.0.0.backup.md`。

---

## §0 项目边界声明（Scope Gate）

### 0.1 AgentHub 是什么

一个**浏览器端的 AI Agent 演练场 + 编排平台**：用户在 Playground 跑流式 Agent，在 RunHistory 回看执行 trace，在 Settings 管理 API Key 与模型路由。技术底座 = Next.js 15 App Router + Vercel AI SDK + OpenAI-compatible 网关（默认 OpenRouter）。

### 0.2 AgentHub **不是**什么（NON-NEGOTIABLE）

以下方向**一律不在本项目范围内**，AI 禁止擅自扩展：

- ❌ **不是** 通用 LLM 包装（ChatGPT 套壳）——我们只做结构化输出 Agent，拒绝自由聊天
- ❌ **不是** 多租户 SaaS——无用户系统、无账单、无鉴权，Key 存浏览器 localStorage
- ❌ **不是** 服务端长任务平台——所有 AI 调用走 Edge Runtime，硬上限 60 秒
- ❌ **不是** 后端持久化系统——**无数据库**，运行记录只存浏览器 IndexedDB / localStorage
- ❌ **不是** 移动端产品——只支持桌面浏览器 ≥ 1280px，不适配移动端

**Why**：边界不明 AI 会自动引入 Prisma / NextAuth / Redis / 移动端适配，每个都拖垮课程主线。
**How to apply**：看到 spec 里出现"用户登录 / 数据库 / 后台 Job / 移动端"立即在 `/speckit.clarify` 阶段打回，**除非命中 §0.3 的作用域例外**。

### 0.3 §0.2 的作用域例外（v2.0.0 引入）

以下场景**有且仅有以下场景**允许引入轻量级嵌入式数据库，作为对 §0.2 "无数据库" 的唯一例外：

| 例外场景 | 允许的技术 | 作用域 | 禁止外扩到 |
|---|---|---|---|
| RunHistory（Trace / Span 持久化） | Turso（libSQL 嵌入式 SQLite）+ Drizzle ORM | 仅 `src/app/runs/**`、`src/lib/db/**`、`src/app/api/runs/**` | 用户账号 / 鉴权 / 订阅 / 业务主数据 |

**Why**：Trace 数据天生是**树形结构 + 大量读写 + 跨会话持久**，用 IndexedDB 做瀑布图查询（按时间范围 / 状态 / 模型筛选 + 游标分页）的成本已超过直接用 SQLite 的学习价值；Turso 的 libSQL 是 SQLite 派生，课程里引入它能天然过渡到"嵌入式 DB / 边缘 DB"主题。

**NON-NEGOTIABLE 边界**（作用域外不松）：

- ❌ 禁止把 Turso 用于用户账号、鉴权、订阅、API Key 管理—— §0.2 对这些场景仍然满权生效
- ❌ 禁止引入 Postgres / MySQL / Redis / Prisma 等其他持久化方案
- ❌ 禁止把 Trace 表之外的业务表塞进 Turso（扩表需另起宪法修订）
- ✅ 客户端的临时状态（Playground 未保存的 prompt、Settings 的 API Key）仍按 §0.2 走 localStorage，禁止上云

**How to apply**：`/speckit.analyze` 看到 spec / plan 引入 DB 相关技术时，检查 **(1) 是否是 RunHistory**、**(2) 文件是否落在作用域路径**。两条同时满足才放行，否则按 §0.2 打回。

---

## §1 项目实际架构（Architecture Ground Truth）

### 1.1 目录结构（禁止自创新层）

```
src/
├── app/
│   ├── api/agent-run/route.ts   ← 唯一 AI 流式入口
│   ├── agent/ gallery/ pipeline/ pricing/ runs/ settings/
│   ├── layout.tsx · page.tsx · globals.css · not-found.tsx
├── lib/
│   ├── schemas/                 ← 所有 Zod schema 集中在此（agent-output / model-pricing / my-agents / trace）
│   ├── hooks/
│   ├── design-tokens.json · mock-data.ts · utils.ts
├── components/
│   ├── ui/                      ← shadcn/ui 全家桶（禁止改源文件）
│   ├── figma/                   ← Figma Make 产物（只读，通过 scripts 同步）
│   └── layout.tsx · particle-background.tsx
```

- **NON-NEGOTIABLE**：所有 Zod schema **必须**放在 `src/lib/schemas/`，禁止散落在 page 或 component 里
- **NON-NEGOTIABLE**：所有 AI 调用**只允许**出现在 `src/app/api/**/route.ts`，客户端禁止直连任何 LLM
- **NON-NEGOTIABLE**：`src/components/ui/` 是 shadcn 生成物，**禁止手改**；要改视觉走 Tailwind `@theme` 变量

**Why**：目录漂移是项目腐化第一信号；schema 分散导致前后端类型不同步。

### 1.2 技术栈锁定（版本见 package.json）

| 层 | 选型 | 禁止替换为 |
|---|---|---|
| 框架 | Next.js 16.2 App Router | Pages Router / Remix / Vite SPA |
| UI | Tailwind v4 `@theme` + shadcn/ui + Radix | CSS Modules / styled-components / MUI |
| AI SDK | Vercel AI SDK v6（`ai` + `@ai-sdk/openai`）| LangChain / 直接 fetch OpenAI |
| Schema | Zod v4 | Yup / io-ts / 手写校验 |
| 图标 | `lucide-react` | react-icons / emoji / 自绘 SVG |
| 表单 | react-hook-form | Formik / 受控原生 input |
| DB（仅 §0.3 作用域内） | Turso（libSQL）+ Drizzle ORM | Postgres / MySQL / Prisma / Redis / IndexedDB 替代 |

**Why**：非必要不换栈；每次换栈 Stage 06 直播要多讲 30 分钟踩坑。
**Note**：DB 一行是 v2.0.0 新增，**仅在 §0.3 作用域例外命中时生效**，其他 spec 引用此行视为 Gate 未过。

---

## §2 第一法衣 · Spec-Kit 业务法衣

### 2.1 Spec First（NON-NEGOTIABLE）

**规则**：任何 `src/` 下的新功能代码，提交前必须存在对应 `specs/NNN-<feature>/spec.md`。

- ❌ 反例：直接在 `src/app/agent/page.tsx` 加"批量运行"按钮，无 spec
- ✅ 正例：先 `/speckit.specify "批量运行 agent"` → 生成 `specs/007-batch-run/spec.md` → 再动代码

**Why**：spec 缺位时 AI 会把实现细节当需求，后续无法回答"这个按钮为什么存在"。

### 2.2 Phase Gate · 量化闸门（NON-NEGOTIABLE）

进入下一阶段必须满足以下**可验证条件**：

| 闸门 | 量化条件 |
|---|---|
| specify → clarify | spec.md 中 `[NEEDS CLARIFICATION]` 标记数 = 0 |
| clarify → plan | clarify 产出的 questions 全部有答复，且 spec 已回填 |
| plan → tasks | plan.md 通过 `/speckit.analyze` 一致性检查（0 inconsistency）|
| tasks → implement | `/speckit.checklist` 产出 checklist.md，且所有条目可勾选 |
| implement → done | checklist.md 中未完成项 = 0 且 `pnpm build` exit code = 0 |

- ❌ 反例："差不多了，直接 implement 吧"——无量化条件
- ✅ 正例：`grep -c "NEEDS CLARIFICATION" spec.md` 返回 0 才允许 clarify

**Why**：模糊闸门等于无闸门；EPAM 80/20 规则下 5 步连乘 0.8⁵ = 0.33，每步不量化最终正确率会崩。

### 2.3 禁止跳步

禁止顺序：`specify → implement`（跳过 plan/clarify/tasks/checklist）。
禁止理由："简单功能不用 plan" —— **没有简单功能**，只有没想清楚的需求。

---

## §3 第二法衣 · StyleSeed 视觉法衣

### 3.1 颜色（NON-NEGOTIABLE）

**规则**：所有颜色**必须**走 `src/app/globals.css` 中 `@theme` 变量；禁止在 JSX / CSS 里写 hex / rgb / hsl 字面量。

- ❌ 反例：`<div className="bg-[#3B82F6]">` · `style={{ color: "rgb(59,130,246)" }}`
- ✅ 正例：`<div className="bg-primary text-primary-foreground">`

**Why**：字面量颜色无法随主题切换、无法被 Figma Variables 反向同步，破坏第三法衣。

### 3.2 间距（NON-NEGOTIABLE）

**规则**：所有 padding / margin / gap 必须走 4px 阶梯：`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`（Tailwind `p-1 p-2 p-3 p-4 p-6 p-8 p-12 p-16`）。禁止 10 / 15 / 22 / 任意值。

- ❌ 反例：`<div className="p-[10px] gap-[15px]">`
- ✅ 正例：`<div className="p-3 gap-4">`

**Why**：任意间距导致视觉节奏断裂；4px 阶梯是 StyleSeed 底层约定。

### 3.3 交互态（NON-NEGOTIABLE）

**规则**：所有可交互元素（button / link / input / tab / switch）必须完整支持 **5 态**：default / hover / active / focus-visible / disabled。缺一即视为违反。

- ❌ 反例：只写 `hover:bg-primary/90`，缺 `focus-visible:` 和 `disabled:`
- ✅ 正例：shadcn `Button` 组件（已内建 5 态），直接复用

**Why**：键盘可达性、视觉反馈完整性缺失会被 a11y 审计一票否决。

### 3.4 图标（NON-NEGOTIABLE）

**规则**：功能图标**只允许**用 `lucide-react`。禁止用 emoji 充当功能图标（💾 ▶️ ⚙️ 一律禁用）；emoji 仅允许出现在**用户可输入的内容区域**。

- ❌ 反例：`<button>💾 Save</button>`
- ✅ 正例：`<button><Save className="h-4 w-4" /> Save</button>`

**Why**：emoji 跨平台渲染不一致、无法被 Tailwind 控制大小和颜色。

---

## §4 第三法衣 · Figma Variables 设计法衣

### 4.1 语义命名，禁止值语义（NON-NEGOTIABLE）

**规则**：Figma Variables 与 Tailwind `@theme` 变量必须表达**用途**，禁止表达**长相**。

- ❌ 反例：`color.blue500` · `color.gray200` · `color.red` · `spacing.22px`
- ✅ 正例：`color.primary.DEFAULT` · `color.bg.surface` · `color.fg.muted` · `color.border.subtle`

**Why**：暗色/亮色主题切换时，值语义会错位（蓝色在暗色里不一定是主色）。

### 4.2 双向同步

Figma Variables ↔ `src/app/globals.css @theme` 必须一一对应，通过 Figma MCP（`mcp__figma__get_figma_data`）或 REST 脚本（`scripts/sync-figma-styles.ts`）定期校验，发现漂移立即对齐。漂移容忍度 = 0。

---

## §5 禁止的代码模式（Forbidden Patterns）

以下模式在代码审查和 `/speckit.analyze` 中应立即打回：

### 5.1 AI SDK 层

- ❌ **禁止裸** `import { openai } from "@ai-sdk/openai"` 后直接 `openai("gpt-...")` —— 固定指向 api.openai.com，切换网关要改代码
- ✅ **必须用** `createOpenAI({ apiKey, baseURL })` 工厂模式，baseURL 从 env 读取

**Why**：2026-04 OpenRouter 实测踩坑；用户可能用 OpenRouter / Azure / DeepSeek / 自建网关，裸 import 导致切换网关要动代码。

### 5.2 环境变量层

- ❌ **禁止** 给服务端密钥（`*_API_KEY` / `*_SECRET`）加 `NEXT_PUBLIC_` 前缀
- ❌ **禁止** 在客户端组件（`"use client"`）里 `process.env.OPENAI_API_KEY`
- ✅ **必须用** T3 Stack 三 schema 分拆：`serverSchema` / `clientSchema` / `sharedSchema`，API Key 走 `z.string().startsWith("sk-")` 校验

**Why**：历史上 Stripe SECRET_KEY 因加 `NEXT_PUBLIC_` 打包到客户端 bundle，公开泄露。此条违反 = 安全事故。

### 5.3 流式 API 层

- ❌ **禁止** 流式 API 不写 `export const runtime = "edge"`
- ❌ **禁止** 不写 `export const maxDuration = 60`（Vercel Hobby 默认 10 秒会截断）
- ❌ **禁止** `streamObject` 调用不带 `onError` handler（前端收到 silent 失败）
- ❌ **禁止** 返回 `result.toTextStreamResponse()` 之外的形式（会破坏 `useObject` 消费）
- ✅ **必须** system prompt 里显式声明"输出必须严格符合 schema"

### 5.4 React 层

- ❌ **禁止** 在 Server Component 里 `"use client"` 之上用浏览器 API（`localStorage` / `window`）
- ❌ **禁止** `try { await ... } catch { /* 空吞 */ }` —— 至少要 `console.error` 或上抛
- ❌ **禁止** `useEffect` 里写数据请求然后不处理 race condition / cleanup

### 5.5 Schema 层

- ❌ **禁止** 同一个业务概念在前后端有两份 Zod schema —— 必须在 `src/lib/schemas/` 定义一次，前后端共用
- ❌ **禁止** `z.string()` 不带 `.describe()` —— AI 看不到字段含义会乱填

---

## §6 代码复用策略（Reuse-First）

**最常被 AI 忽略的一类规则**：AI 天生"倾向写而非读"。以下模块**必须先读再决定要不要复用**，禁止重造：

| 需要的能力 | 必须复用 | 禁止重造 |
|---|---|---|
| 按钮 / 输入 / 对话框 | `src/components/ui/*`（shadcn）| 自己写 `<button className="bg-blue-500">` |
| className 合并 | `src/lib/utils.ts` 的 `cn()` | 自己拼 `${a} ${b}` |
| Zod schema | `src/lib/schemas/*` 已有的 | 在 page 里新写 `z.object(...)` |
| Mock 数据 | `src/lib/mock-data.ts` | 在组件里写 `const data = [{...}]` |
| Token 估算 | `src/lib/token-estimator.ts` | 在 route.ts 里 `text.length / 4` |
| 模型价目表 | `src/lib/schemas/model-pricing.ts` | 硬编码价格 |

**How to apply**：写任何新文件前先 `grep -r "类似功能关键词" src/lib src/components/ui`；找到就复用，找不到才写新的，且新文件也放进这些复用目录。

---

## §7 Quality Gates（量化验收）

合并到主线前必须全部满足：

- [ ] `pnpm build` 退出码 = 0
- [ ] `pnpm lint` 无 error（warning 记录不阻断）
- [ ] 对应 `specs/NNN-*/checklist.md` 无未勾选项
- [ ] 新增组件全部支持 §3.3 的 5 态
- [ ] 新增颜色 / 间距 0 条硬编码（grep 验证：`grep -rE "#[0-9a-f]{6}|p-\[|m-\[|gap-\[" src/app src/components --include="*.tsx"` 返回空）
- [ ] 新增 AI 流式接口符合 §5.3 全部 5 条

---

## §8 版本与变更

- 本宪法走 **SemVer**：
  - MAJOR：删除或弱化任何 NON-NEGOTIABLE 规则
  - MINOR：新增法衣或新增 Forbidden Pattern
  - PATCH：措辞精修、正反例补充
- 变更通过 `/spec-kit-patch` 追加，**禁止覆盖**；每次变更必须更新顶部版本号与"最近校准"日期
- 备份文件：`.specify/memory/constitution.backup.v0.md`（v0 简陋版，保留回滚参考）

---

**（v1.0.0 宪法结束 · AI 在后续每个 `/speckit.*` 动作前必须重读本文件）**
