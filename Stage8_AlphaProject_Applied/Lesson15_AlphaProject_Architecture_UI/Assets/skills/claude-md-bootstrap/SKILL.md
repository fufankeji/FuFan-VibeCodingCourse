---
name: claude-md-bootstrap
description: Generate or refresh a project root CLAUDE.md by READING the project's existing documentation (PRD / architecture decisions / constitution / DESIGN.md / package.json) and producing a 200-line index that follows 2026 Anthropic best practices (WHAT/WHY/HOW framework, @path progressive disclosure, sparse use of YOU MUST/IMPORTANT) AND embeds Karpathy's 4 coding behavior principles (Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution). Use this whenever the user says "帮我写 CLAUDE.md", "项目需要 CLAUDE.md", "生成项目 CLAUDE.md", "refresh CLAUDE.md", "bootstrap CLAUDE.md", "把 PRD 整理进 CLAUDE.md", or asks how to make Claude Code understand their project's tech stack, architecture, conventions, and workflows. ALSO use this skill even when the user does not explicitly mention CLAUDE.md — as long as they want Claude Code to consistently understand their project's structure and rules, this skill applies. Do NOT use for a brand new empty project that has no documentation yet (in that case the user needs to write specs/PRD first).
---

# CLAUDE.md Bootstrap

A reusable workflow for generating a project root `CLAUDE.md` by reading the
project's existing documentation, applying 2026 community best practices, and
embedding Karpathy's behavior guidelines.

## Why this skill exists

Most projects already have rich documentation — PRD, architecture decisions,
design system specs, package.json. The problem isn't lack of content, it's
**lack of an index** that tells Claude Code:

