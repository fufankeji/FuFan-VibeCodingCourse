# Feature Specification: Settings 页（模型 / API Key / Token 预警）

**Feature Branch**: `003-settings`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "Settings 页 — 查看/切换默认模型、管理 API Key（脱敏）、设置 Token 预警阈值、在 Playground 实时预估 token/cost"
**Constitution**: v2.0.0（无需新增例外；API Key 按 §0.3 注释走 localStorage）

---

## 宪法对齐说明（AI 必读，人类可跳过）

| 用户原稿 AC | 宪法裁定 | 本 spec 处理方式 |
|---|---|---|
| AC-6 "API Key 存 .env.local" | §0.2 + §0.3 明文：Settings API Key 走 **localStorage**（禁止上云） | localStorage 为**主存储**；`.env.local` 仅为开发者静默 fallback，UI 不可编辑 env var |
| AC-9 "shared/config/model-pricing.ts" | §1.1 NON-NEGOTIABLE：schema 必须在 `src/lib/schemas/` | 复用已有 `src/lib/schemas/model-pricing.ts`，**不新建路径** |
| AC-8 "js-tiktoken，禁止 tiktoken" | 现有 `src/lib/token-estimator.ts`（4 字符 ≈ 1 token）已有估算基础 | Spec 层描述**意图**（精度提升 + Edge 兼容 + ≤100KB bundle 增量）；是否引入 js-tiktoken 留 plan 决定 |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 管理 API Key + 选默认模型（Priority: P1 · MVP）

开发者第一次打开 AgentHub，进 Settings 页把三个 provider 的 API Key 分别填进去（OpenAI / Anthropic / DeepSeek），然后从模型 Radio 列表里把默认模型切到 DeepSeek V3.2（最便宜）。填好之后切回 Playground，发一条 prompt，看到响应正常返回——确认 Key 已生效。

**Why this priority**：Settings 是整个应用的前置门槛——没有 Key，Playground 和 RunHistory 都无法正常工作。

**Independent Test**：单独实现 US1 即可交付 MVP——进 Settings → 填 3 个 Key → 选默认模型 → 切 Playground 能跑通一次调用。

**Acceptance Scenarios**:

1. **Given** 用户进入 Settings 页，**When** 查看 API Key 区域，**Then** 每个 provider 有独立的输入区，显示"未配置"或已配置的脱敏值（`sk-****1234` 格式）
2. **Given** 用户填入一个有效 Key，**When** 保存，**Then** Key 存入 localStorage，页面立刻显示脱敏值，不显示完整 Key
3. **Given** 用户填入的 Key 不以 `sk-` 开头（或为空），**When** 点保存，**Then** 内联错误提示，不写入 localStorage
4. **Given** 用户点击某条已配置的 Key 旁的"删除"，**When** 确认，**Then** 该 provider Key 从 localStorage 清除，UI 恢复"未配置"
5. **Given** 用户从模型 Radio 列表选中一个新默认模型，**When** 点保存，**Then** 偏好写入 localStorage；下次打开 Playground 时选择器默认已选该模型
6. **Given** 开发者在 `.env.local` 预填了 `OPENAI_API_KEY`，**When** 用户进入 Settings，**Then** OpenAI Key 显示"由环境变量配置（只读）"；UI 不提供编辑/删除入口

---

### User Story 2 — Token 预警阈值（Priority: P2）

开发者不想在某次手滑粘贴了大文档的 prompt 上花超过 $0.50。他在 Settings 里把阈值设成 $0.30，然后回到 Playground，输入一段很长的文字，发现输入框下方的成本预估颜色从绿变红，同时弹出一条"预计超出预警阈值"的提示。

**Why this priority**：依附于 US1 的 Key + 模型配置，且依附于 AC-4 的预估集成（US3）。独立可测但需要 US1 先可用。

**Independent Test**：US1 可用后，Settings 里设阈值 $0.10 → 回 Playground 输入超过对应 token 量的文字 → 颜色变红 + 阈值警告出现。

**Acceptance Scenarios**:

