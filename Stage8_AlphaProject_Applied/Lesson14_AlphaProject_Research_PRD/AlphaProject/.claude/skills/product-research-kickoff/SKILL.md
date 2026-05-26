---
name: product-research-kickoff
description: 把"任何 0→1 新产品的立项前期调研"打包成"4 路并行 + 双引擎验证 + 1 路收敛"的标准化引导流程。通过苏格拉底式提问从用户抽取项目骨架，自动生成可直接喂给 Claude Code Task 工具的 4-agent 并行调研提示词。用于个人/小团队启动新项目时的产品立项调研、技术选型前的事实摸底、PRD 写作前的输入材料准备。触发关键词：新项目立项 / 产品调研 / 立项调研 / 项目可行性调研 / 帮我调研一个新想法 / 我想做个 X 怎么开始调研 / 把想法变成调研计划 / 调研同类竞品 / 摸底数据来源 / 摸底开源生态 / kickoff research / product research / 0 to 1 research。即使用户没明确说"用 Skill"，只要任务沾边"新产品立项前的事实摸底/竞品扫描/资源盘点/技术方案选型调研"都要调用。不用于：已经决定技术栈后的具体实现调研（那是 spec/plan 阶段）、纯学术研究（不是产品立项）、已有产品的迭代调研（用 brainstorming）。
---

# Product Research Kickoff

## Overview

把"新产品立项前期调研"标准化为一套**可复用的元方法论**：4 个独立调研主题并行 + 双搜索引擎交叉验证 + 1 个汇总收敛。输入是用户的一个粗想法，输出是 5 份调研文档 + 驱动 Claude Code 完成它们的并行 Task 提示词。

它在 Vibe Coding 工作流里的位置（5 段链路）：

```
想法 → [本 Skill：立项调研]
       → ★ 对抗调研（adversarial-architecture-selection，多候选时强烈建议）
       → Brainstorming（方向收敛）
       → PRD（prd-writer）
       → Spec-Kit（/specify → /plan → /tasks → /implement）
```

⚠️ 当 03-开源项目.md 推荐了多个候选（N ≥ 2），或调研后发现需要在多个技术
方案中做选型时，**强烈建议**在 brainstorming 之前先用
`adversarial-architecture-selection` Skill 做对抗调研，产出架构基线决策。

**它不是什么**：不是 PRD 写作器（用 `prd-writer`）、不是技术方案设计器（那是 spec-kit `/plan` 阶段）、不是 brainstorming（brainstorming 发散收敛，本 Skill 事实摸底）。

**为什么中间必须插 brainstorming**：调研只解决"市面上能做什么、有什么资源"，**不解决"我到底要做哪个版本"**。从调研直接跳 PRD = 在所有可能性里抓阄。brainstorming 用苏格拉底追问把方向收敛到一个明确的 MVP，PRD 才能写得不发散。

---

## 核心原则

### 1. 4 路并行 + 1 路收敛是写死的骨架

任何新产品立项调研都套用：

```
主题 1：产品形态   → 同类产品 / 信息架构 / 交互模式 / AI 化 / 推送形态
主题 2：关键资源   → 渠道盘点 / 每渠道事实 / 主流选择 / 推荐+备份
主题 3：开源生态   → 项目盘点 / 项目事实 / 拼图 / 复用组合
主题 4：实现方案   → 模块拆解 / 每模块方案对比 / 推荐技术栈
─────────────────────────────────
汇总：05-决策汇总.md（依赖前 4 份，串行在最后）
```

4 主题之间**无依赖**——可以 4 个 sub-agent 同时跑。

### 2. 用 Socratic Q&A 抽取项目骨架，不让用户自己写

用户面对新主题时最难的不是搜索，是"我该搜哪 4 个面"。Skill 的核心价值就是**通过引导提问帮用户把骨架说清楚**。

### 3. 双路调研规范，写死

每个 sub-agent 必须同时用：
- **路 A**：Claude 内置 `WebSearch` / `WebFetch`（偏海外/英文/官方/GitHub）
- **路 B**：`muyu-search-mcp` `web_search` / `web_fetch` / `web_map`（偏中文/国内/合规）

