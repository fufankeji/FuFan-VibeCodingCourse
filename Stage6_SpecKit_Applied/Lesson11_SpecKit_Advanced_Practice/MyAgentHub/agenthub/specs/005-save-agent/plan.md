# Implementation Plan: Save Agent to My Agents (localStorage)

**Branch**: `evolution` (spec dir `specs/005-save-agent`) | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-save-agent/spec.md`

## Summary

Wire the dead "添加到我的 Agent" button at `src/app/agent/[id]/page.tsx:166` to a new `useMyAgents()` client hook. The hook owns a `localStorage`-backed, Zod-validated list of `agent.id` strings at key `agenthub:myAgents`. SSR renders the default label; a `useEffect` mounts, reads, validates, and flips the state — this mount-before-read pattern avoids hydration mismatches. Toggling writes through synchronously; a `setItem` failure silently reverts the UI. No new npm deps, no backend, no other file changes.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 15 (App Router)
**Primary Dependencies**: Already installed — `react`, `zod`, `lucide-react`. No additions.
**Storage**: Browser `localStorage` only (key: `agenthub:myAgents`). No DB, no cookies, no server.
**Testing**: Manual quickstart script in `quickstart.md`. No unit test framework is wired in the repo for this layer; TypeScript strict + Zod runtime validation + a manual 5-step smoke test is the verification surface.
**Target Platform**: Modern evergreen browsers (Chrome/Edge/Firefox/Safari current). Degrades gracefully in storage-disabled environments (Safari private) — state is session-only, no crash.
**Project Type**: Web application (Next.js 15 App Router single-project layout).
**Performance Goals**: Button reflects correct state ≤100 ms after hydration (SC-002). `toggle()` must not block the event loop — single synchronous `setItem` call on lists ≤100 strings is ~O(µs).
**Constraints**: No SSR access to `localStorage`; `typeof window === 'undefined'` guard mandatory inside the hook. Must not trigger React hydration mismatch warnings.
**Scale/Scope**: Per-browser-profile list, ≤100 entries (hard cap enforced by schema).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 法衣 | 原则 | 合规说明 |
|---|---|---|
| 第一法衣 · Spec First | Spec 已含 User story / Acceptance criteria / Constraints / Out of Scope — see spec.md Story 1+2, FR-001..009, SC-001..005 | ✅ |
| 第一法衣 · Plan Before Implement | This plan + Phase 0/1 artifacts precede any code edit | ✅ |
| 第一法衣 · Quality Gate | `/speckit.clarify` 已运行（0 open questions）；`/speckit.checklist` 在 Step 6 产出 | ✅ |
| 第二法衣 · StyleSeed 视觉法衣 | 按钮沿用既有 `<Button>` 样式；仅 icon 切换（`Plus`↔`Check`，均来自 `lucide-react`）；无 hardcoded hex；无 4px 阶梯违规；保留原 className | ✅ |
| 第三法衣 · Figma Variables 设计法衣 | 不新增颜色/间距 token，复用既有 `@theme` | ✅（无变更面） |
| 项目基础约束 · 数据契约可校验 | `my-agents.ts` 导出 Zod schema，读取路径过 `safeParse` | ✅ |
| 项目基础约束 · 客户端边界 | `use-my-agents.ts` 文件头 `"use client"`；`page.tsx` 已是客户端组件 | ✅ |
| 项目基础约束 · 流式走 Edge | N/A — 本 feature 无流式 | ✅ |

**三法衣对齐（本 feature 的落地映射）**：
- **薄壳**：hook 纯前端，无 API/RSC/Edge 调用。
- **幂等**：`toggle(id)` 基于 Set 语义 —— add 去重，remove 对不存在的 id 是 no-op。
- **可验证**：Zod schema 限定 `string.min(1).max(64)`，数组 `.max(100)`；任何损坏/篡改的值 → 空列表 + 下次 write 覆盖。

无任何 gate 违规；Complexity Tracking 表格留空。

## Project Structure

### Documentation (this feature)

```text
specs/005-save-agent/
├── plan.md                    # This file
├── research.md                # Phase 0 — decisions on SSR/storage/validation patterns
├── data-model.md              # Phase 1 — the SavedAgentList entity
├── quickstart.md              # Phase 1 — 5-step manual verification
├── contracts/
│   └── use-my-agents.contract.md   # Hook signature + Zod schema contract
├── checklists/
│   └── requirements.md        # Already produced by /speckit-specify
└── tasks.md                   # Produced by /speckit-tasks (not this step)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── agent/
│       └── [id]/
│           └── page.tsx       # MODIFY — only the Button at line 166 (+ one import line for <Check />)
└── lib/
    ├── hooks/
    │   └── use-my-agents.ts   # CREATE — client hook, mount-before-read, zod-validated write-through
    └── schemas/
        └── my-agents.ts       # CREATE — Zod schema + TS type export
