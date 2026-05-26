---
name: speckit-design-injection
description: Inject a design system (Stitch DESIGN.md / Figma export / Claude Design output / hand-written DESIGN.md) into an existing GitHub Spec-Kit project WITHOUT re-running the whole spec/plan/tasks pipeline. Use this whenever the user has already completed Spec-Kit's specify/clarify/plan/tasks for one or more features AND now wants to add UI design guidance (DESIGN.md, Stitch zip, Figma exports, Claude Design output, HTML prototypes, design tokens) so that the frontend implementation matches a specific visual standard. Triggers include phrases like "我已经跑完 spec-kit 又拿到了设计", "DESIGN.md 怎么融入已有 spec", "Stitch 设计接入 spec-kit", "Figma 设计融入已有的 spec/plan", "Claude Design 怎么用到我已有的项目里", "想把视觉规范注入到 constitution", "不想推倒重跑 spec-kit 但要加入设计", "前端 UI 怎么和我已有的 spec 文档对接". Use this skill even if the user does not explicitly mention "Spec-Kit" — as long as they have spec.md / plan.md / tasks.md files and a separate design artifact, this skill applies. Do NOT use this skill for fresh projects that haven't run Spec-Kit yet (use Spec-Kit directly with DESIGN.md in repo root from the start).
---

# Spec-Kit Design Injection

A reusable workflow for merging a design system into a project that has **already** completed Spec-Kit's specify/clarify/plan/tasks pipeline — without throwing away the existing work.

## Why this skill exists

The natural Spec-Kit flow puts DESIGN.md in the project from day one, before `/speckit.plan` runs. But real projects often go the other way around:

1. You run Spec-Kit first (specify → clarify → plan → tasks) for several Must-have features
2. **Then** you produce a design system (via Google Stitch, Figma, Claude Design, or hand-writing DESIGN.md)
3. Now the existing plan/tasks don't reflect the new visual standard

Naive solutions are wrong:
- ❌ Throw away spec/clarify/plan/tasks and re-run everything → wastes hours of work, loses architecture decisions
- ❌ Manually edit every plan.md to mention DESIGN.md → error-prone, inconsistent across features
- ❌ Just tell the implement agent "also look at DESIGN.md" → no enforcement, AI drifts

The right answer is **Constitution Injection + Selective Re-run**, which this skill walks through.

## When NOT to use this skill

- **Fresh project, no Spec-Kit run yet** → put DESIGN.md in the repo root from the start, use Spec-Kit normally
- **No design artifact in hand** → this skill is about injection, not creation
- **Backend-only project** (no UI) → no design system to inject; not applicable
- **Design changes are tiny** (1-2 color tweaks) → just edit DESIGN.md, no constitution update needed

## Prerequisites (verify before starting)

Stop and ask the user if any of these are missing:

| Required | What to check |
|---------|--------------|
| Spec-Kit already initialized | `.specify/` directory exists at project root |
| At least one feature has plan + tasks | `specs/00X-*/plan.md` and `tasks.md` exist for ≥ 1 feature |
| Design artifact in hand | One of: DESIGN.md file / Stitch download zip / Figma export / Claude Design output / HTML prototypes |
| User can identify the project root | A concrete absolute path |

If anything is missing, ask the user to provide it before continuing. Do not guess.

## The 4-step workflow

```
Step 1 · Material placement       (put artifacts where Spec-Kit can find them)
Step 2 · Constitution injection   (abstract design rules → .specify/memory/constitution.md)
Step 3 · Impact identification    (scan specs/ → mark which features touch UI)
Step 4 · Selective re-run         (only re-run plan + tasks for UI-touching features)
```

**Critical**: spec.md and clarify-updated spec.md are **never** touched. Business requirements don't change just because we added a design system.

---

### Step 1 · Material placement

Goal: get the design artifacts into a predictable place in the project so subsequent steps can reliably reference them.

**Target structure** (regardless of where the design came from):

