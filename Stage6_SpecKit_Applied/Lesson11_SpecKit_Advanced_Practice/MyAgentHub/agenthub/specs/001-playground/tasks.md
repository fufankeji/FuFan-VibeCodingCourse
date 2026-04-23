---
description: "Task list for 001-playground feature implementation"
---

# Tasks: Playground 页（结构化流式 Agent 演练场）

**Input**: [spec.md](./spec.md) + [plan.md](./plan.md)
**Branch**: `001-playground`
**Tests**: 仅包含必要的冒烟测试（spec 未明确要求 TDD，默认最小化测试范围）

## Format: `[ID] [P?] [Story] Description (path · est.min · deps)`

- **[P]** = 可并行（不同文件、无未完成依赖）
- **[Story]** = 所属用户故事 (US1 / US2 / US3)
- **est.min** = 预估时长（分钟）
- **deps** = 依赖任务 ID
- **Priority** 放在每个 Phase 开头：P0 必须 / P1 应该 / P2 可选

## 已完成前置（Phase 0 · 不计入 tasks）

- ✅ `src/lib/schemas/playground.ts`（schema-design 产出）
- ✅ `src/lib/playground/models.ts`（stream-api-route 产出）
- ✅ `src/lib/playground/errors.ts`（stream-api-route 产出）
- ✅ `src/app/api/playground/stream/route.ts`（stream-api-route 产出）
- ✅ `globals.css` 的 `@theme` token（Phase 0 · Figma Sync 已就位）

> 注：用户在命令参数里提到 "globals.css 的 @theme 已就位(Phase 0)"，本 tasks.md 假设此前置成立。若 `--spacing-card-gap` / `--spacing-card-padding` 缺失，补进 **T004**。

---

## Phase 1: Setup · 环境与入口（P0）

**Purpose**：环境变量、导航入口、类型检查等非功能铺垫。

- [ ] T001 在 `.env.local.example` 增加 `OPENROUTER_API_KEY` 与 `OPENROUTER_BASE_URL` 两条示例，附注释说明来源（`.env.local.example` · 5min · 无依赖）
- [ ] T002 [P] 在 `src/lib/env.ts` 的 `serverSchema` 追加 `OPENROUTER_API_KEY: z.string().startsWith("sk-")` 与 `OPENROUTER_BASE_URL: z.string().url().optional()`（若文件不存在则跳过此任务，留到 `/zod-env` 统一处理）（`src/lib/env.ts` · 10min · 无依赖）
- [ ] T003 [P] 在导航/布局里把 `/playground` 入口指向新页面（grep `playground` 定位 layout / navbar 文件后修改）（`src/components/layout.tsx` 或对等文件 · 10min · 无依赖）

---

## Phase 2: Foundational · 基础设施（P0）

**Purpose**：所有 User Story 共享的基础件，必须先于 US1/US2/US3 完成。

**⚠️ CRITICAL**：此 Phase 不完成，US1 的 `ResponseArea` 无法渲染任何卡片。

- [ ] T004 在 `src/app/globals.css` 的 `@theme` 内确认/补充 `--spacing-card-gap: 24px` 与 `--spacing-card-padding: 16px`；同步 Figma Variables `color.bg.surface` / `color.border.subtle`（宪法第三法衣）（`src/app/globals.css` · 15min · 无依赖）
- [ ] T005 [P] 新建 `src/lib/hooks/useIsMac.ts`：封装 `navigator.platform` 探测，SSR 返回 `false`，客户端水合后返回真值；导出 `useIsMac()` 与 `useSubmitHint()`（返回 "⌘+Enter" 或 "Ctrl+Enter"）（`src/lib/hooks/useIsMac.ts` · 15min · 无依赖）
- [ ] T006 [P] 新建 `src/lib/playground/copy-json.ts`：`copyJson(snapshot, { onSuccess, onFail })` 使用 `navigator.clipboard.writeText`，失败显式回调（盲点 6 的可见反馈）（`src/lib/playground/copy-json.ts` · 15min · 无依赖）
- [ ] T007 [P] 冒烟测试 `src/lib/playground/errors.test.ts`：为 6 档错误各写 1-2 条 mock（401/429/504/context_length_exceeded/ECONNRESET/schema 字段缺失），断言 `classifyError` 分类正确（`src/lib/playground/errors.test.ts` · 20min · 无依赖）
- [ ] T008 端到端冒烟：`curl -X POST http://localhost:3000/api/playground/stream` 带合法/非法 body 各 1 次，确认 200 stream / 400 错误体结构符合 `playgroundErrorSchema`（手动或 `scripts/smoke-playground.sh` · 15min · T001 T004）

