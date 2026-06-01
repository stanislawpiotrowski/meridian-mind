<!-- PLAN-REVIEW-REPORT -->

# Plan Review: First Full Study Session (S-02)

- **Plan**: `context/changes/first-study-session/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict      |
| --------------------- | ------------ |
| End-State Alignment   | PASS         |
| Lean Execution        | WARNING (F1) |
| Architectural Fitness | WARNING (F1) |
| Blind Spots           | WARNING (F2) |
| Plan Completeness     | WARNING (F3) |

## Grounding

6/6 paths ✓, scripts (typecheck/lint/build) ✓, SSR+Cloudflare+astro:env ✓, brief↔plan ✓, Progress↔Phase mechanical contract ✓. No contract-surfaces.md / lessons.md (skipped).

## Findings

### F1 — Session-creation locus unresolved; start/resume endpoint may be dead or duplicated

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness / Lean Execution
- **Location**: Phase 1 #2 ↔ Phase 2 #1 (line 139)
- **Detail**: The page contract said it would get the session "either by calling the endpoint server-side or replicating the open-session query" — two architectures shipped with both doors open. If the page replicates+inserts, the POST endpoint is dead and session creation becomes a GET side effect; if it self-fetches, that's an Astro SSR self-fetch; if the island POSTs on mount, the sessionId prop contract changes.
- **Fix A ⭐ Recommended**: Extract a shared `ensureOpenSession()` server-side helper; page calls it; drop the POST /sessions endpoint (3→2 endpoints).
  - Strength: One source of truth for create-or-resume; no SSR self-fetch; consistent with the established server-load pattern; leaner.
  - Tradeoff: Session row created during a GET page load (idempotent insert) — acceptable for this app.
  - Confidence: HIGH — server-load pattern already established; the endpoint's only caller would be the page anyway.
  - Blind spot: Idempotency under concurrent loads — see F2.
- **Fix B**: Keep 3 endpoints; island calls POST /sessions on mount, page loads only cards.
  - Strength: No write-on-GET; clean REST lifecycle.
  - Tradeoff: Island gains an async loading state; priorAttempts load needs sessionId first.
  - Confidence: MED — more moving parts.
  - Blind spot: Resume rehydration timing.
- **Decision**: FIXED via Fix A — added `src/lib/studySession.ts` `ensureOpenSession()`; dropped `POST /api/study/sessions`; page calls helper server-side. Updated Overview/Approach, Phase 1 #2, Phase 2 #1, SC 1.4, brief (API surface, scope, phase risk).

### F2 — No guarantee against duplicate open sessions (idempotency best-effort)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 #2
- **Detail**: create-or-resume is read-then-insert with no DB uniqueness constraint; two simultaneous loads could both insert two open sessions, making resume ambiguous. Low probability for a single student, but the brief named idempotency the #1 phase risk.
- **Fix**: Accept the race for MVP and read the most-recent open session deterministically (`order by started_at desc limit 1`); record a partial unique index `study_sessions (user_id, set_id) where completed_at is null` as a post-MVP seam.
- **Decision**: FIXED — stance written into the `ensureOpenSession` contract (F2 stance note) and Migration Notes; index documented as a seam, not built.

### F3 — Marker contract contradicts the active-recall reveal rule

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #2 (line 149)
- **Detail**: Contract said "markers=[guess?, target]" but also "target NOT shown while awaiting-click". InteractiveMap renders every marker handed to it, so passing target early leaks the answer (violates FR-009).
- **Fix**: Restate markers as phase-derived — `[]`/`[guess]` while awaiting-click, `[guess, target]` only when revealed.
- **Decision**: FIXED — Phase 2 #2 contract reworded to phase-derived markers; removed the redundant trailing sentence.
