# Worked Example: A-Share Trading Dashboard

A complete walkthrough using a real Stitch-generated A-share trading dashboard
project as the case study. This is what running this skill actually looks like
end to end.

## The starting state

The user had:

```
~/projects/ashare-watcher/
├── specs/
│   ├── prd.md                     (12-chapter PRD, A股 7×24 盯盘助手)
│   ├── 001-data-ingestion/        (数据接入: HN + RSS + A股行情)
│   │   ├── spec.md, clarify.md, plan.md, tasks.md
│   ├── 002-storage-layer/         (SQLite + 实时缓存)
│   │   └── ... 4 files
│   ├── 003-watchlist/             (自选股管理)
│   │   └── ... 4 files
│   ├── 004-stock-picker/          (智能选股引擎)
│   │   └── ... 4 files
│   ├── 005-anomaly-detector/      (异动检测)
│   │   └── ... 4 files
│   ├── 006-daily-briefing/        (早盘简报生成)
│   │   └── ... 4 files
│   ├── 007-dashboard-ui/          (盯盘主面板)
│   │   └── ... 4 files
│   ├── 008-feishu-push/           (飞书推送通道)
│   │   └── ... 4 files
│   └── 009-settings/              (设置页)
│       └── ... 4 files
└── .specify/
    └── memory/
        └── constitution.md
```

The user then ran a PRD through Google Stitch and downloaded the result to:

```
~/Desktop/stitch_web_ui_system_generator/
├── prd.md                                           (returned)
├── pro_density_financial_system/
│   └── DESIGN.md                                    (the design system)
├── alphaterminal_market_intelligence_hub/
│   └── code.html                                    (app shell)
└── _1/ _2/ ... _10/                                 (10 pages, en + zh)
```

## Step 1 in action

The user ran the Step 1 prompt (Stitch variant) from `references/prompts.md`.

The agent:

1. Read each `_N/code.html`'s `<title>` tag to map numbers → page names:

   ```
   _1  title="AlphaTerminal - A-Share AI Watcher"       → home-en
   _2  title="AlphaTerminal | Watchlist Management"     → watchlist-en
   _3  title="Settings | AlphaTerminal"                 → settings-en
   _4  title="AlphaTerminal | Alert History"            → alerts-en
   _5  title="Daily Briefs History | AlphaTerminal"    → briefs-en
   _6  title="AlphaTerminal - A股 AI 观察哨"            → home-zh
   _7  title="AlphaTerminal | 自选股管理"               → watchlist-zh
   _8  title="AlphaTerminal | 预警历史"                 → alerts-zh
   _9  title="设置 | AlphaTerminal"                     → settings-zh
   _10 title="每日简报历史 | AlphaTerminal"             → briefs-zh
   ```

2. Executed:

   ```bash
   cp ~/Desktop/stitch_.../pro_density_financial_system/DESIGN.md \
      ~/projects/ashare-watcher/DESIGN.md
   mkdir -p ~/projects/ashare-watcher/design-reference/stitch-export
   cp -r ~/Desktop/stitch_.../_1 ~/projects/.../design-reference/stitch-export/home-en
   # ... (9 more copies with renames)
   cp -r ~/Desktop/stitch_.../alphaterminal_market_intelligence_hub \
         ~/projects/.../design-reference/stitch-export/_app-shell
   ```

3. Verified `specs/prd.md` already exists, compared first 200 chars to source
   `prd.md`. Confirmed match. Did not copy.

4. Output:

   ```
   ~/projects/ashare-watcher/
   ├── DESIGN.md                       ✓ (185 lines, design tokens + components)
   ├── design-reference/
   │   └── stitch-export/
   │       ├── _app-shell/             (code.html)
   │       ├── home-en/                (code.html + screen.png)
   │       ├── watchlist-en/
   │       ├── ...
   │       └── briefs-zh/
   └── specs/                          (unchanged)
   ```

## Step 2 in action

The user ran the Step 2 prompt.

The agent read DESIGN.md, specs/prd.md, and 2-3 sample pages. It then proposed
this addition to `.specify/memory/constitution.md`:

```markdown
## Frontend Design System

### Principle 1 · Visual Source of Truth
All visual specifications (colors, typography, spacing, elevation, shapes) come
exclusively from root `DESIGN.md`. Any component implementation must consume
tokens defined there — no inline hex values, no ad-hoc font sizes.
Why: Constitution holds direction across design iterations; DESIGN.md holds
the current values that will evolve. Conflating them makes the system unable
to absorb design changes.
Source of truth: `<project-root>/DESIGN.md`

### Principle 2 · Visual Reference Anchoring
Before implementing any frontend feature, the implementing agent must read the
matching page in `design-reference/stitch-export/` for that feature.
Naming convention is semantic (e.g., `watchlist-zh` matches feature
`003-watchlist` in Chinese).
Why: Token-level DESIGN.md leaves layout ambiguous; reference HTML anchors the
visual intent. Without it, AI agents drift toward generic dashboards.
Source of truth: `<project-root>/design-reference/stitch-export/`

### Principle 3 · Target Market Conventions
This product targets Chinese mainland A-share retail traders. Market color
semantics (which color = gain, which = loss) follow the convention defined
in DESIGN.md and must not be changed regardless of international defaults.
Why: PRD §3.1 user profile explicitly lists "国内散户" as primary audience.
Misaligning color semantics directly impairs the core trading scan workflow.
Source of truth: PRD §3.1 + DESIGN.md §Key Color Logic

### Principle 4 · Information Density First
Following DESIGN.md's "Signal over Noise" principle, decorative UI elements
are prohibited. Data tables use compact row heights, cards use minimal padding.
Why: Target user runs the app for hours with hundreds of data points on screen.
Visual fatigue management is functional, not stylistic.
Source of truth: DESIGN.md §Brand & Style design principles

### Principle 5 · Bilingual Strategy
Both English and Chinese page variants are first-class. Neither is "primary"
in code, but Chinese pages in design-reference/ are the canonical visual layer
since the primary user base is Chinese-speaking.
Source of truth: design-reference/stitch-export/ contains both -en and -zh
variants for each page

### Principle 6 · Dark Mode Mandatory
Dark mode is the only supported theme. Light mode is not in scope.
Why: DESIGN.md explicitly states "mandatory Dark Mode palette to reduce eye
strain during long trading sessions" — this is a functional requirement, not
aesthetic preference.
Source of truth: DESIGN.md §Colors

### Open Questions
- Component library baseline: DESIGN.md mentions "shadcn/ui" in component
  guidance but does not state if this is a hard requirement or a reference
  point. Please confirm: are we locking shadcn/ui + Tailwind, or is the
  agent free to pick equivalent (Material UI / Ant Design)?
- Accessibility floor: target WCAG level not specified anywhere. Set a
  baseline (e.g., WCAG 2.1 AA) or explicitly opt out?
```

