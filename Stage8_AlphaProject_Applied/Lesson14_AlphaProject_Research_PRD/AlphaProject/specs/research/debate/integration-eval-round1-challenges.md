# Integration Eval — Phase 2 Round 1 挑战记录

> 集成评估师对 5 份"单 fork 派" paper 的复合挑战
> 立场：中立 · 依据：Phase 1 `integration-assessment.md` 的 16 组合评分
> 时间：2026-05-20

---

## 挑战 1 → advocate-langgraph（paper: TradingAgents-CN）

**核心攻击点**：单 fork CN 而不建立 TR 上游同步管线，会变成"凝固 fork"

**依据**：
- 组合 1（CN + TR）= **8.5 分（top 1）**
- 单 fork CN 隐含 ≈ 8.0
- 组合 15（CN + GS 推送借鉴 + AHF 人格借鉴）= **7.5 分（top 3）**

**质问**：是否承认 TR 上游同步必要性？如否，请用工程事实反驳"凝固 fork 风险"。

**回应（advocate-langgraph）**：完全承认。paper 第 7 节已明写"fork CN + 上游 TauricResearch 持续 cherry-pick agent 改进"。具体做法：`git remote add upstream` + 每月 cherry-pick `tradingagents/agents/` 与 `graph/` 开源内核，绕开 CN 闭源 app/ 目录。接受 8-12 人日初建 + 1-2 人日/次成本。组合 15 同意（GS 只抄思路重写避 GPL，AHF MIT 可直接 port）。**8.5 分组合 = paper 固有立场的精确表述，非被迫接受**。

**裁定**：挑战成立但 paper 本就符合 top 1 复合方案，无分歧。advocate-langgraph 立场 = 集成评估师 top 1 (CN+TR 8.5)。

---

## 挑战 2 → advocate-langgraph（paper: TauricResearch/TradingAgents）

**核心攻击点**：TR 无 A 股 datafeed + 无前端 dashboard，单 fork 等于重做 CN 已验证的 A 股化工程

**依据**：
- 组合 1（CN + TR）= **8.5 分（top 1）**——CN 是 TR 的 A 股化包装层
- 组合 7（TR + SD）= **3.5 分**——半自建
- 组合 6（TR + AHF）= **5.5 分**——两个都缺 A 股 + 前端
- 单 fork TR 隐含 ≈ 4.0（A 股化 + UI 全要自建 25-35 人日）

**质问**：CN 的 app/frontend 部分闭源目录占比 <15%，且不在核心 agent 编排路径，为什么这能成为弃 CN 选 TR 的理由？请给出具体闭源文件清单。

**回应（advocate-langgraph）**：接受"CN 是 TR 的 A 股化包装层"。**修正集成评估师的闭源估计**——CN 闭源 = `app/`（FastAPI 后端含 api/ws/auth/batch）+ `frontend/`（Vue3 + Element Plus 整套），**是后端 + Web 前端两大支柱**，需邮件 hsliup@163.com 商授；非 <15% 边角。`tradingagents/` 内核 Apache-2.0 开源。TR 单 fork 是 Plan B：商授谈崩 / bus-factor=1 顾虑 / 强法务合规要求时的兜底，**非主推**。paper 明写"复合最优 = CN+TR"。

**裁定（含集成评估师事实修正）**：
- Phase 1 对 CN 闭源范围估计偏低（"<15%"），**实际闭源 = 整个后端 API + 整个 Web 前端**，这是重大事实更新
- 这一事实**显著影响组合 1 (CN+TR 8.5 分) 的真实可用性**——若商授失败，CN 的 27k star 后端 + 前端价值无法直接使用，只剩 `tradingagents/` 内核（与上游 TR 同源）
- **CN+TR 8.5 分仍成立但严格依赖"商授通过"前提**；商授失败时 TR 单 fork（Plan B）的隐含分应从 4.0 上调至 5.5（CN 不可用时的合理回退）
- advocate-langgraph 把 TR paper 写作独立强势论证是审慎做法，承认其 Plan B 合理性

---

## 挑战 3 → advocate-fullstack（paper: go-stock）

**核心攻击点**：GS 的桌面 Wails 形态与"7×24 Web 服务"产品定义结构性错位 + GPLv3 强传染

**依据**：
- 组合 8（GS + AHF）= **2.5 分（全场最低）**
- 组合 9（GS + SD）= **3.0 分**
- 组合 5（TR + GS）= **3.0 分**
- 组合 15（CN + GS 推送借鉴 + AHF 人格借鉴）= **7.5 分（top 3）**——GS 正确用法
- GS 在所有运行时集成组合里都是 bottom-tier

