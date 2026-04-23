# RunHistory - Tasks v0.1 (MVP)

## P0（本阶段必做）
- [x] T1 写递归 Trace schema：`src/lib/schemas/trace.ts`（z.lazy + 中文 describe + min/max + enum）
- [x] T2 重写 `src/app/runs/page.tsx`，保留 `"use client"` 与左列表+右详情版式
- [x] T3 `buildTrace()`：把 mock-data 扁平 trace 合成递归 Trace（LLM 下挂 Tool 子调用）
- [x] T4 `<TraceWaterfall>` + `<TraceRow>` 递归渲染，带折叠/展开按钮
- [x] T5 耗时色阶通过 token class 切换（<200/200-1000/>1000ms）
- [x] T6 `pnpm build` 通过
- [x] T7 `pnpm dev` + 访问 /runs 返回 200，无 Hydration warning

## P1（下一迭代）
- [ ] 真实 Drizzle schema + Turso 持久化
- [ ] cursor-based 分页
- [ ] shadcn/ui Select 做筛选（状态 / 模型）
- [ ] Playground API Route 接入 trace 写入（`ctx.waitUntil`）
- [ ] SVG 瀑布图替换 div 方案（真实时间刻度）

## P2
- [ ] 跨 Run 聚合分析
- [ ] 告警推送
