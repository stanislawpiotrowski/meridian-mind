# Prioritized Return Session (S-03) Implementation Plan

## Overview

When a student starts a new session against a set they have studied before, the study queue should be **auto-ordered by priority**: items they clicked with high distance error, or have not seen in a long time, appear earlier; items they have consistently nailed and seen recently appear later. No configuration, no schema change, no island change — the whole feature is a server-side reordering of the one array the study page already builds.

This satisfies FR-016 and US-02 with the simplest form the PRD permits (advanced SRS scoring is an explicit Non-Goal). The queue remains the full set, each item exactly once — which automatically satisfies the "well-known items still recur occasionally / never zero" acceptance criterion.

## Current State Analysis

S-02 (`first-study-session`) and F-01 (`domain-data-schema`) are both landed and provide everything this slice needs:

- **The queue is a single server-side array.** `src/pages/study/[setId].astro:23-29` loads flashcards in `created_at ASC` order and passes that array straight to the `StudySession` island (`:72-80`). Reordering this array _is_ the feature.
- **The prioritization inputs already exist and are indexed.** `study_history` (migration `20260530202638_domain_data_schema.sql:81-93`) records `distance_km` and `created_at` per attempt, denormalizes `set_id`, and ships a dedicated index `study_history_set_scan_idx on (user_id, set_id, created_at)` commented "FR-016 prioritization." History is append-only and immutable (hardened in `20260531003200_study_history_append_only.sql`).
- **Resume is keyed by flashcard ID, not queue position.** `StudySession.tsx:88-92` finds the resume point via a `Set` of answered flashcard IDs in the _current_ session. Reordering the queue between visits is therefore safe — provided each flashcard appears exactly once (which the chosen "ordering-only" approach preserves).
- **No test runner is configured** (`package.json`). Per the project's module boundaries, testing strategy is a Module 3 concern; automated verification here is `astro check` + `eslint`. The scorer is written as a dependency-free pure function so it is trivially unit-testable when that arrives.

## Desired End State

A student who has completed at least one session against a set, on starting a new session, sees the queue ordered so that:

- Items missed in the prior session appear before items previously answered correctly (driven by the error term).
- Items not seen for longer appear before items seen recently (driven by the staleness term).
- Never-seen items (e.g. a card added after the first session) surface at the top.
- Nothing is configured by the student.
- A student who has answered everything correctly still sees the full set (every item appears once).

**Verification:** with two completed sessions of seeded history, the queue order on the third visit matches the priority ranking; with zero history the order is identical to S-02's insertion order.

### Key Discoveries

