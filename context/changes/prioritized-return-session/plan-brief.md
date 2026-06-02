# Prioritized Return Session (S-03) — Plan Brief

> Full plan: `context/changes/prioritized-return-session/plan.md`

## What & Why

When a student starts a new session against a previously-studied set, the queue should auto-prioritize the items they struggled with or haven't seen in a long time — surfacing those earlier than items they've consistently nailed — with no configuration. This is the second validation milestone (US-02, FR-016) and the payoff of the per-item history S-02 began recording.

## Starting Point

S-02 and F-01 are landed. The study queue is a single server-side array built in `src/pages/study/[setId].astro:23-29` (flashcards in `created_at ASC`) and handed to the `StudySession` island. `study_history` already records `distance_km` + `created_at` per attempt with a purpose-built index (`study_history_set_scan_idx`, commented "FR-016 prioritization"). Resume is keyed by flashcard ID, not queue position — so reordering between visits is safe.

## Desired End State

On a return session, missed and stale items appear first; never-seen items top the queue; consistently-correct recently-seen items appear last. The full set still appears once each (so well-known items still recur). A first-ever session with no history reproduces S-02's insertion order exactly.

## Key Decisions Made

| Decision            | Choice                                 | Why (1 sentence)                                             | Source |
| ------------------- | -------------------------------------- | ------------------------------------------------------------ | ------ |
| Scoring formula     | Weighted blend of error + staleness    | One sortable score captures both PRD signals; tunable        | Plan   |
| Tunability          | Config object + pure documented scorer | User wants weights/formula easily swappable later            | Plan   |
| Never-seen items    | Top of queue                           | Maximally uncertain; new cards must surface                  | Plan   |
| Per-item signal     | Last attempt only                      | Matches FR-015 wording; cheapest query                       | Plan   |
| "Appear more often" | Ordering-only, full set once           | Meets all US-02 criteria; keeps ID-keyed resume intact       | Plan   |
| Staleness metric    | Wall-clock time since last seen        | Continuous; strong term so old items float up (future top-N) | Plan   |
| Normalization       | Fixed reference scales                 | Deterministic, set-independent, testable                     | Plan   |

## Scope

**In scope:** new pure `src/lib/prioritize.ts` (config + scorer + queue sort); reordering the queue in the study page from prior-session last attempts.

**Out of scope:** schema/migration, API or island changes, in-session duplicates, limited-size/top-N sessions, advanced SRS, per-set tuning UI, automated tests.

## Architecture / Approach

A dependency-free `prioritize.ts` owns the rule: a `PRIORITIZATION_CONFIG` (`wError`, `wRecency`, `errorRefKm`, `stalenessRefMs`), a pure `priorityScore(lastAttempt, now)` (each term normalized to `[0,1]`, never-seen = max), and `prioritizeQueue(flashcards, lastAttempts, now)` returning a stable descending-score sort with insertion order as tie-break. The study page queries each item's latest attempt from _prior_ sessions (excludes the current open session so order is stable across resume), builds a `Map`, and passes the prioritized array to the unchanged island.

## Phases at a Glance

| Phase                   | What it delivers                                | Key risk                                               |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| 1. Prioritization core  | Tunable config + pure scorer + queue sort       | Term normalization / tie-break correctness             |
| 2. Wire into study page | Prior-attempt query + reordered queue to island | Excluding current session so resume order stays stable |

**Prerequisites:** S-02 + F-01 (both landed).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Reference constants (`errorRefKm`, `stalenessRefMs`) are hand-picked defaults; tuning is expected after real use (the config object exists for exactly this).
- "More often" is realized across sessions via ordering, not in-session repetition — an explicit, PRD-sanctioned simplification.

## Success Criteria (Summary)

- Missed / stale / never-seen items appear earlier; consistently-correct recent items appear later — with no configuration.
- The full set still appears once each (well-known items never drop to zero recurrence).
- A no-history session is identical to S-02 (no regression); mid-session resume is unaffected.
