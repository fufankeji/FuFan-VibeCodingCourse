# RunHistory 页 - Spec v0.1 (MVP)

## User Story

作为 AgentHub 用户，我希望有一个"调用历史"页，能看到：
- 最近的 AI 调用列表（时间倒序）
- 每条记录的完整 Trace（嵌套调用 + 耗时）
- Trace 用瀑布图展示（类似 Inngest / Langfuse）

目的：排查某次调用为什么慢 / 某个工具调用失败。

## Acceptance Criteria

### 功能
- AC-1：左列表展示所有 Run（mock 数据 15 条），每行显示 status / agent 名 / 耗时 / 成本 / 时间戳。
- AC-2：选中 Run 后右侧展示该 Run 的 Trace 瀑布图。
- AC-3：瀑布图基于递归 Trace 树渲染，每层 depth 缩进 24px（4px 阶梯的 6 倍）。
- AC-4：带 children 的 span 可点击折叠/展开，折叠态隐藏子树。
- AC-5：耗时色阶：<200ms 绿 / 200-1000ms 黄 / >1000ms 红（从 tokens 取色）。

### 工程
- AC-6：Trace schema 递归（`children: TraceStep[]`，用 `z.lazy()`）。
- AC-7：children 默认空数组，永远不是 null；UI 可无脑 `.map()`。
- AC-8：depth 在渲染层计算，不随 schema 持久化（MVP 阶段）。

### 视觉
- AC-9：所有颜色 / 间距 / 圆角走 tokens（`bg-bg-base` / `text-fg-default` 等）。
- AC-10：折叠按钮、选中卡片均带 focus-visible ring。

## Constraints
- Next.js 15 App Router（但 Runs 页是 `"use client"`，因为要 hover / click 交互）
- Trace 最大嵌套深度 5 层（超过即业务设计问题）
- 单次展示 50 条 Run 以内（MVP mock 数据 15 条）

## Out of Scope （本阶段不做）
- 真实数据持久化（Drizzle / Turso schema 推迟）
- cursor-based 分页（mock 数据量小，演示即可）
- 瀑布图真实时间刻度尺（只按比例渲染）
- 筛选 / 搜索 / 导出 Langfuse
- 真实 streaming 写入 trace（API Route 改造）
- 告警 / 聚合分析
