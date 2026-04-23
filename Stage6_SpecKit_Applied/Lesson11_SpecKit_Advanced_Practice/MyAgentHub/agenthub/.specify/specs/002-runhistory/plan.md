# RunHistory - Plan v0.1 (MVP)

## 1. 数据流
```
mock-data.ts (RUN_HISTORY, 扁平 trace[])
  └→ runs/page.tsx 内 buildTrace() 合成递归 Trace
       └→ <TraceWaterfall> 递归渲染
            └→ <TraceRow>（带折叠/展开 + 条带）
```

## 2. Schema（已落地）
- `src/lib/schemas/trace.ts`
  - `traceStepSchema` 用 `z.lazy()` 递归
  - `children` `.default([])`（永远不是 null）
  - `type` = `llm | tool | retrieval | agent`
  - `status` = `success | error | running`
  - `durationMs` int，上限 10 分钟

## 3. 渲染算法
- 输入：`Trace`（单棵 span 树）
- 每一层 `depth` 通过递归参数传入（不存 schema）
- 横条宽度 = `durationMs / totalMs * 100%`，最小 4%
- 颜色：`<200` / `200-1000` / `>1000` 对应 success / warning / error token

## 4. 技术决策（MVP）
- ✅ Client Component：折叠 / 展开需要 useState，且 mock 数据无 SEO 诉求
- ✅ 不跑真实 DB：Turso / Drizzle 全部 skip，演示纯靠 mock-data.ts
- ✅ 不碰 mock-data.ts：`buildTrace()` 在页面内把扁平 trace 合成递归树，避免影响 gallery / agent 详情页

## 5. 风险
- Hydration：mock-data.ts 用 seededRandom + 固定 MOCK_NOW，时间戳是确定值；`format(HH:mm:ss)` 无时区歧义（ISO → local），dev 日志待验证
- 深度过大：MVP 合成最多 2 层，天然满足 depth ≤ 5
