/**
 * Server-side aggregation for the dashboard "what to do now" home (S-07).
 *
 * Read-only fold over data that already exists (`sets`, `flashcards`,
 * `study_sessions`, `study_history`) into a typed `DashboardData` view model.
 * All query and fold logic lives here so the `.astro` frontmatter stays a thin
 * renderer. The math (`computeStreak`, `isDue`) is pure with an injected `now`,
 * so it is deterministic and unit-testable without refactoring.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { isDue, type LastAttempt } from "@/lib/prioritize";

type TypedSupabaseClient = SupabaseClient<Database>;

/** One recent-set row rendered by the dashboard. */
export interface DashboardSet {
  id: string;
  name: string;
  cardCount: number;
  dueCount: number;
  /** ISO timestamp: latest session activity, falling back to the set's `created_at`. */
  lastActivityAt: string;
  hasOpenSession: boolean;
}

/** Everything the dashboard page renders. */
export interface DashboardData {
  sets: DashboardSet[];
  streak: number;
  /**
   * Primary-CTA target: the set to resume/start. `isResume: true` when it points
   * at an open (incomplete) session. `null` when there are no sets.
   */
  resume: { setId: string; isResume: boolean } | null;
  /** `true` when the user genuinely has no sets (distinct from `loadError`). */
  isEmpty: boolean;
  /** `true` when the sets query itself errored — show "couldn't load", not onboarding. */
  loadError: boolean;
}

/**
 * Consecutive-UTC-day run of completed sessions, walking backward from `now`.
 * Only "current" if it includes today or yesterday (a one-day grace so the streak
 * doesn't visually reset the instant a new UTC day begins); otherwise 0. Pure:
 * `now` is injected. Input timestamps are deduped to UTC calendar days internally.
 */
export function computeStreak(completedDates: string[], now: Date): number {
  const dayKey = (d: Date): number => Math.floor(d.getTime() / 86_400_000);

  const days = new Set<number>();
  for (const iso of completedDates) {
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) days.add(Math.floor(t / 86_400_000));
  }
  if (days.size === 0) return 0;

  const today = dayKey(now);
  // Anchor on today if studied today, else yesterday (grace). Older → not current.
  let cursor: number;
  if (days.has(today)) cursor = today;
  else if (days.has(today - 1)) cursor = today - 1;
  else return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/**
 * Fold the user's domain rows into the dashboard view model. Issues three bounded
 * queries scoped to one user and backed by existing indexes. Degrades softly: only
 * a failed *sets* query drives `loadError`; a failed history/sessions query is
 * treated as empty (zero due / zero streak).
 */
export async function getDashboardData(
  supabase: TypedSupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<DashboardData> {
  // Query 1: sets with their flashcard ids (for the due scan; no extra query).
  const { data: setsData, error: setsError } = await supabase
    .from("sets")
    .select("id, name, created_at, flashcards(id)")
    .eq("user_id", userId);

  if (setsError) {
    return { sets: [], streak: 0, resume: null, isEmpty: false, loadError: true };
  }

  const setRows = setsData;
  if (setRows.length === 0) {
    return { sets: [], streak: 0, resume: null, isEmpty: true, loadError: false };
  }

  // Query 2: the user's study history, newest-first. Reduce to the most-recent
  // attempt per flashcard (mirror study/[setId].astro:61-66).
  const { data: historyData } = await supabase
    .from("study_history")
    .select("flashcard_id, set_id, distance_km, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const lastAttempts = new Map<string, LastAttempt>();
  for (const row of historyData ?? []) {
    if (!lastAttempts.has(row.flashcard_id)) {
      lastAttempts.set(row.flashcard_id, { distanceKm: row.distance_km, lastSeenAt: row.created_at });
    }
  }

  // Query 3: the user's sessions, for last-activity, open-session, and streak.
  const { data: sessionsData } = await supabase
    .from("study_sessions")
    .select("set_id, started_at, completed_at")
    .eq("user_id", userId);

  const sessions = sessionsData ?? [];

  const sets: DashboardSet[] = setRows.map((set) => {
    const flashcardIds = set.flashcards.map((f) => f.id);
    const dueCount = flashcardIds.reduce((n, id) => (isDue(lastAttempts.get(id), now) ? n + 1 : n), 0);

    const setSessions = sessions.filter((s) => s.set_id === set.id);
    const hasOpenSession = setSessions.some((s) => s.completed_at == null);

    let lastActivityAt = set.created_at;
    for (const s of setSessions) {
      const stamp = s.completed_at ?? s.started_at;
      if (stamp && stamp > lastActivityAt) lastActivityAt = stamp;
    }

    return {
      id: set.id,
      name: set.name,
      cardCount: flashcardIds.length,
      dueCount,
      lastActivityAt,
      hasOpenSession,
    };
  });

  // Most-recently-active first.
  sets.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0));

  // Resume target: prefer the most-recently-active set with an open session;
  // else the most-recently-active set; else null. `sets` is already sorted.
  const openSet = sets.find((s) => s.hasOpenSession);
  const resume = openSet
    ? { setId: openSet.id, isResume: true }
    : sets.length > 0
      ? { setId: sets[0].id, isResume: false }
      : null;

  const completedDates = sessions.map((s) => s.completed_at).filter((c): c is string => c != null);
  const streak = computeStreak(completedDates, now);

  return { sets, streak, resume, isEmpty: false, loadError: false };
}