**Checkpoint**：基础设施就绪，3 个 User Story 可并行启动。

---

## Phase 3: User Story 1 — 结构化流式对话（Priority: P1 🎯 MVP）

**Goal**：用户输入 prompt → 选模型 → 按 cmd+enter → 响应区**字段级渐进**渲染思考卡 / 工具卡 / 答案卡。

**Independent Test**：Foundation 完成后只实现 US1 即可交付：发送 "写一个排序算法" → 2 秒内响应区出首个字段 → 流式中未到字段显示骨架 → 完成后三类卡片按顺序呈现。

### 实现 — User Story 1

- [ ] T010 [P] [US1] 新建 `src/app/playground/_components/thinking-card.tsx`：接收 `data: DeepPartial<ThinkingBlock>` + `isLoading`，渲染 summary + steps timeline；`steps[i].content` undefined 时显示字段级骨架（3 条 `animate-pulse` 灰条）；稳定 key 用 `${i}-${step.title?.slice(0,8)}`（`src/app/playground/_components/thinking-card.tsx` · 40min · T004）
- [ ] T011 [P] [US1] 新建 `src/app/playground/_components/tool-calls-card.tsx`：shadcn `Table` 渲染 `rows: DeepPartial<ToolCall>[]`；行级骨架：`status` 未到给 "⋯" 徽章，`durationMs` 未到显示 `—`；`status` 为 error/timeout 时行背景用 `bg-destructive/10`（`src/app/playground/_components/tool-calls-card.tsx` · 40min · T004）
- [ ] T012 [P] [US1] 新建 `src/app/playground/_components/final-answer-card.tsx`：使用 `react-markdown` + `remark-gfm` 渲染；**不启用 KaTeX**；流式中只要 `md` 有任意内容就开始渲染（`src/app/playground/_components/final-answer-card.tsx` · 30min · T004）
- [ ] T013 [P] [US1] 新建 `src/app/playground/_components/error-banner.tsx`：接收 `PlaygroundError`，按 6 类 + unknown 映射 `lucide-react` 图标（WifiOff / KeyRound / Clock / FileWarning / ServerCrash / AlertCircle）+ 文案 + retry CTA；`originalHint` 存在时给"查看详情"抽屉（`src/app/playground/_components/error-banner.tsx` · 30min · 无依赖）
- [ ] T014 [P] [US1] 新建 `src/app/playground/_components/copy-json-button.tsx`：调 `copyJson`（T006），成功用 `CheckCircle2` 图标 2 秒后复原，失败 toast 提示；流式中也可点（`src/app/playground/_components/copy-json-button.tsx` · 20min · T006)
- [ ] T015 [US1] 新建 `src/app/playground/_components/prompt-input.tsx`：`Textarea` + "清空"/"发送"两按钮；占位文本用 T005 的 `useSubmitHint`；监听 cmd/ctrl+enter；空白时禁用发送；调用 `src/lib/token-estimator.ts` 显示 `N / contextWindow` 条形（80% 黄 / 100% 红 + disable）（`src/app/playground/_components/prompt-input.tsx` · 45min · T005 T017)

  > 注：token-estimator 复用宪法 §6 已有文件 `src/lib/token-estimator.ts`，不重造。

- [ ] T016 [US1] 新建 `src/app/playground/_components/model-selector.tsx`：shadcn `Select`，选项从 `PLAYGROUND_MODELS` 生成（只列 `enabled: true`），流式中 `disabled=true` + tooltip "生成中，完成后可切换"（`src/app/playground/_components/model-selector.tsx` · 25min · T017)
- [ ] T017 [US1] 新建 `src/app/playground/_components/response-area.tsx`：`useObject({ api, schema })` 消费；按 `partialObject` 字段存在性分发 T010/T011/T012；空卡不渲染（盲点 8 默认 B）；错误走 `classifyError` + T013；导出 `isLoading` 给父级联动（`src/app/playground/_components/response-area.tsx` · 50min · T010 T011 T012 T013 T014）
- [ ] T018 [US1] 新建 `src/app/playground/playground-client.tsx`：`"use client"` 主容器；`useState` 管 `modelId` / `prompt`；把 `isLoading` 向下传给 `prompt-input` 和 `model-selector` 做 disabled（盲点 2 + 4 默认 A+B）；提供 submit / stop 方法（`src/app/playground/playground-client.tsx` · 35min · T015 T016 T017）
- [ ] T019 [US1] 新建 `src/app/playground/page.tsx`：Server Component 壳，渲染 `<PlaygroundClient />`；顶部标题 + 说明文案；用 `flex flex-col gap-6` 布局整页（`src/app/playground/page.tsx` · 15min · T018）
- [ ] T020 [US1] 手工冒烟：dev server 启动后访问 `/playground`，用 OpenAI + Claude 两个模型各跑 1 次"写一个快速排序"，验证 AC-1 / AC-3 / AC-5 / SC-001（首字段 ≤ 2s）（无新增文件 · 20min · T019 T008）

