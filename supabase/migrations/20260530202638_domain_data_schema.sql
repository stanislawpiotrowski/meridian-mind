-- Domain data schema for MeridianMind (F-01)
--
-- Defines the four tables every downstream slice (S-01..S-04) depends on:
--   sets, flashcards, study_sessions, study_history
--
-- Conventions:
--   * Every table carries user_id (denormalized) so RLS policies are a flat
--     (select auth.uid()) = user_id with no subqueries. The select() wrapper
--     is the documented per-row caching optimization for RLS in Supabase.
--   * All FKs use ON DELETE CASCADE so account- and set-deletion purge
--     dependents automatically (no soft-delete; PRD non-goal).
--   * RLS is enabled on every table with one for-all owner policy bound to
--     the `authenticated` role; `anon` gets nothing (default-deny).
--   * Coordinates and distances are constrained at the DB boundary.

-- ============================================================
-- sets
-- ============================================================
create table sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table sets enable row level security;

create policy sets_owner on sets
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- flashcards
-- ============================================================
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized for flat RLS
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create index flashcards_set_id_idx on flashcards (set_id);

alter table flashcards enable row level security;

create policy flashcards_owner on flashcards
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- study_sessions
-- ============================================================
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references sets(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index study_sessions_user_set_idx on study_sessions (user_id, set_id);

alter table study_sessions enable row level security;

create policy study_sessions_owner on study_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- study_history (append-only attempts log)
-- ============================================================
create table study_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,      -- denormalized for flat RLS
  session_id uuid not null references study_sessions(id) on delete cascade,
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  set_id uuid not null references sets(id) on delete cascade,             -- denormalized for per-set scan
  distance_km double precision not null check (distance_km >= 0),
  created_at timestamptz not null default now()
);

create index study_history_item_idx     on study_history (user_id, flashcard_id, created_at);
create index study_history_set_scan_idx on study_history (user_id, set_id, created_at);      -- FR-016 prioritization
create index study_history_session_idx  on study_history (session_id);                       -- FR-014 session summary

alter table study_history enable row level security;

create policy study_history_owner on study_history
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
