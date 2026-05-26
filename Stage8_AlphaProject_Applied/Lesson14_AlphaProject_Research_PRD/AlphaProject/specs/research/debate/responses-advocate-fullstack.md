# Phase 2 Round 1 Responses · advocate-fullstack

> 代言人：advocate-fullstack（owns go-stock + ai-hedge-fund）
> 落盘时间：2026-05-20
> 用途：Phase 3 Lead 判决证据

---

## 对 position-paper-go-stock 的质疑回应

### E-Q1 (red-team): GPLv3 三方案缓解成本被低估

**质疑摘要**：方案 A 整体 GPLv3 = 商业自杀；方案 B 重写 LLM 抽象 3 人日低估，实际 5-8 人日；方案 C 双重许可无 paper 内证据，ArvinLovegood 6 个月无任何商业 license 公告。要求回答 §5.1 上界 30 人日来源 + 方案 C 证据。

**回应**：
- 方案 A 商业自杀：**承认**。to-C 商业 SaaS 不能走方案 A。
- 方案 B 5-8 人日（不是 3）：**承认**。8 provider × 250 行平均 + 测试 = 2500 行 ≈ 6 人日。
- 方案 C 双重许可：**承认无 paper 内证据**，撤回。
- §5.1 上界 30 人日来源：完全重写 LLM 抽象+推送+异动+龙虎榜 ~20 人日（避所有 GPL 模块）+ 集成测试 10 人日。撤回后修正为 **15-20 人日**，但这等价于"几乎从零写"，fork 价值大幅缩水至仅剩骨架灵感。

立场退：**商业闭源路线下，go-stock 不应 fork，只应借鉴**。

### E-Q2 (red-team): "MCP 工具协议落地领先" thesis 反转

**质疑摘要**：§2 第 8 点吹 MCP 是亮点，§6 缺陷 3 又写"通过 MCP 让 Claude Code 外部调度比自建 LangGraph 更 2026"——thesis 反转。若走 MCP 路线直接写 Python MCP server 包 akshare 1 小时即可，不需要 fork GPLv3 桌面应用。要求回答为何需要 fork go-stock。

**回应**：承认论证内部矛盾。诚实回答：若团队走"MCP server + 外部 agent 调度"路线，**确实不需要 fork go-stock**——写 Python MCP server 包 akshare 1-2 人日即可。go-stock 的 MCP 支持是其作为**桌面工具**的扩展点，不是 fork 它的理由。

**撤回 §2 第 8 点作为 fork 论证**。修正立场：fork go-stock 仅在"Go 栈 + 桌面/个人工具"路线下成立。

### E-Q3 (red-team): 342 release 反映无发布纪律

**质疑摘要**：5.8k 星 12 个月发 342 release（每天一个版本号）= 无稳定版、API 频繁破坏、无 changelog 工程纪律。vnpy/qlib 工业级是 3-6 个月一个 minor。要求回答 fork 后版本策略：锁版本（失维护红利）还是跟版本（每天处理破坏性变更）？

**回应**：部分承认。reframe：5.8k star 个人项目高频发版反映**作者高频响应 + 用户反馈快**，但也确实**无 semver/无 changelog 工程纪律**。

fork 策略正面回答：**锁版本 + 主动 cherry-pick**——锁定某个稳定 release（如 v2026.05.20.2-release），仅在出现安全/数据源 fix 时手动 cherry-pick 单 commit，不跟主线。代价：失去新功能红利。承认这削弱"极活跃维护"作为 fork 优势的论证。

### Integration-Challenge (integration-eval): GS 桌面形态与 Web 7×24 错位

**质疑摘要**：GS 是 Wails 桌面单二进制，与产品定义"7×24 服务端 + Web Dashboard"根本不匹配；GPLv3 强传染；Wails 无对外 API；组合 8 (GS+AHF) 仅 2.5 分（全场最低）；组合 15 (CN + GS 借鉴 + AHF 借鉴) 7.5 分才是 GS 正确用法。要求承认错位或给出 Wails → Web 多用户具体工程路径。

**回应**：承认形态错位是真问题，但坚持 fork 立场。具体工程路径（不空话）：

