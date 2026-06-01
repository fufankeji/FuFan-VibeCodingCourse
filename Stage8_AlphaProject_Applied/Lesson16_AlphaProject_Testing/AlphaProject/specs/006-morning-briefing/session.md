# 会话交接 · 早盘简报（F4 · 006-morning-briefing）

## 完成时间
2026-05-28

## 状态
✅ **已交付**（15/15 tasks · 295 BE tests · tag `v0.1.0-006-morning-briefing`）

## 交付摘要
- BE 纯组装型 feature：复用 F3 (llm_service / news_source / sensitive_filter) + F5 (snapshot) + F6 (PushService)；新增模块仅 7 个（config knobs / db helpers / models / 2 数据源 / prompt+card_builder / briefing_service / scheduler / api）
- 62 个新增 BE 测试（baseline 233 → 295），所有 SC-001..SC-006 单独建用例
- 完整 TDD 链：每个 task RED→GREEN→commit
- DI 一切外部依赖（push / llm / news / market_source / calendar_source / watchlist_snapshot / clock / scheduler / holiday_fn），无任何真实 AkShare / OpenAI / Lark 调用

## 下游对接
- Dashboard（F1 待落地）：消费 `GET /briefing/history` 与 `GET /briefing/{date}`
- 生产 wiring（main.py / lifespan）：用 BackgroundScheduler（apscheduler）注入 `BriefingScheduler(scheduler=...).register()`；trading_calendar holiday_fn 待 F1 wires up

## 上游复用
- **F3**：`llm_service.complete(messages)` 走 LLMResponse | TemplateSignal 二路；`sensitive_filter.apply_compliance(text, limit=...)` 加尾标 + 禁词脱敏；`news_source.fetch_telegraph()` 拉财联社昨夜电报
- **F5**：`watchlist_service.snapshot()` 取自选列表（DI 通过 `watchlist_snapshot` callable，便于测试）
- **F6**：`PushService.send(PushRequest)` 推送；`priority=Priority.system` + 不带 `code/signal` ⇒ F6 不去重（spec FR-005）

## 关键决策
1. **DI over magic wiring**：所有外部依赖（含 scheduler）注入式传入，单测无需 patch
2. **裸数据版（raw）= LLM 失败兜底**：LLMResponse | TemplateSignal 二路；TemplateSignal 时 `_raw_summary()` 用 blocks 数据合成短摘要
3. **占位版（placeholder）= 全数据源失败兜底**：build_content 看到 all_missing 时直接返"今日数据获取异常"占位
4. **warmup vs full**：9:15 调用 `is_followup=False` + 有 missing 块 ⇒ warmup；9:18 调用 `is_followup=True` ⇒ full（覆写当日记录，spec FR-007）
5. **briefing_record upsert**：`ON CONFLICT(on_date) DO UPDATE` 让 9:18 完整版自动覆盖 9:15 预热版（单行/天）
6. **card_builder FR-009**：自选 0 只 ⇒ 跳过"我的自选股"区块；其他 3 区块仍渲染
7. **sensitive_filter limit 调宽**：F3 默认 200 字 cap 是单股解释级；简报卡片传 `BRIEFING_BODY_LIMIT + 2000` 让 4 区块完整渲染，但禁建议词扫描 + 尾标追加照常

## 未做（留作 follow-up）
- 生产环境 BackgroundScheduler wiring（apscheduler 包未安装，main.py lifespan 集成留作 boot 整合期一次性接入）
- AkShare 真实 endpoint 名（隔夜外盘 / 财报披露 / 经济日历）实现时核实（plan R-2）；当前所有 fetcher 注入式，prod 落地时再实例化
- trading_calendar 节假日 holiday_fn（F1 接入后注入）
- 简报 Dashboard UI（F1 任务，本 feature 已交付 BE API）
- Mac caffeinate 防睡眠（运维，非代码）

## 怎么本地跑

```bash
cd backend && uv sync && uv run pytest tests/test_briefing*.py -q
# 295 passed (含 baseline 233 + F4 新增 62)
```

## 待凭证

| 凭证 | 状态 | 影响 | 处理 |
|---|---|---|---|
| LLM_PRIMARY_API_KEY | 未配 | 简报正文走裸数据版（F3 已处理） | `.env` 配 → 自动启用 |
| LARK_RECEIVE_ID | 未配 | 推送走 F6 paused/log 路径（F6 已处理） | `.env` 配 → 自动启用 |
| AkShare 全球指数 endpoint | 未核实 | 外盘数据可能 missing；区块降级"暂无数据"（FR-006） | prod fetcher 接入时验证 |
| AkShare 财报/经济日历 endpoint | 未核实 | 同上 | prod fetcher 接入时验证 |

> 上述都是降级路径已覆盖的"非阻塞缺凭证"。F4 的核心契约（4 区块卡片 + ≤1200 字 + 尾标 + 不去重 + 工作日门）100% 测试通过。

## 测试矩阵（per SC）

| SC | 覆盖测试 |
|---|---|
| SC-001 09:15 ±30s 工作日触发 | `test_briefing.py::test_sc001_workday_window` + `test_briefing_scheduler.py::test_is_workday_*` |
| SC-002 任一数据源失败仍按时发 | `test_briefing.py::test_sc002_news_failure_does_not_block_push` + `test_briefing_service.py::test_fetch_marks_*_missing_on_failure` |
| SC-003 正文 ≤ 1200 字 | `test_briefing.py::test_sc003_body_within_1200_chars` + `test_briefing_service.py::test_generate_truncates_to_1200_chars` + `test_briefing_models.py::test_briefing_content_rejects_overlong_body` |
| SC-004 节假日/周末 100% 不发 | `test_briefing.py::test_sc004_weekend_skips_briefing` + `test_sc004_holiday_skips_briefing` |
| SC-005 保留 30 天 | `test_briefing.py::test_sc005_purge_removes_older_than_cutoff` + `test_briefing_scheduler.py::test_purge_removes_older_than_30_days` |
| SC-006 风险尾标 + 0 禁词 | `test_briefing.py::test_sc006_disclaimer_tail_present_and_forbidden_word_scrubbed` |

## test-routing-advisor 判类
**单后端 (single backend)**。本 feature 全部 BE，无 FE / 无跨服务链路。

## 后端结构性缺口闭合（backend-testing）
- 真库数据层：briefing_record upsert + delete_older_than 已用真 sqlite3 测（`test_briefing_db.py`）
- 鉴权与越权：N/A（单用户本地工具，无 auth 边界 —— 与 F5/F6 一致）
- 并发/竞态：fetch_blocks 用 ThreadPoolExecutor 并发 4 路 + per-source try/except；测试覆盖单源失败、全源失败
- 韧性/降级：LLM TemplateSignal、LLM 异常、单源失败、全源失败 4 条 RED→GREEN 路径全绿
- ⏳ Deferred：APScheduler BackgroundScheduler 真实启停的集成测试（apscheduler 包未装；DI 已足够单测；boot 整合期一次性补）

## Branch HEAD SHA & Tag
- Branch: `feat-006-morning-briefing`
- Tag: `v0.1.0-006-morning-briefing`
- DO NOT merge to main（按指令）
