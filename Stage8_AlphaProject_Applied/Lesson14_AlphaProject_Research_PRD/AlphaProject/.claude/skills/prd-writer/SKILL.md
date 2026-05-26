---
name: prd-writer
description: 生成符合行业标准的产品需求文档（PRD / Product Requirements Document）。当用户提到"写 PRD / 产品需求文档 / 需求文档 / 功能规约 / 产品规约 / spec / 写需求 / 整理需求 / 把想法变成 PRD / 把头脑风暴结果落成需求文档 / 写 product spec / 把脑暴结论沉淀成文档"等场景时务必调用。输出 14 章结构化 PRD，支持 Brainstorming → PRD → TRD 的 Vibe Coding 工作流。中文优先，AI Agent 友好。即使用户没明确说"用 Skill"，只要任务沾边产品需求文档撰写都要调用。
---

# PRD-Writer · 标准产品需求文档生成 Skill

## 这个 Skill 是什么

把"想法 + 调研 + 头脑风暴结论"转化为**符合行业标准的 14 章 PRD 文档**。产出物可以直接喂给工程师 / Claude Code / Spec-kit 进行后续技术方案设计和实现。

**它是什么**：
- 一份**结构化、可验证、AI 友好**的产品需求文档生成器
- 符合行业标准的 14 章 PRD 模板，覆盖从背景到风险的完整维度
- **中文优先**，但章节命名保留中英对照

**它不是什么**：
- ❌ 不是技术方案设计文档（TRD / Design Doc）—— 那是下一步
- ❌ 不是市场调研 / 竞品分析 / 商业计划 —— 那是上游
- ❌ 不替代头脑风暴本身 —— 它把头脑风暴的结论**沉淀**成正式文档

---

## 核心原则（铁律）

### 1. PRD 在 Brainstorming **之后**，不是之前

正确链路：
```
想法 → 调研 → Brainstorming（发散+收敛）→ PRD（落笔）→ TRD（技术方案）→ 实现
                                            ↑
                                       本 Skill 在这里
```

⚠️ **反模式**：用 PRD 来做发散讨论。PRD 是"决议书"不是"探讨稿"。

### 2. PRD 写"做什么"，不写"怎么做"

**一刀切判断法**：
> 工程师能换一种实现仍满足该条 → **留在 PRD**
> 工程师不能换实现 → **那是技术决定，搬去 TRD**

✅ 进 PRD：「自选股 Dashboard 首屏加载 ≤ 2 秒」
❌ 不进 PRD：「用 React + Vite 实现 Dashboard」

详见 `references/prd-vs-trd-boundary.md`

### 3. AI 友好的精度

"Specs are the new code"：PRD 必须写到 **AI Agent 能直接消费**的精度——输入/输出/边界条件/验收标准都明确。

但仍**不指定**：技术栈 / 具体库 / 具体类名。

---

## 5 步工作流

### Step 1：检查上游产物（前置条件）

询问用户是否有以下材料（任一即可）：

- 📁 调研报告（Step 2 调研产物）
- 📝 Brainstorming design doc / 会议纪要
- 💡 想法卡 / MVP Scope 范围声明
- 🎯 竞品分析 / 用户访谈纪要

如果**完全没有**上游材料：
- 不要硬写 PRD（写出来必然是空话）
- 建议用户先做 brainstorming 或调研
- 或者通过 Q&A 现场提取（适用于简单项目）

### Step 2：补齐 6 个核心信息

通过苏格拉底式 Q&A 补齐（一次问一个，A/B/C 多选题优先）：

1. **项目一句话定义**：「____ 是给 ____ 的 ____ 用的 ____ 工具」
2. **核心目标用户**：主画像 / 反画像
3. **MVP 范围**：必做的 3-5 个功能 + 明确不做的清单
4. **成功指标**：怎么算成功？（具体数字，不要 "更好"）
5. **关键非功能需求**：性能 / 安全 / 合规底线
6. **当前不确定的问题**：3-5 个 Open Questions

⚠️ 如果用户对某个问题给的是模糊答案，**追问**直到明确。不要替用户脑补。

### Step 3：按 14 章结构生成 PRD

📖 **何时读 `references/14-chapters-detailed.md`**：开始生成 PRD 章节时读取，每写一章前对照该章的"模板片段 + 反模式"

**速览**：

| # | 章节 | 必/推/可 | 一句话目的 |
|:-:|------|:-:|----------|
| 1 | 文档信息（版本/作者/状态） | ★ | 谁、何时、改了什么 |
| 2 | 项目背景与目标（Why） | ★ | 为什么做、要达成什么 |
| 3 | 目标用户与画像 | ★ | 给谁用 |
| 4 | 用户故事 / 使用场景 | ★ | 用户在什么情境下用 |
| 5 | 功能列表与范围（Scope / Out-of-Scope） | ★ | 做什么、不做什么 |
| 6 | 详细功能描述（输入/输出/流程/边界） | ★ | 每个功能怎么表现 |
| 7 | 非功能需求（性能/安全/合规） | ★ | 质量底线 |
| 8 | UI / 交互说明 | ☆ | 长什么样 |
| 9 | 验收标准（Given/When/Then） | ★ | 怎么算做完了 |
| 10 | 优先级 / MVP 范围 | ★ | 先做哪一刀 |
| 11 | 度量指标（成功标准） | ★ | 怎么算成功 |
| 12 | 依赖与约束 | ☆ | 卡在哪、等谁 |
| 13 | 风险与对策 / 开放问题 | ★ | 还不确定什么 |
| 14 | 里程碑 / 时间计划 | ☆ | 什么时候做完 |

