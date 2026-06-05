# Domain Data Schema (F-01) — Plan Brief

> Full plan: `context/changes/domain-data-schema/plan.md`

## What & Why

Land the domain data layer the entire MeridianMind dependency graph hangs off: four RLS-protected Supabase tables (`sets`, `flashcards`, `study_sessions`, append-only `study_history`) keyed to `auth.users`, plus a typed Supabase client. It's the F-01 foundation — every slice S-01…S-04 reads or writes it. No UI, no API, no study flow.

## Starting Point

Auth is live against a hosted Supabase project, but there are **no migrations**, **no domain tables**, and the Supabase client (`src/lib/supabase.ts:9`) is **untyped**. Docker isn't installed, so there's no local stack — the migration is applied and verified against the remote project.

## Desired End State

Four tables exist with per-user RLS: an account cannot see or touch another account's data through any Supabase path. Set/account deletion cascades to all dependents; bad coordinates and negative distances are rejected at the DB. `src/lib/supabase.ts` returns a `SupabaseClient<Database>` so downstream slices get typed queries.

## Key Decisions Made

| Decision                | Choice                                 | Why (1 sentence)                                                                   | Source |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Study-history shape     | Append-only attempts log               | Satisfies FR-015 _and_ Business Logic's "every past click"; most flexible for S-03 | Plan   |
| Session modeling        | Minimal `study_sessions` now           | Gives mid-session resume + summary a home without reopening a migration in S-02    | Plan   |
| Coordinates             | `double precision` + CHECK ranges      | Distance is client-side, so no spatial type; CHECK is defense-in-depth             | Plan   |
| Primary keys            | `uuid` `gen_random_uuid()`             | Non-enumerable, safe in URLs/RLS, Supabase convention                              | Plan   |
| RLS ownership           | Denormalize `user_id` everywhere       | Flat `auth.uid() = user_id` policy, avoids the subquery-in-RLS perf footgun        | Plan   |
| Deletes                 | `ON DELETE CASCADE` throughout         | Instant purge satisfies retention NFR; FR-006 becomes a one-row delete             | Plan   |
| Prioritization pre-work | Indexes only, query-time compute       | Keeps SRS scoring out of schema (a Non-Goal); ordering is S-03's job               | Plan   |
| `sets` constraints      | Minimal, no unique constraint          | Won't block legitimate re-import of a same-named syllabus                          | Plan   |
| Typed client            | Generate + wire `<Database>` now       | Delivers "types end-to-end"; makes this a real foundation                          | Plan   |
| Seed                    | Minimal `supabase/seed.sql`            | Data to inspect list query + RLS before S-01 exists                                | Plan   |
| Verification            | Remote `db push` + 2-account RLS check | Only path without Docker; real RLS fidelity                                        | Plan   |

## Scope

**In scope:** the migration (4 tables, FKs, CHECKs, indexes, RLS policies), remote apply + isolation verification, generated `database.types.ts`, typed client wiring, `seed.sql`, `typecheck`/`db` npm scripts.

**Out of scope:** API routes, CSV import, UI, quiz loop, `is_correct`/correctness threshold, prioritization scoring, soft-delete, PostGIS, Docker/local stack, sessions answers/queue table.

## Architecture / Approach

One SQL migration in dependency order (`sets` → `flashcards`/`study_sessions` → `study_history`). Ownership denormalized onto every table for flat RLS policies (`(select auth.uid()) = user_id`, `to authenticated`). All FKs cascade. Applied via `supabase db push` to the remote linked project; `supabase gen types --linked` then reads the live schema to produce `database.types.ts`, which parameterizes the client.

## Phases at a Glance

| Phase                  | What it delivers                                                   | Key risk                                                            |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1. Schema migration    | 4 tables applied to remote, RLS isolation verified with 2 accounts | `db push` is irreversible (no auto-rollback) — author carefully     |
| 2. Typed client + seed | `database.types.ts`, typed client, `seed.sql`, npm scripts         | Types must be generated _after_ the push or they'll omit the tables |

**Prerequisites:** project linked (`supabase link`) and a Supabase access token available for `db push` / `gen types --linked`.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- `db push` mutates the live project; acceptable pre-launch (no real users), but a wrong schema needs a hand-written corrective migration.
- Seeding into `auth.users` follows the documented Supabase pattern; the seed is for local/manual use, not the remote isolation test (which uses real accounts).
- No automated test framework exists, so RLS isolation is verified manually — the most security-critical check is a human step.

## Success Criteria (Summary)

- Two real accounts are mutually invisible across all four tables (RLS isolation holds).
- Migration applies cleanly; constraints reject bad coordinates/distances; set deletion cascades with no orphans.
- `npm run typecheck` and `npm run lint` pass with the typed client wired in.
