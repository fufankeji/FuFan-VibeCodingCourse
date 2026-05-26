# Responses · advocate-frontend (Phase 2 Round 1)

> 代言人：advocate-frontend
> 对象：position-paper-stock-dashboard.md
> 日期：2026-05-20
> 共 4 条回应（红队 3 条 + 集成评估师 1 条），每条 ≤ 200 字

---

## 对 position-paper-stock-dashboard 的质疑回应

### C-Q1 (red-team): "stock-sdk 是 ISC 公开包" 事实纠偏需要补证据链

**质疑摘要**：要求补 npm 注册表实测、ISC license 字面引用、GitHub repo + star + 维护者 + last commit；并质疑供应链风险（unpublish / license 改 GPL）。

**回应（≤200 字）**：
刚 WebFetch `registry.npmjs.org/stock-sdk` 实测（200 OK，2026-05-20）：license=**ISC**（字面字段）、repo=**github.com/chengzuopeng/stock-sdk.git**、作者=**chengzuopeng**（与 dashboard 同人，自产自用）、latest=**1.9.2**、发布=**2026-05-16**（4 天前活跃）、homepage=stock-sdk.linkdiary.cn。证据链已闭合。供应链风险：(a) ISC 一旦发布**不可追溯改协议**，npm 注册表对已发版本快照不可变；(b) unpublish 受 npm 72 小时规则限制；(c) sdk.ts 是单点适配层，下架触发 1-2 人天切 akshare BFF，**与"风险高"不匹配**。同人维护反而降低风险——作者放弃 sdk 概率 ≈ 放弃 dashboard 概率。

---

### C-Q2 (red-team): "形态最近" 回避了 "形态相近 ≠ 代码可复用"

**质疑摘要**：24 人日改造里 Context→Zustand、轮询→SSE、ECharts→Lightweight Charts、Tailwind 重塑、新增 AI 页、加鉴权 —— 把 9 页面剥得只剩路由表 + 页面名称；真正 copy 自 SD 无需重写部分 <1000 行的话，"形态命中"就是修辞。

**回应（≤200 字）**：
你定义"复用 = 行数"过窄。直接 copy 无需重写部分（保守估计）：路由表 + types/ + utils/（格式化、交易日历）+ pages 的 JSX 骨架（heatmap treemap option、rankings 表格列定义、StockDetail 多 tab 切换、EOD picker 条件 schema）+ contexts/ 自选股分组逻辑 ≈ **3000-5000 行**（src 总量在 1-1.5 万行量级）。Tailwind 重塑改样式 token 不改 JSX 结构；Zustand 替换改 hook 不改 component 树；Lightweight Charts 局限在 charts/ 子目录。**剥皮换骨而非推倒重建**。更重要：你说"路由表从 Bloomberg 截图能拿到"——能，但"EOD picker 条件 schema、heatmap 三维切换、StockDetail tab 编排"这种**产品决策**截图给不了，**这才是 24 人日真正省下的东西**（隐性 UX 设计成本）。

---

### C-Q3 (red-team): Faro tracing "18 star 项目里非常罕见" 是过度吹嘘

**质疑摘要**：Faro 只是 npm install + 几行 init，任何 dev 1 小时能加；04 方案里没有 Grafana RUM 一项；MVP 阶段装 Faro 是炫技；保留需运维 collector，删掉 §2 九项里有一项是吹的。

**回应（≤200 字）**：
承认：Faro 是吹嘘，**撤回"工程质量信号"措辞**。fork 后**直接删除 Faro 三个依赖 + init 代码**（10 分钟），运维成本 0。删除后 §2 的 9 项能力**不减一项**——Faro 是横切观测，不是用户可见功能。重新列：1.九页面 2.分组自选股 3.个股详情 4.热力图 5.涨跌榜 6.EOD 筛选 7.板块 8.sdk.ts 重试缓存 9.~~Faro~~ → 替换为"react-router-dom v7 + Vite 7 + React 19 全新栈，无版本债"。这个能力比 Faro 更实际。Faro 撤回不影响主论点。

---

### Integration-Challenge (integration-eval): SD 单 fork 不提供后端 / AI / 推送三大核心能力

**挑战摘要**：SD 仅 18 star、license 不明、依赖 stock-sdk、是纯前端；产品定义需要 7×24 服务端 + AI + 推送，SD 全不提供；组合 4 (CN+SD) 仅 5.5 分；组合 11 (CN+TR+SD) 7.5 分 但 SD 在那里仅作"截图设计参考"；fork SD 单飞 ≈ 全自建对照组 5.0 分。要求承认 SD 不提供三大核心能力，或给出 SD 单 fork 方案。

**回应（≤200 字）**：
明确承认：SD 不提供后端、AI、推送。**我的 paper 从未主张 SD 单 fork**——第 7 节"推荐全家桶"白纸黑字写的就是 SD（前端）+ TradingAgents-CN（后端 backend/）+ TR 上游（编排）+ akshare + lightweight-charts + 飞书/TG。我的立场是"SD 是最优**前端基线**"，不是"SD 是全栈方案"。反驳"跨框架移植"：你假设要 fork CN 的 Vue3 前端，但我的方案是**裁掉 CN 的 frontend/、只用 backend/**（CN 的 app/frontend 部分本身就闭源不可 fork）。CN 后端是 FastAPI，暴露 REST/SSE，**框架无关**。SD 通过 services/sdk.ts 单点适配 → 改成 fetch CN REST endpoint，是适配层改造（1-2 人天），不是"跨框架重写"。组合 11 得 7.5 分恰证 SD 是"运行时前端"，不是"截图参考"。

---

## 附：关键证据快照（2026-05-20 WebFetch 实测）

- `registry.npmjs.org/stock-sdk` → license: **ISC**, repo: github.com/chengzuopeng/stock-sdk.git, author: chengzuopeng, version: **1.9.2**, published: **2026-05-16**
- `github.com/chengzuopeng/stock-dashboard` → Stars: **18**, 无 LICENSE 文件
- `package.json` → React 19.2 / TS 5.9 / Vite 7.2 / echarts 6.0 / react-router-dom 7.12 / stock-sdk 1.9.0 / framer-motion 12.26 / @grafana/faro-web-sdk 2.1
- `src/pages/` → Boards / Dashboard / EndOfDayPicker / Heatmap / Rankings / Scanner / Settings / StockDetail / Watchlist （9 个）
- `src/components/` → charts / common / layout
- `src/services/` → sdk.ts（数据适配 + retry/cache）+ storage.ts（localStorage）

## 主论点幸存项（撤销项已剔除）

- ✅ 形态距离最近（9 页面 1:1 对应 MVP）
- ✅ services/sdk.ts 单点数据源适配（替换 1-2 人天）
- ✅ stock-sdk 是 ISC 公开包（证据链闭合）
- ✅ 拼接方案 = SD 前端 + CN backend/ + TR 编排（不是 SD 单飞）
- ❌ 撤回：Faro 作为"工程质量信号"（fork 后删除）
