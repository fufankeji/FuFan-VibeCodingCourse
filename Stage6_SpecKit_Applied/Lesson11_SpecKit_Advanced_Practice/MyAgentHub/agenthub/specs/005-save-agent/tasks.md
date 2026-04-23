---
description: "Task list for feature 005-save-agent"
---

# Tasks: Save Agent to My Agents (localStorage)

**Input**: Design documents from `/specs/005-save-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/use-my-agents.contract.md, quickstart.md

**Tests**: Not requested. The verification surface is TypeScript strict compile + a 5-step manual quickstart. No unit/integration test tasks are generated.

**Organization**: The two user stories (US1: add, US2: remove) share all implementation code; splitting them into separate phases would duplicate every task. They are therefore bundled as `[US1+US2]` under a single implementation phase. MVP = everything through T005 (US1 alone is impossible without the toggle-off path from US2 once the hook exists — removing it costs nothing to keep).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no cross-task deps).
- **[Story]**: `[US1+US2]` for the two bundled user stories; no label for setup/polish.

## Path Conventions

Single project, Next.js 15 App Router. Paths are absolute from repo root `/Users/muyu/MuYuCourseSpace/MyAgentHub/agenthub/`.

---

## Phase 1: Setup

*No setup tasks — no new dependencies, no new directories beyond what T001 creates, no scaffolding.*

## Phase 2: Foundational (blocks all user stories)

- [X] **T001** Create the Zod schema module at `src/lib/schemas/my-agents.ts` exporting `MY_AGENTS_KEY = 'agenthub:myAgents'`, `MAX_SAVED_AGENTS = 100`, `myAgentsSchema = z.array(z.string().min(1).max(64)).max(MAX_SAVED_AGENTS)`, and `type MyAgentIds = z.infer<typeof myAgentsSchema>`. Import `z` from `'zod'`.
  - **Acceptance check**: `pnpm exec tsc --noEmit` exits 0. File has no imports other than `zod`. `grep -c "^export" src/lib/schemas/my-agents.ts` ≥ 4 (two consts, one schema, one type).

## Phase 3: Implementation of US1 (Add) + US2 (Remove) — bundled

**Story goal**: Clicking the Button at `src/app/agent/[id]/page.tsx:166` toggles `agent.id` in `localStorage['agenthub:myAgents']`, the label reflects the current state after hydration, and the state persists across reloads.

**Independent test**: Run `quickstart.md` steps 1–5 end-to-end against `pnpm dev`.

- [X] **T002** [US1+US2] Create the client hook at `src/lib/hooks/use-my-agents.ts`. First line MUST be `"use client";`. Import `useCallback, useEffect, useState` from `'react'`, and `MY_AGENTS_KEY, MAX_SAVED_AGENTS, myAgentsSchema` from `'@/lib/schemas/my-agents'`. Export `useMyAgents(): { ids: readonly string[]; has: (id: string) => boolean; toggle: (id: string) => void; isHydrated: boolean }`. Implement mount-before-read per plan.md § Files to CREATE (2): empty initial state, single-run `useEffect` with `typeof window === 'undefined'` guard + try/catch around `JSON.parse` + `safeParse`, `setIsHydrated(true)` always at effect end. `toggle` uses functional `setIds`; computes next array inside the updater (remove-if-present / append-if-absent-and-<100 / no-op-if-at-cap); wraps `localStorage.setItem` in try/catch and returns `prev` on throw. `has` is a `useCallback` over `ids.includes(id)`.
  - **Acceptance check**: `pnpm exec tsc --noEmit` exits 0. `grep -n 'typeof window' src/lib/hooks/use-my-agents.ts` returns at least one hit. `grep -n 'safeParse' src/lib/hooks/use-my-agents.ts` returns at least one hit. `head -1 src/lib/hooks/use-my-agents.ts` equals `"use client";`.

- [X] **T003** [US1+US2] Modify `src/app/agent/[id]/page.tsx` — **three small edits only**: (a) extend the existing `lucide-react` import (line ~6–16) to also import `Check`; (b) add a new import line `import { useMyAgents } from "@/lib/hooks/use-my-agents";` grouped with the other `@/lib/...` imports; (c) inside the component function body, add `const { has, toggle, isHydrated } = useMyAgents();` next to the existing hook calls; (d) replace the Button at line 166 with the version from plan.md § Files to MODIFY (1) — adds `onClick={() => toggle(agent.id)}`, swaps label/icon conditionally on `isHydrated && has(agent.id)`. **No other JSX, state, imports, or handlers in this file may change.**
  - **Acceptance check**: `pnpm exec tsc --noEmit` exits 0. `git diff src/app/agent/\[id\]/page.tsx` shows hunks touching only: the `lucide-react` import line, the new `useMyAgents` import line, one new line for `const { has, toggle, isHydrated } = useMyAgents();`, and the Button JSX block (approx lines 165–169 in the original). No other hunks. Line count added ≤ 12.

## Phase 4: Polish & verification

- [X] **T004** Run the production build: `pnpm build`.
  - **Acceptance check**: Build exits 0 with no TypeScript errors, no ESLint errors that are new to this feature, and no warnings about hydration mismatch from the `/agent/[id]` route. If Next.js emits any `Warning: Text content did not match` during `pnpm build`'s prerender pass, the task is FAILED — revisit the `isHydrated` gate in the Button.

- [ ] **T005** Manual smoke test per `specs/005-save-agent/quickstart.md` steps 1–5 against `pnpm dev`. Exercise: default render, add, reload, toggle off, multi-agent add, tamper-resistance.
  - **Acceptance check**: All 5 steps pass as described. DevTools → Local Storage shows `agenthub:myAgents` round-trips correctly. Browser console is clean (no hydration warnings, no uncaught exceptions).

- [X] **T006** Final blast-radius audit: from repo root run `git diff --stat` and `git status --short` (both must be run — the first for modified files, the second to catch untracked ones) and confirm **exactly three paths** are reported between them: `src/lib/schemas/my-agents.ts` (new), `src/lib/hooks/use-my-agents.ts` (new), `src/app/agent/[id]/page.tsx` (modified). Documents added under `specs/005-save-agent/**` are the Spec-Kit artifacts and expected; they are NOT part of the "three files" budget but MUST appear as untracked-or-modified under `specs/005-save-agent/`.
  - **Acceptance check**: `git status --short | grep -v '^\?\? specs/005-save-agent' | grep -v '^ M specs/005-save-agent' | grep -v '^A  specs/005-save-agent' | grep -v '^\?\? \.specify/feature\.json' | grep -v '^ M \.specify/feature\.json' | awk '{print $2}' | sort` prints exactly:
    ```
    src/app/agent/[id]/page.tsx
    src/lib/hooks/use-my-agents.ts
    src/lib/schemas/my-agents.ts
    ```
    No file under `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/gallery/**`, `src/app/run-history/**`, `src/app/settings/**`, `src/app/api/**`, `src/components/**`, `src/lib/mock-data.ts`, `src/lib/schemas/agent-output.ts`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `tailwind.config.*`, or `.styleseed/**` may appear. If any does, T006 fails and the offending diff must be reverted before the feature is considered done.

---

## Dependency graph

```text
T001 (schema)
  └─► T002 (hook)  ────────┐
                           ▼
                     T003 (page Button)
                           │
                           ▼
                     T004 (pnpm build)
                           │
                           ▼
                     T005 (quickstart manual)
                           │
                           ▼
                     T006 (blast-radius audit)
```

Strictly linear after T001. No parallel opportunities because each task's acceptance check depends on the prior task's output (the hook imports the schema; the page imports the hook; the build consumes the page; quickstart consumes the build; the audit consumes the full working tree).

## Parallel execution examples

None. Tasks are intentionally linear — this matches the user's request ("5–7 个线性任务") and reduces blast-radius review to a single diff at the end.

## Implementation strategy

- **MVP**: complete through T005. This ships both US1 (add) and US2 (remove) since they share the `toggle` code path.
- **Ship gate**: T006 must pass. Any regression in blast radius is a hard block.
- **Rollback**: a single `git restore` of the three touched paths fully reverts the feature (no migrations, no env changes, no DB state).

## Task count

- Setup: 0
- Foundational: 1 (T001)
- US1+US2 implementation: 2 (T002, T003)
- Polish & verification: 3 (T004, T005, T006)
- **Total: 6 tasks**
