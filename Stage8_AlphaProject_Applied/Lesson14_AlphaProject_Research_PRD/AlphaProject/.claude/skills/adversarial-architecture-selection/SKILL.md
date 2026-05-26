---
name: adversarial-architecture-selection
description: 把"多候选技术架构选型"打包成"法庭式 5 角色对抗调研"的标准化流程，用 Claude Code Agent Teams 让代言人/红队/集成评估师互相质疑，主 Claude 充当法官综合判决，最终产出架构基线决策文档。适用：多个开源项目 fork 选型、多个 SaaS/云厂商选型、多个技术栈对决（React vs Vue vs Svelte）、多个开源库选型（LangChain vs LlamaIndex）、多个架构方案选型（Monolith vs Microservices vs Serverless）、PRD 写到一半发现技术决策有争议需要 deep dive。即使用户没明确说"用 Skill"，只要任务沾边"多候选架构选型需要更严谨的对抗评估"都要调用。触发关键词：架构选型 / 技术选型 / fork 选型 / 候选对抗 / 多方案对比 / 选型纠结 / 架构决策 / 技术栈对决 / 帮我决定用 X 还是 Y / SaaS 选型 / 库选型 / 对抗调研 / architecture decision / tech selection / framework comparison / vendor evaluation / adversarial review。不用于：单一候选无对比（不需要对抗）、纯产品决策不涉技术（用 brainstorming）、已有强烈倾向只想确认（用 devil's advocate 单 agent Skill 即可，本 Skill 过重）。
---

# Adversarial Architecture Selection

## Overview

把"多候选技术架构选型"标准化为**法庭式 5 角色对抗调研**。用 Claude Code Agent Teams 让代言人、红队、集成评估师在 mailbox 中互相质疑，主 Claude 充当法官，最后综合判决出架构基线决策。

它在 Vibe Coding 工作流里的位置（5 段链路）：

```
立项调研（product-research-kickoff）
   ↓
★ 对抗调研（本 Skill，可选——多候选时强烈建议）
   ↓
Brainstorming（产品方向收敛）
   ↓
PRD（prd-writer）
   ↓
Spec-Kit（/specify → /plan → /tasks → /implement）
```

**它不是什么**：不是单 agent 的 devil's advocate（那个过轻）、不是 brainstorming（那是发散收敛产品方向）、不是 PRD 写作器。

**为什么要对抗**：单 agent 做架构评估有强烈的"代言人偏见"——任何项目都能找到优点循环讲、缺点轻描淡写。多候选选型时这个偏见会让重要决策失真。多 agent 法庭辩论是业界（D3 / MAD-M² / AgentCourt）公认的对抗这个偏见的最佳实践。

---

## 核心原则

### 1. 固定 5 角色 Team，无论候选数 N 多少

```
3 代言人 + 1 红队 + 1 集成评估师 = 5 个 teammate（官方推荐甜区）
```

候选项目数 N > 3 时，代言人**内部串行** owns 多项目（不破坏团队规模）。N=2 时第 3 代言人退化为"备用红队"增强反方力量。

### 2. 对抗发生在 paper 层级，不是 teammate 层级

红队和集成评估师**对每份 position paper 单独发质疑**——总质疑数 = 3N，随 N 线性扩展，但 teammate 数固定。这是支持任意 N 的关键设计。

### 3. 反偏见是硬约束（不是建议）

- 每份 paper 必含"致命缺陷自述"（强制 self-attack）
- Phase 2 提交 papers 时**随机打乱顺序**（防位置偏见）
- 每条质疑回应 ≤ 200 字（防长度偏见）
- Lead 在 Phase 2 中**禁止表态**（防权威干预）
- 详细学术依据见 [references/anti-bias-guardrails.md](references/anti-bias-guardrails.md)

### 4. Lead 法官只做综合判决，不参与辩论

主 Claude 在 Phase 1/2 全程**只观察**，Phase 3 才综合所有 papers + debate transcripts 写架构基线决策。这是 LLM-as-Judge 最佳实践——评判者不参与生产证据。

### 5. 三阶段流程严格不可跳

```
Phase 0: 候选项目分配（任务分配，不是淘汰）
Phase 1: 独立深挖（5 agent 并行，禁止互相通信）
Phase 2: 法庭辩论（inter-agent messaging，1-2 轮）
Phase 3: Lead 综合判决（写决策文档）
```

---

## 5 步工作流

### Step 1：判断是否触发本 Skill

适用：用户面对**多个技术候选**且需要做选型决策。常见场景：
- 多个开源项目（≥ 2 个）想 fork，不知选哪个
- 多个 SaaS / 云厂商对比（如 Vercel vs Netlify）
- 多个技术栈对决（如 React vs Vue vs Svelte）
- 多个开源库选型（如 LangChain vs LlamaIndex）
- 调研已做完但发现技术决策仍有争议

不适用：
- 单候选无对比 → 不需要对抗
- 纯产品决策（功能/用户/优先级）→ 用 brainstorming
- 已有强烈倾向只想确认 → 用单 agent devil's advocate Skill 更轻

