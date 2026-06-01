# 实施进度 · 异动检测与推送（F2 · 005-anomaly-detection-push）

## 当前任务
[x] T001-T016 全部完成 — 进入收尾测试路由阶段

## 已完成
- T001 config 阈值
- T002 anomaly 数据模型
- T003 rule_config 开关 + 阈值覆盖
- T004 限制涨跌停（板块感知）
- T005 涵盖（突破/跌破）
- T006 量能 + 振幅
- T007 事件规则（电报/公告匹配）
- T008 StateManager 转换检测
- T009 watchlist 删除事件清理
- T010 anomaly_service 扫描主体
- T011 行情陈旧保护（FR-009）
- T012 推送编排（持仓优先 + 多规则合并）
- T013 APScheduler 注册 + 交易时段门控
- T014 GET /anomaly/badges（F1 回填）
- T015 GET/PATCH /anomaly/rules
- T016 集成 SC-001~006 场景测试

## 阻塞项
- 无

## 测试矩阵
- 234 baseline → **306 passed**（+72 F2 新增）

## 最后更新
2026-05-28
