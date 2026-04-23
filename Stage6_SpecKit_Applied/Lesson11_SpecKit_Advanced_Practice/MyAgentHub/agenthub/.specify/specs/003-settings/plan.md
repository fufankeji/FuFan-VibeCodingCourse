# 003-settings · Plan

## 数据流
textarea 输入 → useMemo 触发 → estimateTokens (4 字符/token) → findModel → estimateCost → levelOf → 着色渲染

## 文件
- `src/env.ts`：Zod 校验 server + client + shared。不在 next.config 里 import
- `src/lib/schemas/model-pricing.ts`：Zod schema（enum provider/tier, min/max price, 中文 describe）+ 4 个预填模型
- `src/lib/token-estimator.ts`：`estimateTokens` / `estimateCost` / `levelOf` / `formatUSD`
- `src/app/settings/page.tsx`：已有 5 Tab 保留；`TokenEstimator` 组件嵌入 "API 密钥" Tab

## 关键取舍
- 不引 `@t3-oss/env-nextjs`：自己用 `safeParse + throw` 手搓，少一个依赖
- 不引 `js-tiktoken`：Edge 兼容 + bundle 体积考虑，走 char/4 粗估；精度 ±30%，够做预警
- 不引 shadcn Select：避免 Radix Portal 的潜在 hydration 风险，原生 `<select>` + Tailwind
- 色值走 emerald/amber/rose（默认 Tailwind palette），不走项目的 `status-*` ghost tokens

## 风险
- char/4 对纯中文偏低（1 汉字 ≈ 2 token），偏差在可接受范围内，文档已标注