★ 必备 · ☆ 推荐 · ○ 可选

**精简版**（适用于小项目 / 个人项目）：保留 #1, #2, #3, #5, #6, #9, #10, #11, #13（9 章）。

### Step 4：自检 4 个关键边界

写完后自检：

- [ ] **What/How 边界**：没有写技术栈 / 框架 / 库的选型
- [ ] **可验证性**：每个功能都有可执行的验收标准（Given/When/Then 格式）
- [ ] **范围明确**：Scope 和 Out-of-Scope 都写了
- [ ] **AI 友好**：边界条件、异常处理、性能要求都明确，AI 不需要"猜"

📖 **何时读 `references/prd-anti-patterns.md`**：自检阶段必读，按 24 条反模式速查表逐项过
📖 **何时读 `references/prd-vs-trd-boundary.md`**：遇到"这内容算 What 还是 How"的灰色判断时读

### Step 5：输出 + 衔接下一步

**输出位置**：`<项目>/specs/<feature-slug>/prd.md`

**衔接建议**（写在 PRD 末尾）：

```markdown
## 下一步

本 PRD 已完成 Step 3。继续走 Step 4 技术方案设计：
- 使用 Spec-kit `/speckit.plan` 命令基于本 PRD 生成 plan.md
- 或者再次启动 Brainstorming Skill 做技术选型
- 关注点：架构 / 数据模型 / API 契约 / 部署方案
```

---

## 在 Vibe Coding 9 步流程中的位置

```
1.想法 → 2.调研 → [Brainstorming 发散] → 3.PRD ← 本 Skill → 4.技术方案 → 5.前端设计 → ...
                                          ↑
                                          产物：specs/<feature>/prd.md
```

📖 **何时读 `references/workflow-integration.md`**：用户问"这 Skill 和 Spec-Kit / OpenSpec / Superpowers 怎么配合"时读

---

## 量化交易场景：完整 PRD 示例

📖 **何时读 `references/quant-trading-example.md`**：用户需要参考示例 / 不确定某章节怎么填时读。它是一份完整的"A 股 AI 盯盘助手"PRD，**直接可用作模板**。

---

## 推荐 PRD 文件命名规范

```
<项目根>/
├── specs/
│   ├── 0001-self-stock-dashboard/
│   │   ├── prd.md                  ← 本 Skill 产物
│   │   ├── plan.md                 ← Step 4 产物（不本 skill 负责）
│   │   ├── tasks.md                ← Step 4 产物
│   │   └── README.md
│   ├── 0002-ai-stock-picker/
│   └── ...
```

**命名规则**：`<4位序号>-<kebab-case-feature-slug>/`

---

## 输出格式要求

1. **Markdown**，不要 Word / PDF
2. **章节顺序固定**，按 14 章模板
3. **每章用 `##` 二级标题**
4. **表格优先**，少用长段落
5. **每个功能描述用统一的 4 元组**：触发 / 输入 / 流程 / 输出 / 边界
6. **验收标准用 Given/When/Then 格式**（可机器验证）
7. **行长度** ≤ 100 字符（便于 diff / review）

---

## 与已有工具的兼容

| 工具 | 兼容性 | 说明 |
|------|:-----:|------|
| GitHub Spec-Kit `/specify` | ✅ 完全兼容 | 本 Skill 产物可作 spec.md 用 |
| OpenSpec | ✅ 兼容 | 可作为 `/proposal` 的输入 |
| Superpowers Brainstorming | ✅ 完美衔接 | 本 Skill 是 Brainstorming 的下一步 |
| Claude Code 内置 | ✅ 原生 | 直接读取 |
| Cursor / Codex | ✅ Markdown 通用 | 可直接喂 |

---

## 触发关键词速查

中文：写 PRD / 产品需求文档 / 需求文档 / 功能规约 / 产品规约 / 写需求 / 整理需求 / 把想法变成 PRD / 把脑暴落成文档 / PRD 草稿 / spec 文档
英文：write a PRD / product requirements / spec doc / feature spec / requirements document

只要任务**沾边产品需求文档**，立刻调用本 Skill。

---

## 反模式速览（写完 PRD 后必检）

- ❌ 写成功能罗列（缺 Why / 缺验收）
- ❌ 没有 Out-of-Scope（范围会爆）
- ❌ 把技术栈写进 PRD（污染边界）
- ❌ 验收标准写成"系统应该好用"（不可验证）
- ❌ 没有 Open Questions（假装一切清楚）
- ❌ 文档信息缺失 / 版本号永远是 v0.1

完整反模式清单见 `references/prd-anti-patterns.md`

---

## 当用户的项目是中型/大型时

按需启用以下补充章节：
- **业务规则与异常分支**（电商 / 金融 / 政务必备）
- **多语言 / 国际化要求**
- **数据迁移方案**（替换老系统时）
- **培训与运营支持**（B 端 SaaS）

按需扩展，但不要为了写而写。

