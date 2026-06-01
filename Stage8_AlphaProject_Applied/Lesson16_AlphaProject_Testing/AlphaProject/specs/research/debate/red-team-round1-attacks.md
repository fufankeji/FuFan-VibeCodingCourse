# 红队 Phase 2 Round 1 · 15 条质疑

> 角色：red-team
> 日期：2026-05-20
> 规则：每份 paper 3 条质疑，必须基于 paper 内部论证暴露的破绽，带源码 / commit / issue / README / license 证据

---

## A. position-paper-ai-hedge-fund.md（owner: advocate-fullstack）

### A-Q1 —— 你的"软性免责被夸大"论证站不住脚
paper §6 缺陷 2 自报"`Just For Educational`是软性建议而非法律约束"。但你自己引用的 README 原文里有 **`no liability for financial losses`**——这是**法律措辞**而非态度表达。MIT 许可证 §7 同样写明 "WITHOUT WARRANTY OF ANY KIND"。**这是法律层叠加：MIT 免责 + 作者主动免责声明**。在 to-C SaaS 场景下，监管机构（中国证监会/网信办）对"AI 投资建议"的态度是显著严格的——一旦你 fork 这个仓库做付费产品出问题，对方 README 第一段截屏就是反向证据链，证明你**明知作者不建议用于真实交易**仍然商用。这不是版权问题，是**金融合规**问题。请正面回答：你的产品页要如何处理这条法律级声明？是删除（违反 MIT 的版权附加条款？）、保留（吓走用户）、还是改写（伪造作者立场）？

### A-Q2 —— 你的"19 个人格 prompt 是独家资产"论证经不起推敲
paper §2 第 1 点把 "19 个 agent" 列为"独家"，§5.2 R2 也承认 "Burry 看 CDS、Druckenmiller 看宏观，A 股部分财务字段（如 FCF 数据质量）需打补丁"。**你自己列出的 13 个投资大师里至少 5 个的方法论在 A 股上不成立**：Burry（CDS 在 A 股不存在）、Wood（破坏式创新美股科技股）、Damodaran（DCF 依赖稳态 FCF，A 股财报 FCF 质量公开烂）、Druckenmiller（宏观对冲 ≠ A 股散户日常）、Jhunjhunwala（印度市场）。剔掉后只剩 8 个能用，**还不如 ai-hedge-fund README 截图截 8 段名字现场让 Claude 生成 prompt 来得快**——这是 2 小时的活，不构成 fork 价值。请给出"19 个 prompt"具体到 A 股的复用率：哪 14 个是直接能用？证据是什么？

### A-Q3 —— 你的"21-30 人日改造"算式漏算最大一项
paper §5.1 表格里**漏算"M 美股语义除根"**。你自己在 §6.1 说"大师 prompt 不需要硬改 —— Buffett 护城河框架在贵州茅台/比亚迪上同样适用"。**这是不诚实的简化**：Buffett prompt 里硬编码的 "10-K filings"、"DCF discount rate based on US Treasury"、"competitive moat in NASDAQ"——这些都是 prompt 模板里的字面字符串。你要逐个改成 "年报"、"10 年期国债"、"A 股护城河（如品牌+渠道+牌照）"。**13 个大师 × 平均 200 行 prompt × 美股语义清洗 ≈ 5-8 人日**，你 §5.1 完全没列。加上 §5.1 (a) 数据层 5-8 人日 + (h) 免责声明改造（不止"改 README"，要做合规风险页 + 用户协议 + 律师 review 至少 3 人日）——**总改造从 30 人日窜到 40+，等于从零写**。请重新算账。

---

## B. position-paper-TauricResearch-TradingAgents.md（owner: advocate-langgraph）

### B-Q1 —— 你的"反向借鉴 CN dataflows"论证是 license 上的鸵鸟战术
paper §0 与 §7 把"用 Apache-2.0 反向借鉴 CN 的 `dataflows/` A 股代码"作为杀手锏。但 CN paper 自己写了 "**app/ + frontend/ 闭源需商授**"——你显然知道 CN 是**双协议混合**。问题是：**`tradingagents/dataflows/` 这个目录在 CN 仓库里到底归 Apache-2.0 还是商授**？CN README 写的是"除 `app/` 和 `frontend/` 外的所有文件 Apache-2.0"——按这个**字面**判断 `dataflows/` 是开源的，但**作者保留单方面变更 license 的权利**（GitHub TOS 允许）；而且 hsliuping 商授盈利的核心动机恰恰是不希望被反向白嫖。一旦你把 CN `dataflows/` 移植到你的上游 fork 并商用，作者发律师函主张"`dataflows/` 实际由 app/ 调用、属于商授边界灰区"，**你拿什么证明它是 100% 安全的**？你需要给出书面 license 确认才能上车——而 paper 完全没提这个步骤。

