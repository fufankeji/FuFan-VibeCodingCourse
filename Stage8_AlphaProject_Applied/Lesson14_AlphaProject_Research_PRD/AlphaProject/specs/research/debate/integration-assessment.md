# Integration Assessment — 多项目复合工程可行性评估

> 评估人：integration-eval（中立）
> 评估日期：2026-05-20
> 立场：不站队代言人、不附和红队，只看工程事实
> 评估对象：5 个 A 类候选 × 16 个组合方式（10 二元 + 5 三元 + 1 全自建对照）

---

## 评估方法

### 6 维度评分卡

每个组合在以下 6 维度评分（单维 1-10，越高越好；推荐分为综合）：

1. **集成边界** —— 对接点是否清晰（高分：HTTP API/SDK 边界；低分：源码层耦合需大改）
2. **数据流冲突** —— 数据模型/字段定义/精度/时区差距（高分：无 adapter；低分：需 ≥3 层 adapter）
3. **版本依赖冲突** —— Python/Node/Go 跨栈、库版本约束（高分：单语言同代；低分：跨进程跨语言）
4. **总改造成本** —— 集成本身额外人日（高分：≤5 人日；低分：≥20 人日）
5. **运维复杂度** —— 部署/进程/可观测性增量（高分：单 docker；低分：异构 multi-process）
6. **推荐分** —— 综合 1-10 分（结合 5 个客观维度 + 项目本身可用性）

### 项目客观属性（评估基线）

| 项目 | 语言/栈 | 部署形态 | 数据模型 | 集成钩子 | License 风险 |
|---|---|---|---|---|---|
| TradingAgents-CN（CN） | Python (FastAPI) + Vue3 + Mongo + Redis | Docker Compose | 自定义 schema（A 股化） | REST API + Python import | Apache-2.0，**app/frontend 部分目录闭源** |
| TauricResearch/TradingAgents（TR） | Python (LangGraph) | CLI / Python lib | LangGraph state | Python import | Apache-2.0 干净 |
| go-stock（GS） | Go + Wails（桌面） | 单二进制 | SQLite 本地 | **无对外 API**（桌面进程） | **GPLv3 强传染** |
| ai-hedge-fund（AHF） | Python + TS Web | Web 应用 | 美股 schema | Python import + Web | MIT 干净 |
| stock-dashboard（SD） | React + ECharts（纯前端） | 静态站 | 依赖 stock-sdk | npm/源码复制 | **License 不明** |

---

## 二元组合（10 个）

### 组合 1：TradingAgents-CN + TauricResearch/TradingAgents（CN + TR）

- **集成边界**：9/10 —— CN 本身是 TR 的下游 fork，文件级同源；可以走 git remote upstream 同步
- **数据流冲突**：8/10 —— 共享 LangGraph state schema；CN 在 A 股化时改了 dataflow 模块，需要 cherry-pick 而非直接 merge
- **版本依赖冲突**：8/10 —— 都 Python，但 CN 锁了较旧 langchain/langgraph 版本，定期同步上游会撞依赖
- **总改造成本**：6/10 —— 8-12 人日（建立同步管线 + 处理 conflict）；长期每次上游升级 1-2 人日维护
- **运维复杂度**：9/10 —— 单进程 Python，部署无增量
- **推荐分**：**8.5/10**
- **结论**：天然搭档，CN 作为骨架 + TR 作为上游同步源是行业最规范的 fork 模式。**唯一风险是 CN 的"app/frontend 部分闭源"目录在上游同步时会断裂**——闭源目录的改动无法回流上游，长期会形成局部死区。

### 组合 2：TradingAgents-CN + go-stock（CN + GS）

- **集成边界**：3/10 —— GS 是桌面 Wails 应用，无对外 API；要拿它的功能只能源码拆解
- **数据流冲突**：4/10 —— Go struct ↔ Python pydantic 双向序列化；A 股 symbol 格式两边可能不一致（GS 用 `SH600000` / CN 可能用 `600000.SH`）
- **版本依赖冲突**：3/10 —— Go runtime + Python runtime 双栈；Wails 还绑了 webview2
- **总改造成本**：4/10 —— **不可能整体集成**；只能"读 GS 源码 → 重写推送逻辑到 Python"，工作量 5-8 人日，**且必须重写（GPLv3 传染不能直接 import）**
- **运维复杂度**：5/10 —— 若启进程 IPC 复杂度翻倍；若只重写思路则无增量
- **推荐分**：**4/10**
- **结论**：**GS 不存在"集成"，只存在"借鉴"**。把 GS 当 source of inspiration、Python 重写钉钉推送和 LLM provider 抽象层是唯一可行路径。GS 的告警阈值规则也只值 1-2 人日的代码量，复用收益有限。

