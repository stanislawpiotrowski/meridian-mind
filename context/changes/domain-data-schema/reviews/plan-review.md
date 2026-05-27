<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Domain Data Schema (F-01)

- **Plan**: context/changes/domain-data-schema/plan.md
- **Mode**: Deep
- **Date**: 2026-05-28
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension             | Verdict            |
| --------------------- | ------------------ |
| End-State Alignment   | PASS               |
| Lean Execution        | PASS               |
| Architectural Fitness | PASS               |
| Blind Spots           | FAIL → resolved    |
| Plan Completeness     | WARNING → resolved |

## Grounding

4/4 existing paths ✓ (package.json, src/lib/supabase.ts, src/middleware.ts, supabase/config.toml), 3/3 new paths correctly absent, tsconfig `@/*`→`./src/*` ✓, Progress↔Phase mechanical check ✓, brief↔plan ✓. No contract-surfaces.md registry (skipped).

## Findings

### F1 — RLS isolation test as written bypasses RLS

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 Manual Verification 1.5; Testing Strategy step 3
- **Detail**: Verifying isolation via the Supabase SQL editor runs as the postgres/owner role, which bypasses RLS — returns all rows regardless of policy, giving a false PASS on the core data-isolation NFR. RLS only engages through PostgREST/supabase-js with a real user JWT (authenticated role).
- **Fix A ⭐ Recommended**: Verify through authenticated supabase-js / REST sessions using each user's token.
  - Strength: Exercises the authenticated role and real policies — the only way a broken policy surfaces. Reuses live auth in src/pages/api/auth/\*.
  - Tradeoff: Must obtain each user's access token and run two small client/curl queries.
  - Confidence: HIGH — standard Supabase RLS testing.
  - Blind spot: None significant.
- **Fix B**: Temporary throwaway authenticated page/route that lists own rows.
  - Strength: Tests the real app stack end-to-end.
  - Tradeoff: Adds scratch code to remove.
  - Confidence: HIGH.
  - Blind spot: Remember to delete the scratch route before commit.
- **Decision**: FIXED via Fix A (rewrote Phase 1 manual 1.5, Testing step 3, Progress 1.5 to mandate authenticated-client verification and explicitly forbid the SQL editor).

### F2 — Plan never confirms the app uses the anon key (not service_role)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 1 success criteria
- **Detail**: Isolation depends on the app connecting with the anon/publishable key so requests run as `authenticated` and RLS applies. If `SUPABASE_KEY` (src/lib/supabase.ts) is the service_role key, RLS is bypassed app-wide and isolation is silently broken. The plan defines policies but never verifies the key class.
- **Fix**: Add a Phase 1 manual criterion confirming the wired SUPABASE_KEY's JWT `role` claim is `anon`, not `service_role`.
  - Strength: Closes the second path by which RLS could be a no-op.
  - Tradeoff: None — confirmation step.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (added Phase 1 manual bullet + Progress 1.9).

### F3 — Seed verification (2.6) isn't executable in this environment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Manual Verification 2.6; seed.sql contract
- **Detail**: Criterion 2.6 can't run as stated — seed.sql auto-runs only on `supabase db reset` (needs Docker, absent), and it inserts a synthetic auth.users row, so running against remote pollutes live auth.
- **Fix**: Re-scope 2.6 to parse-only now; defer functional exercise to a local stack once Docker exists; explicitly forbid running the seed against remote.
  - Strength: Makes the criterion executable; prevents polluting live auth.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (re-scoped Phase 2 manual 2.6, seed.sql contract note, Progress 2.6).