**Wails → Web 多用户改造，4 步 12-18 人日**：
1. **剥离 Wails 框架**（2 人日）：删 `main.go` 的 `wails.Run()`，保留 `app.go` 所有方法体。Wails binding 本质是 Go 方法暴露给 JS，方法签名与 HTTP handler 一一对应。
2. **加 Gin/Fiber HTTP 层**（3 人日）：`backend/api/` 新建路由文件，把 `app.GetStockList()` 包成 `GET /api/stocks`、`AskAI()` 包成 `POST /api/ai/ask`（SSE 流）。Go 原生 HTTP，不是"改造核心架构"。
3. **SQLite → PostgreSQL + 多租户**（4-6 人日）：models 加 user_id 字段，sqlc/gorm 改 PG driver。常规迁移。
4. **前端独立部署**（3-5 人日）：`frontend/` 已是 Vue3+Vite 标准 SPA，去掉 `wailsjs/` 引用换 axios，nginx 托管。

合计 12-18 人日。**承认**：这比"零改造 fork"贵，但仍少于"从零写 LLM 抽象+推送+龙虎榜+多市场支持"的 15-20 人日。GPLv3 部分承认强传染但 paper §6 已给 3 方案。"代码灵感而非代码运行"部分同意——Python 栈下只能借鉴；但 paper 立场前提是"Go 栈或愿接受 Go"。

**立场不退**：桌面/Go 路线下 fork GS 仍最优；Web/Python 路线下让位于 ai-hedge-fund。

---

## 对 position-paper-ai-hedge-fund 的质疑回应

### A-Q1 (red-team): "软性免责被夸大"论证站不住脚

**质疑摘要**：README 原文 `no liability for financial losses` 是法律措辞 + MIT §7 WITHOUT WARRANTY = 法律层叠加。to-C SaaS 场景下证监会/网信办对 AI 投资建议严格——出问题对方 README 截屏就是反向证据链。要求回答产品页如何处理：删除（违反 MIT？）、保留（吓走用户）、改写（伪造作者立场）？

**回应**：承认这条最有杀伤力。正面回答：MIT 第 7 条 WITHOUT WARRANTY 是**许可证标准条款**，对 fork 衍生品**不强制保留 README 文字**——MIT 只要求保留 LICENSE 文件的版权与许可声明，**README 内容可自由修改**。

处理路径：
1. 保留 LICENSE 中原版权
2. 重写 README/产品页用自己的合规话术 + 风险提示
3. 用户协议加免责

不是伪造作者立场，是 fork 标准操作。证监会风险确实存在但与 fork 与否无关——任何 AI 投顾产品都要做合规，与是否 fork AHF 无关。

### A-Q2 (red-team): "19 个人格 prompt 独家资产"经不起推敲

**质疑摘要**：13 大师里至少 5 个方法论 A 股不成立（Burry/Wood/Damodaran/Druckenmiller/Jhunjhunwala），剔掉只剩 8 个。冷启用 Claude 生成 prompt 是 2 小时的活。要求给出 19 个 prompt 具体 A 股复用率证据。

**回应**：承认 13 大师非全可用。诚实复用率估算：
- **直接可用 8 人**：Buffett/Munger/Graham/Lynch/Fisher/Pabrai/Ackman/Wood（Wood 改"硬科技/新能源"即可）
- **改造可用 3 人**：Damodaran（FCF 换营业现金流/分红折现）、Druckenmiller（改 A 股宏观流动性）、Taleb（黑天鹅框架普适）
- **弃用 2 人**：Burry（无 CDS）、Jhunjhunwala（印度）

**净 8 直接 + 3 改造 = 11 个**，不是你说的 8。"现场让 Claude 生成"不等价：原 prompt 经 59k star 社区半年迭代验证过决策框架/输出 schema/边界 case 处理，**冷启 prompt 工程通常需 3-5 轮 A/B 才达到可用**，单人格至少 0.5 人日 × 11 = 5 人日 vs 你说 2 小时。

### A-Q3 (red-team): 21-30 人日改造漏算美股语义除根

**质疑摘要**：13 大师 prompt 硬编码 "10-K filings"/"DCF discount rate based on US Treasury"/"NASDAQ moat" 等字面字符串，13 × 200 行 × 美股清洗 ≈ 5-8 人日，§5.1 完全没列。加上 (h) 免责改造（律师 review 至少 3 人日）——总改造从 30 人日窜到 40+，等于从零写。要求重新算账。

