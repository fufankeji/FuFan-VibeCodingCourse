# Feature Specification: Save Agent to My Agents (localStorage)

**Feature Branch**: `005-save-agent` (spec dir on `evolution` branch)
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "让 /agent/[id] 页面上'添加到我的 Agent'按钮真正能工作：点击后把当前 Agent 的 id 存到 localStorage 的 'myAgents' 数组里；按钮状态变成'已添加到我的 Agent ✓'；刷新页面保持；再点一次从列表里移除（toggle）。不做真实后端、不做用户系统。"

## Clarifications

### Session 2026-04-20

All typical decision points were pre-answered by the requester; recorded here verbatim for the record and to lock the plan/tasks phases against drift.

- Q: What gets persisted per saved Agent? → A: Only the `agent.id` string — never a snapshot of the Agent object. (Rationale: keeps the store tiny and immune to mock-data.ts edits; rich metadata is always derived at read time.)
- Q: Maximum number of saved Agents? → A: 100. Attempting to add #101 is a silent no-op on storage; the button stays in the not-added state.
- Q: How is SSR / hydration handled? → A: Initial render (server + pre-hydration) shows the default label "添加到我的 Agent". A `useEffect` reads `localStorage` only after mount and then flips the state. Reading `localStorage` during render is forbidden.
- Q: Will this release include a dedicated "My Agents" list page? → A: No. Only a reusable `useMyAgents()` hook is exposed so a future feature can build that page without re-touching persistence.
- Q: What is the `localStorage` key? → A: `agenthub:myAgents` (project-namespaced; avoids collisions with unrelated keys in shared browser profiles).
- Q: How is the stored value validated on read? → A: Zod schema `z.array(z.string().min(1).max(64)).max(100)`. Any parse/validation failure is caught and returns an empty list; the next successful write overwrites whatever was there.
- Q: Cross-tab sync behavior? → A: Out of scope. No `storage` event listener; stale tabs see old state until they refresh.
- Q: UI feedback when `localStorage.setItem` throws (quota exceeded / Safari private mode)? → A: Silent revert — UI state rolls back to pre-click and no toast/alert is shown in v1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add an Agent to my collection (Priority: P1)

As a visitor browsing an Agent detail page, I want to save Agents I like so I can find them again later, without creating an account.

**Why this priority**: This is the only user-facing behavior the feature delivers. Without it the button remains dead — everything else in this spec (persistence, toggle-off, SSR safety) is in service of making this single interaction trustworthy.

**Independent Test**: Open `/agent/<any valid id>`, click the "添加到我的 Agent" button. The button label should change to "已添加到我的 Agent ✓". Refresh the page. The button should still show the added state. The agent id should be present in `localStorage['agenthub:myAgents']` as a JSON string array.

**Acceptance Scenarios**:

1. **Given** a freshly opened browser with empty `localStorage`, **When** the user visits `/agent/research-assistant` and clicks the add button, **Then** the button label becomes "已添加到我的 Agent ✓" and `localStorage['agenthub:myAgents']` contains `["research-assistant"]`.
2. **Given** `localStorage['agenthub:myAgents']` already contains `["research-assistant"]`, **When** the user reloads `/agent/research-assistant`, **Then** after hydration the button shows the "已添加" state without the user clicking anything.
3. **Given** multiple Agent pages have been visited and added, **When** the user inspects `localStorage['agenthub:myAgents']`, **Then** it contains a JSON array with all added ids, in insertion order, no duplicates.

---

### User Story 2 - Remove an Agent by clicking again (Priority: P1)

As a user who changed my mind, I want clicking the button a second time to unsave the Agent, so I don't have to dig into browser devtools to clean up.

**Why this priority**: Without a remove path users accumulate unwanted entries forever. Same code path as add, so bundling it at P1 costs almost nothing.

**Independent Test**: On an Agent page where the button shows "已添加", click it. The label returns to "添加到我的 Agent" and the id disappears from `localStorage['agenthub:myAgents']`.

**Acceptance Scenarios**:

1. **Given** the current agent's id is already in `localStorage['agenthub:myAgents']`, **When** the user clicks the button, **Then** the id is removed from the array and the label reverts to the default.
2. **Given** the user toggles the button N times, **When** N is even, **Then** the agent is NOT in the list; when N is odd, it IS in the list.

---

### Edge Cases