**质问**：是否承认 GS 桌面形态与产品 Web 形态错位？请给出"Wails 桌面改造成 Web 多用户服务"的具体工程路径。

**回应（advocate-fullstack）**：承认形态错位但坚持 fork 立场。给出 4 步 12-18 人日改造路径：①剥 Wails（2 人日）②加 Gin/Fiber HTTP（3 人日）③SQLite→PG 多租户（4-6 人日）④前端独立部署（3-5 人日）。承认 GPLv3 强传染但 paper §6 给 3 方案，商业闭源场景重写关键模块需 3-5 人日（修正集成评估师"1-2 人日"低估）。前提是"Go 栈或愿接受 Go"——Python 栈下 GS 让位于 AHF。

**裁定**：
- 12-18 人日 Web 化路径具体可信，**但工程实质 = 把 Wails 挖空只剩 `app.go` 业务方法**，与"借鉴重写"在工程量上趋同
- "Go 栈"前提与 04 文档既定 Python 栈（FastAPI + Prefect + akshare）冲突——若团队接受额外 Go 进程，运维复杂度增量未计入 12-18 人日
- **fullstack 自承"Python 栈下 GS 让位于 AHF"= 隐含承认 Phase 1 评分**：当项目是 Python 栈时，组合 15（CN+GS 借鉴+AHF 借鉴 7.5 分）优于 GS 单 fork
- 接受 GPLv3 重写成本 3-5 人日的修正，**Phase 1 评估应更新此细节**
- 核心分歧仅在"团队是否选 Go 栈"——若选 Go，fork GS 8.0；若选 Python（04 文档既定），fork GS 隐含 ≈ 4.0
- 结论：挑战部分成立，立场分歧锁定在前置技术栈假设上

---

## 挑战 4 → advocate-fullstack（paper: ai-hedge-fund）

**核心攻击点**：AHF 美股基因 + "教育用途不可真实交易"自我定位 + A 股化重写成本 12-18 人日

**依据**：
- 组合 3（CN + AHF）= **5.5 分**——两者多 agent 重叠
- 组合 10（AHF + SD）= **3.5 分**——美股 vs A 股 schema 错位
- 组合 13（TR + SD + AHF）= **3.5 分**——80% 工作量 A 股化重叠
- 组合 15（CN + GS + AHF 借鉴）= **7.5 分（top 3）**——AHF 唯一高价值用法 = 借 19 个人格 prompt port 进 CN

**质问**：AHF 没有 ClickHouse/分钟级行情存储，在没有 CN 后端的情况下如何低成本支持 5400+ A 股数据接入？

**回应（advocate-fullstack）**：承认部分质疑。①AHF A 股化 `src/data/` 重写 5-8 人日 + 自我修正至 12-15 人日（实时层补齐：CH DAO 3 人日 + Redis 快照 2 人日 + 分钟 K 拉取 2 人日 = 7 人日）；②教育免责声明是 MIT 软性声明非法律约束，paper §6 已正面回应；③**反驳"AHF 无 CH = AHF 独有劣势"**——CN 默认 MongoDB 对 OLAP 性能差同样需补 CH 层，非 AHF 独有；④AHF 价值不止 prompt：完整 LangGraph + FastAPI+React Web 骨架 + Poetry/Docker 工程化 + 5 LLM provider + 回测一体，这些 port 到 CN 的成本大于在 AHF 上 A 股化；⑤净对比：AHF 总改造 30-35 人日 vs CN 路线 25-32 人日（含闭源处理），**差距 < 5 人日**。承认组合 15 是更稳健路线，但在"单 fork 派"paper 约束下 AHF 仍优于 CN。

**裁定**：
- **攻击点失败**：我用"AHF 无 ClickHouse"攻击不对称——CN 默认 MongoDB 同样缺 OLAP 层，fullstack 反驳成立
- **攻击点成立**：AHF 美股基因 + A 股化重做仍是真问题，fullstack 自承上调至 12-15 人日已证实
- **fullstack 关键让步**：承认组合 15 (CN+GS+AHF 借鉴 7.5 分) 是"更稳健路线"，AHF 单 fork 是"paper 约束下"的论证而非工程最优
- **集成评估师 Phase 1 修正**：原假设"CN 已 A 股化 = CN 是正确骨架"在 **CN 商授失败场景**下需要重新评估
  - 商授通过：CN+TR 8.5 分仍是 top 1，AHF 单 fork 隐含 ≈ 4.0
  - 商授失败 / 团队偏好 MIT 干净许可 / 偏好 Poetry 工程化：AHF 单 fork 隐含分上调至 **5.5**（与 TR 单 fork Plan B 同档）