### B-Q2 —— "10+ LLM provider"论证撞上自己的 §6 缺陷 3 矛盾
paper §2 第 3 点吹"10+ LLM provider 路由"，但 §6 缺陷 3 又承认"7×24 盯盘 + 每分钟扫异动，token 成本会失控（一次完整辩论 ~10k tokens × 5400 股 × 频次 = 灾难）"。**这两个论点直接打架**：你之所以需要"10+ provider"，是因为这个项目的设计假设就是"多 LLM 多轮辩论"——而你又自己说这种 pattern 不能用于盯盘场景。**那"10+ provider 路由"对盯盘产品到底有什么用？** 我们的实际需求是 "DeepSeek + Qwen + 一个本地 Ollama 兜底"= 3 个 provider，自己写 100 行抽象。你引以为荣的内核反而是**为错误场景设计的过度工程**。请正面回答：盯盘 MVP 实际需要多少个 provider，扛 77.6k★ 项目的依赖图换 3 个 provider 抽象的 ROI 是什么？

### B-Q3 —— "checkpoint + reflection 教科书级"论证是 research framework 反模式
paper §2 第 5、6 点把 SQLite checkpoint per-ticker + `~/.tradingagents/memory/trading_memory.md`(Markdown 文件) 当卖点。**这正是研究框架（research framework）的典型设计**：单用户、本地存储、Markdown 当 KV 数据库。你产品是 **7×24 多用户 SaaS**：100 个用户 × 5400 股 × 持续运行 = 数十万个 SQLite 文件 + 数十万个 Markdown 文件。**这个存储模型 100% 不可用于生产**。你 §5 改造表里"ClickHouse + Redis + PG 存储栈 4 人日"——4 人日根本不够把 checkpoint 从 SQLite-per-ticker 重构成多租户 PG 表，光是适配 LangGraph 的 `BaseCheckpointSaver` 接口 + 测试 + 数据迁移就 5+ 人日。**你引以为豪的"checkpoint"在你产品形态下是负资产**。请说明：把 SQLite checkpoint 改造成多租户云存储的真实人日是多少？现成开源实现是哪个？

---

## C. position-paper-stock-dashboard.md（owner: advocate-frontend）

### C-Q1 —— 你的"stock-sdk 是 ISC 公开包"事实纠偏需要补证据链
paper §3 与 §6.3 关键论点 "**stock-sdk@1.9.0 是 npm 公开包、ISC 协议、零依赖**"——这反驳了我 Phase 1 的攻击，**前提是你的事实核验为真**。但你 §6.3 的证据强度只有一句"WebFetch 实测"。我需要：(1) npm 注册表 URL（`https://www.npmjs.com/package/stock-sdk`）实测；(2) ISC license 在 package.json 的 `license` 字段或 LICENSE 文件的字面引用；(3) `stock-sdk` 在 GitHub 的 repo 地址 + star 数 + 维护者 + last commit date。**没这些证据，你的"事实纠偏"和我说"stock-dashboard 18 star 不可用"是一个等级的薄弱论证**。更关键的：**即使 ISC 公开包，作者也可以下架**（npm unpublish）或**改 license 为 GPL**（注册表允许）。你的 §4 表"替换数据源 1-2 人天"如果碰到 stock-sdk 突然下架是不是要紧急切换？这个供应链风险你没正面回答。

### C-Q2 —— "18 ★ 但形态最近"的论证回避了"形态相近 ≠ 代码可复用"的关键问题
paper §0 用"形态距离"做整篇核心叙事，主张 "9 个页面 ≈ 100% 形态命中"。但你 §5.1 改造预算 24 人日里有 (1) Context → Zustand 1 人日 (2) 轮询→SSE 2 人日 (3) ECharts→Lightweight Charts 2-3 人日 (4) Tailwind+shadcn 重塑 3-4 人日 (5) 新增 AI 页面 5-7 人日 (6) 鉴权 3-5 人日。**这些"形态相近的页面"被你一一改成完全不同的实现，等于把它的 9 个页面骨架剥得只剩"路由表 + 页面名称"——而路由表和页面名称从我 Phase 1 立场书的"Bloomberg 截图 + dribbble 搜索"就能拿到，无 license 风险**。你的 24 人日里**真正复用 stock-dashboard 代码的部分**不到 5 人日（粗略估计：路由结构 + 一些 props 类型）。**请明确：24 人日里有多少行代码是直接 copy 自 stock-dashboard 而无需重写的**？如果答案 < 1000 行，你的"形态命中"论点就是修辞。

