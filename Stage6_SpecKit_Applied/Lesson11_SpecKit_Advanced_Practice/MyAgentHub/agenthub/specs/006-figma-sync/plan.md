# Implementation Plan: Figma Color Token Sync

**Branch**: `evolution` (no feature branch cut) | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/006-figma-sync/spec.md`

## Summary

Build a single-file Node/TypeScript CLI (`src/scripts/figma-sync.ts`) that reads the 6 canonical Color Styles from Figma file `96ECPnljhnFrOMesWfd3d2`, compares them to the 6 matching `--color-*` tokens in `src/app/globals.css`, prints a drift report (bands: <1% OK / 1–3% WARN / >3% MUST-FIX), and rewrites the MUST-FIX token values in place. Figma is the source of truth; write-back to Figma is explicitly out of scope. No new npm dependency is added — `tsx` is pulled transiently via `pnpm dlx`. The Figma MCP tool is used once during planning to verify connectivity and read real values; the script itself uses Node's native `fetch` against Figma REST so it stays a self-contained process.

## Technical Context

**Language/Version**: TypeScript (`tsx` transient runner via `pnpm dlx tsx`), Node.js ≥ 20 (native `fetch`)
**Primary Dependencies**: Figma REST `GET /v1/files/:key/styles` + `GET /v1/files/:key/nodes?ids=...`; no new runtime deps
**Storage**: Filesystem only — reads `src/app/globals.css`, writes the same file in place
**Testing**: Manual acceptance — verify drift report + idempotent re-run + `pnpm build` pass. No unit-test framework added (script is ≈200 LOC, covered by acceptance scenarios in spec.md).
**Target Platform**: Local developer machine (macOS/Linux), ad-hoc invocation
**Project Type**: Single-repo CLI script inside a Next.js 15 App Router project
**Performance Goals**: <10s end-to-end on warm network (spec SC-001)
**Constraints**: No new npm dep; only touches `src/scripts/figma-sync.ts` (new) and the 6 `--color-*` lines in `src/app/globals.css`; never touches `@layer base`, never touches other `@theme` sections (typography/spacing/radius/font)
**Scale/Scope**: Fixed 6 tokens; single Figma file; operator-triggered (no CI in this iteration)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitution clause | Status | Evidence |
|---|---|---|
| 第一法衣 · Spec First | PASS | `specs/006-figma-sync/spec.md` exists with User Story, Acceptance Scenarios, Requirements, Success Criteria |
| 第一法衣 · Plan Before Implement | PASS | This plan.md is being written before any script code |
| 第一法衣 · Quality Gate (clarify + checklist) | PASS | `/speckit-clarify` ran (1 Q auto-answered on drift metric); `/speckit-checklist` scheduled as final step |
| 第二法衣 · 颜色走 @theme 变量，禁 hardcoded hex | PASS — reinforced | Feature's entire purpose is to keep `@theme` colors in lock-step with Figma; no hex is emitted into component code |
| 第二法衣 · 间距 / 交互态 / 图标 | N/A | Feature does not touch UI components |
| 第三法衣 · Variables 化 & 语义命名 | PASS | 6 target Figma styles already use semantic names (`bg/base`, `fg/default`, `primary/default`, `status/success|warning|error`); no value-semantic names |
| 第三法衣 · Figma↔代码双向同步 | **This feature IS the enforcement** | Script closes the drift gap that the 3rd law衣 requires |
| 基础约束 · Zod 可校验 | PASS | Figma REST response shape is validated via runtime type-guards in script; no network I/O without shape check |
| 基础约束 · 服务端/客户端边界 | N/A | Script is a build-time CLI, not a Next.js route |
| 基础约束 · Edge Runtime for streaming | N/A | No streaming |

**Verdict**: **All gates PASS**. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/006-figma-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── figma-rest.md    # Figma REST endpoints + response shape we depend on
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── globals.css                   # EDITED in place — only the 6 --color-* lines
└── scripts/
    └── figma-sync.ts                 # NEW — single-file CLI (added this feature)
```

**Structure Decision**: Single-project layout (Next.js 15 App Router). The sync CLI lives under `src/scripts/` (new folder) so it is colocated with the codebase it edits and so imports from the repo (if any were ever needed) resolve naturally. No `tests/` directory is added — acceptance is manual per spec SC-003 (idempotence) and SC-005 (`pnpm build` pass).

## Complexity Tracking

No constitution violations; table omitted.
