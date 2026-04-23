---

description: "Tasks — Figma Color Token Sync (006-figma-sync)"
---

# Tasks: Figma Color Token Sync

**Input**: Design documents from `specs/006-figma-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/figma-rest.md, quickstart.md

**Tests**: Not requested; no test tasks generated. Acceptance is manual per SC-003 (idempotent re-run) and SC-005 (`pnpm build` pass).

**Organization**: Single user story (P1) — the whole feature is one end-to-end slice. Phase structure is kept for template compatibility.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency chain)
- **[Story]**: [US1] for the sole P1 story; Setup/Foundational/Polish have no story label

## Path Conventions

Single Next.js 15 App Router project. Script at `src/scripts/figma-sync.ts`. CSS at `src/app/globals.css`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minimal prep. Script is a single file — no dedicated `src/scripts/` directory yet.

- [X] T001 Create directory `src/scripts/` at repo root (no file yet; just the folder)
- [X] T002 Verify `FIGMA_TOKEN` availability — check either `process.env.FIGMA_TOKEN` in current shell OR presence of `FIGMA_TOKEN=` line in `.env.local` (do NOT print the token value)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify environment can even run the script.

- [X] T003 Confirm Node ≥ 20 is active (`node -v`); `pnpm dlx tsx --version` works end-to-end without adding to `devDependencies`

**Checkpoint**: Environment green — US1 work can begin.

---

## Phase 3: User Story 1 — One-shot color drift audit (Priority: P1) 🎯 MVP

**Goal**: Ship `src/scripts/figma-sync.ts` that reads the 6 Figma Color Styles, compares them to the 6 `--color-*` tokens in `src/app/globals.css`, prints a drift report, and rewrites MUST-FIX tokens in place.

**Independent Test**: `FIGMA_TOKEN=... pnpm dlx tsx src/scripts/figma-sync.ts` from repo root. Expect: 6-row report printed, exit code 0 or 2, `src/app/globals.css` either unchanged (0) or edited only on the affected `--color-*` lines (2). Re-running immediately after a rewrite exits 0 with no further edits (idempotent).

### Implementation for User Story 1

- [X] T004 [US1] Create `src/scripts/figma-sync.ts` shell: imports (none beyond Node built-ins), `#!/usr/bin/env node` is NOT needed (invoked via `tsx`), top-level `async function main()` with `try/catch` → `process.exit` codes per research R-08
- [X] T005 [US1] In `src/scripts/figma-sync.ts`: add the 6-entry `TARGET_STYLES` constant mapping Figma name → CSS token name (exact pairs per data-model.md §TargetToken)
- [X] T006 [US1] In `src/scripts/figma-sync.ts`: add `FIGMA_TOKEN` env check at top of `main()` — if missing, `console.error` the quickstart troubleshooting line and `process.exit(1)` before any `fetch`
- [X] T007 [US1] In `src/scripts/figma-sync.ts`: implement `fetchStyles(fileKey)` calling `GET /v1/files/:key/styles` with `X-Figma-Token` header (native `fetch`), filter `style_type === "FILL"`, assert each of 6 target names appears exactly once, return `Map<cssToken, node_id>`. HTTP error handling per contracts/figma-rest.md (retry once on 429/5xx)
- [X] T008 [US1] In `src/scripts/figma-sync.ts`: implement `fetchNodes(fileKey, nodeIds)` calling `GET /v1/files/:key/nodes?ids=...`, for each node extract `document.fills[0]`, require `type === "SOLID"`, convert `color.r|g|b` to 0–255 ints + hex, return `Map<cssToken, { hex, opacityWarn: boolean }>`
- [X] T009 [P] [US1] In `src/scripts/figma-sync.ts`: implement pure helpers — `hexToRgb`, `rgbToHsl`, `hslToRgb`, `rgbToHex`, `driftPercent` (all per research R-03, R-04). No dependencies, integer-rounded outputs
- [X] T010 [P] [US1] In `src/scripts/figma-sync.ts`: implement `parseGlobalsCss(path)` → reads file, for each of 6 target CSS tokens finds the matching `/(^\s*--color-<name>:\s*)hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)(;)/m` regex, returns `Map<cssToken, { h, s, l }>` + the raw file string for later rewrite; missing token → error + exit 1
- [X] T011 [US1] In `src/scripts/figma-sync.ts`: implement `buildDriftRows(figmaMap, cssMap)` → produces 6 `DriftRow` objects with band classification per spec FR-005 (<1 OK, 1–3 WARN, >3 MUST_FIX)
- [X] T012 [US1] In `src/scripts/figma-sync.ts`: implement `renderReport(rows)` — fixed-width table (token, figmaHex, cssHex, drift%, band) to stdout, followed by a one-line summary (`N MUST-FIX, M WARN, K OK`)
- [X] T013 [US1] In `src/scripts/figma-sync.ts`: implement `rewriteGlobalsCss(path, fileStr, mustFixRows)` — for each MUST-FIX row, compute target `hsl(H S% L%)` from Figma hex via `hexToRgb → rgbToHsl`, run anchored `String.prototype.replace` (per research R-05) on the in-memory string, write the final string back to the file ONLY if at least one substitution succeeded; `fs.writeFileSync` atomic via write-to-tmp + rename IS NOT needed here — a single in-place write is acceptable for a developer-local script
- [X] T014 [US1] In `src/scripts/figma-sync.ts`: wire `main()` — check env → fetchStyles → fetchNodes → parseGlobalsCss → buildDriftRows → renderReport → if any MUST_FIX: rewriteGlobalsCss + `console.log` the "Rewrote: ..." lines + `process.exit(2)`; else `process.exit(0)`
- [X] T015 [US1] Run the script end-to-end from repo root: `pnpm dlx tsx src/scripts/figma-sync.ts`. Capture stdout; save first run's raw drift report into a scratch note (for the final human report to the operator)
- [X] T016 [US1] If T015 produced exit 2 (any MUST_FIX): `git diff -- src/app/globals.css` to confirm ONLY the affected `--color-*` lines changed; verify `@layer base` and non-color `@theme` entries are untouched
- [X] T017 [US1] Re-run `pnpm dlx tsx src/scripts/figma-sync.ts` a second time to assert idempotence: exit 0 and zero new edits (SC-003)
- [X] T018 [US1] Run `pnpm build` and capture the tail of the output; zero new TS/CSS errors expected (SC-005)