1. What this project is and why it exists (WHAT/WHY)
2. How to find the detailed docs (paths via `@import`)
3. What behaviors to follow (do/don't, Karpathy principles)
4. What commands to run (from real package.json, not hallucinated)

A good CLAUDE.md is a **routing map + behavioral contract**, not a content dump.
Bad CLAUDE.md files copy entire PRDs into the root, blow past the 200-line
ceiling, and cause Claude to ignore real instructions (HumanLayer empirical
finding: instruction adherence drops sharply past 200 lines).

## When NOT to use this skill

- Brand new empty project, no docs yet → write specs/PRD first
- Project that already has a well-curated CLAUDE.md under 200 lines → just edit
  the specific section, don't regenerate
- Backend-only project with no design system → some sections (visual rules)
  don't apply; skip them rather than fabricate

## Prerequisites

Verify before starting. If anything is missing, stop and ask.

| Required | Why |
|---------|-----|
| Project root identified | `CLAUDE.md` must live at the absolute root |
| `package.json` (or equivalent: pyproject.toml / Cargo.toml / pom.xml) | For real commands and dependencies |
| At least one of: PRD / architecture doc / specs / README | Source of WHAT/WHY |

Optional but valuable:
- `.specify/memory/constitution.md` (Spec-Kit projects)
- `DESIGN.md` (projects with explicit visual system)
- `design-reference/` (projects with visual prototype samples)
- Existing `CLAUDE.md` (for merge-not-overwrite mode)

## The 4-step workflow

```
Step 1 · Source inventory       (which files exist, what's in them)
Step 2 · Section mapping        (which file → which CLAUDE.md section)
Step 3 · Generate from sources  (extract, never fabricate)
Step 4 · Verify and finalize    (line count, link integrity, traceability)
```

---

### Step 1 · Source inventory

Goal: build a list of what documentation actually exists. Don't assume; check.

Read each of these if present:

| File | What to extract |
|------|----------------|
| `specs/prd.md` (or `PRD.md`, `docs/prd.md`) | Project WHAT (§1) + WHY (§2 business goals) |
| architecture / tech-stack decision doc (any name, often under `specs/research/` or `docs/`) | Tech stack rationale, selection decisions |
| `.specify/memory/constitution.md` | Principles to reference (NOT copy) |
| `DESIGN.md` | Visual system existence — reference via @path |
| `design-reference/` | Visual sample directory — mention in file navigation |
| `package.json` / `pyproject.toml` / `Cargo.toml` | Real scripts, real dependency versions |
| `README.md` | Existing prose about the project |
| `specs/00X-*/` directories | Feature labeling conventions ([FE]/[BE]/[INT] or other) |

After reading, report to the user **what you found** with a brief summary
per file. Don't proceed to Step 2 until they confirm coverage is complete.

---

### Step 2 · Section mapping

Goal: decide which section of CLAUDE.md gets generated from which source files.

The standard 9-section template lives in `references/template.md`. Read it.

Build a mapping table for this specific project:

| CLAUDE.md section | Source file | Source line/section | Inclusion mode |
|-------------------|-------------|--------------------|----------------|
| 1. Project WHAT | PRD | the "what is this product / overview" portion (section name varies) | extract one paragraph |
| 2. Project WHY | PRD | the "why / business goals / problem to solve" portion (section name varies) | extract one paragraph |
| 3. Workflow HOW | (none — must be action-oriented) | see "anti-pattern" warning below | template constant |
| 4. Tech stack | package.json | dependencies + devDependencies | extract table |
| 5. Commands | package.json | scripts | extract verbatim |
| 6. Constitution ref | .specify/memory/constitution.md | (don't copy) | @import |
| 7. Visual system ref | DESIGN.md + design-reference/ | (don't copy) | @import + path |
| 8. Anti-patterns | constitution.md禁止段 + DESIGN.md 禁止段 | extract 6-8 items | bullet list |
| 9. Karpathy guidelines | references/karpathy-guidelines.md | (verbatim English) | bundled, fixed |
| 10. File navigation | (synthesized) | all key project files | extract table |

Show this mapping to the user. Highlight any sections where the source is
unclear or missing — surface as **Open Questions**, don't fabricate.

---

### Step 3 · Generate from sources

Goal: produce the actual CLAUDE.md content, extracting (never fabricating) from
the mapped sources.

**Inclusion rules**:

- `package.json` scripts → copy verbatim (if exists)
- Tech stack → infer from `dependencies` keys + real versions
- Karpathy section → use `references/karpathy-guidelines.md` verbatim (do NOT
  translate the English principles; the original wording is precise)
- Anti-patterns → bullet list, each item must trace to a source paragraph
- File navigation → only include files that exist; verify each path
- **§3 Workflow → extract from whatever workflow signals the project actually
  has: constitution / discipline / agent-rules / workflow.md / tasks.md label
  conventions / etc. Section names vary by project. NEVER copy a hardcoded
  template, NEVER hardcode specific section names.** See `references/template.md`
  Section 3.

### Phase 1 / Phase 2 handling for §4/§5 (greenfield projects)

For projects that have specs but no code yet (no `package.json`):

- §4 Tech Stack → write placeholder:
  "技术栈意图见 @specs/research/<architecture-decision-doc>.md。
   M1 启动 npm init 后，由 /init 命令从 package.json 自动同步真实依赖版本。"
- §5 Commands → write placeholder:
  "待 M1 启动 npm init 后，跑 /init 自动从 package.json scripts 抽取。"

Do NOT fabricate dependency names or commands. If the user wants details
sooner, ask them to run `npm init` first.

**Exclusion rules**:

- Do NOT copy multi-paragraph content from PRD / constitution / DESIGN.md
- Do NOT translate Karpathy's English principles to Chinese
- Do NOT add framework opinions not stated in source files (if PRD doesn't say
  "use Redux", don't write "use Redux")
- Do NOT exceed 200 lines total
- **Do NOT write §3 Workflow as a past-tense chronology** of how the project
  got to its current state. CLAUDE.md is read by FUTURE Claude sessions during
  DEVELOPMENT. They don't care about "we did research → debate → brainstorming
  → PRD → specify → clarify → plan → tasks → constitution". They care about
  "what do I do RIGHT NOW when starting a task?" §3 must be **action-oriented**
  — see `references/template.md` Section 3 for the right and wrong examples.

**Formatting**:

- Each `@path` reference must use the literal `@` prefix that Claude Code
  recognizes (e.g., `@specs/prd.md`, not `[link](specs/prd.md)`)
- "YOU MUST" and "IMPORTANT" markers: use at most twice in the whole file.
  Reserve them for genuinely critical rules (typically: "read constitution
  before any task" and "no hardcoded visual values")
- Use Chinese for project-specific content if the source docs are Chinese;
  use English for Karpathy section and generic framework names

---

### Step 4 · Verify and finalize

Goal: catch fabrication and ensure the output is usable.

Run these checks:

```
□ Line count < 200 (`wc -l CLAUDE.md`)
□ Each @import path resolves (file exists at given path)
□ Each command in commands section exists in package.json scripts
□ Each dependency mentioned exists in package.json with matching version
□ Each anti-pattern traces to a specific source paragraph
□ YOU MUST / IMPORTANT used ≤ 2 times total
□ Karpathy section is verbatim English (no translation drift)
□ File navigation table only lists files that actually exist
```

**Final report to user**:

```
- 总行数: N (上限 200)
- token 估算: ~K
- 来源映射表（每个章节抽自哪个文件）
- @import 路径完整性: M 个路径，全部解析成功 ✓
- 命令清单: P 条，全部在 package.json scripts 中验证存在
- 缺失/不确定项: [列出 Open Questions]
```

If there is an existing `CLAUDE.md`:
- Don't overwrite. Show diff. Let user decide what to merge.
- Preserve any sections the user wrote manually (look for sections not in the
  standard 9-section template — those are user-authored).

---

## What success looks like

After running this skill:

1. `CLAUDE.md` at project root, < 200 lines
2. Uses `@path` to reference detailed docs, doesn't duplicate content
3. Tech stack and commands match `package.json` exactly
4. Karpathy 4 principles embedded verbatim in English
5. Anti-patterns each trace to a source paragraph (no fabrication)
6. Every future Claude Code session has a routing map to the right doc

## Reference files

- `references/template.md` — the 9-section template structure with examples
- `references/karpathy-guidelines.md` — Karpathy's 4 principles, verbatim English

Read these when you need the exact section ordering or the exact Karpathy text.

## Ready-to-copy trigger prompt

The user can paste this verbatim to invoke the full workflow:

```
请帮我在当前项目根目录创建 CLAUDE.md。如果已有，先读现有内容，最后输出 diff
让我确认再写入，不要直接覆盖。

## 第一步 · 读取项目已有文档（信息源）

读取并理解：
1. specs/prd.md                          → §1 WHAT、§2 WHY
2. 架构 / 选型决策文档（任意命名，通常在 specs/research/ 或 docs/） → §4 技术栈
3. .specify/memory/constitution.md       → §3 工作流抽取源 + §8 Anti-Patterns
4. DESIGN.md（或 specs/design-reference/.../DESIGN.md）→ §7 视觉规范
5. package.json（若存在）                 → §4 真实依赖版本 + §5 真实命令
6. specs/ 下任选 2-3 个 feature 目录       → 了解 task 标签体系

读完报告：每个文件抽到了什么，哪些不存在。

## 第二步 · 按 10 章节生成

1. WHAT（从 prd.md 抽一段）
2. WHY（从 prd.md 业务目标抽一段）
3. 工作流 HOW —— 必须 action-oriented，绝对不要列过去步骤的历史
   从项目实际工作流信号抽取（宪法 / 纪律段 / tasks 标签 / workflow 文档等，
   章节名因项目而异，不要假定特定名字），组织成 4-5 个动作块：
   ① 如何启动一个 feature（一条命令）
   ② 每个 task 启动必须读哪些 @path
   ③ 测试纪律（用哪个 skill）
   ④ feature 完成动作
   ⑤ 节奏铁律
   每块只用 1-2 行。目标 20-30 行。
   禁止出现 "(已完成)" / "(已锁定)" / "(已立)" 等历史标记
4. 技术栈表（package.json 存在就抽真实版本，不存在就写 Phase 1 占位
   "见 @<架构决策文档真实路径>，M1 后 /init 自动同步"）
5. 命令清单（同上，不存在就 "待 M1 启动后 /init 补全"）
6. 项目宪法引用 → @.specify/memory/constitution.md
7. 视觉规范引用 → @<DESIGN.md 真实路径>
8. Anti-Patterns（从 constitution 禁止条款抽 6-8 条，每条加来源引用）
9. Behavioral Guidelines（Karpathy 4 原则，英文 verbatim，加中文导语一句）
10. 关键文件导航表（只列真实存在的文件）

## 第三步 · 硬约束

- 总长度 < 200 行
- "YOU MUST" / "IMPORTANT" 全文最多 2 次
- 不要复制宪法 / PRD / 架构基线 / DESIGN.md 的内容——用 @path 引用
- 命令、依赖、技术栈必须从真实文件抽，不知道用 Phase 1 占位，禁止编造
- §3 必须从源文件抽取，不要套模板
- §9 Karpathy 不要翻译成中文

## 第四步 · 完成报告

- 总行数 / token 估算
- 来源映射表（每章节抽自哪个文件的哪一节）
- 缺失/不确定清单（让我补充）

如已有 CLAUDE.md：保留用户手写章节 verbatim，只 merge 标准章节，输出 diff 等确认。
```

## A note on user communication

Users invoking this skill usually have rich docs already and feel the friction
of "Claude doesn't know where to look". Your first message should reassure:

> "We won't duplicate your PRD into CLAUDE.md. We'll build a 150-200 line
> routing map that points Claude to the right files. Total effort:
> ~15-20 minutes including verification."

Then proceed through the 4 steps interactively, pausing between Step 1
(inventory confirmation) and Step 2 (mapping confirmation) so the user can
catch missing sources early.
