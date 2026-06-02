<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Prioritized Return Session (S-03)

- **Plan**: `context/changes/prioritized-return-session/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-02
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

5/5 paths ✓ (`prioritize.ts` correctly absent — new file), 3/3 symbols ✓, brief↔plan ✓, Progress↔Phase mechanical check ✓, no `contract-surfaces.md` (skipped).

## Findings

### F1 — "Maximum score" for never-seen items doesn't guarantee top placement

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — priorityScore contract (plan.md:77); criterion 1.4
- **Detail**: With wError=wRecency=0.5 and both terms capped at 1, the max score a _seen_ item can reach is 1.0 (maximally wrong AND stale). If never-seen also returns 1.0 it only ties, and the index tie-break could place the seen item first — contradicting Desired End State ("never-seen surface at the top") and criterion 1.4 ("ahead of _any_ seen item"). Passes casual testing; fails when a real set has a far-and-stale item.
- **Fix**: Specify never-seen returns a sentinel strictly above any achievable seen score (`Number.POSITIVE_INFINITY`); reword the :77 contract from "maximum score" to "a sentinel above any seen score".
- **Decision**: FIXED (Fix in plan — reworded :77 contract to `Number.POSITIVE_INFINITY` sentinel strictly above any seen score)

### F2 — Staleness manual verification needs DB-level seeding the plan doesn't spell out

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy step 3 (plan.md:148); criterion 2.6
- **Detail**: `study_history.created_at` is append-only with `DEFAULT now()` (migration 20260530202638:88, hardened in 20260531003200). The app offers no way to write a past timestamp, so "seed an older last_seen_at" requires a raw SQL insert. The plan presented the staleness check as app-reachable like the error check.
- **Fix**: Note in Testing Strategy step 3 that exercising the staleness term needs a direct SQL insert with a backdated `created_at`, or accept it as verified-by-reasoning over the deterministic pure function.
- **Decision**: FIXED (Fix in plan — added backdated-`created_at` SQL note + reasoning fallback to Testing Strategy step 3)