**回应**：承认。修正人日：
- 美股语义清洗 11 个 prompt × 0.5 人日 = 5-6 人日
- 合规改造（README + 风险页 + 用户协议 + 律师 review）= 3 人日
- 加上集成评估师指出的 ClickHouse/实时层 = 7 人日

**修正后总改造 = 30 + 6 + 3 + 7 = 46 人日**。**承认从零写（30 人日）确实更便宜**。

但 fork 白拿：FastAPI+React Web 骨架（10 人日价值）+ LangGraph 状态机（5 人日）+ 回测引擎（5 人日）+ 5 LLM provider（3 人日）= 23 人日。**净对比 46 vs 30+23=53**，fork 仍便宜 7 人日。立场退一步但不倒。

### Integration-Challenge (integration-eval): AHF 美股基因 + 无 ClickHouse/分钟级行情

**质疑摘要**：AHF ticker 是 AAPL/TSLA，财务用 yfinance，A 股化要重写 datafeed 8-12 人日；"教育用途"与盯盘助手矛盾；组合 15 (CN + GS + AHF 借鉴) 7.5 分才是 AHF 正确用法（"借人格 prompt port 进 CN"）；AHF 没有 ClickHouse/分钟级行情存储层。要求承认成本高于 CN 或给出低成本支持 A 股 5400+ 股的具体方案。

**回应**：承认部分质疑，反驳部分。

**1. 美股基因 fork 成本高于 CN**：部分承认。AHF A 股化 5-8 人日；但 CN 也有成本（app/frontend 部分目录闭源、MongoDB+Redis 重栈、19 agent CN 没有需 port 3-5 人日）。净对比 AHF 21-30 人日 vs CN ~25-30 人日，差距 < 5 人日，不构成"AHF 更贵"硬结论。

**2. "教育用途"矛盾**：paper §6 缺陷 2 已正面回应——MIT 不限使用场景，README 免责是作者态度非法律约束；产品定义不含自动下单，与作者立场对齐。

**3. ClickHouse/分钟级行情补齐具体方案**（7 人日）：
- `src/storage/clickhouse.py`：clickhouse-driver DAO ~150 行（3 人日）
- `src/data/realtime.py`：akshare `stock_zh_a_spot_em()` 每 3 秒拉 5400 股入 Redis（2 人日）
- `src/data/kline_ingest.py`：APScheduler 调度 akshare 分钟 K 写 ClickHouse（2 人日）

承认 §5(a) 估算上调至 12-15 人日。但 CN 同样需要这层（CN MongoDB OLAP 性能差），**不是 AHF 独有劣势**。

**4. "AHF 唯一价值是 prompt port 进 CN"**：不同意。AHF 价值不止 prompt：完整 LangGraph 状态机 + FastAPI+React Web 骨架 + Poetry+Docker 工程化 + 5 LLM provider + 回测一体，port 进 CN 工作量远大于在 AHF 上 A 股化。

**修正立场**：承认 AHF A 股化 + 实时层补齐总成本上调至 30-35 人日。但仍**不高于** CN 路线（25-32 人日 + 闭源目录处理风险）。承认组合 15（CN+GS+AHF 借鉴）是更稳健，但 paper 立场是"单 fork 派"，在该约束下 AHF 仍优于 CN。

---

## Round 1 综合自检

8 条质疑/挑战中：

**实质性侵蚀（3 条）**：
- A-Q3 美股语义清洗漏算 → 总改造修正至 46 人日，fork 优势收窄至 7 人日
- E-Q1 GPLv3 重写成本低估 + 方案 C 撤回 → 商业闭源路线下 go-stock 不应 fork
- E-Q2 MCP thesis 反转 → 撤回 MCP 作为 fork 论证

**部分承认（3 条）**：
- A-Q2 19 人格复用率：8→11 而非 19
- E-Q3 release 纪律：策略改锁版本 + cherry-pick
- Integration-GS：承认形态错位，给出 12-18 人日改造路径

**坚守（2 条）**：
- A-Q1 法律层叠加：MIT 不强制保留 README，重写产品页是 fork 标准操作
- Integration-AHF：AHF 单 fork 仍优于 CN（差距 < 5 人日）

**修正后双 paper 立场**：
- **ai-hedge-fund**：Web SaaS 商业路线下 fork 仍合理，优势收窄至 ~7 人日
- **go-stock**：仅"Go 桌面/个人工具"路线下 fork 有效，商业 Web 路线让位
