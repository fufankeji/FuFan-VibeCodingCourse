# 会话交接 · 自选股管理 CRUD（F5 · 001-watchlist-crud）

## 完成时间
2026-05-28

## 状态
✅ **已交付**（17/17 tasks · 96 tests · 5 review defects fixed · tag `v0.1.0-001-watchlist-crud`）

## 交付摘要
- BE：FastAPI + SQLite，22 个 routes（11 业务 + health）；74 BE unit tests
- FE：Vite + React 19 + Tailwind v4 + Zustand 自主构建（不 fork SD），18 vitest cases
- 完整的 TDD 链：RED→GREEN→commit 每个 task 一档
- Superpowers requesting-code-review：3 Critical + 2 Important 全部修复

## 下游对接
- F1（003-watchlist-dashboard）：消费 `svc.snapshot()` / `GET /watchlist`
- F2（005-anomaly-detection-push）：订阅 `app.events.watchlist_events.subscribe(...)`
- F4（006-morning-briefing）：消费同 F1 snapshot
- F6（002-feishu-push-channel）：与 F2 dedup 协同

## 未做（留作 follow-up）
- D4 部分：`stock_basic_service.refresh` dict 防御（akshare 上游字段稳定，低频）
- D5 部分：SQLite FK 启用 + 服务层 group_id 存在性校验（单用户本地，无信任边界，留 v1.1）
- APScheduler 替代 asyncio 后台任务（留 F4 一起做）
- 移动端断点适配（FD-8）：本 feature 仅交付管理抽屉，移动端只读视图属 F1

## 怎么本地跑
```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend (另起 terminal)
cd frontend && pnpm install && pnpm dev   # 默认 :5173，proxy 转 :8000
```
