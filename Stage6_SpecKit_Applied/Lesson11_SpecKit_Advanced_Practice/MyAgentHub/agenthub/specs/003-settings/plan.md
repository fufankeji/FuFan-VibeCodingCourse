# Implementation Plan: Settings 页（模型 / API Key / Token 预警）

**Feature Branch**: `003-settings`
**Spec**: [./spec.md](./spec.md)
**Created**: 2026-04-23
**Status**: Draft

---

## 0. 已存在的相关代码（Plan 前置体检）

| 路径 | 状态 | 本 feature 的处理 |
|---|---|---|
| `src/app/settings/page.tsx` | 已存在（`"use client"` 骨架，已用 `MODEL_PRICING` + `token-estimator`）| **增量修改**，补 Key 管理 / 模型 Radio / 阈值输入 |
| `src/lib/token-estimator.ts` | 已存在（`estimateTokens / estimateCost / levelOf / formatUSD`）| **扩展**：封装 js-tiktoken 精准计数，保留 4-char fallback |
| `src/lib/schemas/model-pricing.ts` | 已存在（含 `MODEL_PRICING` 10+ 模型 + `inputPricePer1M / outputPricePer1M`）| 直接复用，**不新建** `shared/config/model-pricing.ts` |
| `src/lib/env.ts` | **不存在** | 新建，走 `/zod-env` 产出 |
| `src/app/playground/_components/prompt-input.tsx` | 已存在（001 feature）| 增量集成 TokenEstimator 组件 |

---

## 1. 文件结构（新增 / 修改）

### 新增

| 路径 | 职责 |
|---|---|
| `src/lib/token-counter.ts` | js-tiktoken 封装；lazy 动态 import WASM（保证初始 bundle ≤ 100KB）；提供 `countTokens(text, encoding)` + 4-char fallback（WASM 未加载时）|
| `src/lib/cost-calculator.ts` | 读 `model-pricing` 算 input/output cost；提供 `calcCost(inputTokens, outputTokens, modelId)` 和 `calcLevel(costUsd, alertThreshold)` |
| `src/lib/hooks/useSettings.ts` | localStorage 的统一读写 hook；管理 `apiKeys / defaultModel / alertThreshold`；监听 `storage` 事件做跨 Tab 同步 |
| `src/app/settings/_components/model-list.tsx` | shadcn `RadioGroup` 展示 6 个模型，每项显示 name / provider / 输入价 / 输出价 |
| `src/app/settings/_components/api-key-manager.tsx` | 三个 provider 的 Key 输入 + 脱敏展示（`sk-****末4位`）+ 删除；env var 来源的显示"由环境变量配置（只读）" |
| `src/app/settings/_components/threshold-input.tsx` | shadcn `Input` 数字类型，$0.01–$10.00，带内联校验 |
| `src/app/playground/_components/token-estimator.tsx` | 展示 `约 N tokens · $X.XXX`，debounce 300ms；色阶 + 阈值警告文案；纯前端计算 |

### 修改

| 路径 | 改什么 |
|---|---|
| `src/app/settings/page.tsx` | **重构**：由 Server Component 壳 + Client 子组件替换现有全 Client 实现；Server 层检测 env var 并以 props 传入 `ApiKeyManager` |
| `src/app/playground/_components/prompt-input.tsx` | 在输入框下方挂入 `<TokenEstimator>`，接收当前 modelId + alertThreshold |
| `src/lib/token-estimator.ts` | 保留现有 4-char 估算函数作 fallback；引入 `countTokens` 调用新 `token-counter.ts`（可选升级路径） |
| `src/lib/env.ts` | 新建（由 `/zod-env` 产出）：`serverSchema` 含三个 provider Key + Turso；`clientSchema` 为空（Key 禁止 NEXT_PUBLIC）|

---

## 2. 数据流

