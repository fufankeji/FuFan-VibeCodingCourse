# 会话交接 · 异动检测与推送（F2 · 005-anomaly-detection-push）

## 完成时间
2026-05-28

## 状态
F2 MVP 后端实现完成，16/16 task 已交付。后端测试 **322 passed** (baseline 234 + F2 主线 72 + gap closure 16，1 skipped 沿用 F3 待凭证)。代码尚未真实联通飞书 (缺 `LARK_RECEIVE_ID`，由 F6 待凭证项继承)，且未与 F1 (003) 集成 (F1 未合入本分支)。

## 交付摘要

### 新增模块（backend/app/）
- `config.py`（扩展）：`ANOMALY_*` 7 个阈值字段（振幅 / 量比 / 涵盖窗口 / 主板·创业·ST 涨跌停 % / 行情陈旧 300s）
- `models/anomaly.py`：`AnomalyType` (7 值，与 F3 5 个共享徽章逐值对齐) / `AnomalySignal` / `RuleConfig` / `AnomalyState` (内存 + diff/forget) / `RuleKind` / `AnomalyRule`
- `anomaly/rule_config.py`：`RuleConfigStore` (开关 + None-fallback-to-settings 阈值合成)
- `anomaly/price_rules.py`：`board_kind` + `detect_limit / detect_breakout_breakdown / detect_volume / detect_amplitude` 4 个纯函数
- `anomaly/event_rules.py`：`detect_events(watchlist, news_source=…)` (代码 > 全称匹配，≥3 字防误命中)
- `anomaly/anomaly_state.py`：`StateManager` 转换检测 + F5 删除事件订阅 (幂等 + unsubscribe)
- `services/anomaly_service.py`：`AnomalyService.scan_cycle()` 编排 + `QuoteSnapshot` dataclass + `_F2_TO_F3` 7→5 映射 + `_price_paused` (注入 clock 友好) + 持仓优先派单 + 多规则合并单推送
- `services/anomaly_scheduler.py`：`is_trading_hours` + `register_scan_job(scheduler, svc)` (复用 F6 APScheduler)
- `api/anomaly.py`：`GET /anomaly/badges` (F1 回填) + `GET/PATCH /anomaly/rules` (开关 + 阈值)

### 依赖
- 完全复用 `pyproject.toml` 现有依赖：fastapi / pydantic / apscheduler / pytest。无新增。

### 测试矩阵
- `test_anomaly_config.py` (2) · `test_anomaly_models.py` (4) · `test_anomaly_rule_config.py` (3)
- `test_anomaly_price_rules.py` (19) · `test_anomaly_event_rules.py` (6)
- `test_anomaly_state.py` (6) · `test_anomaly_service.py` (12) · `test_anomaly_scheduler.py` (9)
- `test_anomaly_api.py` (5) · `test_anomaly.py` (7 集成场景 SC-001~006)
- `test_gap_anomaly_clock_boundary.py` (2) · `test_gap_anomaly_contracts.py` (14)
- F2 新增合计 **89 tests**；累计 backend **322 passed**。

## 下游对接

### 给 F1（003 Dashboard）— 异动徽章接口

```python
import httpx
resp = httpx.get("http://localhost:8000/anomaly/badges")
# {"600519": ["limit_up"], "000001": ["volume","breakout"]}
```

契约（G6 已固化）：
- 响应 = `dict[str, list[str]]`；list 内 badge 字符串字母序，便于稳定渲染
- 空 state 返 `{}` (不是 `null`)
- badge 字符串值 ⊆ `AnomalyType` 枚举（与 F3 `models.explain.AnomalyType` 在 5 个共享值上对齐：limit_up / limit_down / breakout / breakdown / volume；F2 还可能输出 amplitude / event — F1 渲染时需保持友好降级）

### 给 F1 / F4 — 规则开关 API

```python
httpx.patch("/anomaly/rules", json={"volume_enabled": False, "amplitude_pct": 12.0})
# 返回完整 RuleConfig（含所有开关 + 自定义阈值）
```

### 装配（main.py 集成示例 — 未实际写入 main.py，留给 F1 整合时统一接入）