- Queue construction is isolated to `src/pages/study/[setId].astro:23-29` — the only file Phase 2 touches besides the new lib file.
- `study_history_set_scan_idx` (migration `:92`) is purpose-built for the per-set history scan this plan issues.
- Excluding the _current open session_ from the history scan keeps the order stable across mid-session resume (the answered-this-session items won't reshuffle to the bottom while the student is still in the session).
- `DEFAULT_CORRECT_THRESHOLD_KM = 300` (`src/lib/study.ts:19`) is the natural anchor for `ERROR_REF_KM`.
- Tie-break on insertion order makes a first-ever (no-history) session reproduce S-02 behavior exactly — a clean, regression-free default.

## What We're NOT Doing

- **No literal in-session repetition / duplicates.** "Appear more often" is realized via ordering across sessions, not by enqueuing weak items multiple times in one session. (Chosen explicitly; duplicates would break ID-keyed resume.)
- **No limited-size / top-N sessions.** The queue stays the full set. The scorer is structured so a future top-N truncation is a clean one-line `.slice(0, n)` on the already-prioritized array (see Migration Notes) — but it is not built now.
- **No schema change, no migration, no new API route, no island change.** Phase 2 edits only the study page's data-loading frontmatter.
- **No advanced SRS scoring** (SM-2, SuperMemo, Leitner boxes). PRD Non-Goal.
- **No per-set tuning UI.** Weights/refs are code constants; a future per-set override is a documented seam, not built.
- **No average-over-history aggregation.** Only the last attempt per item feeds the score (matches FR-015 wording).

## Implementation Approach

A new pure module `src/lib/prioritize.ts` owns the rule: a config object of tunable constants, a documented `priorityScore()` pure function, and `prioritizeQueue()` that maps each flashcard to a score and returns a stably-sorted copy. The study page gathers each item's last prior-session attempt into a lookup map and feeds it to `prioritizeQueue()`, replacing the raw insertion-order array passed to the island. Everything downstream of the array (island, map, attempt recording, summary, resume) is untouched.

The blend mixes two units (km and elapsed time), so each term is mapped to `[0,1]` against a fixed reference before weighting — deterministic and set-independent, so ordering is predictable and the function is testable in isolation. Staleness is a strong first-class term so old items float up reliably (important for the planned future top-N truncation, where a buried stale item would otherwise never be seen).

## Critical Implementation Details

- **History scope & resume stability.** The Phase-2 query must read prior attempts _excluding the current open session_ (`.neq("session_id", sessionId)`), so the computed order does not change as the student answers cards within the active session. The current session's in-progress attempts are already loaded separately as `priorAttempts` for resume and must keep that role.
- **Last-attempt extraction.** Order the history scan by `created_at` descending and keep the first row seen per `flashcard_id` — that is the item's most recent attempt. Items with no row are "never seen."
- **`now` is injected, not read inside the scorer.** `prioritizeQueue` takes the current timestamp as a parameter so the function stays pure and deterministically testable; the page passes `new Date()`.

## Phase 1: Prioritization core (`src/lib/prioritize.ts`)

### Overview

A new dependency-free module holding the tunable config, the pure scoring function, and the queue-ordering function. No I/O, no DOM — mirrors the style of `src/lib/geo.ts` and `src/lib/study.ts`.

### Changes Required:

#### 1. Prioritization config + scorer + queue ordering

**File**: `src/lib/prioritize.ts` (new)

**Intent**: Define the priority rule in one tunable, well-documented place so the balance can be tweaked or the formula swapped later without touching the page. Compute a per-item priority and return the reordered queue.

**Contract**:

- `PRIORITIZATION_CONFIG` — an exported config object holding the four tunable constants: `wError`, `wRecency` (default to equal weight, e.g. `0.5` / `0.5`), `errorRefKm` (anchored to `DEFAULT_CORRECT_THRESHOLD_KM` from `src/lib/study.ts`), and `stalenessRefMs` (a reference horizon, e.g. a small number of days expressed in ms). Documented as the single point of change.
- `LastAttempt` type — `{ distanceKm: number; lastSeenAt: string }` (ISO timestamp), keyed externally by flashcard id.
- `priorityScore(lastAttempt: LastAttempt | undefined, now: Date, config = PRIORITIZATION_CONFIG): number` — pure function. Returns a higher-is-more-urgent score. A `undefined` lastAttempt (never seen) returns a sentinel **strictly above any achievable seen score** (use `Number.POSITIVE_INFINITY`) so a never-seen item always sorts ahead of every seen item — including one that is both maximally wrong and maximally stale (which can itself reach `wError + wRecency`). Otherwise: `errorTerm = min(distanceKm / errorRefKm, 1)`, `stalenessTerm = min((now - lastSeenAt) / stalenessRefMs, 1)`, `score = wError·errorTerm + wRecency·stalenessTerm`.
- `prioritizeQueue<T extends { id: string }>(flashcards: T[], lastAttempts: Map<string, LastAttempt>, now: Date, config?): T[]` — returns a new array sorted by descending score, with **insertion order (original array index) as the tie-break** so equal-score items (notably an all-never-seen first session) preserve `created_at ASC`. Must be a stable, non-mutating sort.

A snippet is not needed — the normalization formula is fully specified above and the rest follows existing lib patterns.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Reading the module, the four constants are at the top in `PRIORITIZATION_CONFIG` and the scoring math is isolated in `priorityScore`.
- A never-seen item (`undefined` attempt) sorts ahead of any seen item.
- Two seen items with equal scores retain their original relative order (tie-break verified by inspection / a scratch call).

**Implementation Note**: After this phase and automated verification pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Wire prioritization into the study page

### Overview

Replace the raw insertion-order queue passed to the island with the prioritized order, sourced from each item's last prior-session attempt.

### Changes Required:

#### 1. Load prior-session last attempts and reorder the queue

**File**: `src/pages/study/[setId].astro`

**Intent**: After loading the set's flashcards and ensuring the open session, fetch each item's most recent attempt from _prior_ sessions, build a `Map<flashcardId, LastAttempt>`, and pass `prioritizeQueue(flashcards, lastAttempts, new Date())` to `StudySession` instead of the insertion-order array. Leave the existing `priorAttempts` (current-session resume) load untouched.

**Contract**:

- New query against `study_history` selecting `flashcard_id, distance_km, created_at` for `eq(user_id)`, `eq(set_id)`, `neq(session_id, sessionId)`, ordered `created_at` descending. Reduce to a `Map` keeping the first (latest) row per `flashcard_id`.
- The `flashcards` value passed to `<StudySession flashcards=...>` becomes the `prioritizeQueue(...)` result. `bbox` continues to be computed from the same set of cards (order-independent — no change needed).
- The current-session `priorAttempts` query (`:41-46`) is unchanged and continues to feed resume.
- No-history case: empty map → all items score max → tie-break yields insertion order → identical to current S-02 behavior.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- With a fresh set and no prior sessions, the first session's card order matches insertion order (no regression vs S-02).
- After completing a session where specific items were clicked far from target, starting a new session shows those items earlier than items clicked accurately.
- After a set has been studied, items not touched in the most recent session (older `last_seen_at`) appear ahead of recently-seen accurate items.
- A card added to the set after the first session appears at the top of the next session's queue.
- Mid-session resume still lands on the correct next card and the queue order does not visibly reshuffle while answering within the session.

**Implementation Note**: After this phase and automated verification pass, pause for manual confirmation. This is the slice's user-visible validation milestone (US-02).

---

## Testing Strategy

No automated test runner is configured (Module 3 concern). The scorer is written pure/deterministic so it can be unit-tested later without refactoring.

### Manual Testing Steps:

1. Seed: import a small set (~5 cards), run a full session deliberately clicking 2 cards far away and 3 accurately; finish to completion.
2. Start a new session against the same set → confirm the 2 far-clicked cards appear before the 3 accurate ones.
3. Wait/seed an older `last_seen_at` for one accurate card (or run a second session touching only some cards) → confirm the longer-unseen card rises. Note: `study_history.created_at` is append-only with `DEFAULT now()`, so the app cannot write a backdated timestamp — exercising the staleness term with a controlled age requires a **direct SQL insert into `study_history` with a backdated `created_at`**. Absent that, the staleness term is verified by reasoning over the pure, deterministic `priorityScore` (the time math is local and unit-testable).
4. Add a new card to the set (re-import or DB insert) → start a session → confirm the new card is at the top.
5. Start a session, answer 2 cards, reload the tab → confirm resume lands on card 3 and order is stable.
6. Brand-new set, first session → confirm order equals insertion order (S-02 parity).

## Performance Considerations

The history scan is bounded by one user's attempts on one set (small per the PRD's `data_volume: small`) and hits the purpose-built `study_history_set_scan_idx`. Sorting is in-memory over the set's flashcards (50–300 items). Both are negligible and off the click→feedback latency path (NFR Latency is unaffected — feedback is still local math in the island).

