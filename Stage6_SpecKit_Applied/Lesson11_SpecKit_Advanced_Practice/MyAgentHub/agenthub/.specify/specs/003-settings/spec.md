# 003-settings · Settings 页 + Token 预估器

## User Story
作为 AgentHub 用户，我希望在 Settings 页事前预估一次 AI 调用的 token 数与成本，
避免"敲完发送才知道花多少钱"。

## Acceptance Criteria

### 功能
- AC-1 保留已有 5 个 Tab（个人资料 / API 密钥 / 账单 / 团队 / 集成）不被破坏
- AC-2 在 "API 密钥" Tab 下新增 Token 预估器卡片
- AC-3 预估器：textarea + 模型下拉 + 实时显示 tokens / cost
- AC-4 三级预警：< $0.01 绿；$0.01-$0.10 黄；> $0.10 红
- AC-5 至少支持 4 个模型：gpt-4o-mini / gpt-4o / claude-sonnet-4 / claude-opus-4

### 工程
- AC-6 环境变量 Zod 校验：OPENAI_API_KEY (sk-)、ANTHROPIC_API_KEY (sk-ant-)、NEXT_PUBLIC_APP_URL (.url())
- AC-7 Token 预估纯前端计算，不调 API（Edge 兼容，不用 tiktoken）
- AC-8 模型定价抽成 `src/lib/schemas/model-pricing.ts`，schema + data 分离
- AC-9 env.ts 不在 next.config.ts 里 import（避免 dummy env 阻塞 build）
- AC-10 `pnpm build` 通过；`/settings` 返回 200 且无 Hydration warning

## Out of Scope
- Playground 集成（下一迭代）
- debounce（当前量级 useMemo 即可）
- API Key CRUD、账单真实数据
