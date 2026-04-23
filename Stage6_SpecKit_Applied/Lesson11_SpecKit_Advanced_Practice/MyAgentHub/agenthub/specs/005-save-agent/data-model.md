# Phase 1 — Data Model: Save Agent to My Agents (localStorage)

**Feature**: 005-save-agent
**Date**: 2026-04-20

This feature owns a single entity. No tables, no API schemas — only a client-side storage shape.

## Entity: `SavedAgentList`

**Physical location**: `window.localStorage[MY_AGENTS_KEY]` where `MY_AGENTS_KEY = 'agenthub:myAgents'`.

**On-disk representation**: a single JSON string encoding an array of strings.

**Shape (Zod)**:

```ts
z.array(
  z.string().min(1).max(64)
).max(100)
```

**TypeScript type**: `MyAgentIds = readonly string[]` (inferred from the schema, narrowed to `readonly` at the hook boundary).

### Fields

| Field | Type | Constraint | Notes |
|---|---|---|---|
| (element) | `string` | length ∈ [1, 64] | Must match an `agent.id` from `src/lib/mock-data.ts`. Not enforced at storage time (storage is dumb); the UI is tolerant of unknown ids. |
| (array) | `string[]` | length ≤ 100 | Hard cap. Writer (`toggle`) refuses to grow past 100; it simply no-ops. |

### Uniqueness & ordering

- **Uniqueness**: by convention (enforced by `toggle`'s "if present, remove" branch). Duplicates cannot arise from the hook's own writes. If external code (devtools paste, rogue extension) writes duplicates, they survive Zod validation but are cosmetic noise; the UI treats the list as a set.
- **Ordering**: insertion order. Newest additions are appended to the tail. This is an implementation detail today, but a future `/my-agents` page may rely on it for "recent first" display.

### Lifecycle / state transitions

```text
           (first visit)              (user clicks button)
empty ───────────────────────► [id1]
 ▲                                  │
 │                                  │  (user clicks again — toggle off)
 │                                  ▼
 └────────────────────────────  empty
                                   │
                                   │  (add more, up to 100)
                                   ▼
                               [id1, id2, …, id100]
                                   │
                                   │  (101st click → no-op; list unchanged)
                                   ▼
                               [id1, id2, …, id100]
```

### Read path

1. `useEffect` fires post-mount.
2. `typeof window === 'undefined'` → bail (server, tests).
3. `window.localStorage.getItem('agenthub:myAgents')` → `string | null`.
4. If `null` → state stays `[]`.
5. Else `JSON.parse` inside try/catch; on throw → state stays `[]`.
6. `myAgentsSchema.safeParse` on the parsed value; on failure → state stays `[]`.
7. On success → `setIds(parsed.data)`.
8. `setIsHydrated(true)` — **always**, regardless of which branch above ran, so the UI can leave its default-state holding pattern.

### Write path

1. `toggle(id)` computes the next array inside a `setIds(prev => ...)` updater:
   - `prev.includes(id)` → remove.
   - Otherwise, if `prev.length < 100` → append.
   - Otherwise → return `prev` unchanged (silent cap).
2. Attempt `window.localStorage.setItem(MY_AGENTS_KEY, JSON.stringify(next))` inside try/catch.
3. On success → return `next` (React commits the new state).
4. On throw (quota exceeded, storage disabled) → return `prev` (React keeps the old state; UI does not falsely claim success).

### Validation rules (from FR-006)

- Any non-JSON value in the key → empty list on read.
- Any non-array value → empty list on read.
- Any element that is not a string, or a string of length 0 or > 64 → empty list on read (Zod fails the whole array; partial recovery is not worth the complexity here).
- Any array of length > 100 → empty list on read.

### Scale assumptions

- Typical user: 0–20 saved agents.
- Hard ceiling: 100 entries × 64 chars × 2 bytes ≈ 13 KB. Far under the 5 MB `localStorage` quota even after JSON overhead.
