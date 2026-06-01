# 实施进度 · 自选股管理 CRUD（F5 · 001-watchlist-crud）

## 当前任务
✅ **F5 已交付**（17/17 tasks · 96 tests · 5 review defects fixed · tag `v0.1.0-001-watchlist-crud`）

## 已完成
- [x] T001 · FastAPI app + config — 5 tests
- [x] T002 · SQLite init_db + integrity_check — 9 tests
- [x] T003 · WatchlistItem + Group Pydantic 模型 — 15 tests
- [x] T004 · watchlist_repo CRUD + group persistence — 21 tests
- [x] T005 · stock_basic_service AkShare 缓存 + 四模式检索 + 降级 — 28 tests
- [x] T006 · watchlist_service.add（去重 + 30/5 上限）— 33 tests
- [x] T007 · watchlist_service.remove（soft delete + 队列清理钩子）— 36 tests
- [x] T008 · watchlist_service.undo + purge_expired_soft_deletes（30s 窗口 + clock 注入）— 41 tests
- [x] T009 · watchlist_events pub/sub 契约（WatchlistRemovedEvent）— 45 tests
- [x] T010 · watchlist_service.update（持仓/分组/顺序 + 持仓上限校验）— 51 tests
- [x] T011 · 分组 CRUD（≤5 上限 + 同名校验 + 删除回落 NULL）— 57 tests
- [x] T012 · snapshot 契约（F1/F4 消费，JSON-serializable）— 61 tests
- [x] T013 · backup_db + restore_or_reset（备份→重置兜底）— 64 tests
- [x] T014 · REST 路由（items+groups+undo+search 11 端点 build_app 工厂）— 74 tests ✅ **BE 完成**
- [x] T015 · sdk.ts API client + SdkError — 8 FE tests
- [x] T017 · watchlistStore Zustand（30/5 上限选择器 + loadFromServer）— 13 FE tests
- [x] T016 · Watchlist 页 + ManageDrawer + StockCard/Badge/Search（DESIGN.md token + dashboard_a_ai 视觉对照）— 18 FE tests ✅ **FE 完成**

## 阻塞项
- 无

## 最后更新
2026-05-28
