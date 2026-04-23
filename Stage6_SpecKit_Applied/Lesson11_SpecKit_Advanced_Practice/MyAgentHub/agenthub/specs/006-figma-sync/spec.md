# Feature Specification: Figma Color Token Sync

**Feature Branch**: `evolution` (no branch cut — piggybacks on current evolution branch per project discipline)
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "从 Figma fileKey=96ECPnljhnFrOMesWfd3d2 用 MCP 工具读取 6 个 Color Styles (bg/base, fg/default, primary/default, status/success, status/warning, status/error)，对比当前 src/app/globals.css @theme 里 6 个 --color-* token 的 HSL 值（需转成 hex 对比），生成 drift 报告。Source of truth 是 Figma，drift >3% 的必须改 globals.css 把 @theme token 同步为 Figma hex 转 HSL 的结果。"

## Clarifications

### Session 2026-04-20

- Q: Which drift metric should classify tokens into the OK / WARN / MUST-FIX bands? → A: Normalized Euclidean RGB distance — `sqrt((Δr)² + (Δg)² + (Δb)²) / sqrt(3·255²) × 100%`. Chosen over CIEDE2000 to avoid pulling in a color-science dependency (violates no-new-deps constraint).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-shot color drift audit (Priority: P1)

A designer updates the 6 canonical Color Styles in the Figma design file (fileKey `96ECPnljhnFrOMesWfd3d2`). The developer runs a single local script that reads those 6 styles straight from Figma, compares them to the 6 equivalent `--color-*` tokens in `src/app/globals.css` `@theme`, and prints a drift report naming which tokens are in-spec, warn-level, or must-fix. When drift is flagged as must-fix, the script updates the 6 token declarations in `globals.css` so that the codebase matches Figma.

**Why this priority**: Without an automated check, Figma and code drift silently and visual bugs surface only in review. This single P1 story delivers the full closed loop (read → compare → report → apply) and is the entire MVP.

**Independent Test**: Run the sync script against the real Figma file and the committed `globals.css`; verify a textual drift report is printed, exit code reflects drift severity, and `globals.css` either stays untouched (no must-fix drift) or is edited to match Figma hex-to-HSL values (must-fix drift present). `pnpm build` must still succeed after any edit.

**Acceptance Scenarios**:

1. **Given** `globals.css` already matches all 6 Figma styles within 1% ΔE, **When** the script runs, **Then** all 6 rows are reported as "OK (ignore)" and `globals.css` is not modified.
2. **Given** one token in `globals.css` differs from Figma by >3%, **When** the script runs, **Then** the report marks that row as "MUST FIX", and `globals.css` is rewritten so that token's HSL triplet equals the Figma color converted to HSL.
3. **Given** one token differs by 1–3%, **When** the script runs, **Then** the report marks the row as "WARN" and `globals.css` is left untouched.
4. **Given** Figma returns a style name not in the allowlist of 6, **When** the script runs, **Then** that extra style is ignored and only the 6 target tokens are compared.

### Edge Cases