```
<project-root>/
├── DESIGN.md                              ← the design system "constitution"
├── design-reference/
│   └── <source>-export/                   ← e.g. stitch-export/, figma-export/, claude-design-export/
│       ├── <page-1>/
│       │   ├── code.html  (or .png, .jsx, etc.)
│       │   └── screen.png
│       └── ...
└── .specify/
    └── memory/
        └── constitution.md                ← will be updated in Step 2
```

**Source adapter logic** — the actual move differs by source. Read `references/design-source-adapters.md` for the exact mapping rules for each source type (Stitch / Figma / Claude Design / hand-written / other).

**Naming rule for pages in `design-reference/`**: rename to semantic names that match the feature naming in specs/. Example: Stitch's `_7` → `watchlist-zh` (matches `specs/002-watchlist/`). This makes Step 4's "which page goes with which feature" mapping mechanical.

**Pre-flight check before placement**:
- If `DESIGN.md` already exists in project root → ask user before overwriting
- If `design-reference/` already exists → ask user before merging
- If `prd.md` is duplicated in the design artifact → don't copy it (project already has its own); flag any content mismatches

**Always use `cp -r`**, never `mv`. Keep the original artifact intact as backup.

---

### Step 2 · Constitution injection

Goal: encode the design system as **abstract, unchanging rules** in `.specify/memory/constitution.md`, so every future `/speckit.plan` and `/speckit.tasks` run automatically inherits them.

**The cardinal rule**: constitution holds **direction**, DESIGN.md holds **values**.

```
✅ Constitution writes:  "Visual specs come exclusively from root DESIGN.md.
                         All colors/fonts/spacing must use its tokens."
❌ Constitution does NOT write:  "Primary color is #adc6ff" or "Use ashare-up token for gains"
```

Why? Because constitution is supposed to be persistent across design iterations. Hex values and token names will change when designs evolve. If you bake them into constitution, the constitution becomes a snapshot rather than a contract.

**Trigger prompt template** (give this to the user to run, OR run it yourself if you have `/speckit.constitution` access):

```
/speckit.constitution

Materials in this project that you must read first:
- DESIGN.md at project root
- specs/prd.md (business context)
- design-reference/<source>-export/ — pick 2-3 representative pages to understand visual style

Your job: append a "Frontend Design System" section to .specify/memory/constitution.md.

Each principle in this section must be ABSTRACT direction, never concrete values.

Write each principle as:
  Principle name → Why it's non-negotiable → Which file is the source of truth

Required principle directions (extract specific content from the materials above):
1. Single source of truth for visual specs (which file says what is final)
2. How to reference visual prototype samples (when to read design-reference/)
3. Target market / user conventions that cannot be compromised
   (extract from prd.md; do NOT assume — if prd.md doesn't say, leave a Open Question)
4. Component library baseline (infer from DESIGN.md; if unclear, Open Question)
5. Information density / design philosophy (from DESIGN.md design principles)
6. Multi-language strategy (only if design-reference shows multiple languages)
7. Theme mode (dark/light) — write what DESIGN.md says, no more

Hard constraints:
- Do NOT copy hex values, token names, component names, or font names into constitution
- Do NOT make decisions for me — if a direction is unclear from the materials,
  list it under an "Open Questions" subsection at the end and wait for my answer
- After writing, tell me: (a) which file(s) you changed, (b) which paragraphs of
  the materials each principle traces back to
```

**Common failure mode**: the AI dumps DESIGN.md's tokens into constitution. If you see hex values or token names in the proposed constitution text, reject it and ask the AI to rewrite at the abstract level.

---

### Step 3 · Impact identification

