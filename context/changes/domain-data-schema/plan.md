# Domain Data Schema (F-01) Implementation Plan

## Overview

Land the domain data layer the entire MeridianMind dependency graph hangs off: a single Supabase migration creating four row-level-security-protected tables — `sets`, `flashcards`, `study_sessions`, and an append-only `study_history` — all keyed to `auth.users` with cascade deletes, plus a typed Supabase client and a seed file. This is a pure data foundation: no API routes, no UI, no study flow (those arrive in S-01/S-02). Its job is to make per-user-isolated, type-safe persistence available to every slice that follows.

## Current State Analysis

- **No migrations exist.** `supabase/config.toml` is present (Postgres 17, `[db.migrations] enabled = true`, `[db.seed] sql_paths = ["./seed.sql"]`) but there is no `supabase/migrations/` directory. F-01 writes the _first_ migration and thereby sets the convention for S-01…S-04. The `supabase` CLI is available (v2.98.2, also a devDependency).
- **The Supabase client is untyped.** `src/lib/supabase.ts:9` calls `createServerClient(SUPABASE_URL, SUPABASE_KEY, …)` with no `<Database>` type parameter; no `database.types.ts` exists anywhere in the repo.
- **Auth is live.** Email+password signup/signin run against a hosted Supabase project (`src/pages/api/auth/*`, `src/middleware.ts`). `auth.users` exists and is the FK target for every domain table. The hosted project is therefore reachable and already wired via `SUPABASE_URL`/`SUPABASE_KEY` (`astro:env/server`).
- **No local stack.** Docker is not installed, so `supabase start` / `supabase db reset` are unavailable. The migration is applied and verified against the **remote** linked project.
- **No test framework, no typecheck script.** `package.json` scripts are only `dev`/`build`/`lint`/`format`. `@astrojs/check` is installed, so `astro check` is the typecheck command (to be wired as an npm script in Phase 2).
- **Path alias `@/*` → `src/*`** is in use (auth route imports `@/lib/supabase`), so generated types can be imported as `@/db/database.types`.

## Desired End State

After this plan:

1. Four tables exist in the hosted Supabase `public` schema, each with RLS enabled and a policy restricting all access to rows the authenticated caller owns.
2. A user signed in as account A cannot read, update, or delete any row belonging to account B through any Supabase-backed path.
3. Deleting a `sets` row (or an `auth.users` account) cascades to all dependent flashcards, sessions, and history.
4. Out-of-range coordinates and negative distances are rejected at the database boundary.
5. `src/lib/supabase.ts` returns a `SupabaseClient<Database>`, and `src/db/database.types.ts` reflects the live schema, so S-01…S-04 get typed queries.
6. `npm run typecheck` and `npm run lint` pass; a committed `supabase/seed.sql` can populate one example set for local inspection.

Verification: the migration applies cleanly via `supabase db push`; the two-account isolation test returns zero cross-user rows; typecheck and lint are green.

### Key Discoveries:

- `src/lib/supabase.ts:9` — `createServerClient` is called without a `<Database>` generic; this is the single wiring point to type.
- `supabase/config.toml:53-65` — migrations and seed are already enabled; seed path is `./seed.sql` relative to `supabase/`.
- `src/middleware.ts:11` — `supabase.auth.getUser()` already establishes the authenticated identity whose `auth.uid()` the RLS policies key on.
- `context/foundation/infrastructure.md:86` — Supabase migrations do **not** auto-rollback on a Workers rollback; schema reverts are manual. This makes the migration the one hard-to-reverse step.

## What We're NOT Doing

- No API routes, server endpoints, or store/repository helper functions (S-01+).
- No CSV parsing, import UI, set list UI, or quiz loop (S-01/S-02).
- No `is_correct` column or correctness threshold — distance is the durable signal; correctness is S-02's interpretation.
- No prioritization scoring, Leitner box, or priority columns — indexes only; ordering logic is S-03 (advanced SRS is a PRD Non-Goal).
- No denormalized `item_count`, no uniqueness constraints on set or flashcard names.
- No soft-delete / undo (PRD Non-Goal) — hard cascade only.
- No PostGIS / spatial types — haversine is client-side (F-02).
- No Docker / local Supabase stack setup.
- No edit-flashcard, password-reset, or session-answers/queue table (deferred per roadmap; resume derives from the attempts log).

## Implementation Approach

A single SQL migration defines all four tables, their constraints, indexes, and RLS policies in dependency order (`sets` → `flashcards`/`study_sessions` → `study_history`). Ownership is denormalized: every table carries `user_id` so RLS policies are a flat `(select auth.uid()) = user_id` with no subqueries (the Supabase-recommended pattern; the `select` wrapper is the documented per-row caching optimization). All FKs use `ON DELETE CASCADE` so account- and set-deletion purge dependents automatically.