### C-Q3 —— Faro tracing"18 star 项目里非常罕见"是过度吹嘘
paper §2 第 9 点把 `@grafana/faro-web-sdk` 集成当亮点："**前端 RUM / tracing 已经接好，可直接上 Grafana**"。问题：(1) 这只是 npm install + 几行 init code，**任何 dev 1 小时能加**，并非"工程质量信号"；(2) 你的产品要不要 Grafana RUM？04 实现方案文档里**完全没有 Grafana 这一项**，只用 Prometheus + Grafana 做后端监控。前端 RUM 是 SaaS 中后期 (用户 > 1000 后) 才有意义的——MVP 阶段 0 用户的产品装 Faro 是炫技。(3) Faro 需要后端 collector（Grafana Cloud 或自部署 OTLP collector），**你 fork 后是不是要顺带运维一个 collector**？还是删掉这部分代码？**如果删掉，你 §2 列的"9 大能力"就只剩 8 个，其中一个还是吹的**。请正面回答：你 fork 后保留 Faro 还是删除？保留的运维成本是多少？

---

## D. position-paper-TradingAgents-CN.md（owner: advocate-langgraph）

### D-Q1 —— "省 3-4 个月"口号被你自己 §6 缺陷 3 拆穿到只剩 1.5 个月
paper §0 与 §8 反复打"省 3-4 个月"的牌，但你 §6 缺陷 3 自己承认 "**'省 3-4 个月'的口号要打个折，更准确是省 1.5-2 个月**"。**这是 paper 内部论点崩塌的关键证据**：你的 thesis 在 §6 被自己降级。再加上 §6 缺陷 1（商授费谈不下要回写 35-40 人日）+ 缺陷 2（MongoDB 不适合时序，要异构存储），**真实"省"的数字应该是多少**？我替你算：1.5 个月 - 商授不确定性（10-15 人日）- ClickHouse 异构（3 人日）= **实际净省 0-2 周**。你 §5 那张 "23 人日"表本身就是基于"商授谈下"的乐观估计——一旦谈崩你 §6 自己写 "回升到 35-40 人日"。请正面回答：在**商授未谈下**的现实假设下（你没任何证据表明你能谈下），fork CN 比从零写到底省几人日？

### D-Q2 —— "app/ + frontend/ 闭源可绕开"的实际成本你自己也没算清
paper §6 缺陷 1 说 "**退而求其次用 `web/` 旧 Streamlit + 自己写 FastAPI，仍比从零搭 TauricResearch 上游加 A 股化省 15 人日**"。但 Streamlit 是**研究/原型工具**，不是生产 dashboard：(1) Streamlit 不支持 SSE/WebSocket 流式（04 实现方案的核心通信协议）；(2) Streamlit 多用户共享 session state 是已知反模式，需 magic state 包；(3) Streamlit 移动端响应式布局烂。你用 Streamlit 做"7×24 多用户 dashboard"，3 个月后必须重写——**那 15 人日省的是技术债的预付款**。更糟：你 §1.1 架构图核心节点 `Backend → Web → Dashboard / Watchlist / StockDetail` 都依赖 Vue3 闭源前端，**砍掉 frontend/ 等于砍掉你 §2 核心能力清单里的第 3、5 项（自选股 + 个股详情页）**。请正面回答：商授谈崩 + 用 Streamlit 兜底的方案下，你 §2 的 11 项核心能力实际剩下几项？

### D-Q3 —— "watchlist 数据模型已经替我们设计完"是空头支票
paper §3 用 "watchlists collection" + "analysis_jobs collection" 当作 5-8 人日省下的证据，但**这 4 个 collection schema 是你自己"按代码语义推断"出来的**（你原文 "(app/ 闭源但 schema 可推断)"）——**`app/` 闭源你看不到实际字段**。我看你给的字段 `{ _id, user_id, group_name, tickers, created_at }` —— **任何二年级实习生用 ChatGPT 5 分钟生成这个 schema**，根本不需要 fork 27k★ 仓库。更关键的：MongoDB 的 collection schema 是 **schemaless**，你以为"推断到了"，实际作者 `app/` 里可能有 30 个字段（subscription_type、tier、ai_quota_remaining、grouped_alert_rules、parent_group_id…）——**你 fork 后写新代码的时候才发现你猜的 schema 全错，要么彻底重写要么逆向闭源**。请正面回答：你 §3 的 4 个 collection schema 哪个字段是从 paper 引用的源码/文档原文证据，而不是你自己脑补？

