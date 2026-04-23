# Delivery Readiness Checklist: Figma Color Token Sync

**Purpose**: Requirements-quality sign-off for the 006-figma-sync delivery. Each item asks whether the written requirement is clear, complete, and objectively verifiable — not whether the code runs. Verification evidence from the implement phase is cited inline.
**Created**: 2026-04-20
**Feature**: [spec.md](../spec.md)

## Functional Requirements — Quality & Testability

- [X] CHK001 Is FR-001 specified with an exact Figma `fileKey` and the complete allowlist of 6 Color-Style names so that "missing style" can be objectively detected? [Clarity, Spec §FR-001]
- [X] CHK002 Is FR-002's "first solid RGBA paint → 6-digit hex" transformation defined precisely enough to be reproduced by any implementer? [Measurability, Spec §FR-002]
- [X] CHK003 Are the 6 target `--color-*` token names in FR-003 listed with their exact spellings so that a grep/regex can unambiguously find or miss them? [Completeness, Spec §FR-003]
- [X] CHK004 Is FR-004's drift-percent formula fully specified (including the `sqrt(3·255²)` denominator) so two independent implementers would compute the same %? [Clarity, Spec §FR-004 + Clarifications 2026-04-20]
- [X] CHK005 Are FR-005's three band boundaries `<1% / 1–3% / >3%` expressed as closed/open intervals with no overlap or gap? [Consistency, Spec §FR-005]
- [X] CHK006 Does FR-006 state which fields the drift report MUST contain (token, Figma hex, CSS hex, drift %, band), so a reviewer can judge report completeness without opening Figma? [Completeness, Spec §FR-006]
- [X] CHK007 Is FR-007's rewrite scope bounded in writing — "only the value expression of the affected `--color-*` token" — so whitespace, comments, and ordering preservation are checkable post-run? [Coverage, Spec §FR-007]
- [X] CHK008 Does FR-008 enumerate the forbidden edit zones (`@layer base`, non-color `@theme` entries) explicitly enough that a `git diff` reviewer can verify compliance? [Clarity, Spec §FR-008]
- [X] CHK009 Are FR-009's exit codes specified for each failure class so CI/operator automation can branch on them? [Measurability, Spec §FR-009 + research R-08]
- [X] CHK010 Does FR-010 name the exact branch (`evolution`) that MUST NOT be left, so the invariant is binary rather than subjective? [Clarity, Spec §FR-010]
- [X] CHK011 Does FR-011 pin the "no new npm dep" invariant to a checkable artifact (`package.json` diff = 0 lines)? [Measurability, Spec §FR-011]
- [X] CHK012 Does FR-012 delineate which phase uses MCP (planning/validation) vs which phase uses REST (the script), so a reviewer can audit the separation in the diff? [Consistency, Spec §FR-012]
- [X] CHK013 Is FR-013's "MUST NOT log the token" requirement phrased strongly enough that any `console.log(token)` call would fail review? [Clarity, Spec §FR-013]

## Success Criteria — Objective Measurability

- [X] CHK014 Is SC-001's <10s latency target stated with a network assumption ("warm connection") so the measurement is reproducible? [Measurability, Spec §SC-001]
- [X] CHK015 Does SC-002 quantify "no drift" with a concrete threshold (<1%) and token population (all 6) so it can be binary-verified from the final report? [Clarity, Spec §SC-002]
- [X] CHK016 Is SC-003's idempotence criterion framed as a testable 2-run sequence (second run exits 0, zero edits), rather than as a vague "idempotent" adjective? [Measurability, Spec §SC-003]
- [X] CHK017 Does SC-004 enumerate which fields the report must contain so a reviewer can judge the report without external context? [Completeness, Spec §SC-004]
- [X] CHK018 Is SC-005's build-pass criterion tied to a concrete command (`pnpm build`) with a pass condition (no new TS/CSS errors) rather than a generic "builds OK"? [Clarity, Spec §SC-005]

## Scope & Invariant Specification Quality

- [X] CHK019 Does the Assumptions section explicitly list each Out-of-Scope item (non-color tokens, Figma write-back, `@layer base`, other `@theme` sections, new deps, feature branch) so reviewers can spot a violation at a glance? [Completeness, Spec §Assumptions]
- [X] CHK020 Is the "Source of Truth = Figma" direction stated in one place without contradiction elsewhere? [Consistency, Spec §Summary + FR-012]
- [X] CHK021 Are the 6 edge cases (missing style / alpha<1 / gradient / missing token / missing token file / HSL rounding) enumerated with expected behavior, so no exception path is "undefined"? [Coverage, Spec §Edge Cases]

## Traceability & Sign-off Readiness

- [X] CHK022 Does every FR-xxx reference an acceptance scenario or success criterion so a reviewer can walk from requirement → test evidence without guessing? [Traceability]
- [X] CHK023 Is the "6-row drift report" artifact durable (persisted in tasks.md T015/T017 stdout captures or the operator's final report) so delivery evidence survives this session? [Traceability, Gap]
- [X] CHK024 Is the distinction between "plan-phase MCP call" and "script-runtime REST call" preserved in written artifacts (research R-06, contracts/figma-rest.md) so future maintainers don't accidentally couple them? [Consistency, Research §R-06]

## Notes

All 24 items pass (marked `[X]`). Concrete evidence from implement phase:

- **Drift report (first run, exit 2)** — rewrote `--color-primary-default` and `--color-status-success`.
- **Second run (exit 0)** — 0 MUST-FIX, idempotence holds.
- **`git diff -- src/app/globals.css`** — exactly 2 token-value lines changed (bounded by FR-007/FR-008).
- **`git diff -- package.json`** — no output (FR-011 invariant holds).
- **`git branch --show-current`** — `evolution` (FR-010 invariant holds).
- **`pnpm build`** — Compiled successfully in 4.9s, 0 new errors (SC-005).

CHK023 was the only item with a small gap risk (if tasks.md line-level captures drift later); the operator's final ≤800-word report will persist the run logs outside the SDK session. Confirmed acceptable.

No blocking issues. Delivery passes the quality gate.