📖 **何时读 [references/debate-protocol.md](references/debate-protocol.md)**：触发判断需要更详细的场景判定时读取。

### Step 2：确认前置条件 + 启用 Agent Teams

确认：
- Claude Code v2.1.32+
- 已启用 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`（settings.json 或环境变量）
- 用户能提供候选清单（来自 `specs/research/03-开源项目.md` 或用户直接列出）

如果用户没启用 Agent Teams，先指导启用，再继续。

### Step 3：Phase 0 候选分配

读取候选清单，按下表分配给 3 个代言人：

| N | 分配方案 | 备注 |
|---|---------|-----|
| 0 或 1 | 终止流程（无需对抗）| — |
| 2 | 代言人 1/2 各 1 项目，代言人 3 改为"备用红队"| 增强反方 |
| 3 | 1 代言人 = 1 项目（理想态）| — |
| 4 | 1 代言人 owns 2 项目，其余各 1 | 技术栈相近的合并 |
| 5 | 2/2/1 分配 | — |
| 6+ | 均匀分配 | 罕见 |

分配原则：**技术栈/定位相近**的合并给同一代言人；**差异大**的分给不同代言人。

写入 `specs/research/debate/00-任务分配.md`。

### Step 4：spawn 5 个 teammate

📖 **何时读 [references/role-spawn-templates.md](references/role-spawn-templates.md)**：spawn 时读取，按模板组装各角色的 prompt。

5 个 teammate：
- Teammate 1-3：项目分析师（代言人）
- Teammate 4：红队（魔鬼代言人）
- Teammate 5：集成评估师

📖 **何时读 [references/7-dimensions-framework.md](references/7-dimensions-framework.md)**：组装代言人 prompt 时读取，把 7 维度深挖框架内联到 spawn prompt 里。

### Step 5：执行 3 阶段 + 综合判决

📖 **何时读 [references/debate-protocol.md](references/debate-protocol.md)**：执行 3 阶段时读取，按协议规范驱动 teammate。

**Phase 1**（独立深挖）：5 agent 并行写 papers，禁止互相通信。
**Phase 2**（法庭辩论）：papers 进 mailbox（随机打乱），红队对每份 paper 发 3 条质疑，集成评估师对单 fork paper 发 1 条挑战，代言人逐条回应（每条 ≤ 200 字），1-2 轮。
**Phase 3**（Lead 综合）：写 `specs/research/06-架构基线决策.md`，更新 `05-决策汇总.md → v2`。

📖 **何时读 [references/anti-bias-guardrails.md](references/anti-bias-guardrails.md)**：Phase 2 启动前读取，把反偏见硬约束确认贯彻。

---

## 完整示例

📖 **何时读 [references/example-fork-selection.md](references/example-fork-selection.md)**：用户做开源 fork 选型时读取。完整示例从 Phase 0 到 Phase 3 的产物。

📖 **何时读 [references/example-tech-stack.md](references/example-tech-stack.md)**：用户做纯技术栈选型（无源码可读，纯文档/社区资料对比）时读取。

---

## 不要做的事

- ❌ 不要跳过 Phase 0 直接 spawn——候选分配错了后续都歪
- ❌ 不要让 Lead 在 Phase 2 中表态——权威干预会让 teammate 从众
- ❌ 不要让代言人写"留余地"的 paper——每份都要假设这是唯一选项强势论证
- ❌ 不要省略"致命缺陷自述"——这是反偏见的核心机制
- ❌ 不要按 paper 顺序提交给 Lead——必须随机打乱
- ❌ 不要超过 2 轮辩论——边际收益急剧下降，token 成本飙升
- ❌ 不要让 N=2 时减少团队规模——加备用红队保持势均力敌

---

## 输出格式要求

最终交付物：
- `specs/research/debate/00-任务分配.md`
- `specs/research/debate/position-paper-{name}.md` × N
- `specs/research/debate/red-team-position.md`
- `specs/research/debate/integration-assessment.md`
- `specs/research/debate/debate-transcript.md`
- `specs/research/06-架构基线决策.md` ⭐ 最终产出
- `specs/research/05-决策汇总.md (v2)` ⭐ 同步更新

---

## 触发关键词

**中文**：架构选型 / 技术选型 / fork 选型 / 候选对抗 / 多方案对比 / 选型纠结 / 架构决策 / 技术栈对决 / 帮我决定用 X 还是 Y / SaaS 选型 / 库选型 / 对抗调研 / 多候选评估 / 多项目复合

**英文**：architecture decision / tech selection / framework comparison / vendor evaluation / adversarial review / multi-candidate selection / fork decision

---

## 与其他 Skill 的关系

- **`product-research-kickoff`**（上游）：完成 5 份调研后，如果 03-开源项目.md 有多候选，触发本 Skill
- **`brainstorming`**（下游）：本 Skill 产出架构基线决策后，brainstorming 收敛 MVP 方向
- **`prd-writer`**（下下游）：brainstorming 之后，PRD 中的"架构基线"小节直接引用本 Skill 的产出
- **单 agent devil's advocate Skill**：本 Skill 的轻量版替代品，单候选场景用它即可
