# 会话交接 · 自选股 Dashboard（F1 · 003-watchlist-dashboard）

## 完成时间
2026-05-29

## 状态
✅ 16/16 tasks 全部交付。BE **421 passed** (baseline 384 + 37 new), FE **73 passed** (baseline 45 + 28 new), 1 BE skipped (F3 待凭证). 这是 MVP 6-feature 链中最后一个 feature.
⏸️ 待凭证：LARK_RECEIVE_ID（影响 /push/status webhook_ok 与真实异动推送）+ LLM_PRIMARY_API_KEY（影响 /explain 走 LLM；当前 template_mode auto-engaged）+ AkShare adapter（quote/kline/calendar 的真实 fetcher 待生产部署时注入）。

## 交付摘要

### 后端（backend/app/）
- `services/trading_calendar.py` — frozenset 缓存 + 9:30-11:30/13:00-15:00 时段判定 + 失败保守降级到 "未知"
- `services/quote_service.py` — spot + indices 拉取 + 内存 cache + 120s stale 阈值 + 失败返上次值
- `services/kline_service.py` — 日 K 拉取 + 失败返空 list + `recent_closes(code, n)` 给 F2 breakout 消费
- `models/quote.py` — DataStatus 枚举 (normal/suspended/no_data/stale) + QuoteSnapshot / MarketIndex / KlinePoint pydantic 模型
- `api/quotes.py` — `build_quotes_router` 注入式 (watchlist_service + quote_service + kline_service + calendar)
- `main.py` — 全 router 装配（quotes / push / anomaly / briefing / explain），LARK 缺失时 PushService 走 MagicMock + connection_ok=False

### 前端（frontend/src/）
- `services/sdk.ts` — 增 quoteSnapshot / indices / kline / pushStatus / anomalyBadges + 5 个 DTO 类型
- `store/dashboardStore.ts` — zustand store 合并 snapshot+indices+badges+push 状态，排序 持仓优先 → |change_pct| desc → code asc，跟踪 failureStartedAt 给 >5min red banner
- `components/market-overview/` — 顶部指数卡（横向滚动，bull/bear token 色）
- `components/quote-table/` — 密集表 + 持仓 2px primary 左边框（FD-3）+ 停牌灰显 + 陈旧 chip + 异动徽章位 + md: 响应式隐藏次要列（FD-8）
- `components/anomaly-badge/` — F2 7-enum 映射（limit_up/down/breakout/breakdown/volume/amplitude/event）+ 未知 badge 友好降级
- `components/push-status-bar/` — F6 未就绪自动隐藏 (status=null → return null)
- `components/charts/KlineChart.tsx` — lightweight-charts v5 封装，token 色经 getComputedStyle 注入，useEffect 严格管理 chart lifecycle (R-4 内存泄漏防御)
- `pages/StockDetail.tsx` — display-price 36px + K 线 + 失败 placeholder（FR-007）
- `pages/Dashboard.tsx` — 主组装，60s setInterval + 手动刷新 + 分组筛选 + 空状态 + >5min red banner（FR-001/003/006/009/010）
- `vitest.setup.ts` — 增 matchMedia + ResizeObserver jsdom shims for lightweight-charts

### 依赖
- 新增 `lightweight-charts` v5（FE，K 线封装）
- BE 零新增依赖

### 测试矩阵
- BE: `test_trading_calendar.py` (10) · `test_quote_models.py` (7) · `test_quote_service.py` (7) · `test_kline_service.py` (4) · `test_quotes_api.py` (5) · `test_quotes.py` (4 integration) → F1 共 **37 new BE**
- FE: `sdk.test.ts` (+5 new) · `dashboardStore.test.ts` (6) · `Dashboard.test.tsx` (6) · `QuoteTable.test.tsx` (7) · `__lint__/a11y_dashboard.test.tsx` (4) → F1 共 **28 new FE**
- G-F1 lint gate 仍绿（无 hex/rgb/hsl 裸值）；G-F2 视觉 token 测试沿用；G-F3 a11y 扩展到 Dashboard/QuoteTable/MarketOverview/PushStatusBar

