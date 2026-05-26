# Ready-to-Copy Prompts

Copy-paste prompts for each of the 4 steps. Provided in both English and Chinese.
Adapt the placeholders (in `<angle brackets>`) to your project.

---

## Step 1 · Material Placement (Stitch source example)

### Chinese

```
请帮我把 Stitch 下载的设计产出物整理进当前项目，按以下规则执行：

源目录：<把这里替换成你的 Stitch 下载目录绝对路径>
目标：当前项目根目录

操作清单：
1. 把 source 目录下 <design-system-name>/DESIGN.md 复制到项目根目录，
   作为整个项目的前端设计宪法
2. 在项目根目录新建 design-reference/stitch-export/ 目录
3. 把 source 目录下 _1 ~ _N 这些页面目录全部复制到
   design-reference/stitch-export/ 下，并按各自 code.html 的 <title> 重命名为语义名
   （例：_7 的标题是"自选股管理" → 重命名为 watchlist-zh）
4. source 目录里的 prd.md 不要复制；如果项目里已有 specs/prd.md，先对比内容，
   不一致就停下来问我
5. App shell 目录（如果存在）复制到 design-reference/stitch-export/_app-shell/
6. 跳过 .DS_Store 和其他系统文件

完成后输出：
- 项目目录结构（tree，深度 3）
- DESIGN.md 是否成功放到根目录（ls -la 验证）
- 每个 design-reference/stitch-export/<page>/ 下的文件清单
- 重命名映射表（原编号 → 语义名）

注意：
- 用 cp -r 复制，不要用 mv，保留原件作为备份
- 项目根目录已存在 DESIGN.md 或 design-reference/ 时，停下来问我
```

### English

```
Help me organize the Stitch download artifacts into my current project,
following these rules:

Source directory: <absolute path to your Stitch download>
Target: current project root

Tasks:
1. Copy <design-system-name>/DESIGN.md from source to project root
   (this becomes the project's frontend design constitution)
2. Create design-reference/stitch-export/ at project root
3. Copy all _1 ~ _N page directories from source into
   design-reference/stitch-export/, renaming each to a semantic name based on
   the <title> tag in its code.html
   (example: _7 has title "Watchlist Management" → rename to watchlist-en)
4. Do NOT copy prd.md from source — project already has specs/prd.md.
   If contents differ, stop and ask me
5. App shell directory (if present) → design-reference/stitch-export/_app-shell/
6. Skip .DS_Store and system files

Output after completion:
- Project tree (depth 3)
- ls -la verifying DESIGN.md is at root
- File listing per design-reference/stitch-export/<page>/
- Rename mapping table (original number → semantic name)

Constraints:
- Use cp -r, never mv. Keep original artifacts intact
- If DESIGN.md or design-reference/ already exists at project root, stop and ask
```

---

## Step 2 · Constitution Injection

### Chinese

```
/speckit.constitution

我刚刚把视觉设计产出物归位到了当前项目：
- DESIGN.md 在项目根目录
- 视觉参考样本在 design-reference/<source>-export/

请基于这些素材，更新 .specify/memory/constitution.md，
追加"前端设计系统"章节。

第一步：你要先读取以下文件，理解项目的设计上下文
- DESIGN.md（设计系统全貌）
- specs/prd.md（业务背景、目标用户、市场惯例）
- design-reference/<source>-export/ 下任选 2-3 个页面（理解视觉风格）

第二步：从中抽取出"不可违反的设计原则骨架"，写进 constitution
每条原则写成：原则名 → 为什么不可违反 → 引用哪个具体文件作为执行依据

第三步：constitution 只写方向，不抄具体值
- ✅ 写："视觉规范的唯一来源是 DESIGN.md，颜色/字号/间距必须用其中定义的 tokens"
- ❌ 不写：具体的 hex 值、token 名、字体名、组件名

需要覆盖的方向（让你自己从素材里抽，不要我替你填）：
1. 视觉规范的真理来源（哪份文件说了算）
2. 视觉参考样本的引用方式（什么时候读 design-reference）
3. 目标市场/用户群的不可妥协约定（从 prd.md 抽）
4. 组件库基底（从 DESIGN.md 看出来用什么，不清楚就列 Open Question）
5. 信息密度 / 设计哲学（DESIGN.md 里的设计原则部分）
6. 多语言策略（如果 design-reference 里有多套语言）
7. 暗色/亮色模式（DESIGN.md 怎么说就怎么写）

硬约束：
- 不要把任何 hex 值、token 名、组件名、字体名复制到 constitution
- 不要替我决策——素材没明说的，列到 constitution 末尾 "Open Questions" 章节等我回答
- 写完后告诉我：① 改了哪些文件 ② 每条原则引用了素材的哪些段落
```

### English