Because there is no local stack, the migration is applied to the remote linked project with `supabase db push`, after which `supabase gen types typescript --linked` reads the live schema to produce `src/db/database.types.ts`. The client is then parameterized with that `Database` type. RLS isolation — the security-critical invariant — is verified manually with two real accounts.

## Critical Implementation Details

- **Apply before generating types.** `supabase gen types --linked` reads the _remote_ schema. The migration must be pushed (Phase 1) before type generation (Phase 2), or the generated file will omit the new tables.
- **Migrations are the one irreversible step.** `supabase db push` mutates the live project and does not auto-rollback (`infrastructure.md:86`). Acceptable pre-launch (no real users), but a reverting migration must be hand-written if the schema is wrong. Author carefully; verify the SQL before pushing.
- **RLS default-deny.** Enabling RLS with no policy blocks all access. Each table needs an explicit policy targeting the `authenticated` role; the `anon` role gets nothing.

## Phase 1: Schema migration — authored, applied & isolation-verified

### Overview

Author the first migration with all four tables, constraints, indexes, and RLS policies; apply it to the linked remote project; verify the schema exists, constraints bite, cascades work, and two accounts are mutually isolated.

### Changes Required:

#### 1. Domain schema migration

**File**: `supabase/migrations/<timestamp>_domain_data_schema.sql` (create via `supabase migration new domain_data_schema`)

**Intent**: Define the complete domain data layer in dependency order with per-user RLS and cascade deletes. This DDL is the contract S-01…S-04 build against, so column names and types are load-bearing.

**Contract**: Four tables, all with `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, RLS enabled, and a `for all` policy `to authenticated` using `(select auth.uid()) = user_id` for both `using` and `with check`.

```sql
-- sets
create table sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- flashcards
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized for flat RLS
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

-- study_sessions
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references sets(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- study_history (append-only attempts log)
create table study_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,      -- denormalized for flat RLS
  session_id uuid not null references study_sessions(id) on delete cascade,
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  set_id uuid not null references sets(id) on delete cascade,             -- denormalized for per-set scan
  distance_km double precision not null check (distance_km >= 0),
  created_at timestamptz not null default now()
);

-- indexes
create index flashcards_set_id_idx        on flashcards (set_id);
create index study_sessions_user_set_idx  on study_sessions (user_id, set_id);
create index study_history_item_idx       on study_history (user_id, flashcard_id, created_at);
create index study_history_set_scan_idx   on study_history (user_id, set_id, created_at); -- FR-016 prioritization
create index study_history_session_idx    on study_history (session_id);                 -- FR-014 session summary

