# Design Source Adapters

How to map different design artifact formats into the standard project structure
required by this skill.

The target structure is always:

```
<project-root>/
├── DESIGN.md
└── design-reference/
    └── <source>-export/
        └── <semantic-page-name>/
            └── (artifact files)
```

The variations below cover the four common source types.

---

## A. Google Stitch (https://stitch.withgoogle.com/)

### What you get from Stitch

When you click "下载项目" / "Download project", Stitch produces a folder like:

```
stitch_<project_name>/
├── prd.md                            (your original PRD, returned)
├── <design-system-name>/
│   └── DESIGN.md                     (the design system spec)
├── <app-shell-name>/
│   └── code.html                     (app shell HTML)
└── _1/ _2/ ... _N/                   (each page as numbered directory)
    ├── code.html                     (self-contained HTML page)
    └── screen.png                    (rendered preview)
```

### How to map it

1. `<design-system-name>/DESIGN.md` → `<project-root>/DESIGN.md`
2. `_1, _2, ..., _N/` → `<project-root>/design-reference/stitch-export/<semantic-name>/`
3. App shell directory → `<project-root>/design-reference/stitch-export/_app-shell/`
4. `prd.md` → **do not copy**; project already has `specs/prd.md`. If contents differ, surface as a question.

### How to figure out semantic names

Each `_N/code.html` has a `<title>` tag. Read it to determine the page identity.

Example mapping (A-share trading dashboard):
- `_1/` → title "AlphaTerminal - A-Share AI Watcher" → rename to `home-en`
- `_2/` → title "AlphaTerminal | Watchlist Management" → rename to `watchlist-en`
- `_6/` → title "AlphaTerminal - A股 AI 观察哨" → rename to `home-zh` (Chinese version)
- ...

When Stitch generates both English and Chinese versions, use `-en` / `-zh` suffixes.

### Stitch-specific quirk to clean up

Occasionally `_N/code.html` has a stray markdown fence (```html) at the top.
Note this in your handoff to the implement phase but don't strip it from the
reference sample — it's documentation of what Stitch produced.

---

## B. Figma export

### What you get from Figma

Depends on how it was exported:
- **`.fig` file** — Figma's native format, requires Figma to open
- **MCP-based** — via Figma MCP server, designs are read live, no local files
- **Manual export** — designer dumps PNGs + CSS/Tailwind specs + a written design system doc

### How to map it

**If you have a `.fig` file**:
1. Open in Figma, use "Specs" plugin or "Inspect" panel to extract design tokens
2. Have the user (or a designer) write `DESIGN.md` based on the inspect panel
3. Export each frame as PNG → `<project-root>/design-reference/figma-export/<frame-name>/screen.png`
4. The `.fig` file itself can live in `design-reference/figma-export/_source.fig` as the canonical source

**If you have Figma MCP available**:
1. Don't move artifacts locally — the MCP is the source
2. Still create a `DESIGN.md` at project root (user-authored, summarizing the design system)
3. In constitution Step 2, reference the MCP server name + file ID as the visual sample source

**If you have a manual export**:
1. The design system doc → `<project-root>/DESIGN.md` (normalize to Stitch-style frontmatter + sections if it isn't already)
2. PNG/asset exports → `<project-root>/design-reference/figma-export/<page-name>/`
3. If tokens are in a separate JSON (e.g., Figma Tokens / Style Dictionary export), put that in `<project-root>/tokens.json` and reference from DESIGN.md

### Naming pages

Use the Figma frame names directly, lowercased with hyphens.
Example: `Dashboard / Watchlist` → `dashboard-watchlist/`.

---

## C. Claude Design

### What you get from Claude Design

Claude Design's output is typically:
- Component-level React/Vue code (the "design output is code" philosophy)
- A bundled context that exports to Claude Code via MCP

### How to map it

1. **Treat the generated code as the visual reference**, not as production code
2. Code files → `<project-root>/design-reference/claude-design-export/<component-or-page>/`
3. Have the user (or yourself) extract design system rules from the code into `<project-root>/DESIGN.md`
   - Colors used (from tailwind classes or inline styles)
   - Typography (fonts, sizes, weights observed in components)
   - Spacing patterns (px values that repeat)
   - Component patterns (Card, Table, Modal etc.)
4. Important: this DESIGN.md is **inferred from code**, mark it as such at the top so future iterations know to update from code-of-record, not the other way around

### Why not use Claude Design's code directly as production?

Because it lacks: tests, error handling, edge cases, integration with backend, accessibility audit, project-specific lint/type rules. It's a faithful visual prototype, not deployment-ready code.

---

## D. Hand-written DESIGN.md

### What you might have

A designer or PM wrote a markdown file like `design-spec.md` or `style-guide.md` describing the visual system in plain text — no Figma, no Stitch, no AI tool.

### How to map it

1. Rename / copy to `<project-root>/DESIGN.md`
2. Make sure it has at minimum:
   - **Colors** section (with hex values, or named tokens with values)
   - **Typography** section (font families, sizes, weights, line heights)
   - **Layout & Spacing** section (grid, gutters, container widths)
   - **Components** section (description of key UI building blocks)
3. **No reference HTML/PNG samples?** That's OK — `design-reference/` is optional. Step 1's prerequisites stand: as long as DESIGN.md is concrete enough, we can proceed.
4. If the doc lacks tokens entirely and is all prose, surface this — implement phase will struggle. Suggest adding at least colors + spacing tokens.

### When to push back

If the hand-written doc says things like "use a modern, friendly aesthetic" without concrete values, the constitution principle "Single source of truth for visual specs" becomes meaningless. Ask the user to harden DESIGN.md with at least colors + typography + spacing tokens before proceeding to Step 2.

---

## E. Mixed sources

Real projects often have multiple sources, e.g.:
- A handwritten brand guideline doc (colors + logo)
- A Stitch-generated page layout
- Figma frames for a specific complex screen

### How to map it

1. **Merge into one canonical DESIGN.md** at project root. The merge order:
   - Brand-level (logo, colors, voice) from the hand-written doc
   - System-level (typography, spacing, components) from Stitch
   - Screen-level (specific complex layouts) referenced via design-reference/
2. **Keep each source's artifacts in separate subdirs** of `design-reference/`:
   ```
   design-reference/
   ├── stitch-export/
   ├── figma-export/
   └── brand-guidelines/
   ```
3. In constitution Step 2, the principle "How to reference visual prototype samples" should explicitly list which source covers which type of decision.

---

## Source-agnostic principles

Regardless of source, after Step 1 the project must satisfy:

1. There is **exactly one** `DESIGN.md` at project root
2. `design-reference/` contains visual samples grouped by source
3. Page directory names inside `design-reference/<source>-export/` are **semantic**, not numeric (`watchlist-zh`, not `_7`)
4. Original artifacts on Desktop (or wherever they came from) are **untouched** — we copied, didn't move

If any of these are violated, fix before proceeding to Step 2.
