# CLAUDE.md · 9-Section Standard Template

The reference structure for generated CLAUDE.md files. Adapt section content to
the specific project, but keep the section order and naming consistent.

Total target: < 200 lines.

---

## Section 1 · Project Identity (WHAT)

Open with a single-line title and a one-paragraph definition.

Pattern:
```markdown
# <project-name> · CLAUDE.md

> <one-line tagline, often from PRD title>

## 1 · 项目是什么 (WHAT)

<2-4 sentences extracted/synthesized from the PRD's "product overview / 概述"
section, whatever it's actually named in your PRD>

完整业务需求见：@specs/prd.md
```

---

## Section 2 · Why this project exists (WHY)

Pattern:
```markdown
## 2 · 项目目的 (WHY)

<2-3 sentences synthesized from the PRD's "business goals / 业务目标" portion,
whatever it's actually named>

详细业务目标和成功指标见 PRD §2 / §7.
```

---

## Section 3 · Workflow (HOW)

⚠️ **Principle: action-oriented, never historical.**

CLAUDE.md is read by future development sessions. They don't care how the
project got here ("调研 → 辩论 → PRD → specify → ... → 立宪"). They care
about **what to do right now when starting a task**.

### Extract, don't hardcode

§3 内容必须从以下源抽取，不要直接套模板：

- 项目宪法 / 纪律 / agent-rules 类文档中"开发期纪律"相关段（章节名因项目而异）
- `specs/00X-*/tasks.md` 的标签体系（[FE]/[BE]/[INT] 等）
- 项目实际工作流文档（README workflow 段 / docs/ 下相关文件）
- 你跟用户对话中提到的开发节奏约定

### Required structure (4-5 action blocks)

抽完之后按这个结构组织，**每块只用一两行**：

1. **如何启动一个 feature**（一条命令）
2. **每个 task 启动时必须读哪些上下文**（@path 列表）
3. **测试纪律**（用哪个 skill，节奏怎么走）
4. **feature 完成动作**（review skill + tag + state.md）
5. **节奏铁律**（停在哪里等审）

### Anti-pattern (禁止生成)

- 列过去 9 步"已完成"的历史
- 出现 "(已完成)" / "(已锁定)" / "(已立)" 这类历史标记
- 描述 "spec 是怎么写的" / "宪法是怎么立的"

### Target length

20-30 行。源文件信息少就更短，不要凑长度。

---

## Section 4 · Tech Stack

Extract from `package.json` (or equivalent). Real names, real versions.

Pattern:
```markdown
## 4 · 技术栈

| 层 | 技术 | 版本来源 |
|----|------|---------|
| 前端 | React + TypeScript + Tailwind + shadcn/ui | package.json |
| 后端 | Node.js + Express (或实际 framework) | package.json |
| 数据库 | <从架构决策文档抽取> | <架构决策文档真实路径> |
| 测试 | Vitest + @testing-library/react | package.json |
| 部署 | <从 PRD 或部署文档抽取> | - |

> 具体版本号见 `package.json`。技术选型理由见 @<架构决策文档真实路径>。
```

If the project has no architecture decision document, just point to package.json
and PRD.

---

## Section 5 · Commands

Verbatim from `package.json` scripts. Do not invent.

Pattern:
```markdown
## 5 · 命令清单

\```bash
# 开发
npm run dev          # <从 scripts 抽取的描述>
npm run dev:api      # ...

# 测试
npm test             # 跑所有测试
npm test -- <path>   # 跑单个测试文件

# 构建
npm run build
npm run lint
npm run typecheck
\```
```

Only include commands that actually exist in package.json. Don't show
"npm run lint" if there's no lint script.

---

## Section 6 · Project Constitution Reference

If the project has `.specify/memory/constitution.md`, reference it; do not copy.

Pattern:
```markdown
## 6 · 项目宪法

**YOU MUST** 在任何 task 实现前先读项目宪法：

@.specify/memory/constitution.md

宪法定义了若干条不可违反的原则。违反 = 实现失败。
```

If no constitution exists, skip this section.

---

## Section 7 · Visual System Reference

If the project has `DESIGN.md` and/or `design-reference/`, reference them.

