# Phase 0 — Research: Save Agent to My Agents (localStorage)

**Feature**: 005-save-agent
**Date**: 2026-04-20

No `NEEDS CLARIFICATION` markers remain after `/speckit-clarify`. This document captures the design decisions that feed into Phase 1 artifacts.

## D1 — Persistence layer

- **Decision**: Browser `localStorage` at key `agenthub:myAgents`, JSON-encoded string array.
- **Rationale**: Zero backend surface, zero new npm deps, synchronous API (fits React `onClick` without await), persists across reloads by default. Project has no user system yet; any network-backed option is premature.
- **Alternatives considered**:
  - `sessionStorage` — fails the "persist across reloads" requirement (SC-001).
  - `IndexedDB` — async API, over-engineered for ≤100 short strings.
  - Cookies — 4 KB limit fine, but they leak to every request to `/`, costing bandwidth and colliding with future server-rendered route handlers.
  - React Context only (in-memory) — dies on reload; fails FR-005.

## D2 — Storage key naming

- **Decision**: `agenthub:myAgents` (namespace prefix).
- **Rationale**: The user's browser profile may hold keys from unrelated apps (dev dashboards, other localhost projects). A `project:concept` prefix eliminates collisions and makes devtools Inspection legible.
- **Alternatives considered**:
  - Plain `myAgents` — collision risk, especially on shared `localhost` during dev.
  - `ah_my_agents` — cryptic, no clear ownership.

## D3 — Validation strategy

- **Decision**: `z.array(z.string().min(1).max(64)).max(100)`. On read, `JSON.parse` wrapped in try/catch, then `safeParse`; any failure path returns an empty list.
- **Rationale**: `localStorage` is writable by any script on the same origin, including browser extensions and pasted devtools code. Validating shape **on every read** keeps the runtime boundary trustworthy without imposing defensive coding on consumers. Length bounds (`min 1`, `max 64`) match realistic `agent.id` shapes in `src/lib/mock-data.ts`.
- **Alternatives considered**:
  - No validation, trust shape — one bad devtools paste crashes every `/agent/*` page. Unacceptable.
  - Manual `Array.isArray + every(typeof === 'string')` — reinvents Zod for no size win; the project already ships Zod.

## D4 — SSR-safe hook pattern (mount-before-read)

- **Decision**: Initialize React state with an empty array + `isHydrated = false`. Inside a single-run `useEffect`, guard with `typeof window === 'undefined'`, read + validate + `setIds`, then `setIsHydrated(true)`. Consumers gate dynamic UI on `isHydrated`.
- **Rationale**: Next.js 15 App Router renders server-side. Accessing `localStorage` during render throws on the server, and even client-side lazy initialization (`useState(() => localStorage.getItem(...))`) causes hydration mismatch because the server HTML and the client's first render disagree on the button's label. Mount-before-read guarantees server HTML === client first render; the real state is revealed on the next paint.
- **Alternatives considered**:
  - `useSyncExternalStore` with a server-snapshot of `[]` — correct but verbose; the slight under-abstraction of `useState + useEffect` is clearer for this project's size.
  - `next/dynamic` with `ssr: false` on the whole button — bloats the page tree, adds a skeleton flash where none is needed.
  - Reading in `useLayoutEffect` — fires before paint on the client but still after hydration, no benefit over `useEffect` and breaks SSR logs with a warning.

## D5 — Write-through + silent revert

- **Decision**: `toggle` computes the next array inside the setState updater, attempts `localStorage.setItem` inside a try/catch; on throw, returns the previous state (so the UI does not pretend to have saved).
- **Rationale**: Quota-exceeded is rare but real on Safari private mode. A false "added ✓" state would undermine SC-005. Silent revert is the smallest correct behavior; a toast is polish reserved for a later release.
- **Alternatives considered**:
  - `localStorage.setItem` before `setState` — inverts the source of truth; if `setState` batches/bails, UI and storage drift.
  - Show a toast on failure — requires wiring a toast provider; out of scope per spec's Out of Scope list.

## D6 — Toggle semantics & 100-entry cap

- **Decision**: `toggle(id)` acts as a Set operation — present → remove, absent → append (iff `length < 100`). A 101st add is a no-op (list unchanged, no error shown).
- **Rationale**: Set semantics are idempotent at the intent level ("user wants this saved"), which satisfies the Constitution's 幂等 law. The cap protects `localStorage`'s 5 MB quota and keeps the future list UI bounded.
- **Alternatives considered**:
  - Throw on overflow — breaks idempotency, forces consumers to try/catch around a trivial click.
  - Evict oldest (FIFO) — surprising behavior for a user, spec does not ask for it.

## D7 — Hook API shape

- **Decision**: Return `{ ids: readonly string[]; has: (id: string) => boolean; toggle: (id: string) => void; isHydrated: boolean }`.
- **Rationale**: `has` lets consumers write `has(agent.id)` without needing to inspect the array themselves. `ids` is a `readonly` view for a future `/my-agents` page to map over. `isHydrated` is the hydration gate. Keeping the surface to four members matches single-responsibility.
- **Alternatives considered**:
  - Returning a full `{ add, remove, toggle, clear }` surface — YAGNI for this release; can be added later without breaking consumers.
  - Returning a React context — adds provider wiring for no current multi-consumer need.

## D8 — Icon choice

- **Decision**: `Plus` (not added) → `Check` (added). Both from `lucide-react` already in use on this page.
- **Rationale**: Satisfies 第二法衣's "icons must come from `lucide-react`", matches conventional UX for toggleable saves, and avoids emoji-as-icon.
- **Alternatives considered**:
  - Heart icon — implies "favorite" not "saved"; different mental model.
  - Text-only toggle — accessibility is equal but visual affordance weakens; the existing design places an icon to the left of the label, so keeping an icon maintains visual rhythm.

## D9 — Out-of-scope explicitly deferred

The following decisions are deliberately **not** made in this feature and have no artifacts:

- Cross-tab sync via the `storage` event (would require an extra listener + re-read).
- A dedicated `/my-agents` route.
- Edits to Gallery / RunHistory / Settings to consume the hook.
- Any backend persistence.

Each is traceable to a bullet under spec.md § Out of Scope.
