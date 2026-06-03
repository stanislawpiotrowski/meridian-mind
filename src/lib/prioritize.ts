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
export interface PrioritizationConfig {
  wError: number;
  wRecency: number;
  errorRefKm: number;
  stalenessRefMs: number;
}

export const PRIORITIZATION_CONFIG: PrioritizationConfig = Object.freeze({
  wError: 0.5,
  wRecency: 0.5,
  errorRefKm: DEFAULT_CORRECT_THRESHOLD_KM,
  stalenessRefMs: 3 * 24 * 60 * 60 * 1000, // 3 days
});

/**
 * Cutoff above which a *seen* item counts as **due** (= "to review"). Set to the
 * contribution of a single dominant term — `min(wError, wRecency)` (≈ 0.5 with
 * the shipped config) — so an item that is either fully stale OR fully missed
 * qualifies, while a recently-and-accurately-answered item (both terms low) does
 * not. Note: staleness alone qualifies a card as "to review" (the staleness term
 * reaches `wRecency` after `stalenessRefMs` regardless of accuracy). That is
 * intended — the badge counts items *to review*, not "weak items only". A single
 * threshold cannot separate "merely stale" from "freshly missed"; both sit near
 * 0.5, and that is by design. Single point of change for tuning this cutoff.
 */
export const DUE_SCORE_THRESHOLD = Math.min(PRIORITIZATION_CONFIG.wError, PRIORITIZATION_CONFIG.wRecency);

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
 * Is this item due (= "to review")? Pure predicate over `priorityScore`, so the
 * dashboard's notion of urgency and the study queue's ordering share one rule and
 * can never drift. A never-seen item (`priorityScore` → `+Infinity`) is always
 * due; a seen item is due once its score crosses `DUE_SCORE_THRESHOLD`.
 */
export function isDue(
  lastAttempt: LastAttempt | undefined,
  now: Date,
  config: PrioritizationConfig = PRIORITIZATION_CONFIG,
): boolean {
  return priorityScore(lastAttempt, now, config) >= DUE_SCORE_THRESHOLD;
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

  // Descending score, insertion index as tie-break. Two never-seen items both
  // score +Infinity, so `b.score - a.score` is NaN — being falsy, it correctly
  // falls through to the index tie-break. Keep both terms: do not "simplify".
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return scored.map((entry) => entry.flashcard);
}
