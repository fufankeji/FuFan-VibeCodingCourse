---
description: "Task list for 003-settings feature implementation"
---

# Tasks: Settings 页（模型 / API Key / Token 预警）

**Input**: [spec.md](./spec.md) + [plan.md](./plan.md)
**Branch**: `003-settings`

## Format: `[ID] [P?] [Story] Description (path · est.min · deps)`

- **[P]** = 可并行
- **[Story]** = US1 / US2 / US3
- **Priority**: P0 必须 / P1 应该 / P2 可选

## 已完成前置（不计入任务）

- ✅ `src/lib/schemas/model-pricing.ts`（含 `MODEL_PRICING` 10+ 模型 + 定价）
- ✅ `src/lib/token-estimator.ts`（`estimateTokens / estimateCost / levelOf / formatUSD`）
- ✅ `src/app/settings/page.tsx`（骨架，全 Client，已用 MODEL_PRICING 和 estimateCost）
- ✅ `specs/003-settings/spec.md` + `plan.md`

---

## Phase 1: Setup（P0）

- [ ] T001 安装 `js-tiktoken`：`pnpm add js-tiktoken`；确认 `package.json` 更新，无 peer-dep 报错（`package.json` · 5min · 无依赖）
- [ ] T002 [P] 新建 `src/lib/env.ts`：走 `/zod-env` skill 生成，`serverSchema` 包含 `OPENAI_API_KEY / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY`（各 `.optional()`）+ `TURSO_DATABASE_URL / TURSO_AUTH_TOKEN`（沿用 §0.3）；`clientSchema` 为空（Key 禁止 NEXT_PUBLIC，宪法 §5.2）（`src/lib/env.ts` · 15min · 无依赖）
- [ ] T003 [P] 更新 `.env.local.example` 追加 `OPENAI_API_KEY / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY` 三条（与 T002 同步）（`.env.local.example` · 5min · 无依赖）

**Checkpoint**：`pnpm build` 不报 env 相关错误（env.ts 正确导出）。

---

## Phase 2: Foundational · 共享工具层（P0）

**Purpose**：token-counter / cost-calculator / useSettings — US1/US2/US3 全部依赖。

- [ ] T004 新建 `src/lib/token-counter.ts`：`loadEncoder()`（lazy dynamic import js-tiktoken，首次调用时加载 WASM）+ `countTokensFallback(text)`（4-char，同步）+ `countTokens(text): Promise<number>`（优先精准，fallback 降级）；仅在 `typeof window !== "undefined"` 时加载 WASM（SSR 安全）（`src/lib/token-counter.ts` · 25min · T001）
- [ ] T005 [P] 新建 `src/lib/cost-calculator.ts`：`calcCost(inputTokens, outputTokens, modelId)` 读 `MODEL_PRICING`；`calcLevel(costUsd, alertThreshold)` 返回 `"green"|"yellow"|"red"`（阈值-60% 为黄、阈值以上为红）；`formatEstimate({tokens, costUsd, level})` 产出 `"约 N tokens · $X.XXX"` 字符串（`src/lib/cost-calculator.ts` · 20min · 无依赖）
- [ ] T006 [P] 新建 `src/lib/hooks/useSettings.ts`：管理 `{ apiKeys, defaultModel, alertThreshold }` 三段 localStorage（key 名 `agentHub:*`）；`storage` 事件监听做跨 Tab 同步；localStorage 不可用时降级 `sessionStorage`（`src/lib/hooks/useSettings.ts` · 35min · 无依赖）

**Checkpoint**：`pnpm tsx -e "import('./src/lib/token-counter').then(m => m.countTokens('hello').then(console.log))"` 输出 token 数（无报错）。

---

## Phase 3: US1 — API Key 管理 + 模型选择（P1 · MVP 🎯）

**Goal**：进 Settings → 填 3 个 Key → 选默认模型 → 切 Playground 跑通一次调用。

**Independent Test**：只做 US1 即可交付 MVP：填 OpenAI Key → 去 Playground 发一条 prompt → 不报 Auth 错误。

### 实现 — User Story 1