### 4. 4 主题是"插槽"不是"硬编码"

骨架固定，每个主题里填什么由用户答案决定。某些主题对特定项目不适用（纯前端工具不需要"数据来源"），允许替换。

---

## 5 步工作流

### Step 1：判断是否触发本 Skill

适用：用户描述了一个**新产品想法**且尚未做过系统调研。

不适用：
- 想法太空（"我想做个 app"）→ 先做 brainstorming 发散
- 已经有调研产物 → 进 brainstorming（不要直接跳 PRD）
- 是已有产品的小迭代 → 用 brainstorming

### Step 2：苏格拉底式 Q&A 抽取骨架

📖 **何时读 [references/socratic-questions.md](references/socratic-questions.md)**：每次启动 Skill 时读取，按 6 个核心问题引导用户。

重要原则：
- **一次只问 2-3 个问题**，不要刷屏，等用户回答后再问下一批
- **A/B/C 多选题优先**，比开放问题省力
- **用户答模糊就追问**，不要替他脑补
- 关键产出：6 个骨架变量（项目一句话定义 / 目标市场 / 对标竞品 / 关键资源类型 / 是否复用开源 / 6 模块清单）

### Step 3：基于骨架填充 4 主题模板

📖 **何时读 [references/4-themes-template.md](references/4-themes-template.md)**：拿到用户骨架后读取，把骨架变量代入 4 个主题的可填充模板。

填充顺序：
1. 主题 1（产品形态）——用"对标竞品"和"目标市场"填充
2. 主题 2（关键资源）——用"关键资源类型"决定具体维度（数据/API/硬件/算力）
3. 主题 3（开源生态）——用"是否复用开源"决定是否启用
4. 主题 4（实现方案）——用"6 模块清单"展开

如果某主题不适用，明确告诉用户并询问是否替换。

### Step 4：生成并行调研提示词

📖 **何时读 [references/parallel-dispatch-spec.md](references/parallel-dispatch-spec.md)**：生成最终提示词时读取，套用双路调研规范 + Task 并行调度规范。

最终提示词的固定结构：

```
# 调研任务：<项目名> · 产品立项调研

## 项目定位
<用户在 Step 2 给出的一句话定义>

## 📁 输出路径
<项目目录>/specs/research/01-...md ~ 05-决策汇总.md

## 调研主题 1：... （由模板填充）
## 调研主题 2：...
## 调研主题 3：...
## 调研主题 4：...
## 最终决策汇总：...

## 🔑 产出质量要求（写死）
## 🔀 双路调研规范（写死）
## 并行执行说明（写死）

## 下一步（三段链路，不要跳步）
（见 Step 5 详细说明）
```

### Step 5：自检 + 衔接下一步

自检 5 条：
- [ ] 4 主题之间真的独立吗？（如果主题 2 必须用主题 1 结果，就不是并行场景）
- [ ] 双路调研规范写进提示词了吗？
- [ ] 输出文件用了 `specs/research/` 标准位置吗？
- [ ] 衔接了完整三段链路（brainstorming → PRD → Spec-Kit），不是直接跳 PRD？
- [ ] 三段触发提示词都给了，用户复制即可推进？

📖 **何时读 [references/handoff-to-prd.md](references/handoff-to-prd.md)**：当用户问"调研完之后怎么走"、"PRD 要写啥"、"PRD 怎么转 spec-kit"时读取。这是完整的下游链路方法论（4 段链路 / 11 问 brainstorming 议程 / PRD 12 章节 / PRD→Spec-Kit 7 规则）。

**衔接说明**：调研产物落地后，**不要直接跳到 PRD**——业界共识链路是「调研 → 脑暴 → PRD → Spec-Kit」。把下面这段写进生成提示词的末尾：