## Migration Notes

- **No DB migration.** This slice is read-only against existing tables.
- **Future top-N (limited-size sessions) seam:** because `prioritizeQueue` returns a fully priority-ordered array, a capped session is a future `.slice(0, n)` on that array — the strong staleness term ensures old items are near the top and won't be buried by truncation. Recorded as a seam, not built (PRD Non-Goal "Configurable session length").
- **Future per-set tuning seam:** `PRIORITIZATION_CONFIG` is the single point of change; a per-set override column would be loaded by the page and passed as the `config` argument, mirroring the `correct_threshold_km` seam already noted in `src/lib/study.ts`.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-03, lines 117-128)
- PRD: FR-015, FR-016 (`context/foundation/prd.md:139-143`), US-02 (`:58-68`), Business Logic (`:154-162`)
- Queue construction to reorder: `src/pages/study/[setId].astro:23-29`
- History schema + prioritization index: `supabase/migrations/20260530202638_domain_data_schema.sql:81-93`
- ID-keyed resume (must stay intact): `src/components/study/StudySession.tsx:88-92`
- Config/seam style to mirror: `src/lib/study.ts:11-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prioritization core (`src/lib/prioritize.ts`)

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [x] 1.3 Four constants live at the top in `PRIORITIZATION_CONFIG`; scoring math isolated in `priorityScore`
- [x] 1.4 Never-seen item sorts ahead of any seen item
- [x] 1.5 Equal-score items retain original relative order (stable tie-break)

### Phase 2: Wire prioritization into the study page

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.4 No-prior-session set orders by insertion order (S-02 parity)
- [ ] 2.5 Far-clicked items from a completed session appear earlier next session
- [ ] 2.6 Longer-unseen items appear ahead of recently-seen accurate items
- [ ] 2.7 A card added after the first session appears at the top next session
- [ ] 2.8 Mid-session resume lands on the correct card; order doesn't reshuffle while answering