-- RLS: enable + one flat owner policy per table (repeat for each table)
alter table sets enable row level security;
create policy sets_owner on sets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- … identical owner policy on flashcards, study_sessions, study_history …
```

### Success Criteria:

#### Automated Verification:

- Migration file exists: `ls supabase/migrations/*_domain_data_schema.sql`
- Migration applies cleanly: `npx supabase db push` (exit 0)
- Migration is recorded as applied: `npx supabase migration list --linked` shows the new entry
- All four tables report `rowsecurity = true` (SQL: `select relname, relrowsecurity from pg_class where relname in ('sets','flashcards','study_sessions','study_history')`)

#### Manual Verification:

- Two-account isolation: signed in as account A, create a set + flashcard; signed in as account B, a `select` over each table returns zero of A's rows, and update/delete of A's rows affects nothing
- CHECK constraints reject `latitude = 200`, `longitude = -500`, and `distance_km = -1` on direct insert
- Cascade: deleting a `sets` row removes its flashcards, sessions, and history; no orphans remain
- RLS default-deny confirmed: the `anon` role can read no rows from any table

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation that the isolation, constraint, and cascade checks succeeded before proceeding to Phase 2 (which reads the applied schema to generate types).

---

## Phase 2: Typed client, seed & dev ergonomics

### Overview

Generate TypeScript types from the now-applied schema, parameterize the Supabase client so downstream slices get typed queries, commit a seed file for local inspection, and add the npm scripts the project is missing.

### Changes Required:

#### 1. Generated database types

**File**: `src/db/database.types.ts` (new)

**Intent**: Capture the live schema as a `Database` type so all Supabase queries are typed end-to-end.

**Contract**: Generated by `npx supabase gen types typescript --linked > src/db/database.types.ts`; exports a `Database` interface with the four `public` tables. Not hand-edited; regenerated whenever the schema changes.

#### 2. Typed Supabase client

**File**: `src/lib/supabase.ts`

**Intent**: Parameterize the client with the generated `Database` type so callers get typed table access.

**Contract**: `createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, …)`, importing `Database` from `@/db/database.types`. Return type becomes `SupabaseClient<Database> | null`. No behavioral change.

#### 3. Seed file

**File**: `supabase/seed.sql` (new)

**Intent**: Provide one example set (~10 flashcards) for local inspection of the list query and RLS once a local stack exists; runnable manually against any environment.

**Contract**: Inserts a deterministic test user into `auth.users` (fixed UUID, following the documented Supabase auth-user seed pattern), then one `sets` row and ~10 `flashcards` owned by it. Idempotent (guard with fixed UUIDs / `on conflict do nothing`). For-local-use; remote verification in Phase 1 uses real accounts, not this seed.

#### 4. npm scripts

**File**: `package.json`

**Intent**: Add the missing typecheck command and convenience scripts for the migration workflow this change introduces.

**Contract**: `"typecheck": "astro check"`, `"db:push": "supabase db push"`, `"db:types": "supabase gen types typescript --linked > src/db/database.types.ts"`.

### Success Criteria:

#### Automated Verification:

- Types file exists and references all four tables: `ls src/db/database.types.ts` and it contains `sets`, `flashcards`, `study_sessions`, `study_history`
- Typecheck passes: `npm run typecheck`
- Lint passes: `npm run lint`
- Seed file exists: `ls supabase/seed.sql`

#### Manual Verification:

- Autocomplete/type errors behave correctly: a throwaway `supabase.from('flashcards').select('latitude')` type-checks and a bogus column name is flagged by the editor
- Seed, when run against a local/remote DB, produces one set with ~10 flashcards visible to its owner

**Implementation Note**: After Phase 2 automated verification passes, pause for manual confirmation before considering F-01 complete.

---

## Testing Strategy

### Unit Tests:

- None. No test framework is installed and this is a schema/wiring change with no application logic to unit-test. Correctness is enforced by DB constraints + RLS, verified directly.

### Integration Tests:

- The two-account RLS isolation check (Phase 1 manual) is the integration test that matters — it exercises the security invariant end-to-end against the real database.

### Manual Testing Steps:

1. Apply the migration: `npx supabase db push`; confirm exit 0 and `migration list --linked` shows it.
2. In the Supabase SQL editor, confirm all four tables exist with `rowsecurity = true`.
3. Create accounts A and B via the live signup flow. As A, insert a set + flashcard (via SQL editor using A's `auth.uid()`, or an authenticated client). As B, confirm `select` over each table returns none of A's rows.
4. Attempt inserts with `latitude = 200` / `longitude = -500` / `distance_km = -1`; confirm each is rejected.
5. Delete A's set; confirm its flashcards, sessions, and history are gone.
6. Generate types, wire the client, run `npm run typecheck` and `npm run lint`.

## Performance Considerations

At PRD scale (`data_volume: small`, `qps: low`, 1–3 sets of 50–300 items) the indexes are more than sufficient. The `(select auth.uid())` wrapper in policies caches the auth lookup per statement rather than per row — the documented Supabase RLS perf pattern. The FR-016 prioritization query is served by `study_history_set_scan_idx` without a join, since `set_id` is denormalized onto the attempts log.

## Migration Notes

- `supabase db push` is the one hard-to-reverse step and does not auto-rollback (`infrastructure.md:86`). If the schema is wrong after push, author a corrective migration — do not expect a Workers rollback to revert it.
- Ensure the project is linked (`supabase link`) and a Supabase access token is available before Phase 1.

## References

- Roadmap item: `context/foundation/roadmap.md` — F-01 (domain-data-schema)
- PRD: `context/foundation/prd.md` — FR-004, FR-005, FR-015, FR-016, Business Logic, Access Control, NFRs (Data-isolation, Persistence-reliability, retention)
- Infra constraints: `context/foundation/infrastructure.md:86` (migration rollback), `:78` (Workers secrets at build vs runtime)
- Client wiring point: `src/lib/supabase.ts:9`
- Auth identity source: `src/middleware.ts:11`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema migration — authored, applied & isolation-verified

#### Automated

- [ ] 1.1 Migration file exists at `supabase/migrations/*_domain_data_schema.sql`
- [ ] 1.2 Migration applies cleanly via `npx supabase db push`
- [ ] 1.3 Migration recorded as applied in `npx supabase migration list --linked`
- [ ] 1.4 All four tables report `rowsecurity = true`

#### Manual

- [ ] 1.5 Two-account isolation: account B sees/affects none of account A's rows across all tables
- [ ] 1.6 CHECK constraints reject out-of-range latitude/longitude and negative distance
- [ ] 1.7 Deleting a set cascades to its flashcards, sessions, and history with no orphans
- [ ] 1.8 `anon` role can read no rows (RLS default-deny)

### Phase 2: Typed client, seed & dev ergonomics

#### Automated

- [ ] 2.1 `src/db/database.types.ts` exists and references all four tables
- [ ] 2.2 Typecheck passes: `npm run typecheck`
- [ ] 2.3 Lint passes: `npm run lint`
- [ ] 2.4 Seed file exists at `supabase/seed.sql`

#### Manual

- [ ] 2.5 A typed query type-checks and a bogus column name is flagged by the editor
- [ ] 2.6 Seed produces one set with ~10 flashcards visible to its owner