- Figma file is reachable but one of the 6 named Color Styles is missing or renamed → script fails loudly and names the missing style; no partial rewrite of `globals.css`.
- Figma style uses alpha < 1 → script treats alpha as 1 and records a warning (out-of-scope color channel).
- Figma style is a gradient or non-solid paint → script fails with a descriptive error; `globals.css` untouched.
- `FIGMA_TOKEN` env var missing → script prints a pointer to `.env.local` and exits non-zero without network I/O.
- `globals.css` has been refactored so a target `--color-*` token is missing → script reports the token as "MISSING in globals.css" and does not attempt to insert a new line.
- HSL round-trip: Figma hex → HSL may produce non-integer H/S/L. Script rounds to nearest integer for writing; drift is always computed on the hex-space ΔE so rounding bias is bounded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sync script MUST read the 6 target Figma Color Styles — `bg/base`, `fg/default`, `primary/default`, `status/success`, `status/warning`, `status/error` — from the Figma file with key `96ECPnljhnFrOMesWfd3d2`.
- **FR-002**: The sync script MUST extract each Color Style's first solid RGBA paint and convert it to a 6-digit hex representation.
- **FR-003**: The sync script MUST read the current 6 `--color-*` token declarations in `src/app/globals.css` (`--color-bg-base`, `--color-fg-default`, `--color-primary-default`, `--color-status-success`, `--color-status-warning`, `--color-status-error`) and parse each `hsl(H S% L%)` value into an equivalent hex representation for comparison.
- **FR-004**: The sync script MUST compute a per-token drift percentage using **normalized Euclidean RGB distance** — `sqrt((Δr)² + (Δg)² + (Δb)²) / sqrt(3·255²) × 100%` — reported as a 0–100 percentage (decided in Clarifications 2026-04-20).
- **FR-005**: The sync script MUST classify each token into one of three bands based on drift %: <1% → OK (ignore), 1–3% → WARN (report only), >3% → MUST FIX.
- **FR-006**: The sync script MUST print a human-readable drift report listing each of the 6 tokens with: Figma hex, globals.css hex (derived from HSL), drift %, and band.
- **FR-007**: For MUST-FIX rows, the script MUST edit `src/app/globals.css` in place, replacing only the value expression of the affected `--color-*` token with the Figma hex color converted into `hsl(H S% L%)` format, preserving surrounding whitespace, comments, and token order.
- **FR-008**: The sync script MUST NOT modify any line inside the `@layer base { ... }` block or any non-color entries in `@theme` (typography, spacing, radius, font).
- **FR-009**: The sync script MUST exit with a non-zero status code when any drift falls into MUST FIX or when any target style is missing; otherwise exit 0.
- **FR-010**: The sync workflow MUST stay within the existing `evolution` branch; no new git branch is cut for this feature.
- **FR-011**: The sync script MUST NOT add any runtime or dev dependencies to `package.json`; it is executed via `pnpm dlx tsx src/scripts/figma-sync.ts`.
- **FR-012**: During planning/validation, the operator MUST use the Figma MCP tool `mcp__figma__get_figma_data` to read the file; the script itself MUST use Node's native `fetch` against the Figma REST API (keeping the script a self-contained process with no MCP dependency).
- **FR-013**: The sync script MUST authenticate to Figma using a `FIGMA_TOKEN` environment variable and MUST NOT log the token.

### Key Entities

- **FigmaColorStyle**: A Figma Color Style referenced by name (e.g., `bg/base`). Has a single solid paint with channels r/g/b each in [0,1]. Identified by Figma `styleId` and `name`.
- **ThemeToken**: A CSS custom property line in `src/app/globals.css` inside `@theme`, of the form `--color-<group>-<slot>: hsl(H S% L%);`. Identified by token name; value is parseable back to hex for comparison.
- **DriftRow**: The per-token comparison result — `{ token, figmaHex, cssHex, driftPct, band }` where band ∈ `{ OK, WARN, MUST_FIX }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single command (`pnpm dlx tsx src/scripts/figma-sync.ts`) completes the read-compare-report-apply cycle in under 10 seconds on a warm network connection.
- **SC-002**: After a successful run, 100% of the 6 target tokens have <1% drift against their Figma source of truth.
- **SC-003**: When Figma has not changed, a second run of the script produces zero `globals.css` edits (idempotence) and exits 0.
- **SC-004**: A reviewer can read the drift report and decide whether to merge without opening Figma — each row states token name, Figma hex, current-css hex, drift %, and band.
- **SC-005**: Running `pnpm build` after a sync that edited `globals.css` MUST succeed with no new TypeScript/CSS errors, proving the emitted `hsl(...)` strings are Tailwind v4-valid.

## Assumptions

- The Figma file `96ECPnljhnFrOMesWfd3d2` has exactly the 6 Color Styles named `bg/base`, `fg/default`, `primary/default`, `status/success`, `status/warning`, `status/error`; any other styles in the file are ignored.
- A valid `FIGMA_TOKEN` is present in the developer's local environment (via `.env.local` or shell) at the time the script is run; CI is out of scope for this iteration.
- The `@theme` block in `src/app/globals.css` is the single source of truth on the code side — no other file redefines these 6 tokens.
- Non-color tokens (typography, spacing, radius) are explicitly **Out of Scope** and will be handled by a later feature.
- Writing back to Figma is out of scope; sync is Figma → code only.
- No new npm dependency is acceptable; execution relies on `pnpm dlx tsx` invoked ad-hoc.
- Branch hygiene: all work lands on `evolution`; a feature branch named `006-figma-sync` is explicitly disallowed for this iteration.
- Drift threshold bands (<1/1–3/>3%) are product decisions already made by the operator and are not up for clarification.
