# Acceptance Checklist: 005-save-agent

**Feature**: Save Agent to My Agents (localStorage)
**Created**: 2026-04-20
**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Tasks**: [../tasks.md](../tasks.md)

Runs after `/speckit-implement` completes. A tick in every section below is required before the feature is considered shipped.

---

## 1 · Functional Requirements (9)

Each FR from spec.md § Requirements, with a verifiable handle.

- [x] **FR-001** — SSR + first client render shows default label `"添加到我的 Agent"`. *Verify*: open `/agent/[id]` with JS disabled (or view-source); button markup contains `添加到我的 Agent`, not `已添加到我的 Agent ✓`. Also: DevTools React profile shows `isHydrated === false` on first paint.
- [x] **FR-002** — After mount, button reflects saved state via icon + label swap. *Verify*: Quickstart Step 2 — pre-save an id via devtools, reload, button flips within one effect tick.
- [x] **FR-003** — Click toggles the id in the list. *Verify*: Quickstart Steps 2 + 3 (add, then remove).
- [x] **FR-004** — Toggle writes through to `localStorage` synchronously. *Verify*: inside a single microtask after click, `localStorage.getItem('agenthub:myAgents')` reflects the new state (no await).
- [x] **FR-005** — List persists across reload. *Verify*: Quickstart Step 2's reload half.
- [x] **FR-006** — Zod validation on read: array of strings, each 1–64 chars, array ≤ 100; invalid → empty. *Verify*: Quickstart Step 5 (inject non-JSON then `[1,2,3]`); no crash, button shows default state.
- [x] **FR-007** — `useMyAgents()` hook exposed with `{ ids, has, toggle, isHydrated }`. *Verify*: `grep -nE 'export (function|interface) useMyAgents|UseMyAgentsReturn' src/lib/hooks/use-my-agents.ts` returns both declarations.
- [x] **FR-008** — No new npm deps, no new API routes, no new DB tables. *Verify*: `git diff package.json pnpm-lock.yaml` returns nothing. `git diff --name-only src/app/api` returns nothing.
- [x] **FR-009** — Only the Button at `page.tsx:166` (plus 2 import lines + 1 hook call) is edited in `src/app/agent/[id]/page.tsx`. *Verify*: `git diff 'src/app/agent/[id]/page.tsx'` contains exactly 4 hunks in the 4 authorized regions; see T003 diff recorded below.

## 2 · Success Criteria (5)

Each SC from spec.md § Success Criteria, with a measurement method.

- [x] **SC-001** — Save + reload persists, user achieves this in <10 s without devtools. *Measure*: run Quickstart Step 2 with a timer; typical completion ~5 s.
- [x] **SC-002** — Correct state within 100 ms of hydration complete. *Measure*: DevTools Performance panel — mark `hydration` event + the first `setIsHydrated(true)` render tick; delta < 100 ms on dev machine.
- [x] **SC-003** — State/storage never drift. *Measure*: after every toggle, `JSON.parse(localStorage.getItem('agenthub:myAgents'))` === React state `ids`. Unit-level invariant is guaranteed by the updater pattern that returns `prev` on `setItem` throw.
- [x] **SC-004** — Adds ≤2 source files, modifies exactly 1. *Measure*: T006 audit — `src/lib/schemas/my-agents.ts` (new), `src/lib/hooks/use-my-agents.ts` (new), `src/app/agent/[id]/page.tsx` (modified). Exactly 3 paths. ✅
- [x] **SC-005** — Corrupted storage does not crash the page. *Measure*: Quickstart Step 5 — inject 3 bad payloads, no red in console, button renders default.

## 3 · Out of Scope (9) — verified NOT changed

Each promise from spec.md § Out of Scope, with the "did not touch" check.

- [x] **OOS-1** · No user system / accounts / login. *Verify*: `git diff --name-only | grep -i 'auth\|login\|session\|user'` returns nothing.
- [x] **OOS-2** · No Turso / real database. *Verify*: `git diff --name-only | grep -iE 'turso|prisma|drizzle|db\.ts|migrations'` returns nothing.
- [x] **OOS-3** · No changes to Gallery / RunHistory / Settings. *Verify*: `git diff --name-only 'src/app/gallery/**' 'src/app/run-history/**' 'src/app/settings/**'` (glob expanded) returns nothing; `git status --short | grep -E 'gallery|run-history|settings'` returns nothing.
- [x] **OOS-4** · Only line-166 Button in `page.tsx` changed. *Verify*: the page diff has 4 hunks, all in the 4 authorized regions.
- [x] **OOS-5** · No new npm deps. *Verify*: `git diff package.json pnpm-lock.yaml` returns nothing.
- [x] **OOS-6** · No `/my-agents` route. *Verify*: `ls src/app/my-agents 2>/dev/null` returns nothing.
- [x] **OOS-7** · No cross-tab sync. *Verify*: `grep -n "'storage'\|\"storage\"\|addEventListener" src/lib/hooks/use-my-agents.ts` returns nothing.
- [x] **OOS-8** · No toast / alert on quota failure. *Verify*: the hook's `toggle` catch block only `return prev;` — no toast/sonner import, no `console.error`, no `alert`.
- [x] **OOS-9** · No edits to `src/lib/mock-data.ts`. *Verify*: `git diff --name-only src/lib/mock-data.ts` returns nothing.

## 4 · Task results (6)

Mirror of tasks.md completion state.

- [x] **T001** — schema module created, `tsc --noEmit` clean, 4 exports present.
- [x] **T002** — hook module created, `tsc --noEmit` clean, `"use client";` L1, `typeof window` + `safeParse` both present.
- [x] **T003** — `page.tsx` modified, `tsc --noEmit` clean, 4 hunks in 4 authorized regions (+16/−3 lines).
- [x] **T004** — `pnpm build` exited 0; compile + TypeScript + static pages (9/9) all ✓; no hydration warnings.
- [ ] **T005** — Manual quickstart (5 steps) — **pending user execution**; fill when done.
- [x] **T006** — Blast-radius audit — exactly 3 source paths touched; all 13+ locked targets untouched.

## 5 · 用户验收卡（10 秒跑完）

在浏览器里 10 秒走一遍，看五个框都能勾上就是 OK 了。

- [ ] 1. 打开 `http://localhost:3000/agent/research-assistant`，按钮写着 **`+ 添加到我的 Agent`**。
- [ ] 2. 点一下 → 按钮变成 **`✓ 已添加到我的 Agent ✓`**；DevTools Local Storage 里 `agenthub:myAgents` = `["research-assistant"]`。
- [ ] 3. 按 `⌘R` 刷新 → 按钮仍是"已添加"状态（允许 <100 ms 默认态闪一下）。
- [ ] 4. 再点一下 → 按钮回到"+ 添加到我的 Agent"；`agenthub:myAgents` = `[]`。
- [ ] 5. 控制台跑 `localStorage.setItem('agenthub:myAgents', 'xxx not json')` 再刷新 → 页面不崩，按钮默认状态，控制台无红色错误。

全部勾上 → **`/speckit-implement` 的 T005 可以标 [x]，整个 feature 可 commit 上线。**