```
[Settings 页加载]
  └─ Server Component (page.tsx)
       │ 读 process.env.{OPENAI,ANTHROPIC,DEEPSEEK}_API_KEY
       │ 产出 isEnvConfigured: { openai: bool, anthropic: bool, deepseek: bool }
       │ 作为 props 传给 <ApiKeyManager isEnvConfigured={...} />
       │
  └─ ApiKeyManager ("use client")
       │ 读 localStorage agentHub:apiKey:{provider}
       │ 合并展示：env 来源 → 只读；localStorage 来源 → 可编辑/删除
       │ 保存：格式校验(sk-前缀+长度) → localStorage.setItem → 脱敏展示
       │
  └─ ModelList ("use client")
       │ 读 localStorage agentHub:defaultModel（或第一个 enabled 模型为默认）
       │ RadioGroup 选中 → localStorage.setItem agentHub:defaultModel
       │
  └─ ThresholdInput ("use client")
       │ 读 localStorage agentHub:costAlertThreshold（默认 0.50）
       │ 输入校验 [0.01, 10] → localStorage.setItem

[Playground 实时预估]
  └─ prompt-input.tsx onChange
       │ debounce 300ms
       │ countTokens(text, model.encoding)   ← token-counter.ts（lazy WASM）
       │ calcCost(inputTokens, estimatedOutputTokens, modelId)  ← cost-calculator.ts
       │ calcLevel(costUsd, alertThreshold)  ← green / yellow / red
       │ setEstimate({tokens, costUsd, level})
       │
  └─ <TokenEstimator estimate={...} alertThreshold={...} />
       │ 渲染 "约 N tokens · $X.XXX" + 色阶 + 阈值文案
       │
  └─ useSettings() (跨 Tab 同步)
       │ window.addEventListener("storage") → 阈值变更时强制刷新 alertThreshold

[localStorage 键名约定]
  agentHub:apiKey:openai        // string（原始 Key，只存，不读完整值）
  agentHub:apiKey:anthropic
  agentHub:apiKey:deepseek
  agentHub:defaultModel         // modelId string
  agentHub:costAlertThreshold   // float string（"0.50"）
```

---

## 3. js-tiktoken 集成方案（关键决策）

### 问题：WASM 体积 vs ≤100KB 约束

js-tiktoken 的 `cl100k_base` 编码器 WASM 文件约 420KB（未压缩），**直接 import 违反 spec SC-005**（≤100KB bundle 增量）。

### 解决方案：Lazy WASM 动态加载

```ts
// src/lib/token-counter.ts
let encoder: Awaited<ReturnType<typeof import("js-tiktoken").encoding_for_model>> | null = null;

export async function loadEncoder() {
  if (encoder) return encoder;
  const { encoding_for_model } = await import("js-tiktoken");  // 首次按需加载
  encoder = encoding_for_model("gpt-4o");                      // cl100k_base
  return encoder;
}

export function countTokensFallback(text: string): number {
  return Math.ceil(text.length / 4);  // 同步 fallback，WASM 未就绪时使用
}

export async function countTokens(text: string): Promise<number> {
  try {
    const enc = await loadEncoder();
    return enc.encode(text).length;
  } catch {
    return countTokensFallback(text);
  }
}
```

**效果**：
- 初始 bundle 增量 = 0（dynamic import 不计入主 chunk）
- 首次按键 100ms 内显示 fallback（4-char 估算）
- WASM 加载完成后（背景，约 500ms）后续全部精准计数
- 满足 SC-002（< 100ms 响应）和 SC-005（≤ 100KB 初始增量）

---

## 4. API Key 生命周期（安全设计）

```
用户输入 Key（完整值）
  ↓
格式校验（client-side）：sk- 前缀 + 最短 20 字符
  ↓
存入 localStorage（原始字符串，非加密）
  ↓
显示时：只取末 4 位 → 展示 "sk-****" + last4
  ↓
Playground 发请求时：从 localStorage 读取 → 放入请求 Header（X-Api-Key）
  ↓
服务端 route.ts：优先读 process.env.*_API_KEY，fallback 读 X-Api-Key header
  ↓
⚠️ localStorage Key 明文存储的安全边界：
  - 不加 NEXT_PUBLIC_，不进 bundle（宪法 §5.2）
  - 仅个人设备本地使用（§0.2 无多租户）
  - 生产部署时建议用 .env.local 而非 UI 录入
```

---

## 5. 技术决策

### 决策 1：为什么 Settings page 拆成 Server + Client

现有 `page.tsx` 全是 `"use client"`——无法直接读 `process.env`。把壳改成 Server Component：
- Server 层：`const isOpenaiEnv = !!process.env.OPENAI_API_KEY`，传 props 给 Client
- Client 层：ApiKeyManager / ModelList / ThresholdInput 保持 `"use client"`
- 好处：env var 状态服务端判断，不在客户端暴露 `process.env`（宪法 §5.2）

