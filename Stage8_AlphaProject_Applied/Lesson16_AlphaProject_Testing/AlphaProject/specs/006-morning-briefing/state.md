# 实施进度 · 早盘简报（F4 · 006-morning-briefing）

## 当前任务
✅ **F4 已交付**（15/15 tasks · 295 BE tests · tag `v0.1.0-006-morning-briefing`）

## 已完成
- [x] T001 · briefing config knobs — 5 tests
- [x] T002 · briefing_record 表 + CRUD helpers — 4 tests
- [x] T003 · BriefingContent / DataBlock / BriefingRecord 模型（≤1200 字校验）— 7 tests
- [x] T004 · market_overview_source（外盘/昨收/板块 注入式 fetcher）— 3 tests
- [x] T005 · calendar_source（财报/经济日历 注入式 fetcher）— 3 tests
- [x] T006 · briefing_prompt 模板（4 区块 + 字数约束）— 3 tests
- [x] T007 · card_builder（4 区块 Markdown + 降级占位 + 版本标签）— 6 tests
- [x] T008..T012 · briefing_service 编排（并发拉取 / LLM 生成 / 推送归档 / 区块降级 / 预热补发）— 11 tests
- [x] T013 · scheduler 注册 + 工作日门 + 30 天清理 — 8 tests
- [x] T014 · briefing 历史回看 API（/briefing/history + /:date）— 3 tests
- [x] T015 · SC-001..SC-006 集成测试 — 9 tests

## 阻塞项
- 无

## 最后更新
2026-05-28
