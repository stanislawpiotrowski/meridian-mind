<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Domain Data Schema (F-01)

- **Plan**: context/changes/domain-data-schema/plan.md
- **Scope**: Full plan (Phases 1 & 2)
- **Date**: 2026-05-31
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings · 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Verified Independently This Turn

- `npm run typecheck` → 0 errors, 0 warnings (4 deprecation hints in `eslint.config.js` are pre-existing `tseslint.config` warnings, unrelated to F-01)
- Migration file `supabase/migrations/20260530202638_domain_data_schema.sql` matches the plan SQL block exactly — 4 tables, RLS enabled per table, flat owner policy `for all to authenticated using (select auth.uid()) = user_id with check (...)`, all 5 indexes, CHECK constraints (latitude/longitude/distance_km), ON DELETE CASCADE on every FK.
- `src/lib/supabase.ts` diff is the minimal `<Database>` parameterization the plan specified (one new import line + `<Database>` on `createServerClient`) — no behavioral change.
- `src/db/database.types.ts` exists and references all four tables (sets, flashcards, study_sessions, study_history).
- `package.json` exposes the three new scripts: `typecheck`, `db:push`, `db:types` per Phase 2 §4.
- `supabase/seed.sql` is local-only, idempotent (fixed UUIDs + `on conflict do nothing`), inserts 10 European-capital flashcards, and carries explicit "do not run against remote" warnings — matches the plan's revised Phase 2 contract.
- `src/middleware.ts` unchanged.

## Findings

### F1 — Lint baseline claim in Progress 2.3 is partially inaccurate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/domain-data-schema/plan.md:272` (Progress 2.3); `.gitignore` (missing entry); `eslint.config.js` (no ignore for worktrees)
- **Detail**: Plan progress 2.3 documents the lint adaptation as "pre-existing CRLF baseline (2064 errors on un-touched files from prior commits)". Current `npm run lint` reports 2042 errors total, of which **~1042 come from `.claude/worktrees/agent-aaa3e049d1014516c/...`** — a transient untracked worktree created during agent runs in this change, not a "prior commit" baseline. The other ~1000 are the true pre-existing CRLF baseline on real src files. F-01's own files lint clean: `npx eslint src/lib/supabase.ts` returns zero errors, and `src/db/database.types.ts` is correctly excluded via the new ignore. The honest statement is "F-01 introduced no new lint errors on the files it touched; the ~1000 CRLF baseline is pre-existing on un-touched src files; an additional ~1042 errors come from a transient `.claude/worktrees/` directory which should be gitignored." Fixing `.gitignore` brings the visible count back near the true baseline and stops every future agent worktree from polluting lint runs.
- **Fix**: Add `.claude/worktrees/` to `.gitignore`. `eslint.config.js` already calls `includeIgnoreFile(gitignorePath)`, so the new ignore propagates automatically. After this, re-run `npm run lint` and update Progress 2.3 with the corrected count.
- **Decision**: FIXED — `.claude/worktrees/` added to `.gitignore`; `npm run lint` confirmed 2042 → 1000 errors; Progress 2.3 updated.

### F2 — Unplanned `eslint.config.js` edit (justified but undocumented)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `eslint.config.js:73`
- **Detail**: Phase 2 "Changes Required" lists four files: `src/db/database.types.ts`, `src/lib/supabase.ts`, `supabase/seed.sql`, `package.json`. The implementation also added `{ ignores: ["src/db/database.types.ts"] }` to `eslint.config.js`. The change itself is sound — generated files shouldn't be linted, and without it the 295-line types file would flood lint output. But it wasn't called out in the plan's "Changes Required" nor recorded as an addendum, so a future reviewer using the plan as the contract sees an unexplained file in the diff.
- **Fix**: Add a one-line plan addendum under Phase 2 documenting the `eslint.config.js` ignore for the generated types file. (Alternative: accept silently as a trivial, self-evident scope expansion.)
- **Decision**: FIXED — Phase 2 §5 added to plan.md documenting the `eslint.config.js` ignore for the generated types file.

### F3 — `study_history` is contractually "append-only" but RLS allows update/delete

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `supabase/migrations/20260530202638_domain_data_schema.sql:97-101` (plan.md:106 calls the table "append-only attempts log")
- **Detail**: The migration comment and the plan both describe `study_history` as "append-only attempts log", and downstream slices (FR-014 session summary, FR-016 prioritization) treat it as immutable history. The implemented RLS policy is `for all to authenticated` which grants the row owner UPDATE and DELETE in addition to INSERT/SELECT. An authenticated user can therefore tamper with their own attempts via PostgREST — rewriting `distance_km`, deleting older attempts, etc. Cascade deletes from `sets`/`study_sessions` are the only intended delete path.

  The implementation matches the plan SQL block exactly, so this is a plan-level gap surfaced now that the code is in place, not implementer drift. For the PRD's no-real-users-yet stage and low-trust risk model, this may be acceptable as-is.

- **Fix**: Either accept the gap (document why "append-only" is informal, not DB-enforced), or in a follow-up change tighten the policy to separate INSERT/SELECT policies and omit UPDATE/DELETE policies, leaving only the cascade path as the way rows disappear.
- **Decision**: FIXED via Fix B — follow-up migration `supabase/migrations/20260531003200_study_history_append_only.sql` authored (drops `study_history_owner`, replaces with `study_history_insert_owner` + `study_history_select_owner`); plan.md Phase 1 has an F3 addendum. **Push pending**: `npx supabase db push` failed in this shell with HTTP 401 because `SUPABASE_DB_PASSWORD` is not set; user must run the push from an environment that has the password to complete the fix on the remote project.