- [ ] T007 [P] [US1] 新建 `src/app/settings/_components/api-key-manager.tsx`：三个 provider 各一行，展示脱敏值（`sk-****末4位`）；env 来源显示只读徽章；保存前格式校验（`sk-` 前缀 + `.length >= 20`）；删除清 localStorage；调 `useSettings`（`src/app/settings/_components/api-key-manager.tsx` · 45min · T006）
- [ ] T008 [P] [US1] 新建 `src/app/settings/_components/model-list.tsx`：shadcn `RadioGroup`，数据源 `MODEL_PRICING`（筛 enabled 模型 ≥ 6 个）；每项显示 displayName / provider / inputPricePer1M / outputPricePer1M；选中写 `useSettings.setDefaultModel`（`src/app/settings/_components/model-list.tsx` · 30min · T006）
- [ ] T009 [US1] 重构 `src/app/settings/page.tsx` 为 Server Component 壳：Server 层读 `process.env.*_API_KEY` → 产出 `isEnvConfigured` props → 传给 `<ApiKeyManager isEnvConfigured={...} />`；组合 `<ModelList>` + `<ThresholdInput>`（`src/app/settings/page.tsx` · 25min · T007 T008 T010）
- [ ] T010 [P] [US1] 新建 `src/app/settings/_components/threshold-input.tsx`：shadcn `Input` 数字类型，$0.01–$10.00；实时校验 + 内联错误；`onBlur` 写 `useSettings.setAlertThreshold`（`src/app/settings/_components/threshold-input.tsx` · 20min · T006）
- [ ] T011 [US1] 修改 `src/app/api/playground/stream/route.ts`：服务端读 Key 时改为：1) `process.env.*_API_KEY`，2) 请求 Header `X-Api-Key` fallback；并在 playground-client.tsx 里提交时把 localStorage Key 放入 headers（`src/app/api/playground/stream/route.ts` + `src/app/playground/playground-client.tsx` · 30min · T009）
- [ ] T012 [US1] 手工冒烟（US1 MVP）：填 OpenAI Key → 去 Playground 发一条 "hello" → 看到正常响应（非 Auth 错误）；检查 DOM 扫描：Key 完整字符串不出现在任何 `textContent` / `value`（无新增文件 · 15min · T011）

**Checkpoint**：US1 MVP 可 demo。

---

## Phase 4: US2 — Token 预警阈值（P2）

**Goal**：Settings 里设阈值 → Playground 预估超阈值变红 + 警告文案。

**Independent Test**：设阈值 $0.05 → 在 Playground 输入 1000 字 → 颜色变红 + 超阈提示。

### 实现 — User Story 2

- [ ] T013 [US2] 新建 `src/app/playground/_components/token-estimator.tsx`：接收 `modelId / alertThreshold` 两个 optional props；内部 debounce 300ms 调 `countTokens` + `calcCost` + `calcLevel`；渲染 `"约 N tokens · $X.XXX"` + 色阶（绿/黄/红走 `text-green-600 / text-amber-500 / text-destructive` token）+ 阈值警告文案；modelId 无值时渲染 `–`（`src/app/playground/_components/token-estimator.tsx` · 40min · T004 T005）
- [ ] T014 [US2] 修改 `src/app/playground/_components/prompt-input.tsx`：追加可选 props `{ modelId?, alertThreshold? }`；在 Textarea 下方挂入 `<TokenEstimator>`（`src/app/playground/_components/prompt-input.tsx` · 15min · T013）
- [ ] T015 [US2] 修改 `src/app/playground/playground-client.tsx`：从 `useSettings()` 读 `defaultModel` 和 `alertThreshold`，向下传给 `<PromptInput>`（`src/app/playground/playground-client.tsx` · 10min · T006 T014）
- [ ] T016 [US2] 冒烟：Settings 设阈值 $0.05 → Playground 粘贴 3000 字 → 预估颜色变红 + 出现警告文案；再清空输入 → 预估消失（无新增文件 · 10min · T015）

**Checkpoint**：US1 + US2 独立可用。

---

## Phase 5: US3 — 实时 Token/Cost 预估精准化（P2）

**Goal**：Playground 按键 < 100ms 更新预估；js-tiktoken WASM 加载后自动切换精准模式。

**Independent Test**：在 DevTools Performance 里录制：按键到预估更新 ≤ 100ms（WASM 未就绪时走 fallback，时间同样 ≤ 100ms）。

### 实现 — User Story 3

- [ ] T017 [US3] 在 `token-counter.ts` 里预加载 WASM（页面 `load` 事件后触发 `loadEncoder()`，不阻塞首屏）；添加 `isEncoderReady(): boolean` 供 TokenEstimator 展示"精准"或"估算"标签（`src/lib/token-counter.ts` · 15min · T004）
- [ ] T018 [US3] 在 `token-estimator.tsx` 里展示精度标签：WASM 就绪后展示 `约 N tokens (精准)`，未就绪展示 `约 N tokens (估算)` — 小字，弱色（`src/app/playground/_components/token-estimator.tsx` · 10min · T017）
- [ ] T019 [US3] bundle 验证：`pnpm build` 后检查 `_next/static/chunks/` 里的 chunk 体积，js-tiktoken WASM 文件不在主 chunk，确认 Settings 相关初始 chunk ≤ 100KB（spec SC-005）（无新增文件 · 10min · T018）