1. **Given** 用户在 Settings 打开阈值输入框，**When** 输入 $0.30，**Then** 值写入 localStorage；范围约束 $0.01 - $10.00，超出范围给内联校验提示
2. **Given** 当前 Playground 的 prompt 预估 cost < 用户设定阈值，**When** 查看输入框下方，**Then** 成本预估显示绿色或黄色（≥$0.10 转黄）
3. **Given** prompt 预估 cost > 用户设定阈值，**When** 查看输入框下方，**Then** 成本预估显示红色 + "预计超过预警阈值" 提示文案

---

### User Story 3 — 实时 Token / Cost 预估集成（Priority: P2）

开发者在 Playground 的输入框里打字，每次按键后 100ms 内，输入框下方自动更新：`约 1200 tokens · $0.036`。颜色按成本三档跟随变化。这个计算完全在前端完成，不发任何请求。

**Why this priority**：这是 Settings 的"输出端"——Settings 里定好了模型和阈值，Playground 里预估才有意义。没有 US1 的模型 + Key 配置前提，预估没有参照模型的定价表。

**Independent Test**：US1 可用后（至少默认模型已选），输入 "hello world" → 下方立刻出现 token 数和 cost；清空输入框 → 预估消失。

**Acceptance Scenarios**:

1. **Given** Playground 输入框为空，**When** 用户开始打字，**Then** 输入框下方出现"约 N tokens · $X.XXX"，延迟 < 100ms
2. **Given** 当前选中模型已有定价数据，**When** 用户粘贴大段文字（>10K 字符），**Then** 预估仍在 100ms 内更新（不等 API 响应）
3. **Given** 预估 cost 落在三档色阶区间，**When** 查看预估文案，**Then** 颜色正确：< $0.10 绿 / $0.10 - $0.50 黄 / > $0.50 红
4. **Given** 当前选中模型没有定价数据（如未来新模型）或输入框清空，**When** 用户查看，**Then** 预估区域隐藏或显示"–"，不报错

---

### Edge Cases

- **localStorage 被禁用**（隐私浏览器 / 严格隐私模式）：Key 输入框显示"您的浏览器不支持本地存储，Key 将只在本次会话有效"，降级为 sessionStorage；功能可用，但刷新后丢失
- **Key 格式合法但实际无效**（已吊销 / 余额为 0）：Settings 只做格式校验（`sk-` 前缀 + 最短长度），不做 API 调用验证；实际失败时 Playground 的错误分类负责展示
- **同时配置了 env var 和 localStorage Key**：以 env var 为准（服务端路由优先读 env），Settings 显示"由环境变量配置（只读）"，不展示 localStorage 值
- **阈值设为极小值（$0.01）**：几乎每条 prompt 都会触发红色，属于用户自选，不做额外干预
- **定价表里某模型 inputPrice / outputPrice 为 0**（免费模型）：cost 显示 `$0.000`，颜色常绿，不触发阈值警告
- **多个 Tab 同时打开 Settings 和 Playground**：localStorage 更新会触发 `storage` 事件，两个 Tab 的预估应同步更新（Playground 监听 `window.storage` 事件）
- **JSON 注入**：localStorage 写入前必须只存 Key 字符串，禁止 eval 或 JSON.parse(localStorage.getItem())（Key 是纯字符串，无需解析）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：Settings 页必须提供 API Key 管理区域，支持三个 provider（OpenAI / Anthropic / DeepSeek），每个 provider 一条独立的 Key 输入行
- **FR-002**：Key 必须以脱敏格式展示（`sk-****末4位`）；保存后全程不得以完整形式出现在页面 DOM 中
- **FR-003**：Key 保存前必须做格式校验（以 `sk-` 开头，最短 20 字符）；不合法时显示内联错误，不写 localStorage
- **FR-004**：用户可删除某 provider 的 Key；删除后该 Key 从 localStorage 清除，UI 回到"未配置"态
- **FR-005**：若该 provider Key 来自 `.env.local`（服务端检测到 env var 已配置），UI 显示"由环境变量配置（只读）"，不提供编辑/删除入口
- **FR-006**：Settings 页必须提供模型 Radio 列表，每项显示：模型名 / provider / 输入单价 / 输出单价；支持至少 6 个模型
- **FR-007**：用户选中的默认模型存入 localStorage；Playground 初始化时读取该值并预选对应模型
- **FR-008**：Settings 页必须提供 Token 预警阈值输入框，范围 $0.01 – $10.00，保存到 localStorage
- **FR-009**：Playground 输入框下方必须实时显示 token 预估（`约 N tokens · $X.XXX`），延迟 < 100ms，纯前端计算
- **FR-010**：预估 cost 按三档着色：< $0.10 绿 / $0.10 – $0.50 黄 / > $0.50 红；色阶阈值来自用户设置的预警阈值（超过阈值才触发红色，≥ 阈值 60% 触发黄色）
- **FR-011**：当预估 cost 超过用户设定的预警阈值时，在 Playground 输入框下方显示非阻塞警告文案（不弹 modal，不禁用发送）
- **FR-012**：Token 计数必须 Edge Runtime 兼容，不得引入 Node 原生模块；bundle 增量 ≤ 100KB（未压缩）
- **FR-013**：模型定价数据复用 `src/lib/schemas/model-pricing.ts`，不得在 UI 组件内硬编码价格
- **FR-014**：所有颜色、间距走设计 token；脱敏 UI 的 `****` 部分视觉权重区别于真实字符（宪法第二法衣）

