/**
 * Server-side create-or-resume for a study session. One canonical place to get
 * the open session for a `(user, set)` so entry to `/study/[setId]` always
 * lands on a single session. Called server-side by the study page — never over
 * HTTP — so there is no SSR self-fetch and no duplicated query.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Return the id of the open `study_sessions` row for `(userId, setId)`,
 * creating one if none exists. RLS scopes all access to the owner, so a
 * foreign/missing set simply yields no rows (and the page redirects).
 *
 * F2 stance (duplicate open sessions): create-or-resume is a read-then-insert
 * with no DB uniqueness guarantee. For the single-student MVP we consciously
 * accept the race and resolve reads deterministically by taking the
 * most-recent open session. A partial unique index is recorded as a post-MVP
 * seam in the plan's Migration Notes, not built now.
 *
 * Returns `null` only when the open-session lookup errors and no row could be
 * created — the caller treats that as "cannot start a session".
 */
export async function ensureOpenSession(
  supabase: TypedSupabaseClient,
  userId: string,
  setId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("study_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("set_id", setId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("study_sessions")
    .insert({ user_id: userId, set_id: setId })
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return created.id;
}
