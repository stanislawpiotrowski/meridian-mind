-- Tighten study_history policy to append-only at the DB boundary.
--
-- The original migration (20260530202638_domain_data_schema.sql) gave
-- study_history a single `for all to authenticated` policy. The plan
-- and the table comment call this an "append-only attempts log" and
-- downstream slices (FR-014 session summary, FR-016 prioritization)
-- treat it as immutable, but `for all` granted owners UPDATE and DELETE
-- too. An authenticated user could rewrite distance_km or delete
-- attempts via PostgREST. Recorded in impl-review F3.
--
-- This migration replaces the single policy with two narrower ones so
-- the only way a row disappears is cascade from sets / study_sessions.

drop policy if exists study_history_owner on study_history;

create policy study_history_insert_owner on study_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy study_history_select_owner on study_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