### 组合 3：TradingAgents-CN + ai-hedge-fund（CN + AHF）

- **集成边界**：6/10 —— 都是 Python，可以共生在 monorepo；但 AHF 的 agent 人格框架与 CN 的 LangGraph 编排是两套 paradigm
- **数据流冲突**：5/10 —— **AHF 面向美股**（ticker 是 AAPL/TSLA），财务数据用 yfinance API；接 A 股要重写整条 datafeed 层
- **版本依赖冲突**：6/10 —— 都 Python，但 AHF 用了一堆 LangChain 旧版组件 + 自己一套 schema，与 CN 的 langgraph 版本可能错位
- **总改造成本**：4/10 —— 12-18 人日（重写数据源 + 人格 prompt 中文化 + 编排框架二选一）
- **运维复杂度**：7/10 —— 单进程 Python，但 AHF 自带 Web UI（TS）若启用则多一个前端栈
- **推荐分**：**5/10**
- **结论**：**两个项目重叠度高于互补度**（都是"多 agent + 教育/研究"），同时挂会产生选择困难。建议二选一：**要中文化 + A 股 → 选 CN，要更丰富的投资人格 → 借 AHF 的 prompt 一次性 port 过来**，不要两个都跑。

### 组合 4：TradingAgents-CN + stock-dashboard（CN + SD）

- **集成边界**：7/10 —— CN 后端 + SD 前端，是天然的 BFF 接力；SD 本来就 fetch 后端 API
- **数据流冲突**：4/10 —— SD 是依赖某 `stock-sdk` 的纯前端，它的 fetch 形态是直接调第三方/sdk，**不是调 CN 后端 REST**；要让 SD 改成调 CN 的 FastAPI，前端代码大改
- **版本依赖冲突**：8/10 —— Python 后端 + React 前端，各自独立无冲突
- **总改造成本**：5/10 —— 10-15 人日（SD 的 fetch 层全部重写指向 CN API + 鉴权对齐）
- **运维复杂度**：7/10 —— Docker Compose 加一个前端容器
- **推荐分**：**5.5/10**
- **结论**：**SD 的价值是 UI 灵感而非可集成代码**——它 18 star、license 不明、依赖外部 sdk，把它的 React 组件抄到 CN 自己的 Vue3 前端要做一次跨框架移植；不如直接在 CN 的 Vue3 上重画。**SD 的真正用法是"截图当设计参考"**。

### 组合 5：TauricResearch/TradingAgents + go-stock（TR + GS）

- **集成边界**：3/10 —— TR 没有前端/UI；GS 是 Go 桌面。两者各占一端，但没有公共集成点
- **数据流冲突**：4/10 —— TR 不带 A 股 datafeed，GS 有 A 股数据但锁在 Go 里；要让 TR 用 GS 的数据必须做 Go → Python IPC 或 GS 数据落盘后 Python 读
- **版本依赖冲突**：3/10 —— 跨语言（Go + Python）+ Wails webview 依赖
- **总改造成本**：3/10 —— 18-25 人日（写 Go ↔ Python IPC + 数据落盘 + 重做 A 股化）
- **运维复杂度**：3/10 —— 两个独立进程 + IPC channel + 桌面/服务端运行模型冲突（GS 是桌面、TR 是服务端）
- **推荐分**：**3/10**
- **结论**：**形态根本不匹配**。TR 是服务端 LangGraph 框架，GS 是桌面单机 app，硬拼会变成"GS 桌面端调远程 TR 服务"——但 TR 本身需要的 A 股化工作量大于 GS 给的便利。**不要走这条路**。

### 组合 6：TauricResearch/TradingAgents + ai-hedge-fund（TR + AHF）

- **集成边界**：6/10 —— 都 Python；可以把 AHF 的 19 个人格 agent 接入 TR 的 LangGraph 节点
- **数据流冲突**：5/10 —— TR 的 state schema 与 AHF 的人格输入格式不同；两者都面向美股（无 A 股化）
- **版本依赖冲突**：5/10 —— 都 Python，LangChain 版本可能错位；TR 的 LangGraph 与 AHF 的自研编排要选一个为主
- **总改造成本**：5/10 —— 12-15 人日（重做 A 股 datafeed + 把 AHF 人格 prompt port 进 TR 节点 + 中文化）
- **运维复杂度**：7/10 —— 单进程 Python
- **推荐分**：**5.5/10**
- **结论**：**两者都缺 A 股 + 都缺前端**，组合后 70% 工作量还是要自己补。**与其拼这两个，不如直接用已经做完 A 股化 + Web UI 的 CN**。