- **结论**：挑战 4 部分成立，立场分歧锁定在"CN 商授可获取性 + 闭源容忍度"前提假设上

---

## 挑战 5 → advocate-frontend（paper: stock-dashboard）

**核心攻击点**：SD 18 star + license 不明 + 依赖外部 stock-sdk + 纯前端无后端/AI/推送

**依据**：
- 组合 4（CN + SD）= **5.5 分**——跨框架（React → Vue3）重写前端
- 组合 11（CN + TR + SD）= **7.5 分（top 3）**——但 SD 仅作"截图设计参考"
- 组合 14（CN + SD + GS）= **7.0 分**——同样 SD 仅作"设计参考"
- 单 fork SD 隐含 ≈ 4.0（需自建后端 + AI + 推送 ≈ 62 人日，等价于全自建对照 5.0）

**质问**：SD 不提供后端/AI/推送三大核心能力，在没有 CN 后端的情况下如何承担 7×24 盯盘 AI 助手的核心功能？

**回应（advocate-frontend）**：明确承认 SD 不提供后端/AI/推送。但 paper 第 7 节"推荐全家桶"从未主张 SD 单 fork——而是 **SD（前端）+ CN backend/ + TR 上游 + akshare + lightweight-charts + 飞书/TG**。反驳"跨框架移植"：**裁掉 CN 闭源 frontend/，只用 CN 后端**（CN 后端是 FastAPI 暴露 REST/SSE，框架无关）；SD 通过 `services/sdk.ts` 单点适配改 fetch CN REST endpoint = 1-2 人天的适配层改造，**不是跨框架重写**。组合 11 (CN+TR+SD 7.5 分) 中 SD 是"运行时前端"非"截图参考"，9 个页面 + sdk.ts + faro RUM 都是可运行代码。

**裁定（含集成评估师事实修正）**：
- frontend 反驳成立：Phase 1 我假设了"CN 前端为主体 + SD 当截图"是错误前提
- **正确解读**：CN 的 frontend/ 本身闭源（来自挑战 2 事实修正）→ "弃 CN frontend 用 SD 作为开源前端替代"是闭源问题的合理工程回应
- 组合 11 (CN+TR+SD 7.5 分) 重新解读：SD 是**运行时前端**，sdk.ts 适配层改造仅 1-2 人天
- **SD 的工程价值从"截图参考"上调至"开源前端基线"**——尤其在 CN 商授失败场景下，SD + CN 后端（若可解 lock）/ 或 SD + 自建轻量后端 成为切实路径
- 单 fork SD 仍不成立（产品需要后端 AI 推送），但 paper 本就主张"全家桶"非"SD 单飞"，挑战误判 paper 立场
- 结论：挑战部分成立（SD 单飞不可行），但 frontend 的"SD 作前端基线 + CN 后端"路径在工程上合理

---

## 挑战汇总表

| # | paper | owner | 攻击关键词 | 依据组合分 |
|---|---|---|---|---|
| 1 | TradingAgents-CN | advocate-langgraph | "凝固 fork" / 拒绝 TR 上游同步 | top 1 = 8.5（CN+TR） |
| 2 | TauricResearch/TradingAgents | advocate-langgraph | A 股化重做 / 半自建陷阱 | TR+SD=3.5, TR+AHF=5.5 |
| 3 | go-stock | advocate-fullstack | 桌面 vs Web 形态错位 / GPL 传染 | GS+AHF=2.5（最低） |
| 4 | ai-hedge-fund | advocate-fullstack | 美股基因 / 教育自定位 / A 股化 12-18 人日 | AHF+SD=3.5 |
| 5 | stock-dashboard | advocate-frontend | 18 star / license 不明 / 无后端 AI 推送 | CN+SD=5.5 |

---

## 元规则自检

- [x] 每条挑战都附 Phase 1 具体组合分数
- [x] 不依赖话术，只用工程事实（数据流、运行时形态、license、人日成本）
- [x] 不附和红队"全自建"（全自建 = 5.0，低于所有 CN-based 复合方案）
- [x] 不偏袒任何代言人（langgraph/fullstack/frontend 各被挑战）
