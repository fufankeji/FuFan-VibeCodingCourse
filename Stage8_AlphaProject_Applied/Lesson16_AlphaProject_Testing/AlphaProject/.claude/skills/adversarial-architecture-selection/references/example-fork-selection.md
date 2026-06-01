# Example · 开源 fork 选型完整示例

> 场景：A 股自动盯盘 AI 助手项目，已完成 product-research-kickoff，
> 03-开源项目.md 列出 4 个候选 fork 项目，需对抗决策。

---

## 输入

### 项目定位
7×24 帮我盯 A 股的 AI 助手：自选股 Dashboard + 自然语言智能选股 + 早盘简报 + 异动预警。

### 候选清单（来自 specs/research/03-开源项目.md）
1. **daily_stock_analysis**（Python，1.2k stars，全栈 Web 架构）
2. **vnpy**（Python，22k stars，桌面端 PyQt + 量化交易框架）
3. **Qbot**（Python，5k stars，模块化 + Telegram bot 集成）
4. **backtrader-cn**（Python，3k stars，A 股本土化的 Backtrader 适配）

N = 4

---

## Phase 0：候选分配

按规则 "N = 4：1 代言人 owns 2 项目，其余各 1，技术栈相近的合并"：

| 代言人 | owns | 合并理由 |
|--------|------|---------|
| 代言人 1 | daily_stock_analysis | 全栈 Web 派系，独立 |
| 代言人 2 | vnpy + backtrader-cn | 都是"量化框架派"，桌面/CLI 取向，合并便于对比 |
| 代言人 3 | Qbot | 模块化 + 通讯集成派系，独立 |

写入 `specs/research/debate/00-任务分配.md`。

---

## Phase 1：5 个 teammate 并行产出

### Teammate 1（代言人 1）→ position-paper-daily_stock_analysis.md

```markdown
# Position Paper: daily_stock_analysis

## 1. 架构总览
全栈 Web 架构：FastAPI 后端 + Vue 2 前端 + SQLite 存储 + AKShare 数据源。
（Mermaid 图...）

## 2. 核心能力清单
- ✅ 稳定：日线级回测（A 股全市场）
- ✅ 稳定：Web Dashboard
- 🟡 Beta：分钟级回测
- 🔬 实验：LLM 选股
- ❌ 未实现：推送通道

## 3. 数据模型
（关键类清单...）

## 4. 扩展点
✅ 数据源继承 BaseDataSource 即可
⚠️ 撮合规则硬编码

## 5. 改造成本估算
| 改造项 | 人日 | 风险 |
|--------|:----:|------|
| 加 Tushare 备线 | 2-3 | 低 |
| 加飞书推送 | 1-2 | 低 |
| 加 LLM Function Calling | 3-5 | 中 |
| 替换前端为 Next.js | 8-12 | 中 |
| **合计** | **14-22 人日** | — |

## 6. ⭐ 致命缺陷自述
1. 最后 commit 2025-08，社区活跃度低
2. 撮合引擎硬编码"次日开盘价"
3. 测试覆盖率 18%

## 7. 与其他候选的集成可行性
- vs vnpy：互斥（PyQt vs Web）
- vs Qbot：部分集成（Qbot 的 Telegram 可拿）
- vs backtrader-cn：能配合（撮合引擎可替换）

## 总结
fork daily_stock_analysis 是最优解——架构对齐目标产品（Web）、改造成本最低（14-22 人日）、
扩展点设计合理。主要风险是社区活跃度低，但目标产品规模个人级，自维护可接受。
```

### Teammate 2（代言人 2）→ 两份 paper

#### position-paper-vnpy.md
```markdown
# Position Paper: vnpy

## 总结
fork vnpy 是最优解——成熟度最高（22k stars）、覆盖最全（含期货/期权）、量化社区主流。
但要承担 PyQt → Web 的重写成本（25-35 人日）。

[7 维度详填...]

## 6. ⭐ 致命缺陷自述
1. PyQt 桌面框架与 Web 目标产品架构正面冲突
2. 体量过大（核心代码 50k 行），fork 后维护负担重
3. 文档主要面向机构用户，散户使用门槛高
```

#### position-paper-backtrader-cn.md
```markdown
# Position Paper: backtrader-cn

## 总结
fork backtrader-cn 是最优解——A 股本土化最好、Backtrader 生态丰富、社区文档完善。
但缺前端、缺实盘，要补的多。

[7 维度详填...]

## 6. ⭐ 致命缺陷自述
1. 仅适配回测引擎，无前端无实盘
2. Backtrader 上游已不活跃维护
3. A 股本土化深度有限（仅日线适配）
```

### Teammate 3（代言人 3）→ position-paper-Qbot.md
```markdown
# Position Paper: Qbot

## 总结
fork Qbot 是最优解——模块化设计最好（5 个独立模块）、Telegram bot 现成、改造灵活。
但偏数字货币，A 股本土化要补。

[7 维度详填...]
```