```python
from app.anomaly.anomaly_state import StateManager
from app.anomaly.rule_config import RuleConfigStore
from app.services.anomaly_service import AnomalyService
from app.services.anomaly_scheduler import register_scan_job
from app.api.anomaly import build_anomaly_router

state_mgr = StateManager()
state_mgr.subscribe_watchlist_events()  # F5 删除事件
rule_store = RuleConfigStore()

anomaly_svc = AnomalyService(
    watchlist_service=watchlist_service,        # F5
    quote_fetcher=quote_service.get_snapshot,   # F1 (待合入)
    kline_fetcher=kline_service.recent_closes,  # F1 (待合入)
    news_source=news_source,                    # F3
    explain_service=explain_service,            # F3
    push_service=push_service,                  # F6
    state_manager=state_mgr,
    rule_store=rule_store,
)
register_scan_job(scheduler, anomaly_svc)       # 复用 F6 APScheduler
app.include_router(build_anomaly_router(state_manager=state_mgr, rule_store=rule_store))
```

## test-routing-advisor 判类与路由

| 维度 | 判定 |
|---|---|
| 主类 | 单后端 |
| 次类 | 跨模块契约（F2 → F1/F3/F5/F6） |
| 完整功能链路首贯通 | **否**（F1 未合入；两条候选链路待 F1 后由 full-chain-testing 挖掘） |
| 路由 | → `backend-testing`（已闭环 6 个 gap） |

### Gap closure 详情
- **G1** stale-quote 300s clock boundary（fake clock ±1s）
- **G2** watchlist_events subscribe 幂等 + 跨测泄漏隔离
- **G3** PushRequest `signal` key 跨周期稳定性（多 tag 字母序）
- **G4** F2→F3 全 7 个 AnomalyType 真 pydantic 校验
- **G5** F2↔F5 snapshot 真实形态（真 WatchlistService + tmp SQLite）
- **G6** `/anomaly/badges` 契约 snapshot（空 dict / 排序）

## 待凭证 (Credentials Required)

| 项 | 来源 | 影响 | 备注 |
|---|---|---|---|
| `LARK_RECEIVE_ID` | 飞书 Lark App | F2 推送链路真发送 | 沿用 F6 待凭证项；F2 调 PushService 自动按其配置走 mock / 真发 |

## 未做（明确推迟）
- ❌ **F1 集成 / main.py wiring**：F1 (003) 未合入本分支；wire-up 留待 F1 收尾时统一接入 (装配示例见上)
- ❌ **板块整体异动**：v1.1（PRD Out-of-Scope）
- ❌ **规则编辑器**：v2
- ❌ **完整 trading_calendar (节假日)**：MVP 用 anomaly_scheduler.is_trading_hours 简易版；F1 (003) 含完整版后替换
- ❌ **anomaly_state SQLite 落盘**：plan 列为可选；MVP 全内存（重启清零，下次扫描自动重建）
- ❌ **一字板 / 封单精确判定**：v1.1（MVP 用涨跌幅近似已记录在 spec §2.3 + plan R-2）
- ❌ **Sched 实际启动 wiring**：register_scan_job 已写好，但 main.py 未挂载（待 F1 整合）

## 风险已知 (carry-over)
- **R-2** 一字板封单未做精确判定（涨跌幅近似，spec §2.3 ✓ 文档已声明）
- **R-7** 事件规则同名公司误匹配可控但有噪声（v1.1 优化；G4 已部分覆盖 name ≥3 字护栏）
- **q.ts=0 falsy 短路**：`_price_paused` 用 `if q.ts and (now - q.ts) > threshold`，当 quote.ts=0 (epoch) 时被当作 fresh —— 对接 F1 quote_service 时需保证真 ts 不为 0（生产中不可能，但单测注意）

## 关键决策记录
- **F2-only 类型 (amplitude / event) 映射 F3**：`amplitude → VOLUME`，`event → SUMMARY` (`_F2_TO_F3` dict)；保持 F3 解释链路统一，无需扩 F3 enum
- **signal 字段格式**：`"+".join(sorted(tags))` —— 单股多规则合并同时为 F6 dedup 提供稳定 key
- **持仓优先**：在 `_dispatch` 内做 sort（holding_codes set），不依赖 watchlist 入参顺序
- **F1 trading_calendar 缺位的临时处理**：anomaly_scheduler 自带最小 is_trading_hours (无节假日)，待 F1 合入后切换；scheduler 注入设计支持热替换

## 下一步建议
1. F1（003 watchlist-dashboard）合入后：
   - 替换 anomaly_scheduler.is_trading_hours → F1 trading_calendar
   - 在 main.py wire AnomalyService（quote_service / kline_service 注入）
   - 挂载 build_anomaly_router 到 app
   - 触发 `test-routing-advisor` 再跑一次，把"自选股 → 异动 → Dashboard 徽染"链路交给 `full-chain-testing`
2. 配置 `LARK_RECEIVE_ID` 后做一次真实端到端：触发涨停 → 飞书卡片送达
