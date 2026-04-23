# Phase 0 Research: Figma Color Token Sync

## R-01 — Figma REST endpoint(s) for reading Color Styles

**Decision**: Use `GET /v1/files/:key/styles` to list all styles with their `name`, `style_type` (filter `FILL`), and `node_id`, then follow up with `GET /v1/files/:key/nodes?ids=<n1>,<n2>,...` to resolve each style's solid paint fill and extract the RGB channels.

**Rationale**: A single `GET /v1/files/:key` dumps the whole file tree and is overkill (can be several MB). The 2-call flow returns only what the 6-style audit needs — metadata (call 1) and fill paints (call 2). Both endpoints exist in Figma REST stable v1, no preview flag needed. Auth via `X-Figma-Token: $FIGMA_TOKEN` header.

**Alternatives considered**:
- `GET /v1/files/:key` — rejected: too much payload, wastes bandwidth.
- Figma GraphQL — rejected: not public/stable.
- `GET /v1/files/:key/variables/local` — rejected: returns Variables (separate primitive from Styles); this file uses **Color Styles**, not Variables, per the Figma file structure observed via MCP.

## R-02 — Figma node → color channels extraction

**Decision**: For each resolved style node, read `document.fills[0]` and require `type === "SOLID"`. Extract `color.r`, `color.g`, `color.b` (floats in [0,1]) and convert to 0–255 integers via `Math.round(c * 255)`. Alpha is asserted `=== 1` or (if present and ≠1) produces a WARN log and the script treats opacity as 1. Non-SOLID paints (gradients, images) throw a descriptive error.

**Rationale**: All 6 target tokens are solid fills by design; non-solid would be a design-system bug upstream. Hard fail with a named-style error message keeps the audit trustworthy rather than silently emitting garbage values.

**Alternatives**: Attempt gradient-average — rejected (not in scope, would mask design errors).

## R-03 — Hex ↔ HSL round-trip math

**Decision**: Implement minimal in-file helpers:

- `hexToRgb(hex: string) → {r,g,b}` — 6-char hex → 3×0–255 integers.
- `rgbToHsl({r,g,b}) → {h,s,l}` — standard sRGB→HSL conversion, returning `h` in [0,360], `s,l` in [0,100], all rounded to **integer**.
- `hslToRgb({h,s,l}) → {r,g,b}` — inverse, used ONLY for drift computation of current CSS values (so both sides compare in RGB space).
- `rgbToHex({r,g,b}) → "#rrggbb"` — for the report.

Rounding: HSL values are rounded to integers when written back to `globals.css` (matches the existing file's style — all existing values are integer H/S/L).

**Rationale**: Zero dependencies. The script is ~40 LOC of color math, trivially testable by inspection. Existing `globals.css` uses integer HSL (`hsl(220 15% 10%)`) — preserving that convention keeps diffs clean.

**Alternatives**:
- `culori`/`color-convert` npm packages — rejected: violates no-new-deps.
- Float HSL — rejected: breaks convention with existing file.

## R-04 — Drift metric (confirmed by clarify session)

**Decision**: Normalized Euclidean RGB distance:

```
driftPct = sqrt((Δr)² + (Δg)² + (Δb)²) / sqrt(3 · 255²) × 100
```

where Δ is Figma-hex RGB minus current-CSS (HSL-round-tripped) RGB. Result in [0, 100].

**Rationale**: Max possible distance is sqrt(3·255²) = 441.67, so dividing gives a clean 0–100%. Matches intuition: 1% ≈ JND (just-noticeable difference) for low-contrast pairs; 3% is visibly wrong. Handles integer HSL rounding bias well because rounding error is bounded to a few units in each channel — typically well under 1% drift.

**Alternatives**:
- CIEDE2000 — rejected: pulls in a color-science lib (no-new-deps).
- Simple max-channel-delta — rejected: under-reports multi-channel drift (e.g., 10/10/10 looks like 10 when actually 17).

## R-05 — In-place CSS edit strategy

**Decision**: Read `src/app/globals.css` as a single string. For each MUST-FIX token, use a targeted `String.prototype.replace` with an anchored regex matching ONLY that token's declaration on its own line:

```
/(^\s*--color-<token>:\s*)hsl\([^)]*\)(;)/m
```

Replace group 1 is preserved (keeps indentation), group-1 + new `hsl(H S% L%)` + `;` is emitted. Other lines are untouched.

**Rationale**: Keeps whitespace, comments, ordering, and non-color `@theme` entries 100% intact. The anchored line-start + token-name + direct `hsl(...)` pattern is unambiguous given the current file structure (verified by reading globals.css).

**Alternatives**:
- PostCSS AST edit — rejected: adds `postcss` dep.
- Full-file rewrite from parsed object — rejected: risks reordering, losing comments.
- `sed` shell call — rejected: macOS/Linux `sed` flag differences cause portability pain.

## R-06 — MCP vs REST separation

**Decision**: MCP `mcp__figma__get_figma_data` is used **only in the plan/validation phase** (once, done in plan phase to verify connectivity + sample one real color value). The sync script itself is a standalone Node process and uses `fetch()` to call Figma REST. No MCP at runtime.

**Rationale**: MCP tools only run inside an agent context; the operator wants the script to be runnable via plain `pnpm dlx tsx ...` in a terminal, CI, or a git hook if ever desired. Coupling the script to MCP would require the agent SDK to be installed and would break idempotent re-run by human operators.

**Alternatives**: Script-via-MCP — rejected (leaks agent-context coupling into shippable tooling).

## R-07 — FIGMA token source (amended 2026-04-20)

**Decision**: Read token from `process.env.FIGMA_API_KEY` (primary, matches the naming convention already used in this project's `.env.local`), falling back to `process.env.FIGMA_TOKEN`. The script **auto-loads** `.env.local` via a tiny inline parser (≈6 lines, zero deps) if present, so operators don't have to `export` the var manually.

**Rationale (amended)**: During plan I assumed operator would export the var. During implement we discovered `.env.local` already has `FIGMA_API_KEY=...`. Adding a 6-line `.env.local` reader:

```ts
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
```

is dependency-free (no `dotenv` package) and pattern-faithful to how Next.js itself loads `.env.local`. If missing, the script still errors loudly and exits 1.

**Alternatives rejected**:
- Require shell `export` — rejected: terrible UX, makes `pnpm dlx tsx` invocation fragile.
- `dotenv` npm package — rejected: new dep violates constraint.

## R-08 — Exit codes & CI posture

**Decision**:

- Exit **0**: zero MUST-FIX drifts (file may or may not have been edited — actually never edited at 0, since MUST-FIX is what triggers edits).
- Exit **1**: any generic error (missing token, Figma HTTP error, missing target style, gradient fill).
- Exit **2**: one or more MUST-FIX drifts were detected *and* the file was rewritten (non-zero to signal the operator should review the diff, commit, and potentially open a PR).

**Rationale**: Distinct exit codes let a future CI job distinguish "Figma broken" (1) from "we drifted and self-corrected" (2 → CI creates a PR). This iteration runs manually, but the codes are forward-compatible.

**Alternatives**: Single exit 0 on success-or-edit — rejected (no way for CI to detect edits happened).

## Open items post-research

None. All NEEDS-CLARIFICATION resolved in spec.md + clarify session. Ready for Phase 1.