### 决策 2：为什么 token-counter.ts 不复用现有 token-estimator.ts

`token-estimator.ts` 已有 `estimateTokens`（4-char），直接修改有破坏现有调用者的风险（settings/page.tsx 已在用它）。新建 `token-counter.ts` 封装 js-tiktoken 作为"精准路径"，让 `token-estimator.ts` 保持不变并内部调用 `countTokens`（降级到 4-char fallback 当 WASM 未就绪）。

### 决策 3：为什么 cost-calculator.ts 独立而不合并进 token-estimator

`token-estimator.ts` 已有 `estimateCost` — 但它假设 output ≈ input（`outputRatio = 1`）。Settings 的预估场景需要：
- 分别传 inputTokens / estimatedOutputTokens
- 接收动态 modelId（来自 useSettings 的 localStorage 读值）
- 提供 `calcLevel(costUsd, userThreshold)`（阈值来自 localStorage，不是 hardcode）

独立文件避免污染已有的 `estimateCost` 签名（001 playground 在用）。

### 决策 4：为什么 useSettings hook 集中管理 localStorage

Settings 的 3 类数据（Key / 默认模型 / 阈值）在多个组件（ApiKeyManager / TokenEstimator / ModelSelector）都需要读写，加上跨 Tab `storage` 事件同步。如果各自散写 `localStorage.getItem`，维护成本极高。`useSettings` 做单一入口：读、写、跨 Tab 同步、fallback（localStorage 不可用时降级 sessionStorage）。

### 决策 5：为什么 Secret Key 不加密存 localStorage

加密需要密钥，密钥存在哪？只能存 localStorage（鸡蛋问题）。对于课程项目的个人使用场景，明文 localStorage（不加 NEXT_PUBLIC_、不进 bundle）是可接受的安全边界。如果要提升，用 `sessionStorage`（页面关闭即清）或 `.env.local`（开发者模式）。

---

## 6. 风险预估

### 风险 1：js-tiktoken WASM 在 SSR / Edge 环境 import 报错

**表现**：在 Server Component 或 API Route（edge）里 import js-tiktoken 会报 `Cannot use import statement in a module`（ESM/CommonJS 混用）或 WASM `instantiate` 失败。

**应对**：
- `token-counter.ts` 的 `import("js-tiktoken")` 只在 `typeof window !== "undefined"` 时执行（客户端专用）
- 服务端 token 估算退回 `countTokensFallback`（4-char）
- `prompt-input.tsx` 是 `"use client"`，没有 SSR 问题；但如果任何 Server Component 意外 import token-counter，需要 `"use client"` 边界隔离

### 风险 2：跨 Tab storage 事件在同一 Tab 内不触发

**表现**：MDN spec 规定 `window.storage` 事件**不在触发该事件的同 Tab 里触发**——即改阈值的那个 Tab 的 Playground 不会自动更新。

**应对**：
- Settings 组件保存后，主动触发一次 React state 更新（而不是只靠 storage 事件）
- Settings 和 Playground 如果在同一个页面（SPA），不需要依赖 storage 事件，共享 `useSettings` hook 的 state 即可
- 跨 Tab 同步只对"两个独立标签页"场景生效，满足 spec SC-006（300ms 更新）

### 风险 3：API Key 末 4 位脱敏依赖 Key 长度

**表现**：如果 Key 不足 8 字符（理论上不合法但可能存入），`key.slice(-4)` 会展示大部分明文。

**应对**：
- FR-003 格式校验：`key.length >= 20`，不合法不写入 localStorage
- 脱敏函数加保护：`key.length < 8 ? "sk-*****" : "sk-****" + key.slice(-4)`
- 单测：掌握"短 Key 不写入"的 guard

### 风险 4：Playground 集成破坏 001 的 prompt-input 测试

**表现**：给 `prompt-input.tsx` 加 TokenEstimator 需要注入 `modelId` 和 `alertThreshold`——如果 001 的其他组件没有传这两个 props，会出现 TypeScript 类型错误。

**应对**：
- `modelId` 和 `alertThreshold` 均设为 `optional`（TokenEstimator 只在有值时渲染）
- `playground-client.tsx` 从 `useSettings()` 读取并向下传 props
- 改动范围：`prompt-input.tsx`（加可选 props）+ `playground-client.tsx`（传值）= 2 个文件，不触及 API Route 和 schema
