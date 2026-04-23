# Quickstart: Manual verification for 005-save-agent

**Run after `/speckit-implement` finishes.** Each step maps to a functional requirement or success criterion; if any step fails, the feature is not shipped.

## Prerequisites

- `pnpm install` (no-op; no new deps).
- `pnpm dev` running in one terminal.
- Fresh browser profile or an incognito window (clean `localStorage`). DevTools → Application → Local Storage visible.

## The 5-step smoke test

### 1. Default state on first visit (FR-001, SC-002)

1. Open `http://localhost:3000/agent/research-assistant`.
2. Observe the right-column card's bottom button.

**Expected**: Button reads "添加到我的 Agent" with a `+` icon. No console warnings about hydration mismatch.

### 2. Add → persisted (FR-002, FR-003, FR-004, FR-005)

1. Click the button once.

**Expected**:
- Label flips to "已添加到我的 Agent ✓" with a check icon.
- DevTools shows `agenthub:myAgents` = `["research-assistant"]`.

2. Hard refresh the page (`⌘R` / `Ctrl+R`).

**Expected**: After hydration, the button immediately shows the "已添加" state (brief default flash of <100 ms is acceptable per SC-002).

### 3. Toggle off (FR-003, US-2)

1. Click the button again.

**Expected**:
- Label returns to "添加到我的 Agent" with the `+` icon.
- DevTools shows `agenthub:myAgents` = `[]`.

### 4. Multi-agent + order preserved (Acceptance scenario 3)

1. Click button to add `research-assistant`.
2. Navigate to `/agent/code-reviewer` (any other valid id). Add it.
3. Navigate to `/agent/writing-coach` (any other valid id). Add it.
4. Inspect DevTools → Local Storage.

**Expected**: `agenthub:myAgents` = `["research-assistant", "code-reviewer", "writing-coach"]` (insertion order, no duplicates).

### 5. Tamper resistance (FR-006, SC-005)

1. In DevTools Console: `localStorage.setItem('agenthub:myAgents', 'not-json{{{')`.
2. Reload any `/agent/*` page.

**Expected**: Page renders without crash; button shows default state; no red errors in console (the hook swallows parse failure).

3. In DevTools Console: `localStorage.setItem('agenthub:myAgents', '[1,2,3]')` (numbers, not strings).
4. Reload.

**Expected**: Page renders without crash; button shows default state; Zod validation caused the list to be treated as empty.

## Exit criteria

- All 5 steps pass in a single session.
- `pnpm build` completes with no TypeScript errors.
- `git diff --stat` shows exactly three paths: `src/lib/schemas/my-agents.ts` (new), `src/lib/hooks/use-my-agents.ts` (new), `src/app/agent/[id]/page.tsx` (modified, small diff).

## Common pitfalls (what to look for in code review)

- **Hydration mismatch**: if you see `Warning: Text content did not match. Server: "添加到我的 Agent" Client: "已添加到我的 Agent ✓"`, the `isHydrated` gate was bypassed in the Button.
- **Write without revert**: force a quota error (`for (let i = 0; i < 1e4; i++) localStorage.setItem('junk_'+i, 'x'.repeat(1e6))`), then click Add. The button should not claim success.
- **Line-166 drift**: run `git diff src/app/agent/\[id\]/page.tsx` and confirm the only hunk edits touch the Button JSX and the import lines. Any other hunk is a regression.