**Checkpoint**：US1 独立可用 → MVP 达成，可以 demo/部署。

---

## Phase 4: User Story 2 — 多模型横向切换（Priority: P2）

**Goal**：用户切换不同厂商模型后，重新发送能看到对应模型的结构化卡片。

**Independent Test**：US1 完成后，切 GPT ↔ Claude 各跑同一 prompt，响应区正确清空重渲染，顶部 chip 显示当前模型。

### 实现 — User Story 2

- [ ] T021 [US2] 在 `response-area.tsx` 顶部加"当前模型"chip（用 `metadata.modelId` 或 fallback 到请求 modelId），切换模型提交新流时自动刷新（`src/app/playground/_components/response-area.tsx` · 15min · T018）
- [ ] T022 [US2] 在 `playground-client.tsx` submit 逻辑里，检测到 modelId 变更或正在 loading 时先调 `stop()` 清空 → 再 `submit(...)`（实现 spec FR-009 + 盲点 4 默认 B：流式中选择器本就 disabled，此处只处理"完成后切换再发"路径）（`src/app/playground/playground-client.tsx` · 15min · T018）
- [ ] T023 [US2] 冒烟：同一 prompt 切 5 个 enabled 模型各跑 1 次，记录"是否都能产出合法 schema"；把 `structuredOutputSupport: unreliable` 的模型在 `models.ts` 标记并在选择器给灰态（无新增文件 · 30min · T022 T016）

**Checkpoint**：US1 + US2 都可独立工作。

---

## Phase 5: User Story 3 — 查看原始结构化数据（Priority: P3）

**Goal**：用户点"复制原始 JSON"把当前 partialObject 深拷贝到剪贴板。

**Independent Test**：流式中途点复制 → 粘贴到编辑器是合法 JSON（部分字段）；流式结束后点 → 拿到完整对象。

### 实现 — User Story 3

- [ ] T024 [US3] 把 T014 的 `CopyJsonButton` 挂到 `ResponseArea` 底部，`snapshot` 传 `structuredClone(object ?? {})`（避免 proxy 异常）（`src/app/playground/_components/response-area.tsx` · 10min · T014 T017）
- [ ] T025 [US3] 冒烟：流式进行到一半点复制 → JSON.parse 粘贴板内容不抛错；全部到齐后点复制 → 字段与 UI 展示一一对应（无新增文件 · 10min · T024）

**Checkpoint**：三个故事全部独立可用。

---

## Phase 6: Polish & Cross-Cutting（P1 除 T030 其余 P2）

- [ ] T026 [P] 响应式适配：在 ≥ 768px 下保持单列、≥ 1280px 下保留最大宽度 `max-w-4xl mx-auto`；手工在 Chrome DevTools 768/1024/1280/1440 各断点验证无破版（spec FR-011 / SC-005）（涉及 `page.tsx` · 20min · T019）
- [ ] T027 [P] 可达性：所有可交互元素的 5 态 (default/hover/active/focus-visible/disabled) 由 shadcn 内建，但手动确认 `model-selector` / `prompt-input` / 自定义按钮无退化（宪法 §3.3）（无新增文件 · 20min · T019）
- [ ] T028 [P] `partialObject` 抖动降频：在 `response-area.tsx` 内用 `useDeferredValue(object)` 包装后再向下分发（plan.md §6 风险 3）（`src/app/playground/_components/response-area.tsx` · 15min · T017）
- [ ] T029 [P] 硬编码颜色/间距扫描：`grep -rE "#[0-9a-f]{6}|p-\[|m-\[|gap-\["  src/app/playground src/lib/playground` 必须为空（宪法 §7 Quality Gate）（无新增文件 · 10min · T019）
- [ ] T030 最终 build 验证：`pnpm build` 退出码 = 0；`pnpm lint` 无 error（宪法 §7 必过）（无新增文件 · 10min · T019 T026-T029）
- [ ] T031 [P] 更新 `specs/001-playground/checklists/requirements.md`：勾选所有 AC 已实现的条目；不通过的留原因（`specs/001-playground/checklists/requirements.md` · 10min · T020 T023 T025）

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 Setup → Phase 2 Foundational → Phase 3/4/5（可并行）→ Phase 6 Polish
- Phase 2 的 T004 阻塞所有卡片组件（T010/T011/T012 的设计 token 依赖）