### Teammate 4（红队）→ red-team-position.md
```markdown
# 红队立场：反对所有 fork，主张全自建或换 SaaS

## 1. 对每个项目的致命质疑

### daily_stock_analysis（3 条致命质疑）
1. 半年没 commit，等于死项目——fork 一个死项目=接锅
2. 测试覆盖率 18%，改造时回归测试是噩梦
3. Vue 2 已 EOL，前端不重写迟早出 CVE 漏洞

### vnpy（3 条致命质疑）
1. PyQt 与 Web 目标架构 100% 冲突，等于重写
2. 50k 行核心代码，fork 后任何 bug 你都得自己接
3. 量化框架对"AI 助手"产品过度设计

### Qbot（3 条致命质疑）
1. 数字货币基因——A 股适配代码不到 10%
2. 模块化听起来好，实际模块间耦合严重
3. 5k stars 中相当部分是 fork 灌水

### backtrader-cn（3 条致命质疑）
1. 上游 Backtrader 已死（2023 年底无 commit）
2. 只有回测，没有实盘/前端/推送，约等于补全一个新项目
3. Backtrader 设计偏数据科学家，对工程化部署不友好

## 2. 全自建方案估算
- 工作量：45-60 人日
- 主要风险：撮合规则、订单管理、回测引擎要自研
- 收益：架构纯净，没有"接锅"成本，长期维护简单

## 3. "换思路"方案
- 选 SaaS：用 Bloomberg Terminal API + 自建薄壳前端
- 工作量：20-30 人日
- 缺点：每月 SaaS 费用 $2000+，不适合个人产品
```

### Teammate 5（集成评估师）→ integration-assessment.md
```markdown
# 集成评估

## 组合评估表
| 组合 | 集成边界 | 数据冲突 | 依赖冲突 | 改造成本 | 运维复杂度 | 推荐分 |
|------|---------|---------|---------|---------|----------|:-----:|
| 单 fork daily_stock_analysis | n/a | n/a | n/a | 14-22 人日 | 低 | **8.0** |
| 单 fork vnpy | n/a | n/a | n/a | 35-50 人日 | 中 | 5.5 |
| 单 fork Qbot | n/a | n/a | n/a | 25-35 人日 | 中 | 6.0 |
| 单 fork backtrader-cn | n/a | n/a | n/a | 30-40 人日 | 中 | 5.0 |
| daily + Qbot 推送 | 模块替换 | 低 | 低 | 16-25 人日 | 低 | **8.5** |
| daily + backtrader 撮合 | API 适配 | 中 | 中 | 20-28 人日 | 中 | 7.0 |
| 全自建 | n/a | n/a | n/a | 45-60 人日 | 低 | 6.0 |

## Top 3 推荐
1. daily + Qbot 推送复合（8.5）—— 弥补 daily 推送缺失，集成成本极低
2. 单 fork daily（8.0）—— 最简洁
3. daily + backtrader 撮合（7.0）—— 弥补硬编码撮合，但复杂度上升
```

---

## Phase 2：法庭辩论（第 1 轮）

Lead 把 4 份 paper 随机打乱顺序：`[Qbot, daily, vnpy, backtrader-cn]`，广播给所有 teammate。

### 红队 → daily 的 3 条质疑（部分摘录）
- Q1：你自报"半年无 commit"，但论证段说"个人级产品自维护可接受"——如果你出 bug 找不到 upstream 修，怎么办？
- Q2：你估算"加飞书 1-2 人日"——但 daily 没有任何通知模块基础，你这 1-2 人日的依据是什么？
- Q3：测试覆盖率 18%，你打算 fork 后补到多少？补测试本身估算了吗？

### 集成评估师 → daily 的 1 条挑战
- 我的评估表显示"daily + Qbot 推送复合"（8.5 分）比单 fork daily（8.0 分）更优。请说明为什么不选复合？

### 代言人 1 回应（daily）
- R1：自维护可接受指核心逻辑稳定，bug 主要在改造层，改造层是我自己写的，不依赖 upstream
- R2：飞书推送是独立模块，依赖飞书 SDK，1-2 人日是 SDK 集成 + 配置，不需要 daily 项目内部支持
- R3：覆盖率目标 60%，补测试约 5-8 人日，应纳入估算——已修正改造成本为 19-30 人日
- 集成评估师挑战：复合方案确实更优，**接受复合建议**——主架构选 daily + Qbot 推送模块。

### 红队 → vnpy 的 3 条质疑
- Q1：你估算 PyQt → Web 重写 25-35 人日，但 vnpy 前端逻辑深度依赖 Qt 信号槽，重写量被低估
- Q2：你自报"体量过大"是缺陷，那为什么还推荐 fork？
- Q3：vnpy 的回测/实盘代码分离做得最好，但目标产品不需要"实盘交易"——大部分价值用不上