Pattern:
```markdown
## 7 · 视觉规范

前端实现期 **YOU MUST** 先读：
- @DESIGN.md （设计系统宪法，颜色/字号/间距 token）
- `design-reference/<source>-export/<对应页面>/` （视觉参考样本）

关键约定：<如有 A 股红涨绿跌、暗色模式、品牌色等市场惯例，简短列出>
```

If the project has no visual system, skip this section.

---

## Section 8 · Anti-Patterns

What NOT to do. Each item must trace to a source paragraph (constitution,
PRD, architecture decision, or industry standard).

Pattern:
```markdown
## 8 · Anti-Patterns（禁止）

- ❌ 不要在代码中硬编码视觉值（颜色 hex / 字号 px）——必须走 DESIGN.md token
  *(来源: constitution F-1)*
- ❌ 不要引入第二套 UI 组件库——锁定 shadcn/ui
  *(来源: constitution F-4)*
- ❌ 不要在 /speckit.specify 阶段写技术选型——留给 /plan
  *(来源: Spec-Kit 官方指南)*
- ❌ 不要"贴心地"加未在 spec 中要求的功能
  *(来源: Karpathy 原则 #2 Simplicity First)*
- ❌ 不要让 .env / .credentials.yaml 进 git
  *(来源: 通用安全实践)*
- ❌ 不要 PR 一次性提交多个 feature——按 feature 拆 branch
  *(来源: Spec-Kit + Superpowers 协同惯例)*
```

Aim for 6-8 items. Each item ≤ 2 lines.

---

## Section 9 · Behavioral Guidelines (Karpathy-Inspired)

Insert the contents of `references/karpathy-guidelines.md` verbatim. Add a
Chinese opening line for accessibility:

```markdown
## 9 · Behavioral Guidelines (Karpathy-Inspired)

以下 4 条原则适用于全项目所有 task 实现期，目的是减少 AI 编码的常见失误。

[paste references/karpathy-guidelines.md verbatim here]
```

Do NOT translate the four principles. The original English wording is precise.

---

## Section 10 · Key File Navigation

A table that lists every important project document and when to read it.

Pattern:
```markdown
## 10 · 关键文件导航

| 文件 | 作用 | 何时读 |
|------|------|--------|
| @.specify/memory/constitution.md | 项目宪法 | 每个 task 实现前必读 |
| @specs/prd.md | 业务需求 | 业务边界不清时 |
| @<架构决策文档真实路径> | 技术选型 | 引入新依赖前 |
| @DESIGN.md | 视觉系统 | [FE] 任务必读 |
| design-reference/<source>-export/ | 视觉样本 | [FE] 任务必读 |
| specs/00X-<feature>/spec.md | feature 需求 | feature 开始前 |
| specs/00X-<feature>/plan.md | feature 实现方案 | feature 开始前 |
| specs/00X-<feature>/tasks.md | feature 任务清单 | task 执行时 |
| specs/00X-<feature>/state.md | feature 进度 | 每个 task 跑完更新 |
```

Only include files that actually exist. Verify each path before listing.

---

## Length budget

| Section | Target lines |
|---------|-------------|
| 1. WHAT | 5-8 |
| 2. WHY | 4-6 |
| 3. HOW | 8-12 |
| 4. Tech stack | 10-15 |
| 5. Commands | 15-25 |
| 6. Constitution ref | 5-7 |
| 7. Visual system ref | 5-8 |
| 8. Anti-patterns | 12-18 |
| 9. Karpathy | 30-35 |
| 10. File navigation | 12-18 |
| Headers + dividers | 10-15 |
| **Total** | **~115-167** |

This leaves a buffer under the 200-line ceiling for project-specific extensions.

---

## Section ordering rationale

Why this order:
1. **WHAT first** — Claude needs to know what this project IS before anything else
2. **WHY before HOW** — purpose before mechanics
3. **Tech stack before commands** — names before invocations
4. **Constitution + Visual before Anti-patterns** — positive rules before negatives
5. **Karpathy at the end** — universal behavior guidelines, the "always-true"
   layer underneath project specifics
6. **File navigation last** — readers who scroll to the end get the routing map
