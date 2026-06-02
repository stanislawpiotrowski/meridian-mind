/**
 * Priority ordering for a returning study session (S-03, FR-016).
 *
 * When a student restarts a set they've studied before, the queue is reordered
 * so weak items (clicked far from target) and stale items (not seen for a while)
 * surface earlier. Pure number/time math — no I/O, no DOM — mirroring the
 * dependency-free style of `src/lib/geo.ts` and `src/lib/study.ts`.
 *
 * This is deliberately the simplest rule that satisfies FR-016. Advanced SRS
 * scoring (SM-2, Leitner) is an explicit PRD Non-Goal.
 */

import { DEFAULT_CORRECT_THRESHOLD_KM } from "@/lib/study";

/**
 * The single point of change for the priority rule. A future per-set override
 * would load these from a column and pass them as the `config` argument,
 * mirroring the `correct_threshold_km` seam noted in `src/lib/study.ts`.
 *
 * - `wError` / `wRecency`: weights blending the two normalized terms. Equal by
 *   default so error and staleness contribute symmetrically.
 * - `errorRefKm`: distance at which the error term saturates to 1. Anchored to
 *   the correct-answer threshold so "wrong by a full threshold or more" is
 *   treated as maximally wrong.
 * - `stalenessRefMs`: elapsed-time horizon at which the staleness term saturates
 *   to 1. A small number of days so items unseen for a few days float fully up.
 */
export const PRIORITIZATION_CONFIG = {
  wError: 0.5,
  wRecency: 0.5,
  errorRefKm: DEFAULT_CORRECT_THRESHOLD_KM,
  stalenessRefMs: 3 * 24 * 60 * 60 * 1000, // 3 days
};

export type PrioritizationConfig = typeof PRIORITIZATION_CONFIG;

/** The most recent prior-session attempt for one flashcard, keyed externally by id. */
export interface LastAttempt {
  distanceKm: number;
  /** ISO timestamp of the attempt (`study_history.created_at`). */
  lastSeenAt: string;
}

/**
 * Higher-is-more-urgent priority for one item. Pure: `now` is injected, never
 * read from the clock here, so the function is deterministically testable.
 *
 * A never-seen item (`undefined` attempt) returns `+Infinity` — strictly above
 * any achievable seen score (which tops out at `wError + wRecency`) — so a card
 * added after the first session always sorts ahead of every seen item.
 *
 * For a seen item each term is normalized to `[0,1]` against a fixed reference
 * before weighting, so the blend of kilometers and elapsed time is unit-free
 * and set-independent.
 */
export function priorityScore(
  lastAttempt: LastAttempt | undefined,
  now: Date,
  config: PrioritizationConfig = PRIORITIZATION_CONFIG,
): number {
  if (!lastAttempt) return Number.POSITIVE_INFINITY;

  const errorTerm = Math.min(lastAttempt.distanceKm / config.errorRefKm, 1);
  const elapsedMs = now.getTime() - new Date(lastAttempt.lastSeenAt).getTime();
  const stalenessTerm = Math.min(Math.max(elapsedMs, 0) / config.stalenessRefMs, 1);

  return config.wError * errorTerm + config.wRecency * stalenessTerm;
}

/**
 * Return a new array of `flashcards` sorted by descending priority. Original
 * array index is the tie-break, so equal-score items (notably an all-never-seen
 * first session) preserve their incoming `created_at ASC` order. Non-mutating;
 * the input array is left untouched.
 */
export function prioritizeQueue<T extends { id: string }>(
  flashcards: T[],
  lastAttempts: Map<string, LastAttempt>,
  now: Date,
  config: PrioritizationConfig = PRIORITIZATION_CONFIG,
): T[] {
  const scored = flashcards.map((flashcard, index) => ({
    flashcard,
    index,
    score: priorityScore(lastAttempts.get(flashcard.id), now, config),
  }));

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return scored.map((entry) => entry.flashcard);
}
