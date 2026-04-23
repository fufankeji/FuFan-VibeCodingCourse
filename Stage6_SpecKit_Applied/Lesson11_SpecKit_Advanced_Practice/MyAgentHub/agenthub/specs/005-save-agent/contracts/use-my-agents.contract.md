# Contract: `useMyAgents` hook

**Feature**: 005-save-agent
**Module**: `src/lib/hooks/use-my-agents.ts`
**Consumers** (this release): `src/app/agent/[id]/page.tsx` (Button at line 166).
**Consumers** (future): any page wanting to render the saved list (e.g. `/my-agents`).

This is the single public contract this feature exposes. Any change to this signature after v1 is a breaking change.

## Signature

```ts
export function useMyAgents(): UseMyAgentsReturn;

export interface UseMyAgentsReturn {
  /** Snapshot of saved agent ids. Safe to pass through to render. */
  readonly ids: readonly string[];

  /** Whether the given agent id is currently saved. */
  has: (id: string) => boolean;

  /**
   * Insert the id if absent, remove it if present. Synchronously writes to
   * localStorage; on write failure, the UI state does not change (silent revert).
   * Idempotent at the intent level ("make this saved / not saved"). Adding past
   * the 100-entry cap is a no-op.
   */
  toggle: (id: string) => void;

  /**
   * `false` during SSR and the first client render pass; flips to `true` after
   * the mount effect has read localStorage. Consumers should gate any dynamic
   * label / icon on this flag so the server and first client render agree.
   */
  readonly isHydrated: boolean;
}
```

## Invariants

1. `ids` length ≤ 100 at all times after hydration.
2. Every element of `ids` is a non-empty string of length ≤ 64.
3. `has(id)` returns `true` iff `ids.includes(id)`.
4. `toggle(id)` followed by a synchronous read of `localStorage['agenthub:myAgents']` reflects the same array now in `ids`, **except** when `setItem` throws, in which case both `ids` and storage remain at the pre-toggle value.
5. Before `isHydrated === true`, `ids` is the empty array (regardless of what's in storage). This is by design — consumers must not render "saved" state before hydration.

## Underlying schema

Imported from `src/lib/schemas/my-agents.ts`:

```ts
export const MY_AGENTS_KEY = 'agenthub:myAgents' as const;
export const MAX_SAVED_AGENTS = 100 as const;
export const myAgentsSchema = z.array(z.string().min(1).max(64)).max(MAX_SAVED_AGENTS);
export type MyAgentIds = z.infer<typeof myAgentsSchema>;
```

The schema is the **only** validation boundary. Consumers must not re-validate.

## Non-goals (explicit)

- No `clear()`, `add()`, or `remove()` helpers. `toggle` covers all current needs; additions can come later without breaking callers.
- No cross-tab `storage` event handling. A second tab that mutates storage while the first tab is open will see the mutation only on next mount / reload.
- No async variant. All operations are synchronous; if `setItem` is slow enough to matter (multi-MB payloads), that's already out of scope for a 100-entry cap.

## Error behavior summary

| Situation | Behavior |
|---|---|
| SSR / `typeof window === 'undefined'` | Effect bails; state remains empty; `isHydrated` flips to `true` on client mount only. |
| Missing key | State stays empty; no error. |
| Non-JSON value | State stays empty; `JSON.parse` error swallowed. |
| JSON parses but fails schema | State stays empty; Zod error swallowed. |
| `setItem` throws (quota / disabled storage) | State is not updated; UI reverts to pre-click. |
| `toggle` called with id of length 0 or > 64 | The id is stored (no client-side guard). Read will fail schema on next mount and the whole list will be dropped. **Callers should not pass garbage ids**; in this release, all callers pass `agent.id` from `mock-data.ts` which always fits. |