### Key Entities

- **ApiKeyEntry**：单条 provider Key 配置：`{ provider, maskedValue, isFromEnv }` — 只存脱敏展示值和来源标记，**不存完整 Key**（完整 Key 只在用户输入的一次性字符串里存在，写完即丢）
- **ModelPreference**：用户选择的默认模型 id，存 localStorage key `agentHub:defaultModel`
- **CostAlertThreshold**：用户设定的阈值 USD，存 localStorage key `agentHub:costAlertThreshold`，默认 $0.50
- **TokenEstimate**：纯前端计算的临时值 `{ tokens, costUsd, tier: "safe"|"warn"|"danger" }`，不持久化

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**：Settings 页完整加载（含模型列表 + Key 状态）≤ 500ms（localStorage 读取是同步的，无 API 延迟）
- **SC-002**：Token / Cost 预估从用户按键到 UI 更新 < 100ms，100% 情况下（纯同步计算，不受网络影响）
- **SC-003**：Key 全程脱敏验证：对 Settings 页做 DOM 扫描，任意 Key 的完整字符串 **不出现**在任何 DOM 节点的 `textContent` / `value` / `data-*` 属性中
- **SC-004**：localStorage 禁用降级：在隐私模式下功能可用，会话结束前 Key 有效；不报 JS 错误
- **SC-005**：bundle 增量：`pnpm build` 产出，Settings 页相关 chunk 新增体积 ≤ 100KB（含 token 计数库的额外引入，若有）
- **SC-006**：多 Tab 同步：A Tab 改 Settings 阈值 → B Tab 的 Playground 成本颜色 ≤ 300ms 内跟随更新（`storage` 事件驱动）

## Assumptions

- API Key 主存储为 **localStorage**（宪法 §0.2 + §0.3 明文约定）；key 为 `agentHub:apiKey:{provider}`
- `.env.local` 的 env var 仅作开发者级 fallback，服务端路由优先读 env；UI 只读展示来源，不提供编辑
- Key 格式校验仅做客户端 `sk-` 前缀 + 最短长度，**不发 API 请求验证有效性**（有效性由 Playground 的错误分类负责）
- Token 计数精度要求：课程场景下 ±20% 可接受；`src/lib/token-estimator.ts` 的"4 字符≈1 token"已满足；若课程需要展示 tiktoken 精度，由 plan 阶段决定是否引入 js-tiktoken（束缚：≤100KB 增量）
- 模型定价数据复用 `src/lib/schemas/model-pricing.ts`（已有），**不新建** `shared/config/model-pricing.ts`
- Playground 里的预估集成（AC-4）是本 spec 的**产出**之一，需要修改 001-playground 的 `prompt-input.tsx`；两个 spec 的实现需在同一分支或按依赖顺序合并
- Token 预警仅做视觉提示，**不阻断发送**（不是 modal / confirm dialog），遵循"非阻塞"原则
- Settings 页无 SEO 需求，全页 Client Component 可接受；不做 URL 路由状态持久化（筛选项 Settings 页不需要）