Goal: figure out which existing features need their plan/tasks updated (those that touch UI), versus which are pure backend (don't touch).

**Don't re-run everything blindly**. Re-running pure backend features wastes time and risks regressing already-good plans.

**Trigger prompt template**:

```
Scan all feature directories under specs/. For each feature, classify whether its
plan.md or tasks.md involves frontend UI (React/Vue components, pages, forms,
tables, charts, etc.) versus pure backend/algorithm work.

Output table:
| Feature dir | Has FE? | Needs re-run? | Best matching page in design-reference/ |

Re-run criteria:
- Has FE = true → needs re-run of /plan + /tasks
- Has FE = false → no action

Then WAIT for me to confirm the re-run list. Do not start re-running yet.
```

**Page-to-feature matching**: if `design-reference/` was named semantically in Step 1, the matching is usually 1:1. If a feature has no matching page in `design-reference/`, surface that as a gap — the user may need to generate that page or accept that the AI will design it from scratch.

---

### Step 4 · Selective re-run

Goal: re-run `/speckit.plan` and `/speckit.tasks` for UI-touching features only. Skip `/specify` and `/clarify` — business requirements are unchanged.

**Trigger prompt template** (one feature at a time; loop for each):

```
For specs/<NNN>-<feature-name>/, re-run plan + tasks ONLY.
Do NOT touch spec.md or any clarify outputs — business requirements are unchanged.

/speckit.plan
- Read root DESIGN.md and design-reference/<source>-export/<matched-page>/ first
- In plan.md, add a "Frontend section" listing:
  (a) Which components are used (refer to DESIGN.md §Components)
  (b) Which DESIGN.md section each component maps to
  (c) The visual reference sample path
- Preserve ALL existing backend / data flow / integration / dependency content unchanged

/speckit.tasks
- Tag each task: [FE] / [BE] / [INT]
- [FE] tasks must cite:
  (a) The DESIGN.md section being implemented
  (b) The reference HTML/sample path
  (c) The shadcn (or equivalent) component being used
- [BE] tasks: preserve original
- Re-evaluate parallel groups — usually [FE] and [BE] of the same feature can run in parallel

After completing this feature, STOP and let me review before moving to the next.
```

**Iteration pacing rule**: one feature at a time. Re-running 5 features in a single shot makes review impossible and bugs cascade.

---

## Anti-patterns to avoid

| Anti-pattern | Why it's wrong | Right approach |
|--------------|---------------|----------------|
| Copy hex values into constitution | Constitution becomes a snapshot, not a contract | Constitution references DESIGN.md as source of truth |
| Re-run /specify after adding design | Wastes work, business hasn't changed | Only re-run /plan + /tasks |
| Re-run all features including backend-only | Wastes time, risks regression | Identify UI-touching features first |
| Let AI guess at unclear directions | Replaces user judgment, creates drift | Surface as Open Questions, wait for user |
| Inject DESIGN.md content directly into each plan.md | Inconsistent across features | Use constitution as single enforcement point |
| Skip Step 2, jump straight to re-run | Each plan.md remembers DESIGN.md differently | Constitution ensures uniform reference |

## What success looks like

After running this skill:

1. `DESIGN.md` lives at project root, referenced by all future Spec-Kit runs
2. `design-reference/<source>-export/` has semantically-named pages
3. `.specify/memory/constitution.md` has a Frontend Design System section with **abstract** principles (no hex values)
4. UI-touching features have updated plan.md (with frontend section referencing DESIGN.md) and tasks.md (with [FE]/[BE]/[INT] tags)
5. Backend-only features are untouched
6. `/speckit.implement` (the next phase) can produce code that visually matches the design system

## Reference files

- `references/design-source-adapters.md` — how to map Stitch / Figma / Claude Design / hand-written outputs into the standard project structure (Step 1 details)
- `references/prompts.md` — full ready-to-copy prompts for all 4 steps in both English and Chinese
- `references/examples.md` — a complete walkthrough using a real Stitch-generated A-share trading dashboard project as the case study

Read these when you need source-specific guidance or want to show the user a worked example.

## A note on user communication

This skill is used by people who have **already invested significant effort** in Spec-Kit. Their fear when bringing in a new design is "do I have to redo everything?" Your first message to them should immediately address that fear:

> "No, you don't need to redo your spec/clarify work. We only update the frontend-touching plan/tasks, and we use Spec-Kit's constitution mechanism to enforce the design system project-wide. Total effort: usually 30-60 minutes regardless of how many features you have."

Then proceed through the 4 steps interactively, pausing at each step for confirmation.