## test-routing-advisor 判类与路由

| 维度 | 判定 |
|---|---|
| 主类 | 局部前后端（mix BE+FE，T005/T010 跨 BE+FE 切片） |
| 完整功能链路首贯通 | **是** — 这是 6-feature MVP 链的最后一格，至少两条端到端贯通：① 自选股 (F5) → /quotes/snapshot (F1) → Dashboard 渲染 (F1)；② 自选股 (F5) → AnomalyService 扫描 (F2，待 scheduler 启动) → /anomaly/badges (F2) → Dashboard 徽章渲染 (F1) |
| 路由 | 主要走过 backend-testing + frontend-testing 模式 (内联在本会话 task-by-task TDD)，完整链路测试 deferred —— 需 LARK + AkShare 凭证才能真起栈 |

### 已闭环 BE 缺口
- BE-1 trading_calendar 失败降级与缓存（test_trading_calendar 10 cases）
- BE-2 stale_threshold clock boundary (test_quote_service.test_stale_after_threshold)
- BE-3 source fail → cached fallback（test_failure_returns_last_value）
- BE-4 /quotes/snapshot 合并 F5 watchlist × quote_service（test_quotes_api 真 watchlist_service）
- BE-5 main.py 全 router 装配 (验证 import 即可 list 全 routes，21 routes 含 /quotes/* /push/status /anomaly/* /briefing/* /explain)

### 已闭环 FE 缺口
- FE-1 dashboardStore 排序断言（dashboardStore.test 排序+持仓优先+|change|+code）
- FE-2 fetch 失败时 push_status / badges 降级而不 crash
- FE-3 Dashboard navigates to StockDetail on row click
- FE-4 QuoteTable holding 视觉强化 (border-l + primary color via FD-1 token)
- FE-5 axe 0 violations on Dashboard empty/QuoteTable populated/MarketOverview/PushStatusBar
- FE-6 token discipline (no hardcoded colors lint gate) 仍绿
- FE-7 QuoteTable bull/bear 色绑定 token（QuoteTable.test 验证 var(--color-bull) / var(--color-bear)）

### 未闭环（Deferred — 需凭证或完整链路）
- 真实 AkShare adapter 注入 + spot 拉取冒烟（待生产部署）
- AnomalyService 扫描 → /anomaly/badges 端到端贯通（需 LARK + scheduler 启动）
- 完整链路测试：自选股加入 → 异动检测 → 飞书 + Dashboard 徽染（需 LARK_RECEIVE_ID）
- Playwright FD-8 真窄屏响应式视觉断言（jsdom 限制；当前 md: Tailwind class 已就位）

## 给下游 / 后续 session 的接口

### Dashboard 页面挂载
当前 main.py 只装配 router；前端入口 (App.tsx) 需切换到 `<Dashboard />` 作为主页。
F5 的 `<Watchlist />` 应改为 Dashboard 内 onOpenWatchlist 触发的抽屉/路由切换。

### AnomalyService scheduler 整合（待 LARK 凭证）
F2 session.md §装配示例 已给出代码，需在 main.py 中：
```python
# 真实 AkShare 适配器注入
from akshare_adapter import spot_fetcher, kline_fetcher  # 待写
_quote_service = QuoteService(spot_fetcher=spot_fetcher, index_fetcher=...)
_kline_service = KlineService(fetcher=kline_fetcher)
# 启动 APScheduler + 注册 anomaly_scan + briefing 任务
```

## 待凭证 (Credentials Required)

| 项 | `.env` key | 影响 | 提供后 |
|---|---|---|---|
| 飞书推送 | `LARK_RECEIVE_ID` | /push/status webhook_ok=False, AnomalyService 不能真发 | webhook_ok=True + 异动推送可达 |
| 主 LLM | `LLM_PRIMARY_API_KEY` | /explain 走 template_mode（已合规） | 走 DeepSeek 真 LLM ≤200 字解释 |
| 行情数据源 | AkShare 适配器（代码级） | /quotes/snapshot 返空 rows | 自选股真实报价 + 60s 刷新 |
| 交易日历 | AkShare 交易日历 | session_label="未知" 或 today=today 简易 | 节假日精确判定 |

## 关键决策记录
- **lightweight-charts v5 API**：用 `chart.addSeries(CandlestickSeries, opts)` 而非旧版 `addCandlestickSeries`；token 色经 `getComputedStyle(--color-bull)` 注入，避免硬编码 hex 触发 G-F1 lint gate
- **F2 → F1 徽章友好降级**：未知 badge string 回退到 raw label 而非崩溃（spec 提到的 F2 amplitude/event 此处一并 fall-through）
- **失败 5min banner 阈值**：`Date.now() - failureStartedAt.getTime() > 5*60_000`，store 在成功 load 时 reset 时间戳，确保不会误报
- **持仓 2px primary 左边框 + transparent 占位**：非持仓行也用 `border-l-2 border-l-transparent` 占位，避免持仓状态切换时表格抖动（FD-5 密度优先）
- **AnomalyScheduler 不在 main.py 启动**：F2 session 提示装配代码需 quote_fetcher/kline_fetcher/news_source/push 全就位；本 F1 收尾仅装 router，scheduler 启动留待真实 fetcher + LARK 凭证就位的下一个 session
- **ExplainService 在 main 用 LLMService(primary=None,...) + template_mode**：与 F3 session.md "template 模式可跑" 对齐，无凭证状态下 /explain 仍返 200 + 模板文案 + 风险尾标
- **vitest setup matchMedia + ResizeObserver shim**：jsdom 缺这俩，lightweight-charts autoSize 会炸；shim 后 KlineChart 可在测试环境正常 mount/unmount

## 风险已知 (carry-over)
- **R-1** 前端自建工作量：已交付，shadcn 未引入但 Tailwind v4 + token 直接满足密度需求
- **R-2** AkShare 限流：main.py 用空 fetcher 默认值，生产部署需注入真适配器 + 双源切换备用
- **R-4** lightweight-charts React 19 集成内存泄漏：useEffect cleanup 调 chart.remove() 已覆盖，jsdom 不能验真实泄漏，留 Playwright 跑回归
- **R-6** 首屏 < 2s：MVP 一次性同步 fetch 4 个 endpoint；30 只自选股 + 4 endpoint 在本地内网应远 < 2s（实测待生产）

## 下一步建议
1. 用户提供 `LARK_RECEIVE_ID` 后：
   - 主导 AkShare adapter 编写（quote/kline/calendar/news 真实拉取）
   - 装 AnomalyService scheduler 启动 + register_briefing_job 启动
   - 触发完整链路测试（自选股加入 → 异动 → 飞书 + Dashboard 徽染）
2. 用户提供 `LLM_PRIMARY_API_KEY` 后：
   - 去掉 F3 `tests/test_explain.py::test_real_provider_smoke` 的 skip 跑真接口
   - 验证 /explain 真实 LLM 输出 ≤200 字 + 合规过滤 + 缓存
3. 前端 App.tsx 主路由切换：把 `<Watchlist />` 换成 `<Dashboard onOpenWatchlist={...} />`
4. （可选）Playwright 跑 FD-8 响应式真窄屏视觉断言

## 主要 commits
- `feat(003-T001): trading_calendar with conservative degrade`
- `feat(003-T002-T004): quote/kline services + models`
- `feat(003-T005): /quotes REST API (snapshot/indices/kline)`
- `feat(003-T006-T007): sdk + dashboardStore for F1 contracts`
- `feat(003-T008-T016): F1 Dashboard components + page + main.py wire-up`
- `chore(003): finalize` — tag + state/session update