### 组合 7：TauricResearch/TradingAgents + stock-dashboard（TR + SD）

- **集成边界**：5/10 —— TR 没 API server，需要自己包 FastAPI；SD 没 backend，正好接上
- **数据流冲突**：3/10 —— TR 输出 LangGraph 决策日志（结构复杂）；SD 期望简单的 quote/k-line 字段。需要新写 BFF 做转换
- **版本依赖冲突**：8/10 —— Python + React 各自独立
- **总改造成本**：3/10 —— 25-35 人日（**等价于半自建**：A 股化 + API 层 + SD fetch 重写 + 中文化）
- **运维复杂度**：6/10 —— 后端 + 前端两个容器
- **推荐分**：**3.5/10**
- **结论**：**两个都是"半成品"，拼起来 = 全自建 70%**。SD 的 18 star 不足以背书产品级前端，TR 的英文 + 无前端不足以背书产品级后端。

### 组合 8：go-stock + ai-hedge-fund（GS + AHF）

- **集成边界**：2/10 —— Go 桌面 + Python Web，无公共边界
- **数据流冲突**：3/10 —— GS A 股 + AHF 美股，schema/symbol/财报字段全不同
- **版本依赖冲突**：2/10 —— Go + Python + Node 三栈
- **总改造成本**：2/10 —— 25-30 人日（IPC + 数据 schema 统一 + A 股化 AHF）
- **运维复杂度**：3/10 —— 桌面 + 服务端混合形态本身就反模式
- **推荐分**：**2.5/10**
- **结论**：**最不合理的组合**。两个项目目标用户、部署形态、数据范围全部对不上，硬合 = 两个孤岛 + 一座烂尾桥。

### 组合 9：go-stock + stock-dashboard（GS + SD）

- **集成边界**：3/10 —— GS 桌面无对外 API；SD 是 Web 前端。要 SD 调 GS，得让 GS 起本地 HTTP server（Wails 默认不暴露）
- **数据流冲突**：5/10 —— 都做 A 股，symbol 格式可能要对齐；GS 内部 SQLite vs SD 直接调外部 sdk
- **版本依赖冲突**：5/10 —— Go + Node 双栈
- **总改造成本**：4/10 —— 12-18 人日（给 GS 加 HTTP server + SD fetch 改 + GPLv3 隔离）
- **运维复杂度**：4/10 —— **GPLv3 + 桌面 app + Web 前端，运维形态错位**
- **推荐分**：**3/10**
- **结论**：GS 是单用户桌面盘，SD 是单用户前端盘，**两者堆叠没创造新价值**，且 GPLv3 让 SD 部分代码也可能被传染（如果共用前端资源）。

### 组合 10：ai-hedge-fund + stock-dashboard（AHF + SD）

- **集成边界**：6/10 —— AHF 有 Python 后端 + 自带 TS Web；SD 是独立 React 前端。技术栈相邻
- **数据流冲突**：3/10 —— AHF 美股 + SD A 股，两个市场的财报/指标完全不同
- **版本依赖冲突**：6/10 —— Python + Node 双栈但都常见
- **总改造成本**：3/10 —— 20-30 人日（AHF 全部 A 股化 + SD 改接 AHF API + 中文化）
- **运维复杂度**：6/10 —— Python 后端 + React 前端，标准两容器
- **推荐分**：**3.5/10**
- **结论**：**A 股化成本太高**——AHF 是为美股的财报和因子设计的，改 A 股等于重写一半。SD 又只 18 star，前端价值有限。**这不是 1+1>2，是 0.5+0.3=0.6**。

---

## 三元组合（5 个）

### 组合 11：CN + TR + SD

- **集成边界**：8/10 —— CN 提供完整后端 + 数据层，TR 作 upstream 同步源，SD 作前端灵感参考（不直接集成代码）
- **数据流冲突**：7/10 —— CN ↔ TR 同源；SD 只取设计不取代码
- **版本依赖冲突**：7/10 —— 单 Python + Vue3（CN 自带），SD 若用则要做跨框架移植
- **总改造成本**：6/10 —— 12-15 人日（CN 启动 + TR 上游同步建立 + SD 截图改 CN Vue3 前端）
- **运维复杂度**：9/10 —— Docker Compose 标配
- **推荐分**：**7.5/10**
- **结论**：**实质 = CN 作为骨架 + TR 上游同步 + SD 当壁纸**。这是 03 文档原本推荐的方向之一，工程务实。