```markdown
## 下一步（按需走 3-4 段链路，不要跳步）

调研完成（5 份 md 落地）后，按以下顺序推进：

### ⓪ 如果有多个候选技术方案 → 先做对抗调研（强烈建议）

如果 03-开源项目.md 推荐了 ≥ 2 个候选 fork 项目，或你在 SaaS / 库 / 技术栈
之间纠结，**先**用 `adversarial-architecture-selection` Skill 做对抗调研：

> 我有多个候选技术方案：[列出候选]
> 请用 adversarial-architecture-selection Skill 做架构基线决策。

产出：`specs/research/06-架构基线决策.md` + `05-决策汇总.md (v2)`
然后进入 ①。

💡 规范（5 角色法庭辩论 / 7 维度深挖 / 反偏见硬约束）由 Skill 内部负责。

如果只有 0-1 个候选 → 跳过 ⓪，直接进 ①。

### ① 用 brainstorming Skill 收敛 MVP 方向

**根据是否走过 ⓪（对抗调研）选择对应版本**：

---

#### 版本 A（走过 ⓪ 对抗调研，存在 06-架构基线决策.md）

> 请仔细阅读 specs/research/ 下的所有调研文件，然后用 Superpowers
> brainstorming Skill 帮我收敛 MVP 方向。
>
> 📂 必读文件（按优先级排序）：
> 1. `specs/research/06-架构基线决策.md`     ⭐ 架构基线（不可再争论）
> 2. `specs/research/05-决策汇总.md (v2)`   ⭐ 综合汇总
> 3. `specs/research/04-实现方案.md`
> 4. `specs/research/03-开源项目.md`
> 5. `specs/research/02-数据来源.md`（如有）
> 6. `specs/research/01-产品形态.md`
>
> ⚠️ Brainstorming 边界：
> - 架构基线 = 已锁定。06 的复用矩阵和改造决策**不再讨论**——
>   已通过 5 角色法庭辩论决定，brainstorming 不重开此案。
> - 06 的 Open Questions 必须**全部进入** Q10（不要丢失），可以补充新问题。
> - Must-have 优先级要参考 06 的复用矩阵——"几乎免费"（直接复用模块）
>   的能力优先纳入 MVP，"代价昂贵"（要自建）的能力慎入 MVP。
>
> 帮我确定以下 11 个问题（这是写 PRD 的输入）：
>
> 【为什么/做什么/不做什么】（纯产品决策，不受 06 约束）
> 1. 业务目标 + 产品目标 + Non-Goals（明确不做什么）
> 2. 1-2 个主画像 + 反画像（明确不服务谁）
> 3. 3-5 条核心用户故事（INVEST 格式）
>
> 【架构基线影响的功能决策】（必须参考 06）
> 4. MVP 功能列表 + Out-of-Scope 清单
>    - Must-have 优先选 06 复用矩阵中"直接复用"的能力
>    - Out-of-Scope 必含 06 中代言人自报"致命缺陷"涉及的能力
> 5. 每个核心功能的关键边界条件（数据缺失/并发/失败怎么办）
>    - 边界要落到 06 架构基线能支撑的范围内
>
> 【怎么算做好了】
> 6. 非功能需求（性能/可用性/合规，必须用数字）
>    - 性能上限参考 06 架构基线的真实能力
> 7. 每个用户故事的验收标准（Given/When/Then）
> 8. 优先级（MoSCoW：Must/Should/Could/Won't）
>    - 排序要参考 06 的改造成本（成本低 = 优先级前）
> 9. 北极星指标 + 关停线
>    - 关停线考虑 06 架构基线的扩展上限
>
> 【还不确定的】
> 10. Open Questions（至少 3 个）
>     - 必须包含 06 中遗留的所有 Open Questions
>     - 可补充新的产品级 Open Questions
> 11. 依赖与约束（产品级——技术依赖已在 06 中明确）
>     - 外部 API、合规审批、平台政策
>     - 不重复 06 中的技术依赖
>
> ⚠️ 禁止重开的话题：
> - 架构基线（用什么 fork / 复合方案）—— 06 已决定
> - 技术选型（用什么框架 / 库）—— 留给 spec-kit /plan
> - 06 中已被否决的方案 —— 不要旧事重提

---

#### 版本 B（跳过 ⓪，无 06）

> 请仔细阅读 specs/research/ 下的 5 份调研，然后用 Superpowers brainstorming
> Skill 帮我收敛 MVP 方向。必须帮我确定以下 11 个问题（这是写 PRD 的输入）：
>
> 【为什么/做什么/不做什么】
> 1. 业务目标 + 产品目标 + Non-Goals（明确不做什么）
> 2. 1-2 个主画像 + 反画像（明确不服务谁）
> 3. 3-5 条核心用户故事（INVEST 格式）
> 4. MVP 功能列表 + Out-of-Scope 清单
> 5. 每个核心功能的关键边界条件（数据缺失/并发/失败怎么办）
>
> 【怎么算做好了】
> 6. 非功能需求（性能/可用性/合规，必须用数字，不要形容词）
> 7. 每个用户故事的验收标准（Given/When/Then）
> 8. 优先级（MoSCoW：Must/Should/Could/Won't）
> 9. 北极星指标 + 关停线
>
> 【还不确定的】
> 10. 至少 3 个 Open Questions
> 11. 关键依赖与约束（外部 API/数据/合规审批）
>
> ⚠️ 技术选型相关讨论留给后续 spec-kit /plan 环节。

### ② 用 prd-writer Skill 写 PRD
触发提示词（极简版，规范在 prd-writer Skill 内部）：
> 基于 brainstorming 的收敛结果和 specs/research/ 下的调研文件，
> 用 prd-writer Skill 帮我写 PRD（产出到 specs/prd.md）。
>
> ⚠️ 如果 specs/research/06-架构基线决策.md 存在：
> PRD 需新增"架构基线"小节，搬运 06 的复用矩阵。

💡 设计原则：prd-writer Skill 已编码 12 章节规范、AC 格式、NFR 数字化、
Must-have 可独立 specify 等约束——触发提示词不重复，让 Skill 自己负责规范。

### ③ 用 GitHub Spec-Kit 把 PRD 转成可执行 spec
触发提示词（对 PRD 每个 Must-have 功能各跑一次）：
> 实现 specs/prd.md 中的 <功能名>，跑全套 spec-kit 流程：
> /speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement

⚠️ **关键工作流约束**（spec-kit 本身不知道这些）：
- 按 Must-have 拆条跑——禁止把整个 PRD 喂给 /speckit.specify（context 会撑爆）
- /speckit.specify 自己会从 specs/prd.md 取材料，不需要在提示词里复制 PRD 内容
- 跳过 brainstorming 直接写 PRD → PRD 必然发散
- 跳过 PRD 直接 /speckit.specify → spec 缺业务上下文，AI 会瞎补默认假设
```