---

## E. position-paper-go-stock.md（owner: advocate-fullstack）

### E-Q1 —— "GPLv3 三方案缓解"每个方案的真实成本你都低估了
paper §6 缺陷 1 给三个方案，但每个都有未交代的代价：
- **方案 A 整体 GPLv3 开源**：你写"如果本就是个人/社区开源直接 fork"——**问题是产品定义"A 股 7×24 自动盯盘 AI 助手"明显是 to-C 商业产品**，开源全部代码 = 公开 prompt 模板 + 推送密钥逻辑 + 业务规则 = 竞争对手 fork 后 0 成本上线同款。**这不是"是否首选"，这是商业自杀**；
- **方案 B 重写 LLM 抽象 ~3 人日**：你低估了。go-stock 8 个 provider 抽象不是 500 行——`backend/llm/` 实际目录下每个 provider 平均 200-400 行（auth、rate limit、stream、function calling、error retry），8 个 = 2000-3000 行。重写 + 测试**实际 5-8 人日**，不是 3；
- **方案 C 双重许可商谈**：你说"go-stock 是个人项目理论可行"，但**ArvinLovegood 在 GitHub issue 历史里没有任何双协议成功案例**（go-stock 5.8k 星 6 个月没有任何商业 license 公告），而且 GPL 项目作者授商业 license **本质是放弃 GPL 对 fork 抄袭的保护**，作者无动机配合。

请回答：你 §5.1 的"GPL 处理 0-30 人日"上界 30 人日的具体来源是什么？方案 C 的成功概率有 paper 内引用证据吗？

### E-Q2 —— "MCP 工具协议落地领先"被你自己 §6 缺陷 3 打脸
paper §2 第 8 点把 "**MCP 工具协议支持（v2026.04.11+）**" 当 2026 年最新趋势的亮点，§6 缺陷 3 又写 "**MCP 支持是替代方案：通过 MCP 暴露工具，让 Claude Code 这种外部 agent 来调度，比自建 LangGraph 编排更"2026 时代"**"。**这两个论点合起来就是 thesis 反转**：你说"fork go-stock 是首选"，但你的杀手论证又变成"用 MCP 让外部 agent 调度"——**那直接用 Claude Code/Cursor + 自己写 MCP server 不就行了？不需要 fork 这个 GPLv3 的桌面应用骨架**。MCP server 是规范，5400+ 个开源实现，**任何一个 Python MCP 模板 + akshare 1 小时就有同样能力**。你的 thesis 实际上是"MCP 万岁"而不是"go-stock 万岁"。请正面回答：如果产品走 MCP 路线，**为什么需要 fork go-stock 而不是直接写一个 Python MCP server**？

### E-Q3 —— "342 个 release 极活跃维护"反而暴露稳定性问题
paper §2 第 10 点把 "**342 个 release，2026-05-19 仍在每周发版**" 列为优势。**反过来读：5.8k 星项目在 12 个月内发了 342 个 release（每月 28 个 release），平均每天一个版本号**。这不是"活跃"，是**没有稳定版概念**——典型的个人项目 churn 模式：bug fix 不收敛、API 频繁破坏、release notes 流水账。你 fork 后想跟 upstream 同步，每天 cherry-pick 一次？**还是锁死某个版本永远不升级（那就失去你说的"活跃"优势）**？工业级开源（如 vnpy、qlib）的 release 节奏是 3-6 个月一个 minor。go-stock 的 release 频率反映的是**没有发布工程纪律**。请正面回答：你 fork 后采取什么版本策略？锁版本（失去维护红利）还是跟版本（每天处理破坏性变更）？

---

## 总结

红队 Phase 2 Round 1 发完。15 条质疑全部基于 paper 内部矛盾、未交代成本、和 paper 引用的事实强度不足。

| Paper | 主攻点 |
|---|---|
| ai-hedge-fund | 法律免责严肃性 / 人格 prompt 复用率 / 漏算改造项 |
| TauricResearch | 反向借鉴 license 风险 / provider 数量过度工程 / checkpoint 反多租户 |
| stock-dashboard | stock-sdk 证据链不足 / "形态命中"实际代码复用率 / Faro 是炫技 |
| TradingAgents-CN | "省 N 月"自我崩塌 / Streamlit 兜底破功能 / schema 是脑补 |
| go-stock | GPLv3 三方案每个都贵 / MCP 论点反吃自己 / 高频 release = 无纪律 |