### 组合 12：TR + SD + go-stock（推送借鉴）

- **集成边界**：5/10 —— TR 后端 + SD 前端 + 借鉴 GS 推送代码（重写）
- **数据流冲突**：4/10 —— 全部要从零做 A 股 datafeed；SD 改 fetch；推送层独立
- **版本依赖冲突**：6/10 —— Python + React；GS 不参与运行
- **总改造成本**：4/10 —— 25-30 人日（A 股化 + API 层 + 前端接驳 + 推送重写）
- **运维复杂度**：6/10 —— 双容器
- **推荐分**：**4/10**
- **结论**：**用 TR + SD 代替 CN 是降级选择**——CN 已经做了 90% 的 A 股化和 Web 化，弃 CN 用 TR + SD 等于把 CN 的工作量重做一遍。

### 组合 13：TR + SD + AHF（agent 借鉴）

- **集成边界**：5/10 —— TR LangGraph 主框架 + AHF 人格 prompt 借鉴 + SD 前端
- **数据流冲突**：3/10 —— TR 和 AHF 都美股，SD A 股；三个数据模型不齐
- **版本依赖冲突**：5/10 —— LangChain/LangGraph 双方版本协调
- **总改造成本**：3/10 —— 30-40 人日（A 股化 + 人格 port + 前端集成）
- **运维复杂度**：6/10 —— 双容器
- **推荐分**：**3.5/10**
- **结论**：**80% 工作量重叠在"A 股化"**，借的人格 prompt 价值低于工作量成本。

### 组合 14：CN + SD + go-stock

- **集成边界**：6/10 —— CN 后端 + SD 前端灵感 + GS 推送借鉴
- **数据流冲突**：6/10 —— CN 自带数据流；SD 设计参考；GS 只借鉴
- **版本依赖冲突**：8/10 —— Python + Vue3
- **总改造成本**：6/10 —— 13-18 人日（CN 起步 + 推送重写 + 前端微调）
- **运维复杂度**：8/10 —— 单 Compose
- **推荐分**：**7/10**
- **结论**：**务实组合**——CN 做骨架、SD 当截图参考、GS 当推送范本。三者职责清晰不打架。

### 组合 15：CN + go-stock（推送借鉴）+ ai-hedge-fund（agent 借鉴）

- **集成边界**：6/10 —— CN 骨架 + GS 重写推送 + AHF 借人格 prompt
- **数据流冲突**：6/10 —— CN 已 A 股化；AHF 人格 prompt 中文化即可
- **版本依赖冲突**：7/10 —— 单 Python；AHF 的 LangChain 旧组件要适配 CN 的 langgraph
- **总改造成本**：6/10 —— 15-20 人日（CN 起步 + 推送重写 + 人格 port + 中文化）
- **运维复杂度**：8/10 —— 单 Compose
- **推荐分**：**7.5/10**
- **结论**：**借鉴型三元组合，避开了所有运行时集成的坑**——只有 CN 真正运行，GS 和 AHF 都是"代码灵感来源"。这是工程上最稳妥的多项目"集成"。

---

## 对照组：全自建（无 fork）

- **集成边界**：10/10 —— 自家代码全控
- **数据流冲突**：10/10 —— 无 adapter
- **版本依赖冲突**：10/10 —— 自选最新栈
- **总改造成本**：1/10 —— 0 人日集成，但全栈从 0 写 ≈ 62 人日（04 文档生产化估算）
- **运维复杂度**：10/10 —— 自家技术债，部署最熟悉
- **推荐分**：**5/10**（高度自由但工程量大，与"借 CN"相比省不出时间，反而失去 27k star fork 带来的迭代红利）
- **结论**：**全自建在"集成可行性"维度满分**，但产品速度劣势明显——62 人日全自建 vs 30-40 人日 fork CN，差距 20+ 人日，等同于 1 个月窗口。除非红队能论证"CN 的代码质量差到不可救药"，否则全自建是工程浪费。

---

## 综合排序（按推荐分）