### 代言人 2 回应（vnpy）
- R1：信号槽逻辑确实复杂，**承认**估算偏低，应改为 35-50 人日
- R2：体量大是双刃剑——但 vnpy 的成熟度其他项目难以替代
- R3：实盘代码可以剥离不要，但保留回测核心引擎仍优于其他候选

（其他质疑回应略...）

### Lead 判断
1 轮后，daily + Qbot 复合方案明显占优：
- 代言人 1 主动接受复合方案
- 集成评估师评分 8.5 vs daily 单 fork 8.0、vnpy 5.5、Qbot 6.0、backtrader 5.0
- 红队对 vnpy 的"重写代价"质疑被代言人 2 自己承认
- 全自建方案无明显优势（成本是复合方案的 2 倍）

**进入 Phase 3**（无需第 2 轮）。

---

## Phase 3：Lead 综合判决

### `specs/research/06-架构基线决策.md`

```markdown
# 06 架构基线决策

## 1. 决策摘要

**架构基线**：daily_stock_analysis 主仓 + Qbot 推送模块复合

**一句话理由**：daily 架构对齐目标产品，Qbot 弥补推送缺失，复合成本最低（16-25 人日）。

## 2. 复用矩阵

| 模块 | 来源 | 处理方式 | 改造点 |
|------|------|---------|--------|
| Web 后端 | daily | 直接复用 | - |
| 回测引擎 | daily | 改造 | 加分钟级支持 |
| 数据接入层 | daily | 改造 | 加 Tushare 备线 |
| 推送通道 | Qbot 飞书模块 | 直接复用 | 改 Telegram → 飞书 |
| 前端 UI | 自建 | 全新开发（Next.js）| 替换 daily 的 Vue 2 |
| LLM 选股 | 自建 | 全新开发 | daily 实验代码不可用 |
| 撮合引擎 | daily | 保留 | 暂用硬编码次日开盘，v2 再优化 |
| 风控 | 自建 | 全新开发 | daily 无 |

## 3. 被否方案理由

### vnpy 为什么没选
- 代言人 2 自己承认 PyQt → Web 重写代价被低估（应 35-50 人日）
- 集成评估师评分仅 5.5
- 红队 Q3 指出实盘代码价值用不上（debate-transcript L78）

### Qbot 单 fork 为什么没选
- 数字货币基因导致 A 股适配代码 < 10%（红队 Q1）
- 代言人 3 未能反驳"模块间耦合严重"质疑（debate-transcript L102）

### backtrader-cn 为什么没选
- 上游已死（红队 Q1）
- 只有回测，要补的太多（代言人 2 自报）
- 集成评估师评分 5.0

### 全自建为什么没选
- 工作量是复合方案的 2 倍（45-60 vs 16-25 人日）
- 红队未能论证"接锅成本"显著高于复合方案

## 4. Open Questions（给 brainstorming 阶段）

1. 撮合引擎硬编码"次日开盘"是否要在 MVP 中解决？还是 v2 再做？
2. 前端是否要支持移动端？（影响 Next.js 还是 React Native）
3. 复合方案的代码合并方式：monorepo 还是子模块？

## 5. 改造成本总估算

| 项 | 人日 |
|----|:----:|
| daily fork 改造（数据 + 回测 + LLM 集成）| 12-18 |
| Qbot 推送模块抽取 + 改飞书 | 2-3 |
| 自建前端 Next.js | 8-12 |
| 自建风控 | 3-5 |
| 测试补强（18% → 60%）| 5-8 |
| 集成 + 部署 | 3-5 |
| **合计** | **33-51 人日** |

月预算估算：210-560 RMB（腾讯云轻量 + Tushare 订阅 + 飞书免费）
```

### `specs/research/05-决策汇总.md`（更新为 v2）

顶部加：
```markdown
> **v2 更新（2026-05-19）**：根据源码对抗调研结果，"开源复用决策"和
> "技术栈决策"两节做了重大调整。详见 06-架构基线决策.md。
```

"开源复用决策"一节完全替换为 06 的复用矩阵。其他章节按矩阵微调。

---

## 总结

这个示例展示了对抗调研如何：
- 把 4 个候选压到 1 个明确决策（daily + Qbot 复合）
- 每个被否方案都有**可追溯的辩论依据**（不是 Lead 拍脑袋）
- 留下 3 个 Open Questions 给 brainstorming 阶段处理
- 改造成本从代言人 1 的"14-22 人日"经辩论修正为"33-51 人日"，更真实

学员可以**直接当模板用**——把"daily/vnpy/Qbot/backtrader-cn" 替换成自己项目的候选即可。