### Critical Path (时间最短关键路径)

```
T001 → T004 → T017 → T018 → T019 → T020 → T030
(5) + (15) + (50) + (35) + (15) + (20) + (10) = 150 min (≈ 2.5h)
```

但关键路径**不含 T010/T011/T012/T013/T014/T015/T016**——这些必须并行完成才能让 T017 不等。实际单人工期更接近 **7h**。

### Parallel Opportunities

- **Phase 1**：T002 / T003 两条 P 并行，2 分钟出完
- **Phase 2**：T005 / T006 / T007 三条 P 并行，20 分钟出完
- **Phase 3**：T010 / T011 / T012 / T013 / T014 **五条并行**（各自独立文件），可一口气提出 5 个 commit
- **Phase 6**：T026 / T027 / T028 / T029 / T031 五条并行

### 推荐提交顺序（每条 = 一个 commit）

```
feat(001): [T001] add OpenRouter env example
chore(001): [T003] wire /playground nav entry
feat(001): [T004] add card-gap/card-padding tokens
feat(001): [T005] add useIsMac hook
feat(001): [T006] add copyJson util
test(001): [T007] errors classifier smoke
feat(001): [T010] thinking card with field-level skeletons
feat(001): [T011] tool-calls card
feat(001): [T012] final answer markdown card
feat(001): [T013] error banner 6-class
feat(001): [T014] copy json button
feat(001): [T015] prompt input with token estimator
feat(001): [T016] model selector
feat(001): [T017] response area streaming dispatcher
feat(001): [T018] playground client container
feat(001): [T019] playground page
chore(001): [T020] MVP smoke pass
feat(001): [T021][T022] multi-model switch (US2)
feat(001): [T024] wire copy-json into response area (US3)
chore(001): [T026-T031] polish: responsive + a11y + grep gate
```

---

## Parallel Example: Phase 3

```bash
# 以下 5 条可同时派 5 个 developer / 5 个 subagent，各写各的文件：
- T010: src/app/playground/_components/thinking-card.tsx
- T011: src/app/playground/_components/tool-calls-card.tsx
- T012: src/app/playground/_components/final-answer-card.tsx
- T013: src/app/playground/_components/error-banner.tsx
- T014: src/app/playground/_components/copy-json-button.tsx

# 5 条完成后再汇入 T017 (response-area.tsx)，再依次进 T018 T019
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1（T001 T003，跳过 T002 若 env.ts 不存在）
2. Phase 2（T004 是硬阻塞，T005/T006/T007/T008 并行）
3. Phase 3 全部 T010→T020
4. **STOP & VALIDATE**：跑 T020 冒烟，达成 SC-001 / SC-002 就可 demo

### 渐进交付

- MVP → US1 跑通即可部署
- 再补 US2（多模型切换，15min 小任务两条）
- 再补 US3（10min 小任务两条）
- 最后 Phase 6 过 Quality Gate

### 任务总量与工时估算

| Phase | 任务数 | 单人估时 |
|---|---|---|
| Phase 1 Setup | 3 | 25 min |
| Phase 2 Foundational | 5 | 80 min |
| Phase 3 US1 (MVP) | 11 | 360 min (6h) |
| Phase 4 US2 | 3 | 60 min |
| Phase 5 US3 | 2 | 20 min |
| Phase 6 Polish | 6 | 85 min |
| **合计** | **30** | **约 10.5h（单人）/ 5h（三人并行）** |

---

## Notes

- [P] = 不同文件、无未完成依赖 → 可并派
- 每个 task 描述末尾都标了 `路径 · 估时 · 依赖`，LLM 可独立领取
- 遵守 plan.md §0 的 8 个 Clarify 默认值；若用户推翻任何一条，对应 task 需微调
- 宪法 §6 复用优先：`token-estimator.ts`、`cn()`、shadcn 组件优先复用，T015 / T016 明示依赖
- `/speckit.analyze` 建议在 T020 之后 + T030 之前各跑一次，捕捉 spec ↔ plan ↔ tasks 漂移