- **SSR/Hydration**: On first render (server-side and pre-hydration), the button MUST show the default "添加到我的 Agent" label. Reading `localStorage` during render would either crash on the server or cause hydration mismatch. The real state must only reveal itself after the component mounts on the client.
- **Corrupted localStorage**: If another script or the user writes non-JSON or a non-string-array into `localStorage['agenthub:myAgents']`, the app MUST treat the store as empty (not crash) and overwrite on the next successful write.
- **Storage quota exceeded**: If `localStorage.setItem` throws (quota full, Safari private mode), the UI state MUST NOT claim success — the button reverts and the user sees no false "已添加" state. No toast/error UX in this release; silent revert is acceptable.
- **Upper bound**: The list caps at 100 entries. Attempting to add a 101st entry while the list is full is a no-op on storage; the button stays in the "not added" state for that agent.
- **Unknown agent id**: If the add action is called with an id that is not in the mock-data catalog, the store accepts it (it's just a string). The list page consuming the hook later is responsible for gracefully ignoring unknown ids.
- **Cross-tab sync**: Out of scope for this release. Two tabs may temporarily disagree; whichever writes last wins on the next read.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render the "添加到我的 Agent" button on `/agent/[id]` with a default (not-added) label during server render and initial client hydration.
- **FR-002**: After the component mounts on the client, system MUST read the saved list from `localStorage['agenthub:myAgents']` and, if the current agent's id is present, update the button label to "已添加到我的 Agent ✓" with a visual affordance (icon swap) indicating saved state.
- **FR-003**: Clicking the button MUST toggle the current agent's id in the saved list: insert if absent, remove if present.
- **FR-004**: After any toggle, the new list MUST be written back to `localStorage['agenthub:myAgents']` synchronously.
- **FR-005**: The saved list MUST persist across page reloads and navigation within the same browser profile.
- **FR-006**: The saved list MUST be validated on read with a schema that enforces: JSON array, each element is a non-empty string of length 1–64, array length ≤ 100. Invalid data MUST be treated as an empty list.
- **FR-007**: System MUST expose a reusable `useMyAgents()` hook returning `{ ids, has(id), toggle(id), isHydrated }` so future features (Gallery, RunHistory) can consume the same store without re-implementing persistence.
- **FR-008**: The feature MUST NOT introduce new npm dependencies, new database tables, new API routes, or changes to any file outside the three targets listed in plan.md.
- **FR-009**: The only change to `src/app/agent/[id]/page.tsx` MUST be confined to the Button element currently at line 166 (adding `onClick`, dynamic label, dynamic icon). No other imports, handlers, or JSX in that file may be altered.

### Key Entities *(data involved)*

- **SavedAgentList**: An ordered array of agent ids (strings). Stored as JSON at `localStorage['agenthub:myAgents']`. No per-entry metadata — metadata is derived at read time by looking up each id in the existing mock-data catalog. This keeps the store cheap and immune to mock-data edits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh browser, the user can save an Agent and confirm it stays saved across a full page refresh in under 10 seconds, without touching devtools.
- **SC-002**: The button visibly reflects the correct state (added vs. not-added) within 100 ms of client hydration completing.
- **SC-003**: 100% of toggle clicks result in a durable write to `localStorage` before the next user interaction is accepted (i.e., state and storage never drift).
- **SC-004**: Adding the feature adds no more than 2 new source files (one hook, one schema) and modifies exactly 1 line range in one existing file (the button at `src/app/agent/[id]/page.tsx:166`).
- **SC-005**: Corrupted or tampered `localStorage` values never crash the page; the user always sees a functional, default-state button.

## Out of Scope *(mandatory for this feature)*

The following are explicitly NOT part of this release and MUST NOT be touched by the implementation:

- **No user system / accounts / login**: The feature is strictly per-browser-profile. No backend identity, no cookies beyond what the app already sets.
- **No Turso / real database**: Persistence is `localStorage` only. No server-side list, no sync.
- **No changes to Gallery / RunHistory / Settings pages**: These pages do not consume the hook in this release.
- **No changes to `src/app/agent/[id]/page.tsx` beyond the Button at line 166**: All other JSX, hooks, imports, and handlers in that file stay byte-identical. The `onClick`, dynamic label, and icon swap are the only diff.
- **No new npm dependencies**: React 19 hooks, the built-in `localStorage` API, and the already-installed `zod` package are sufficient.
- **No "My Agents" list page**: A dedicated `/my-agents` route is deferred. The `useMyAgents` hook is exposed so a future feature can build that page without re-visiting persistence.
- **No cross-tab sync**: We do not listen for `storage` events in this release.
- **No toast/error UI on quota-exceeded**: Silent revert is acceptable for v1.
- **No migration from any prior key**: `agenthub:myAgents` is introduced fresh; no legacy key is read.
- **No mock-data.ts edits**: Only the existing `agent.id` values are used.

## Assumptions

- The user is on a modern evergreen browser with `localStorage` enabled (not Safari private mode with storage disabled). Degraded browsers silently fall back to session-only state.
- `agent.id` values in `src/lib/mock-data.ts` are stable, URL-safe strings of length 1–64. (The schema enforces this on the consumer side anyway.)
- The project already includes `zod` as a runtime dependency (confirmed by existing `src/lib/schemas/agent-output.ts`), so no new dependency is needed for validation.
- The design system already provides `<Button>` with adequate states via `className` variants; no new shadcn primitive is required. An icon swap (e.g., `Plus` → `Check`) from the existing `lucide-react` dependency is acceptable.
- Hydration timing: the `useEffect` pattern that reads `localStorage` after mount is acceptable UX — the button briefly shows the default state before revealing the saved state. This is a deliberate trade to avoid hydration mismatch warnings.
