# Handoff to PRD · 下游链路标准接口文档

> 本文是 `product-research-kickoff` Skill 的下游衔接规范，给"调研完之后到底怎么一路走到 Spec-Kit"
> 一个明确答案。SKILL.md 主体放触发提示词（即用即拿），本文放方法论（搞懂为什么这么衔接）。
>
> **何时读**：当用户问"调研完了下一步怎么走"、"PRD 到底要写啥"、"PRD 怎么转 spec-kit"时读取。

---

## 目录

- [一、4 段链路总览](#一4-段链路总览)
- [二、Brainstorming 必须确定的 11 个问题](#二brainstorming-必须确定的-11-个问题)
- [三、PRD 的 12 章节标准结构](#三prd-的-12-章节标准结构)
- [四、PRD → Spec-Kit 的 7 条转化规则](#四prd--spec-kit-的-7-条转化规则)
- [五、三个常见反模式](#五三个常见反模式)
- [六、信息来源](#六信息来源)

---

## 一、5 段链路总览（含可选对抗调研）

```
立项调研（本 Skill）
  产出：specs/research/01~05.md
  解决：市面上能做什么？能用什么资源？技术上可行吗？
       ↓
★ 对抗调研（adversarial-architecture-selection Skill，可选）
  触发条件：03-开源项目.md 有 ≥ 2 个候选，或技术方案有明显选型分歧
  产出：specs/research/06-架构基线决策.md + 05-决策汇总.md (v2)
  解决：在多个技术候选中做出可追溯的架构基线决策
       ↓
Brainstorming（Superpowers brainstorming Skill）
  产出：方向收敛纪要（覆盖下方 11 个问题）
  解决：在调研呈现的"可能性空间"里挑出最对的那个方向
       ↓
PRD（prd-writer Skill）
  产出：specs/prd.md（12 章节，AI 友好精度）
  解决：把"做什么 + 为什么 + 怎么算做好了"落成书面契约
       ↓
Spec-Kit（/specify → /plan → /tasks → /implement）
  产出：specs/00X-feature/{spec, plan, tasks}.md + 代码
  解决：把 PRD 的 Must-have 功能转成可执行 spec → 技术方案 → 任务 → 实现
```

**四个分界的本质**：

| 分界 | 本质 |
|------|------|
| 调研 → 对抗调研 | 信息收集 → 多候选对抗决策（仅在 N ≥ 2 时） |
| 对抗调研 → 脑暴 | 技术基线 → 产品方向决策 |
| 脑暴 → PRD | 口头共识 → 书面契约 |
| PRD → Spec-Kit | 产品语言 → 工程语言 |

**对抗调研何时跳过**：
- 03-开源项目.md 推荐 0 或 1 个候选 → 跳过，直接 brainstorming
- 已经做完技术选型，没有架构分歧 → 跳过
- 调研发现的候选差异极小（如 React 18 vs 19）→ 跳过，直接看官方文档

**对抗调研何时必做**（强烈建议不跳）：
- 多个开源项目 fork 候选（典型 fork 选型场景）
- 多个 SaaS / 云厂商对比（Vercel vs Netlify vs Cloudflare）
- 多个技术栈对决（React vs Vue vs Svelte）
- 多个库选型（LangChain vs LlamaIndex vs Haystack）
- 多个架构方案选型（Monolith vs Microservices vs Serverless）

---

## 二、Brainstorming 必须确定的 11 个问题

调研产物落地后，brainstorming 阶段必须帮用户回答完以下 11 个问题——**这 11 个答案就是 PRD 的输入清单**。如果某个问题答不上来，说明 brainstorming 没收敛到位，不要急着写 PRD。

### ⚠️ 如果走过对抗调研（有 06-架构基线决策.md），以下问题受 06 约束

| 问题 | 06 影响度 | 怎么影响 |
|------|:--------:|---------|
| Q1-3, Q7 | ❌ 不影响 | 纯产品决策 |
| Q4 MVP 功能 / Out-of-Scope | ✅ 强影响 | Must-have 优先选 06 "直接复用"模块；Out-of-Scope 必含 06 "致命缺陷"涉及的能力 |
| Q5 边界条件 | ✅ 强影响 | 边界要落到 06 架构基线能支撑的范围内 |
| Q6 非功能需求 | 🟡 部分影响 | 性能上限受架构基线约束 |
| Q8 优先级 MoSCoW | ✅ 强影响 | 排序参考 06 改造成本（成本低 = 优先级前）|
| Q9 关停线 | 🟡 部分影响 | 考虑 06 架构基线的扩展上限 |
| Q10 Open Questions | ✅ 强影响 | **必须包含 06 中遗留的所有 Open Questions** |
| Q11 依赖与约束 | ✅ 强影响 | 仅写产品级依赖（外部 API / 合规 / 审批），不重复 06 的技术依赖 |

**brainstorming 禁止重开**：架构基线（用什么 fork）、技术选型（用什么框架）、06 中已被否决的方案——这些是 06 的成果，不重新讨论。

### 【为什么/做什么/不做什么】（5 问）

1. **业务目标 + 产品目标 + Non-Goals**
   - 业务目标举例：6 个月服务 1,000 名用户
   - 产品目标举例：把"想法 → 上线"的时长从 2 周缩短到 2 天
   - Non-Goals 举例：不做高频、不做衍生品

2. **1-2 个主画像 + 反画像**
   - 主画像要具体到背景、目标、痛点、频次、设备
   - 反画像写"明确不服务谁"（比如机构客户、需要 < 10ms 响应的用户）

3. **3-5 条核心用户故事**（INVEST 格式）
   - 作为 X，我希望 Y，以便 Z
   - 必须是真实场景，不是功能改写

4. **MVP 功能列表 + Out-of-Scope 清单**
   - Must-have 控制在 5-8 个
   - Out-of-Scope 至少列 3 条（AI 不会从省略中推断）
   - ⚠️ 有 06 时：Must-have 优先选复用矩阵中"直接复用"的能力；
     Out-of-Scope 必含 06 中代言人自报"致命缺陷"涉及的能力

5. **每个核心功能的关键边界条件**
   - 数据缺失怎么办？并发冲突怎么办？外部服务挂了怎么办？
   - 这一项最容易被忽略，但直接决定 AI 编码时会不会瞎补假设
   - ⚠️ 有 06 时：边界条件要落到 06 架构基线能支撑的范围内

### 【怎么算做好了】（4 问）

6. **非功能需求**——必须用数字，禁止形容词
   - ❌ "快"、"友好"、"稳定"
   - ✅ p95 < 3s、月可用性 ≥ 99.5%、错误率 < 0.1%
   - 🟡 有 06 时：性能上限参考 06 架构基线的真实能力

7. **每个用户故事的验收标准（Given/When/Then）**
   - 可直接转测试用例
   - 至少覆盖正常路径 + 1 个异常路径

8. **优先级（MoSCoW）**
   - Must / Should / Could / Won't
   - 强制 80/20——所有功能都是 Must 等于没排
   - ⚠️ 有 06 时：排序参考 06 的改造成本（成本低 = 优先级前）

9. **北极星指标 + 关停线**
   - 北极星：1 个核心指标（如月活策略数 ≥ 5000）
   - 关停线：什么情况下推倒重来（如 3 个月 MAU < 200）
   - 🟡 有 06 时：关停线考虑 06 架构基线的扩展上限

### 【还不确定的】（2 问）

10. **至少 3 个 Open Questions**
    - 列出还不确定的事 + Owner + Due Date
    - 少于 3 个通常说明没想透（Aakash Gupta 原则）
    - ⚠️ 有 06 时：**必须包含 06 中遗留的所有 Open Questions**（不要丢失），
      可补充新的产品级 Open Questions

11. **关键依赖与约束**
    - 外部 API / 数据源 / 合规审批 / 平台政策
    - 哪些卡在别人手里，哪些有截止时间
    - ⚠️ 有 06 时：仅写**产品级**依赖（合规、外部审批、平台政策）；
      技术级依赖已在 06 中明确，不重复

### Brainstorming 触发提示词（推荐版）

```
请仔细阅读 specs/research/ 下的 5 份调研，然后用 Superpowers brainstorming
Skill 帮我收敛 MVP 方向，必须帮我确定上面 11 个问题。

⚠️ 不要让我"用 React 还是 Vue"——技术选型留给后面 spec-kit /plan 环节。
```

---

## 三、PRD 的 12 章节标准结构

业界综合 Atlassian / ProductSchool / Spec-Kit / Lenny / Amazon PR-FAQ 等十几家模板，归纳出 12 个章节（AI 时代精简版）。

| # | 章节 | 必备 | 一句话目的 | 对应 brainstorming 问题 |
|---|------|:---:|----------|----------------------|
| 1 | 文档信息 | ★ | 谁、什么时候、改了什么 | （填写时补）|
| 2 | 背景与目标 Why | ★ | 为什么做、要达成什么 | Q1 |
| 3 | 目标用户画像 | ★ | 给谁用 | Q2 |
| 4 | 用户故事 | ★ | 用户在什么情境下用 | Q3 |
| 5 | 功能范围 Scope / Out-of-Scope | ★ | 做什么、不做什么 | Q4 |
| 6 | 详细功能描述（输入/输出/边界） | ★ | 每个功能怎么表现 | Q5 |
| 7 | 非功能需求（数字化）| ★ | 质量底线 | Q6 |
| 8 | UI 链接（Figma + 关键页面） | ☆ | 长什么样 | — |
| 9 | 验收标准（Given/When/Then） | ★ | 怎么算做完了 | Q7 |
| 10 | 优先级 / MVP（MoSCoW） | ★ | 先做哪一刀 | Q8 |
| 11 | 度量指标（北极星 + 关停线） | ★ | 怎么算成功 | Q9 |
| 12 | 风险 + Open Questions + 依赖 | ★ | 还不确定什么 | Q10, Q11 |

### AI 友好的 PRD 写作要点（Spec-Driven 派）

1. **不写技术选型**（用什么框架/库/数据库）→ 这是 spec-kit `/plan` 的事
2. **写到"AI 直接消费"的精度**：每个功能的输入/输出/边界穷举
3. **AC 用 Given/When/Then** → 可直接转测试用例
4. **NFR 必须数字化** → AI 才能生成可测代码
5. **显式词表** → 领域术语单独列一节，AI 不能猜
6. **末尾加自检指令** → "完成后请逐条核对本 PRD 的每一项 AC"

### PRD 触发提示词（极简版，规范在 prd-writer Skill 内部）

```
基于 brainstorming 的收敛结果和 specs/research/ 下的调研文件，
用 prd-writer Skill 帮我写 PRD（产出到 specs/prd.md）。

⚠️ 如果 specs/research/06-架构基线决策.md 存在：
PRD 需新增"架构基线"小节，搬运 06 的复用矩阵。
```

💡 **设计原则**：prd-writer Skill 已编码 12 章节规范、AC 格式、NFR 数字化、
Must-have 可独立 specify、Out-of-Scope、Open Questions、不写技术选型等约束。
触发提示词不重复这些规范，让 Skill 自己负责。

⚠️ 唯一需要额外提示的是"06 架构基线小节"——这是 adversarial-architecture-selection
Skill 之后才出现的新场景，prd-writer 初版可能未编码。

---

## 四、PRD → Spec-Kit 的 7 条转化规则

### 4.1 关键事实（2026 年现状）

- **Spec-Kit 目前没有 `/speckit.prd` 命令**——是社区强烈要求但还未实现的功能（GitHub Issue #1527）
- **`/speckit.specify` 的设计是 feature-level**——一次处理一个功能，不是整篇 PRD
- **`/speckit.specify` 的输入要求**：高层 prompt，聚焦 What & Why，不写技术细节

### 4.2 三种主流转化模式

| 模式 | 怎么做 | 适合 |
|------|-------|-----|
| A. 整体喂入 | 把 PRD 全文给 `/specify` | MVP 小项目（< 5 个核心功能）|
| **B. 按功能拆条**（推荐）| 每个 Must-have 单独跑一次 `/specify` | 中大型项目 |
| C. PRD 作 Context | PRD 放 `.specify/memory/`，每次 specify 引用 | 多人协作、需求频变 |

### 4.3 写 PRD 时就为 Spec-Kit 做准备的 7 条规则

1. **每个 Must-have 功能写成可独立 `/specify` 的单元**
   - 一个功能一个段落，输入/输出/边界/AC 自包含
   - 不要在功能 A 段引用功能 B 段的"参见上文"

2. **AC 用 Given/When/Then**
   - 可被 `/specify` 直接转成测试用例
   - 至少 1 条正常路径 + 1 条异常路径

3. **边界条件穷举**
   - AI 不会从省略中推断
   - 例："如果没说不做认证，AI 可能就给你加上"

4. **每个功能标 Phase（5-15 分钟工作量）**
   - Claude Opus 4.5 时代的甜区
   - 太大 → 拆；太小 → 合

5. **显式词表**
   - 领域术语单独列一节
   - 量化的"滑点/撮合"、金融的"T+1"必须定义

6. **数据样例**
   - 给 input/output 的 JSON 或表格样例
   - AI 直接对齐，不用猜

7. **末尾加自检指令**
   - "完成后请逐条核对本 PRD 的每一项 AC，并报告未覆盖项"

### 4.4 Spec-Kit 触发提示词（极简版，对每个 Must-have 各跑一次）

```
实现 specs/prd.md 中的 <功能名>，跑全套 spec-kit 流程：
/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement
```

⚠️ **关键工作流约束**（spec-kit 本身不知道这些）：
- 按 Must-have 拆条跑——禁止把整个 PRD 喂给 /speckit.specify（context 会撑爆）
- /speckit.specify 自己会从 specs/prd.md 取材料，不需在提示词里复制 PRD 内容

💡 **设计原则**：spec-kit 是 GitHub 官方工具，工具自带规范由它负责；触发提示词
只补充"工作流级"约束（按功能拆条）——这是 spec-kit 工具不会自动遵守的部分。

---

## 五、三个常见反模式

| # | 反模式 | 后果 | 处方 |
|---|--------|-----|-----|
| 1 | 跳过 brainstorming 直接写 PRD | PRD 必然发散（调研只解决"能做什么"，不解决"该做哪个"）| 强制 brainstorming 收敛 11 问 |
| 2 | 跳过 PRD 直接 `/speckit.specify` | spec 缺业务上下文，AI 会瞎补默认假设 | 先写 PRD，再 specify |
| 3 | 把 PRD 整篇喂给 `/speckit.specify` | context 撑爆、spec 失焦 | 按功能拆条，每个 Must-have 各跑一次 |

---

## 六、信息来源

1. Sean Grove (OpenAI) — The New Code: "Specifications are the source, code is the output"
2. GitHub Spec-Kit 仓库 https://github.com/github/spec-kit
3. Spec-Kit `/specify` 模板 https://github.com/github/spec-kit/blob/main/templates/commands/specify.md
4. Spec-Kit `/speckit.prd` 命令提案 Issue #1527
5. Addy Osmani — How to write a good spec for AI agents https://addyosmani.com/blog/good-spec/
6. David Haberlah — How to write PRDs for AI Coding Agents
7. ChatPRD — Writing PRDs for AI Code Generation Tools in 2026
8. Atlassian — Product Requirements Document Guide
9. Aakash Gupta — PRDs: A Modern Guide
10. Lenny Rachitsky — Examples and templates of 1-Pagers and PRDs
11. 九天 KB — PRD标准规范与构成深度调研（综合 30+ 来源）
