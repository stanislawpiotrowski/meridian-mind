# First Full Study Session (S-02) — Plan Brief

> Full plan: `context/changes/first-study-session/plan.md`

## What & Why

Build the spatial-click quiz loop end-to-end — the product's north star (US-01). A student picks an imported set, answers one object at a time by clicking a blank map, gets instant distance + correct/incorrect feedback with the correct location revealed, advances through the whole set, and reaches a summary. This is the validation milestone: it exercises the novel mechanic (spaced-repetition + spatial-click + bring-your-own-CSV) end-to-end for the first time.

## Starting Point

All three prerequisites are already built: the F-01 schema (`sets`, `flashcards`, `study_sessions`, append-only `study_history`), the F-02 `InteractiveMap` island (click capture, markers, bbox framing, connector + km label), and the `haversine` distance util. `src/pages/sets/index.astro` already links each set to `/study/<setId>` — a route that doesn't exist yet. This slice builds that route and the loop behind it; it writes no migrations.

## Desired End State

`/study/<setId>` runs the full quiz: name → map click (locked on first click) → instant feedback → acknowledge → next, exactly once per card, ending in a summary (items answered, accuracy %, most-missed). Closing the tab and returning — even on another device — resumes at the next unanswered card with prior answers intact.

## Key Decisions Made

| Decision                | Choice                                                              | Why                                                                                                         | Source      |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- |
| Mid-session persistence | Server-recorded attempts (resume from DB)                           | Single source of truth; honors the cross-device guardrail; reuses append-only `study_history`               | Plan        |
| API surface             | 2 endpoints (attempt, complete) + shared `ensureOpenSession` helper | Session create-or-resume runs server-side from the page (no SSR self-fetch); endpoints self-guard 401       | Plan        |
| Correct/incorrect       | Fixed distance threshold                                            | Deterministic, right granularity for continent-scale MVP sets                                               | Plan        |
| Threshold value         | **300 km**, as a configurable parameter                             | Demanding but fair; built as a named default with a documented per-set-override seam (no hardcoded literal) | Plan (user) |
| Map framing             | Auto-fit to set's bounding box (padded)                             | Every set is sensibly framed; reuses F-02's `bbox` prop                                                     | Plan        |
| Queue order             | Stable insertion order (`created_at`)                               | Deterministic; resume = set-difference, no stored shuffle                                                   | Plan        |
| Summary                 | Client-side, in-memory                                              | Data already in hand; `study_history` stays the durable analytics source for S-03                           | Plan (user) |
| Resume UX               | Auto-resume open session silently                                   | Zero-friction match to "never lose state"; restart is post-MVP                                              | Plan        |
| Within-card             | Lock on first click, then reveal                                    | Matches active-recall intent; one clean attempt per card                                                    | Plan        |
| Write timing            | Render feedback instantly; POST attempt in background               | Meets p95 < 500 ms NFR by construction                                                                      | Plan        |

## Scope

**In scope:** `/study/[setId]` page, `StudySession` island, 2 in-session API routes (attempt, complete) + a shared `ensureOpenSession` helper, a `study.ts` scoring/config module (threshold + verdict + bbox helper), `/study` route guard, the summary panel.

**Out of scope:** prioritized ordering (S-03), delete-set (S-04), malformed-CSV UX (S-05), scale-adaptive units (Open Q #1), per-set threshold override (seam only), explicit restart/pause affordances.

## Architecture / Approach

Server-load the set + flashcards + open session + prior attempts in the `.astro` page (matching the `sets/index.astro` pattern), then mount a React island that holds the entire session in memory. Feedback is pure client-side `haversine` math (no round-trip); each acknowledged attempt is POSTed to `study_history` in the background. Resume rehydrates the island from the open session's recorded attempts. The in-memory results array doubles as the summary source.

## Phases at a Glance

| Phase                 | What it delivers                                              | Key risk                                                                |
| --------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. API + lib + guard  | 2 endpoints + `ensureOpenSession`, `study.ts`, `/study` guard | Create-or-resume race accepted for MVP (deterministic most-recent read) |
| 2. Page + island      | Server-load + full click→feedback→advance loop with resume    | Resume correctness (next-card = first un-attempted)                     |
| 3. Summary + complete | In-memory summary panel + `completed_at` stamping             | Double-complete / all-answered-on-entry edge cases                      |

**Prerequisites:** F-01, F-02, S-01 — all met. **Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- Background attempt POST can fail; mitigation is retry-once, and resume reads from `study_history` so a lost write just means the student re-answers that card (no corruption).
- A single far-flung outlier coordinate could over-zoom the auto-fit bbox; padding softens it, acceptable for MVP.
- Sets always have ≥1 card (S-01 invariant), but the page handles 0 cards defensively.

## Success Criteria (Summary)

- A student runs a full session against an imported set and reaches a summary with accurate counts.
- Mid-session tab-close-and-return resumes losslessly; `study_history` has one row per acknowledged attempt.
- Click→feedback is instant (no network on the latency path); `completed_at` stamps at the end and a revisit starts fresh.