```
/speckit.constitution

I've placed design artifacts in this project:
- DESIGN.md at project root
- Visual reference samples in design-reference/<source>-export/

Update .specify/memory/constitution.md by appending a "Frontend Design System"
section, based on these materials.

Step 1: Read these files to understand the design context
- DESIGN.md (the full design system)
- specs/prd.md (business context, target users, market conventions)
- 2-3 sample pages from design-reference/<source>-export/ (visual style)

Step 2: Extract "non-negotiable design principles" — direction, not values
Format each principle as: Name → Why it's non-negotiable → Source-of-truth file

Step 3: Constitution holds direction, DESIGN.md holds values
✅ Write: "Visual specs come from root DESIGN.md, all colors/fonts/spacing
   must use its tokens"
❌ Do NOT write: specific hex values, token names, font names, or component names

Required directions to cover (extract from the materials, don't ask me to fill):
1. Single source of truth for visual specs
2. How to reference visual prototype samples
3. Target market / user conventions that cannot be compromised
   (from prd.md; if unclear, Open Question)
4. Component library baseline (infer from DESIGN.md; if unclear, Open Question)
5. Information density / design philosophy (from DESIGN.md design principles)
6. Multi-language strategy (only if multiple shown in design-reference)
7. Theme mode — exactly what DESIGN.md says, no more

Hard constraints:
- Do NOT copy hex values, token names, font names, or component names
- Do NOT make decisions for me — anything unclear goes under
  "Open Questions" at the end
- After writing, report: (a) files changed (b) source paragraphs for each principle
```

---

## Step 3 · Impact Identification

### Chinese

```
扫描 specs/ 下所有 feature 目录，逐个判断 plan.md 或 tasks.md 是否涉及前端 UI
（React/Vue 组件、页面、表单、表格、图表、Dashboard 等）。

输出表格：
| feature 目录 | 是否含前端 UI | 需要重跑 plan+tasks 吗 | 对应 design-reference 哪个页面 |

判断标准：
- 含前端 = 需要重跑 /plan + /tasks
- 不含前端（纯后端/算法/调度/数据库）= 不动

不要替我决策，输出表格后停下来等我确认重跑清单。
```

### English

```
Scan all feature directories under specs/. For each, classify whether its
plan.md or tasks.md involves frontend UI (React/Vue components, pages, forms,
tables, charts, dashboards) versus pure backend/algorithm/scheduling/DB work.

Output table:
| Feature dir | Has FE? | Needs re-run? | Best matching design-reference/ page |

Criteria:
- Has FE = true → needs /plan + /tasks re-run
- Has FE = false → no action

Do NOT decide for me. After the table, STOP and wait for my confirmation.
```

---

## Step 4 · Selective Re-run (per feature)

### Chinese

```
针对 specs/<NNN>-<feature-name>/，只重跑 plan + tasks。
绝对不要动 spec.md 或 clarify 后的 spec.md——业务需求没有变化。

/speckit.plan
- 必须先读根目录 DESIGN.md 和 design-reference/<source>-export/<对应页面>/
- 在 plan.md 的"前端区"章节显式列出：
  ① 用哪些组件（按 DESIGN.md §Components）
  ② 每个组件对应 DESIGN.md 的哪一节
  ③ 视觉参考样本路径（design-reference/<source>-export/<page>/）
- 保留原 plan.md 的所有后端 / 集成 / 数据流 / 依赖 / 风险点 内容，不要动

/speckit.tasks
- 每条任务标签：[FE] / [BE] / [INT]
- [FE] 任务必带：
  ① 引用的 DESIGN.md 章节
  ② 参考的 HTML / 图片 样本路径
  ③ 用的 shadcn（或对应库）组件
- [BE] 任务：保留原内容
- 重新评估并行组（[FE] 和 [BE] 通常可并行）

完成一个 feature 后停下来给我确认，再跑下一个。
```

### English

```
For specs/<NNN>-<feature-name>/, re-run plan + tasks ONLY.
Do NOT touch spec.md or any clarify outputs — business requirements unchanged.

/speckit.plan
- Read root DESIGN.md and design-reference/<source>-export/<matched-page>/ first
- Add a "Frontend section" to plan.md listing:
  (a) Components used (per DESIGN.md §Components)
  (b) Which DESIGN.md section each component maps to
  (c) Visual reference sample path
- Preserve all existing backend / integration / data flow / dependencies / risks

/speckit.tasks
- Tag each task: [FE] / [BE] / [INT]
- [FE] tasks must cite:
  (a) DESIGN.md section
  (b) Reference HTML/image sample path
  (c) shadcn (or equivalent) component used
- [BE] tasks: preserve original
- Re-evaluate parallel groups ([FE] and [BE] usually parallelizable)

After this feature, STOP and let me review before the next.
```