| 排名 | 组合 | 推荐分 | 核心定位 |
|---|---|---|---|
| 1 | CN + TR（fork + upstream 同步） | **8.5** | 行业最规范 fork 模式 |
| 2 | CN + TR + SD | **7.5** | fork + 上游 + UI 参考 |
| 2 | CN + GS（推送借鉴）+ AHF（人格借鉴） | **7.5** | CN 骨架 + 双借鉴 |
| 4 | CN + SD + GS | **7.0** | CN 骨架 + 前端参考 + 推送借鉴 |
| 5 | CN + AHF | **5.5** | 重叠多，二选一更好 |
| 5 | CN + SD | **5.5** | SD 只值"截图" |
| 5 | TR + AHF | **5.5** | 都缺 A 股 + 前端 |
| 8 | 全自建（对照） | **5.0** | 自由度满，工程量大 |
| 9 | CN + GS | **4.0** | GS 只能借鉴 |
| 9 | TR + SD + GS | **4.0** | 等价于半自建 |
| 11 | TR + SD + AHF | **3.5** | A 股化成本太高 |
| 11 | TR + SD | **3.5** | 两个半成品 |
| 11 | AHF + SD | **3.5** | 美股 vs A 股错位 |
| 14 | GS + SD | **3.0** | 桌面 + Web 形态错位 |
| 14 | TR + GS | **3.0** | 服务端 + 桌面错位 |
| 16 | GS + AHF | **2.5** | 最不合理组合 |

---

## Top 3 推荐组合

1. **CN + TR**（8.5）—— 单 fork + 上游同步，工程最规范，CN 已 A 股化省 2-3 月，TR 上游迭代快
2. **CN + TR + SD**（7.5）—— 增加 SD 作 UI 灵感参考，零运行时集成成本，仅设计借鉴
3. **CN + GS + AHF**（7.5）—— CN 骨架运行 + 仅借鉴 GS 推送代码（避 GPL）+ AHF 人格 prompt port

**共同点：都以 CN 为骨架**。CN 是唯一同时满足"A 股化完成 + Web 化完成 + Apache-2.0 + 27k star 验证"的项目，**复合方案中其他项目只能作为"借鉴源"而非"运行时集成"**。

## Bottom 3 应避免组合

1. **GS + AHF**（2.5）—— 桌面 + Web 美股，形态彻底错位
2. **TR + GS / GS + SD**（3.0）—— GS 桌面单机性质决定它无法被"集成"，只能"借鉴"
3. **TR + SD + AHF / AHF + SD**（3.5）—— 美股化基因 + A 股化重做，工作量等同自建

---

## 关键工程事实（用于挑战代言人）

1. **GS 的 GPLv3 决定了它只能"读源码 + 重写思路"**，不存在任何意义上的"集成"
2. **SD 的 18 star + license 不明 + 依赖外部 sdk 决定了它只能"截图参考"**，不存在"前端代码移植"
3. **AHF 和 TR 都是美股原生**，把它们接进 A 股盯盘等于重写 datafeed 层 8-12 人日
4. **CN 是唯一已完成 A 股化 + Web 化的项目**，复合方案不绕开 CN 是工程浪费
5. **"单 fork 派" paper 如果不解释为什么不复合 GS 推送 + AHF 人格借鉴，就漏掉了 7.5 分的工程可能性**

---

## Phase 2 挑战预告（对各代言人）

| paper 拥有者 | 项目 | 复合挑战 |
|---|---|---|
| advocate-langgraph | CN（单 fork） | 你为什么不同时借 GS 的推送 + AHF 的人格 prompt？组合 15 的 7.5 分高于单 fork 的隐含 8.0 |
| advocate-langgraph | TR（单 fork） | TR 不带 A 股 + 不带前端，等价于半自建（组合 7 = 3.5 分）。为什么不上 CN？ |
| advocate-fullstack | GS（单 fork） | GS GPLv3 + 桌面单机，无 Web 多用户能力，组合 8/9 全在 bottom 3。为什么不只取推送代码思路？ |
| advocate-fullstack | AHF（单 fork） | AHF 是美股原生，A 股化要 12-18 人日。为什么不只借人格 prompt 接入 CN？ |
| advocate-frontend | SD（单 fork） | SD 18 star + license 不明 + 依赖外部 sdk。前端价值是"截图参考"而非"代码集成"，为什么单 fork？ |

---

## 反规约自检

- [x] 不附和红队"全自建" —— 全自建只给 5.0 分，劣于 CN-based 组合
- [x] 不偏袒任何代言人 —— 5 个项目各有评分，CN 高分是事实而非偏好
- [x] 只用 6 维度评分 + 工程事实做判断 —— 无话术加分