**Checkpoint**：US1 + US2 + US3 全部可用。

---

## Phase 6: Polish & Cross-Cutting（P1 除 T024 其余 P2）

- [ ] T020 [P] DOM 扫描脱敏验证：用浏览器 DevTools 手动验证 Settings 页的 DOM，完整 API Key 不出现在任何节点的 `textContent` / `value` / `data-*`（spec SC-003）（无新增文件 · 15min · T012）
- [ ] T021 [P] 硬编码颜色扫描：`grep -rE "#[0-9a-f]{6}|color: " src/app/settings src/app/playground/_components/token-estimator.tsx` 必须为空（宪法 §3.1）（无新增文件 · 10min · T019）
- [ ] T022 [P] localStorage 禁用兜底测试：在 Chrome Incognito 模式下打开 Settings → 确认不报 JS 错误，Key 输入框可用（降级 sessionStorage），页面显示降级提示（spec Edge Cases 第 1 条）（无新增文件 · 15min · T012）
- [ ] T023 [P] 多 Tab 同步测试：开两个 Tab → Tab A 修改阈值 → Tab B Playground 预估颜色 ≤ 300ms 跟随更新（spec SC-006）（无新增文件 · 10min · T016）
- [ ] T024 `pnpm build` exit 0 + `pnpm lint` 无 error（宪法 §7 Quality Gate）（无新增文件 · 10min · T019）
- [ ] T025 [P] 更新 `specs/003-settings/checklists/requirements.md`：勾选 AC-1~13 中已实现条目（`specs/003-settings/checklists/requirements.md` · 10min · T023）

---

## Dependencies & Execution Order

### Critical Path

```
T001 → T004 → T013 → T014 → T015 → T016 → T024
(5)    (25)   (40)   (15)   (10)   (10)   (10)
= 115 min ≈ 2h（纯串行关键路径）
```

### Parallel Opportunities

- **Phase 1**：T002 / T003 并行
- **Phase 2**：T005 / T006 与 T004 无依赖，三条并行
- **Phase 3**：T007 / T008 / T010 三条并行（都依赖 T006）
- **Phase 6**：T020 / T021 / T022 / T023 / T025 五条并行

### 推荐提交顺序

```
chore(003): [T001] install js-tiktoken
feat(003): [T002-T003] env.ts + env example
feat(003): [T004] token-counter lazy WASM
feat(003): [T005] cost-calculator
feat(003): [T006] useSettings hook
feat(003): [T007] api-key-manager
feat(003): [T008] model-list
feat(003): [T010] threshold-input
feat(003): [T009] settings page Server Component refactor
feat(003): [T011] playground Key forwarding
chore(003): [T012] US1 smoke pass
feat(003): [T013] token-estimator component
feat(003): [T014-T015] wire into playground
chore(003): [T016] US2 smoke pass
feat(003): [T017-T018] precise mode label
chore(003): [T019-T025] bundle check + polish + quality gate
```

---

## 任务总量与工时估算

| Phase | 任务数 | 单人估时 |
|---|---|---|
| 1 Setup | 3 | 25 min |
| 2 Foundational | 3 | 80 min |
| 3 US1 MVP | 6 | 145 min |
| 4 US2 预警 | 4 | 75 min |
| 5 US3 精准化 | 3 | 35 min |
| 6 Polish | 6 | 70 min |
| **合计** | **25** | **≈ 7h 单人 / 3h 三人并行** |

---

## Notes

- T009（重构 page.tsx）依赖 T007 / T008 / T010 全部完成后才能合并，建议最后做
- T011（Key 转发给服务端）是 US1 功能闭环的关键，必须完成才能真正验证 Key 是否生效
- js-tiktoken 的 WASM 只在客户端加载，任何 Server Component / API Route 引入 token-counter.ts 必须确保不调用 `loadEncoder()`（见 plan §风险 1）
- `/zod-env` skill 可为 T002 提供完整的 env.ts 模板，建议先跑再调整
- `/schema-design` 用户在命令里提到：如果需要重新设计 model-pricing schema，可单独跑；但当前 `src/lib/schemas/model-pricing.ts` 已满足需求，**建议跳过，直接复用**