---

## 完整示例

📖 **何时读 [references/example-stock-ai.md](references/example-stock-ai.md)**：用户需要参考完整示例或不确定某主题怎么填时读。这是从骨架到最终提示词的端到端样例，可**直接当模板用**。

---

## 不要做的事

- ❌ 不要硬编码"对标竞品""数据源"等场景特异内容，由 Q&A 抽取
- ❌ 不要替用户决策。Skill 只生成调研提示词，事实由 sub-agent 调研得出
- ❌ 不要省略双路调研。中国市场场景下，单靠 WebSearch 会漏掉大量中文信源
- ❌ 不要为了少问而跳过 Q&A。骨架没问清楚，生成的提示词必然是空话
- ❌ 不要在主 Claude session 里直接做调研。**必须派 4 个 Task**——保护主 session context、真并行省时间

---

## 输出格式要求

1. 最终交付物是**一份完整的并行调研提示词**（Markdown）
2. 用户复制粘贴这份提示词到 Claude Code 即可启动 4-agent 并行调研
3. 必须包含：项目定位 + 输出路径 + 4 主题 + 汇总 + 质量要求 + 双路规范 + 并行说明 + 下一步衔接
4. 行长度 ≤ 100 字符（便于 review）

---

## 触发关键词

**中文**：新项目立项 / 立项调研 / 产品调研 / 项目可行性 / 帮我调研一个新想法 / 我想做个 X 怎么开始调研 / 把想法变成调研计划 / 调研同类竞品 / 摸底数据来源 / 摸底开源生态

**英文**：kickoff research / product research / 0 to 1 research / new product discovery