**Checkpoint**: US1 is fully functional and testable as the full feature MVP.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Guard the hard-discipline invariants before sign-off.

- [X] T019 [P] Verify `package.json` was not modified (no new dep snuck into `dependencies` or `devDependencies`)
- [X] T020 [P] Verify `src/app/globals.css` diff is bounded to lines `--color-bg-base` / `--color-fg-default` / `--color-primary-default` / `--color-status-success` / `--color-status-warning` / `--color-status-error` (comments + other `@theme` + `@layer base` untouched)
- [X] T021 Verify git branch is still `evolution` (`git branch --show-current`)
- [X] T022 Produce the ≤800-word operator report: six-step artifact paths + line counts, MCP-call log (calls + args + data summaries), drift report original text, globals.css diff snippet, pnpm build result, pitfalls + fixes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no deps — T001 + T002 parallelizable.
- **Foundational (Phase 2)**: after Phase 1.
- **User Story 1 (Phase 3)**: after Phase 2. Internal chain: T004 → T005/T006 → T007 → T008 → T009/T010 (parallel, pure helpers + parser) → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018.
- **Polish (Phase 4)**: after Phase 3.

### Within User Story 1

- T009 (color math helpers) and T010 (CSS parser) touch the SAME file (`figma-sync.ts`) but different logical regions; they are [P]-safe only in the sense of "can be authored in parallel by different minds" — in a single-agent run, do them sequentially. The [P] label is retained for template fidelity.
- All other US1 tasks are strictly sequential (they build the same file top-down + run commands that depend on the previous step).

### Parallel Opportunities

- T001 ∥ T002 (unrelated checks).
- T019 ∥ T020 (independent verifications).

---

## Parallel Example: User Story 1

```bash
# No genuine cross-file parallelism — this feature lives in one new file.
# If splitting by concern, helpers vs parser:
Task: "Add color-math helpers (hexToRgb/rgbToHsl/hslToRgb/rgbToHex/driftPercent) to src/scripts/figma-sync.ts"
Task: "Add parseGlobalsCss(path) to src/scripts/figma-sync.ts"
```

---

## Implementation Strategy

### MVP = full feature

Phases 1 → 2 → 3 produce the MVP. There is no deferrable second increment in this feature.

### Sequencing

1. T001–T003 (setup + env).
2. T004 → T014 top-down build of `figma-sync.ts`.
3. T015–T018 run, verify diff, re-run for idempotence, `pnpm build`.
4. T019–T022 polish + report.

---

## Notes

- [P] tasks = different files OR non-overlapping regions of the single script file.
- Every US1 implementation task names the exact file path (`src/scripts/figma-sync.ts` or `src/app/globals.css`).
- No test files are generated; acceptance is via quickstart.md manual run + idempotence + `pnpm build`.
- Hard-discipline invariants (guard in Polish phase): no new npm dep, edits bounded to 6 `--color-*` lines + the new script file, stay on `evolution` branch.
