<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Dashboard as Home (S-07)

- **Plan**: context/changes/dashboard-home/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: SOUND (→ all findings triaged & fixed)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

7/7 paths ✓, prioritize.ts symbols ✓ (`priorityScore`/`PRIORITIZATION_CONFIG`/`LastAttempt`), brief↔plan ✓, Progress↔Phase ✓, contract-surfaces.md absent (skipped).

## Findings

### F1 — "Due" threshold can't separate stale-but-known from weak

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 1 #1 (DUE_SCORE_THRESHOLD)
- **Detail**: With the shipped config (`wRecency 0.5`, `stalenessRefMs 3 days`), staleness alone saturates to 0.5 after 3 days regardless of accuracy; max seen score is 1.0. No single threshold admits "weak" while excluding "merely stale" — both sit near 0.5 — so the per-set badge reads "all due" within days. Plan deferred the threshold without acknowledging the score geometry makes the badge non-selective.
- **Fix A ⭐ Recommended**: Adopt explicit "to review" semantics (never-seen OR not-reviewed-recently OR last-wrong), `DUE_SCORE_THRESHOLD ≈ min(wError,wRecency)`, badge labelled "to review", document staleness-qualifies as intended.
- **Fix B**: Due = never-seen OR error-only (ignore staleness); badge stays selective but diverges from queue order (reintroduces a second rule).
- **Decision**: FIXED via Fix A — updated Critical Implementation Details (score geometry made explicit + "to review" framing), Phase 1 #1 threshold contract (`≈ min(wError,wRecency)`, comment notes staleness qualifies), Phase 2 badge label ("N to review", not "weak"/"due").

### F2 — Desired End State promises a "card count" the data model omits

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State (line 27) vs DashboardSet type
- **Detail**: Desired End State says each row shows "its card count or last-activity hint" but `DashboardSet` had no count field and Phase 2 rendered only name + badge. Query already pulls `flashcards(id)`.
- **Fix**: Add `cardCount` to DashboardSet (from `flashcards(id).length`) and render it.
- **Decision**: FIXED — added `cardCount` to `DashboardSet` (derived, no extra query) and to the Phase 2 row render.

### F3 — Query-failure degrades to the onboarding "no sets" state

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 #2 — getDashboardData ("treat as empty, no throw")
- **Detail**: "On a null/failed query, treat as empty" means a transient sets-query failure shows the onboarding "add a set" card to a user who has sets, hiding their work.
- **Fix**: Distinguish "no sets" from "sets query failed"; on sets-query error render a neutral "couldn't load" message.
- **Decision**: FIXED — added `loadError` to `DashboardData` (driven only by the sets query), refined `isEmpty` to exclude error, and added a neutral "couldn't load" branch to the Phase 2 render.