The agent then asked the user to answer the Open Questions before proceeding.

User answered: "shadcn/ui + Tailwind locked. WCAG AA baseline." Agent
incorporated answers into Principles 4 and added Principle 7 (accessibility).
Constitution finalized.

## Step 3 in action

The user ran the Step 3 prompt.

The agent scanned all 9 feature directories and produced:

| Feature dir | Has FE? | Needs re-run? | Matching page |
|------------|:------:|:-------------:|---------------|
| 001-data-ingestion | ❌ | No | (n/a, pure backend) |
| 002-storage-layer | ❌ | No | (n/a, pure backend) |
| 003-watchlist | ✅ | Yes | watchlist-zh |
| 004-stock-picker | ✅ | Yes | (uses home-zh main panel) |
| 005-anomaly-detector | ⚠️ partial | Yes (alert list UI) | alerts-zh |
| 006-daily-briefing | ⚠️ partial | Yes (briefing display UI) | briefs-zh |
| 007-dashboard-ui | ✅ | Yes | home-zh |
| 008-feishu-push | ❌ | No | (push channel adapter) |
| 009-settings | ✅ | Yes | settings-zh |

Net: 5 features need re-run, 4 don't. The user confirmed and the agent
proceeded to Step 4.

## Step 4 in action (one feature shown)

The user ran the Step 4 prompt for `003-watchlist` first.

The agent re-ran `/speckit.plan` for that feature. The original plan.md had a
"前端实现" section that said something like:

```
前端实现:
- 用 React 实现自选股列表
- 支持添加/删除/排序
- 实时显示价格涨跌
```

After re-run, the same section became:

```
前端实现 (按 DESIGN.md + design-reference/stitch-export/watchlist-zh/):

组件清单:
1. WatchlistTable     — 主表格组件
   - DESIGN.md §Data Tables (Core)
   - shadcn/ui: Table + custom DataTable wrapper
   - 视觉参考: design-reference/stitch-export/watchlist-zh/code.html
   - 行高 40px, sticky header, 30+ rows/screen

2. SparklineCell      — 表格内 K 线 cell
   - DESIGN.md §Data Tables → Sparklines
   - 用 ashare-up / ashare-down tokens 着色
   - 视觉参考: 同上, 表格第 7 列

3. PriceCell          — 价格 cell with display-price typography
   - DESIGN.md §Typography → display-price
   - JetBrains Mono 等宽确保对齐

4. StockTagBadge      — 股票代码标签
   - DESIGN.md §Components → Navigation & Status Badges
   - 12px 高度 small variant

5. AddWatchModal      — 添加自选股的弹层
   - DESIGN.md §Elevation → Level 2 Overlays
   - shadcn/ui: Dialog
   - 视觉参考: watchlist-zh code.html 第 240-310 行
```

The original backend section (API contracts, DB schema, data flow with mermaid)
was preserved verbatim. Only the frontend section was rewritten.

Similarly `/speckit.tasks` was re-run. The original 14 tasks became 18 tasks
with proper tags:

```
[BE] T01-T04 — API endpoints (preserved from original)
[FE] T05 — implement WatchlistTable component (DESIGN.md §Data Tables, ref: watchlist-zh)
[FE] T06 — implement SparklineCell (DESIGN.md §Sparklines, ref: watchlist-zh col 7)
[FE] T07 — implement PriceCell with display-price typo (DESIGN.md §Typography)
... etc
[INT] T17 — wire WatchlistTable to GET /api/watchlist
[INT] T18 — E2E test on Chrome desktop
```

The agent stopped after `003-watchlist` and asked the user to review before
proceeding to `004-stock-picker`. User reviewed, confirmed, agent continued.

## Total effort

- Step 1: ~5 minutes (file moves)
- Step 2: ~10 minutes (constitution write + Open Question round trip)
- Step 3: ~3 minutes (scan + table)
- Step 4: ~8 minutes per feature × 5 features = ~40 minutes

Grand total: ~60 minutes. Compared to re-running all 9 features fresh (which
would be ~6-8 hours including re-doing /specify and /clarify), this is a
6-8x improvement, with zero loss of business decisions captured in the
original spec/clarify.

## What to tell your students

The key insight to communicate: **constitution.md is the long-lived
contract, DESIGN.md is the current visual snapshot**. The reason this skill
exists is that Spec-Kit's natural flow assumes you have the design first, but
real projects often produce design after engineering. This skill bridges that
inversion cleanly.
