# Phase 1 Data Model: Figma Color Token Sync

The script operates entirely in memory; there is no persistent datastore. The following shapes describe the *in-memory* data flow.

## TargetToken

The canonical mapping of Figma style name → `globals.css` token name. Hard-coded as a constant in `src/scripts/figma-sync.ts`.

| Figma style name | CSS token | Group |
|---|---|---|
| `bg/base` | `--color-bg-base` | background |
| `fg/default` | `--color-fg-default` | foreground |
| `primary/default` | `--color-primary-default` | primary |
| `status/success` | `--color-status-success` | status |
| `status/warning` | `--color-status-warning` | status |
| `status/error` | `--color-status-error` | status |

**Invariants**:
- Exactly 6 entries.
- Each Figma name appears exactly once.
- Each CSS token appears exactly once and is present in `src/app/globals.css` `@theme`.

## FigmaColorStyle (Figma REST shape — subset)

```ts
interface FigmaStyleMeta {
  key: string;
  name: string;               // e.g. "bg/base"
  style_type: "FILL" | ...;   // we filter to FILL
  node_id: string;            // needed for the nodes follow-up
}

interface FigmaSolidPaint {
  type: "SOLID";
  color: { r: number; g: number; b: number };  // each in [0, 1]
  opacity?: number;           // ∈ [0,1]; treated as 1 with WARN log if < 1
}

interface FigmaStyleNode {
  document: {
    fills: FigmaSolidPaint[];  // we use [0]
  };
}
```

**Validation rules**:
- `fills.length >= 1` — else error "`<name>` has no fills".
- `fills[0].type === "SOLID"` — else error "`<name>` fill is not SOLID".
- `color.r|g|b ∈ [0,1]` — if out of range, error with observed value.
- `opacity` missing or `=== 1` → accept; otherwise WARN "non-opaque alpha ignored".

## ThemeToken (parsed from globals.css)

```ts
interface ThemeToken {
  cssName: string;            // "--color-bg-base"
  h: number;                  // integer 0–360
  s: number;                  // integer 0–100
  l: number;                  // integer 0–100
  rawLine: string;            // original line content (for in-place rewrite)
}
```

**Validation rules**:
- Each of the 6 target CSS names MUST match exactly one line in `@theme`.
- Value must match `hsl(<H> <S>% <L>%)` regex (whitespace-tolerant, integer channels).
- Missing match → error "`<cssName>` not found in globals.css"; script aborts without writing.

## DriftRow

The per-token comparison output.

```ts
type Band = "OK" | "WARN" | "MUST_FIX";

interface DriftRow {
  token: string;              // "--color-bg-base"
  figmaHex: string;           // "#141A1F"
  cssHex: string;             // "#16181D" — computed from ThemeToken HSL
  driftPct: number;           // 0–100, 2 decimals
  band: Band;
}
```

**Band rules** (from spec FR-005):

| driftPct | band |
|---|---|
| `< 1.0` | `OK` |
| `>= 1.0 && <= 3.0` | `WARN` |
| `> 3.0` | `MUST_FIX` |

## Report

A flat `DriftRow[]` of length 6 rendered to stdout as a fixed-width table plus a one-line summary (`N MUST-FIX, M WARN, K OK`). Followed by a diff preview if any MUST-FIX entries triggered rewrites.

## State transitions

```
[start]
   ↓
[env check]  → missing FIGMA_TOKEN ⇒ exit 1
   ↓
[figma GET /styles]  → HTTP ≠ 200 ⇒ exit 1
   ↓
[figma GET /nodes?ids=...]  → HTTP ≠ 200 ⇒ exit 1
   ↓
[parse globals.css]  → missing token ⇒ exit 1
   ↓
[build 6 DriftRows]
   ↓
[print report]
   ↓
if (any MUST_FIX) {
  [rewrite globals.css in place]
  → exit 2
} else {
  → exit 0
}
```

No persistence beyond the in-place CSS edit.
