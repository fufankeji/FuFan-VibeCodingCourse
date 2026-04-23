# 003-settings · Tasks

- [x] T-1 P0：`src/env.ts` server + client + shared schema；friendly error
- [x] T-2 P0：`src/lib/schemas/model-pricing.ts` schema + 4 模型数据
- [x] T-3 P0：`src/lib/token-estimator.ts` estimateTokens / estimateCost / levelOf / formatUSD
- [x] T-4 P0：`src/app/settings/page.tsx` 在 "API 密钥" Tab 嵌入 `<TokenEstimator />`，保留 5 Tab
- [x] T-5 P0：`pnpm build` 通过
- [x] T-6 P0：`pnpm dev` + `curl /settings` 返回 200，无 Hydration warning
- [ ] T-7 P1（下迭代）：接入 Playground 输入框
- [ ] T-8 P1（下迭代）：阈值自定义 + 超阈值警告 modal