```

**Structure Decision**: Single-project Next.js App Router. Hook goes under `src/lib/hooks/` (new subdirectory is acceptable; convention already established by `src/lib/schemas/`, and Next.js imposes no constraint). Schema goes under `src/lib/schemas/` next to the existing `agent-output.ts`.

### Files to CREATE (exactly 2)

1. **`src/lib/schemas/my-agents.ts`**
   - `export const MY_AGENTS_KEY = 'agenthub:myAgents' as const;`
   - `export const MAX_SAVED_AGENTS = 100 as const;`
   - `export const myAgentsSchema = z.array(z.string().min(1).max(64)).max(MAX_SAVED_AGENTS);`
   - `export type MyAgentIds = z.infer<typeof myAgentsSchema>;`

2. **`src/lib/hooks/use-my-agents.ts`** (`"use client"` at top of file)
   - Signature: `export function useMyAgents(): { ids: readonly string[]; has: (id: string) => boolean; toggle: (id: string) => void; isHydrated: boolean }`
   - Internals:
     - `const [ids, setIds] = useState<string[]>([])`
     - `const [isHydrated, setIsHydrated] = useState(false)`
     - `useEffect(() => { if (typeof window === 'undefined') return; try { const raw = window.localStorage.getItem(MY_AGENTS_KEY); if (raw) { const parsed = myAgentsSchema.safeParse(JSON.parse(raw)); if (parsed.success) setIds(parsed.data); } } catch { /* swallow — treat as empty */ } setIsHydrated(true); }, [])`
     - `has = useCallback((id) => ids.includes(id), [ids])`
     - `toggle = useCallback((id) => { setIds(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= MAX_SAVED_AGENTS ? prev : [...prev, id]); try { window.localStorage.setItem(MY_AGENTS_KEY, JSON.stringify(next)); return next; } catch { return prev; /* silent revert */ } }); }, [])`
   - Return shape exposes `ids` as read-only slice.

### Files to MODIFY (exactly 1)

**`src/app/agent/[id]/page.tsx`** — diff confined to:
- **One import line** (add `Check` to existing `lucide-react` import at line ~15).
- **One import line** (add `import { useMyAgents } from '@/lib/hooks/use-my-agents';`).
- **One hook call** inside the component body (e.g. just below the existing `useObject` hook).
- **The Button element at line 166** — swap `<Plus>` for conditional `<Check>`/`<Plus>`, swap label for conditional text, add `onClick={() => toggle(agent.id)}`.

Before/after of the Button (the only JSX change):

```tsx
// BEFORE (line 166)
<Button className="w-full font-medium">
  <Plus className="mr-[8px] h-[16px] w-[16px]" />
  添加到我的 Agent
</Button>

// AFTER
<Button className="w-full font-medium" onClick={() => toggle(agent.id)}>
  {isHydrated && has(agent.id) ? (
    <Check className="mr-[8px] h-[16px] w-[16px]" />
  ) : (
    <Plus className="mr-[8px] h-[16px] w-[16px]" />
  )}
  {isHydrated && has(agent.id) ? '已添加到我的 Agent ✓' : '添加到我的 Agent'}
</Button>
```

No other JSX, state, or imports in that file change.

### Files NOT to Touch (locked — ≥13 entries)

This plan treats any diff outside the three files above as a **regression**.

1. `src/app/layout.tsx`
2. `src/app/page.tsx`
3. `src/app/globals.css`
4. `src/app/gallery/**` (entire subtree)
5. `src/app/run-history/**` (entire subtree)
6. `src/app/settings/**` (entire subtree)
7. `src/app/api/**` (entire subtree — no new routes, no edits)
8. `src/components/**` (all existing shadcn/ui primitives, Card, Badge, particle-bg, etc.)
9. `src/lib/mock-data.ts`
10. `src/lib/schemas/agent-output.ts` (existing schema untouched)
11. `.specify/memory/constitution.md` (and `constitution.backup.md`)
12. `package.json`, `pnpm-lock.yaml` (no new dependencies — `react`, `zod`, `lucide-react` already present)
13. `next.config.ts`, `tsconfig.json`, `tailwind.config.*`, `.styleseed/**`

### SSR Risk Handling (mount-before-read)

Next.js 15 App Router renders the page on the server. `localStorage` does not exist there. Two defences, both required:

1. **`typeof window === 'undefined'` guard** at the top of the `useEffect` inside the hook — belt-and-braces for environments where the component is somehow invoked outside a browser (e.g., test harness).
2. **`isHydrated` flag** gating the Button's dynamic label/icon. Until `isHydrated` flips to `true` in a post-mount effect tick, the button renders the default `添加到我的 Agent` + `<Plus>` — which is **identical to what the server produced**. This guarantees `hydration === server output` on first paint, so React never emits a hydration mismatch warning.

Any variant that reads `localStorage` during render (e.g., lazy initial state `useState(() => localStorage.getItem(...))`) is **explicitly rejected** in research.md.

## Complexity Tracking

> No Constitution violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
