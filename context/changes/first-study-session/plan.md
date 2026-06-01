# First Full Study Session (S-02) Implementation Plan

## Overview

Build the spatial-click quiz loop end-to-end: a student picks an imported set, runs a study session one flashcard at a time, clicks the map to answer, gets instant distance + correct/incorrect feedback with the correct location revealed, advances through the full queue, and reaches a session summary — with mid-session progress preserved losslessly across a tab close or device change. This is the roadmap north star (US-01, FR-008…FR-015) and the product's validation milestone.

All three prerequisites are already in place (F-01 schema, F-02 map island, the `haversine` util), so this slice writes no migrations and reuses the existing map mechanic. The work is: a thin session-lifecycle API, a small scoring/config module, the `/study/[setId]` page, and the quiz island that drives the loop.

## Current State Analysis

- **Schema (F-01) — complete.** `sets`, `flashcards` (name + latitude + longitude), `study_sessions` (with nullable `completed_at`), and `study_history` (append-only: `insert` + `select` RLS policies only, columns `distance_km`, `flashcard_id`, `session_id`, `set_id`, `user_id`, `created_at`; index `study_history_set_scan_idx` on `(user_id, set_id, created_at)` is purpose-built for FR-016). The study loop only writes/reads these; no schema change. (`supabase/migrations/20260530202638_domain_data_schema.sql`, `…20260531003200_study_history_append_only.sql`)
- **Map mechanic (F-02) — complete.** `InteractiveMap` island (`src/components/map/InteractiveMap.tsx`) accepts `onMapClick(LatLng)`, `markers` (`guess`/`target` variants with optional label), a `bbox` framing prop (`[[west,south],[east,north]]`), and a `connector` flag that draws the guess→target line with a km label. `MapDemo.tsx` demonstrates the exact driving pattern. `haversine(a, b)` in `src/lib/geo.ts` returns whole-km great-circle distance; `createMapProjection` in `src/lib/mapProjection.ts` owns all lat/lng↔pixel conversion.
- **Entry point — already wired to a missing route.** `src/pages/sets/index.astro:57` links each set to `/study/${set.id}`. That page does not exist; this slice creates it.
- **Patterns.** Astro pages gate on `Astro.locals.user` and `Astro.redirect("/auth/signin")` (`src/pages/sets/index.astro:8`); API routes self-guard with a 401 JSON response (`src/pages/api/sets/index.ts:6-13`); islands `fetch()` JSON to `/api/...` and navigate via `window.location` (`src/components/sets/ImportSetForm.tsx`). Supabase server client via `createClient(headers, cookies)` (`src/lib/supabase.ts`), typed with `Database` (`src/db/database.types.ts`).
- **Gap.** Middleware `PROTECTED_ROUTES = ["/dashboard", "/sets"]` (`src/middleware.ts:4`) does not include `/study` — it must be added so unauthenticated visitors are redirected.

## Desired End State

A signed-in student visiting `/study/<setId>` for a set they own:

1. Sees one object name at a time over an auto-framed map of the set's region.
2. Clicks the map; the click locks as their guess, and within ~instant (no network) sees: the km distance error, a correct/incorrect verdict (correct = within the threshold, default 300 km), and the correct location revealed with a connector line.
3. Acknowledges and advances to the next card; every flashcard in the set appears exactly once, in stable insertion order.
4. After the last card, sees a summary: number answered, accuracy %, and the list of most-missed items.
5. Can close the tab at any point and return (same or different device) to resume at the next unanswered card with prior answers intact.

Verification: the loop runs against a real imported set; `study_history` accrues one row per acknowledged attempt; closing the tab mid-session and reopening resumes correctly; `completed_at` is stamped at the end; `npm run build`, typecheck, and lint pass.

### Key Discoveries:

- `study_history` is append-only by RLS (`…append_only.sql`) — the study loop must only `insert` and `select`, never update/delete. This is also why it is the durable source of truth for S-03 analytics.
- `InteractiveMap` already exposes everything the quiz needs (`onMapClick`, `markers`, `bbox`, `connector`) — `src/components/map/MapDemo.tsx:31-95` is the reference driver.
- The latency NFR (p95 < 500 ms) is met by construction: the correct location ships to the client with the flashcard, so distance/verdict is local `haversine` math; the attempt POST is fired in the background and never blocks feedback.
- Resume is a set-difference: with stable insertion order, the "next card" is the first flashcard (by `created_at`) whose id has no attempt row in the open session — no stored shuffle/order is needed.

## What We're NOT Doing

- **Prioritized / weighted queue ordering** — S-03 (FR-016). S-02 is the full set, each item exactly once, in stable insertion order.
- **Delete a set** — S-04.
- **Malformed-CSV row reporting** — S-05; import is happy-path (already shipped in S-01).
- **Scale-adaptive distance units (km/m)** — PRD Open Question #1; km only.
- **Per-set correct-threshold override** — future. We build the threshold as a configurable parameter with a documented seam (a `correct_threshold_km` column on `sets`), but add no column and no UI now.
- **Explicit restart / "start over" affordance, explicit pause UI** — PRD non-goals; an open session auto-resumes silently.
- **A server-computed summary endpoint or separate summary page** — the summary is computed client-side in-memory from the session's attempts.

## Implementation Approach

Two thin endpoints (attempt, complete) own the in-session writes; session create-or-resume is a shared server-side helper the page calls during its normal server-load (no write-on-GET concern beyond an idempotent insert, and no SSR self-fetch). All page/island data-loading otherwise follows the existing server-load-then-island pattern. The island holds the full in-memory record of the session (each card's guess, distance, verdict), which doubles as the summary source. Feedback is always local math; persistence is a background concern that never gates the UI. Resume is reconstructed by server-loading the open session's recorded attempts into the island's initial state.

Correctness/scoring lives in one small module (`src/lib/study.ts`) so the threshold is a single named default threaded as a parameter — not duplicated across the API and the island.

## Critical Implementation Details

- **Latency / write ordering** — On click: compute `haversine` + verdict and paint feedback synchronously; fire the `study_history` POST in the background (do not `await` it before rendering). Advancing on Acknowledge does not wait on the POST. A failed POST is retried once; if it still fails, the card simply looks unanswered on a later resume (the student re-answers it) — no silent corruption, since `study_history` is the source of truth and resume reads from it.
- **Resume semantics** — `created_at` ordering of flashcards is the queue. "Answered" = has an attempt row in the open session. An un-acknowledged click (tab closed before Acknowledge) was never POSTed, so that card is correctly unanswered on resume. One attempt per card is enforced client-side (lock on first click); the loop never POSTs a second attempt for the same card in the same session.
- **Empty / single-card sets** — A set always has ≥1 flashcard (S-01 import requires valid rows), but the page must still handle a 0-card set defensively (show a "set has no cards" message, no session created). A 1-card set runs the loop once then summarizes.

## Phase 1: Session lifecycle API + scoring lib + route guard

### Overview

Stand up the backend the island talks to: a scoring/config module, a shared server-side session create-or-resume helper, two self-guarding API routes for in-session writes (attempt, complete), and the middleware guard for `/study`.

### Changes Required:

#### 1. Study scoring & config module

**File**: `src/lib/study.ts` (new)

**Intent**: Single home for the correct-answer threshold and verdict logic, so the value is defined once and passed as a parameter rather than hardcoded in the API and island. Documents the future per-set-override seam.

**Contract**: Exports `DEFAULT_CORRECT_THRESHOLD_KM = 300` and a pure `isCorrect(distanceKm: number, thresholdKm?: number): boolean` (defaulting to the constant). Depends only on numbers — no DOM, no d3, mirrors the dependency-free style of `src/lib/geo.ts`. A comment names the future seam: a `correct_threshold_km` column on `sets` would flow into `thresholdKm` here.

#### 2. Session create-or-resume helper (shared server-side)

**File**: `src/lib/studySession.ts` (new)

**Intent**: One canonical place to get the open session for a `(user, set)` — create it if none exists, return the existing open one otherwise — so entry to `/study/[setId]` always lands on a single session. Called server-side by the study page (Phase 2), not over HTTP, so there is no SSR self-fetch and no duplicated query. Replaces what would otherwise be a `POST /api/study/sessions` endpoint (now unnecessary — the page is the only caller and runs server-side).

**Contract**: Exports `ensureOpenSession(supabase, userId, setId): Promise<string>` returning the session id. Looks up an existing `study_sessions` row for `(user_id, set_id)` with `completed_at IS NULL` (order by `started_at desc`, take the first — see F2 stance below); if found returns its id, else inserts one (`user_id`, `set_id`) and returns the new id. Takes an already-constructed typed Supabase client (the page builds it via `createClient`); RLS scopes all access to the owner, so a foreign/missing set simply yields no rows and the page redirects. Pure data-access — no `Response`/HTTP concerns.

> **F2 stance (duplicate open sessions):** create-or-resume is a read-then-insert with no DB uniqueness guarantee. For the single-student MVP we consciously accept the race and resolve reads deterministically by taking the most-recent open session (`order by started_at desc limit 1`). A hardening option — a partial unique index `create unique index … on study_sessions (user_id, set_id) where completed_at is null` — is recorded here as a post-MVP seam, not built now.

#### 3. Record attempt endpoint

**File**: `src/pages/api/study/sessions/[id]/attempts.ts` (new)

**Intent**: Append one acknowledged attempt to the append-only `study_history` log. Called in the background by the island; off the latency path.

**Contract**: `POST` with body `{ flashcardId: string, distanceKm: number }`; `[id]` is the session id. Self-guards 401. Inserts into `study_history` with `user_id` (from `locals.user`), `session_id`, `flashcard_id`, `set_id` (resolved from the session or passed in body), and `distance_km`. Returns `{ ok: true }` on success, 4xx/5xx with `{ error }` otherwise. Only inserts — never updates/deletes (RLS forbids it anyway).

#### 4. Complete session endpoint

**File**: `src/pages/api/study/sessions/[id]/complete.ts` (new)

**Intent**: Stamp `completed_at` so the session is no longer "open" and won't be auto-resumed.

**Contract**: `POST`, `[id]` = session id. Self-guards 401. Updates `study_sessions.completed_at = now()` where `id = [id]` and the row is owned by the user (RLS-scoped). Idempotent (completing an already-complete session is a no-op success). Returns `{ ok: true }`.

#### 5. Protect `/study` routes

**File**: `src/middleware.ts`

**Intent**: Redirect unauthenticated visitors away from the study page, matching the gating of `/dashboard` and `/sets`.

**Contract**: Add `"/study"` to `PROTECTED_ROUTES` (`src/middleware.ts:4`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck` (or `astro check`)
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `ensureOpenSession` returns a session id; called twice mid-session it returns the _same_ id (resume), and after completion a fresh call returns a _new_ id (verifiable via the page: reload mid-session keeps the session; reload after finishing starts a new one).
- `POST /api/study/sessions/<id>/attempts` inserts a `study_history` row visible in Supabase; a foreign/invalid session or set is rejected.
- `POST /api/study/sessions/<id>/complete` sets `completed_at`.
- Hitting `/study/<anything>` while signed out redirects to `/auth/signin`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Study page + quiz island

### Overview

Create the `/study/[setId]` page (server-loads set, flashcards, open session + its recorded attempts, computes framing) and the `StudySession` island that runs the click→feedback→acknowledge loop with lossless resume.

### Changes Required:

#### 1. Study page (server-load + framing)

**File**: `src/pages/study/[setId].astro` (new)

**Intent**: Gate auth, load the set and its flashcards (insertion order), ensure/resume a session, load any prior attempts for rehydration, compute the auto-fit bbox, and mount the island. Follows the server-load pattern of `src/pages/sets/index.astro`.

**Contract**: Reads `Astro.params.setId`; redirects to `/auth/signin` if no `locals.user`. Loads the set (404/redirect to `/sets` if not owned/found), its `flashcards` ordered by `created_at` (`id, name, latitude, longitude`), the open session id via `ensureOpenSession(supabase, user.id, setId)` (Phase 1 #2 — the single create-or-resume path), and that session's existing `study_history` rows (`flashcard_id, distance_km`). Computes a padded bbox from the flashcards' min/max lat/lng. Passes to the island: `sessionId`, `setId`, ordered `flashcards`, `priorAttempts`, `bbox`, and `thresholdKm` (from `DEFAULT_CORRECT_THRESHOLD_KM`). Handles the 0-card set with a message and no island.

**Contract (bbox helper)**: a small pure function (co-located in the page or added to `src/lib/study.ts`) `boundingBox(points: LatLng[], padFraction): Bbox` returning `[[west,south],[east,north]]`, padded so markers aren't flush to the edge. Reuses the `Bbox` type from `src/lib/mapProjection.ts`.

#### 2. Quiz island

**File**: `src/components/study/StudySession.tsx` (new)

**Intent**: Drive the full quiz loop over `InteractiveMap`: present the current card's name, lock the guess on first click, render instant feedback, POST the attempt in the background, advance on Acknowledge, and resume from prior attempts. Holds the in-memory session record that Phase 3 summarizes.

**Contract**: Props `{ sessionId, setId, flashcards: {id,name,latitude,longitude}[], priorAttempts: {flashcardId, distanceKm}[], bbox, thresholdKm }`. Internal state per card: phase `awaiting-click` → `revealed`. On first map click while `awaiting-click`: set guess, compute `distanceKm = haversine(guess, target)` and `verdict = isCorrect(distanceKm, thresholdKm)`, transition to `revealed`, and fire-and-forget `POST /api/study/sessions/[id]/attempts` (retry once on failure). The marker array is **phase-derived**: `[]` while `awaiting-click` (target hidden — active recall, FR-009), and `[guess, target]` only once `revealed` (with `connector` on). Never pass the `target` marker before the click. Acknowledge advances `currentIndex` to the next card. Initial `currentIndex` and the in-memory results array are seeded from `priorAttempts` (cards already attempted are marked done; the loop starts at the first un-attempted card). Uses existing UI primitives (`Button`) and the cosmic styling of sibling components.

#### 3. Map demo reference

**File**: (none — reuse) `src/components/map/MapDemo.tsx`

**Intent**: No change; cited as the driving pattern for `InteractiveMap` so the island mirrors its marker/connector usage.

**Contract**: n/a.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Visiting `/study/<setId>` for an owned set shows the first object name over a map auto-framed to the set's region.
- Clicking the map locks the guess, reveals the target + connector + km distance, and shows a correct/incorrect verdict consistent with the 300 km threshold.
- Acknowledge advances to the next card; the target is hidden again until the next click.
- Every flashcard appears exactly once, in CSV/insertion order.
- Closing the tab after answering several cards and reopening `/study/<setId>` resumes at the next unanswered card with prior cards counted (verify `study_history` rows exist for answered cards).
- A 0-card set shows a graceful message and creates no session.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Session summary + completion

### Overview

Add the terminal summary panel and wire session completion.

### Changes Required:

#### 1. Summary panel

**File**: `src/components/study/StudySession.tsx` (extend) and/or `src/components/study/SessionSummary.tsx` (new)

**Intent**: When the last card is acknowledged, replace the quiz UI with a summary computed in-memory from the session's results: items answered, accuracy %, and the most-missed list (FR-014).

**Contract**: Summary derives from the island's in-memory results plus `priorAttempts` (so a resumed-then-finished session is complete): `answered = count`, `accuracy = correct/answered`, `mostMissed = items sorted by distanceKm desc` (top N, e.g. 5). Renders with existing cosmic styling and a link back to `/sets`. No new endpoint — purely a render of held data.

#### 2. Completion call

**File**: `src/components/study/StudySession.tsx` (extend)

**Intent**: On reaching the summary, mark the session complete so it is not auto-resumed and a future visit starts fresh.

**Contract**: After the final Acknowledge, `POST /api/study/sessions/[id]/complete` (background; failure is non-fatal — the session is functionally finished and would simply auto-resume to an empty queue, which the page should treat as "show summary / nothing left"). Guard against double-complete.

#### 3. Empty-queue-on-entry handling

**File**: `src/pages/study/[setId].astro` and/or island

**Intent**: If a resumed session has every card already attempted (e.g., complete failed previously), show the summary directly rather than an empty loop.

**Contract**: When `priorAttempts` covers all flashcards, the island opens on the summary view and (re-)fires complete.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Completing every card shows a summary with correct count, accuracy %, and a most-missed list ordered by distance.
- After completion, `study_sessions.completed_at` is set; revisiting `/study/<setId>` starts a fresh session (new id, queue from the top).
- A session whose cards were all answered before completion (simulate by not calling complete) opens directly on the summary.
- The summary's "back to sets" link returns to `/sets`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

> Note: automated test tooling is introduced in Module 3; this slice verifies via typecheck/lint/build plus the manual steps below (consistent with prior slices in this repo).

### Unit-level (manual reasoning / future tests):

- `isCorrect(distanceKm, thresholdKm)` boundary at exactly the threshold.
- `boundingBox` padding and antimeridian-free continent sets; single-point set degenerates to a small framed box.
- `haversine` is already covered by F-02.

### Integration / end-to-end (manual):

1. Import a small set (e.g., a few European capitals) via `/sets`, then open it.
2. Answer a card correctly (near target) and incorrectly (far) — verify verdict and km.
3. Mid-session, close the tab; reopen — verify resume position and preserved answers.
4. Finish the set — verify summary numbers and `completed_at`.
5. Reopen the finished set — verify a fresh session starts.
6. Sign out and hit `/study/<id>` — verify redirect.

## Performance Considerations

The click→feedback path is pure client-side `haversine` math (no network), satisfying the p95 < 500 ms NFR by construction. Attempt persistence is a background POST that never blocks the UI. Sets are ≤300 items (PRD), so loading all flashcards and country outlines up front is well within budget; the basemap is bundled (no runtime fetch).

## Migration Notes

No schema changes. Two post-MVP seams are documented but not built: the per-set threshold override (a `correct_threshold_km` column on `sets`, noted in `src/lib/study.ts`) and a partial unique index on `study_sessions (user_id, set_id) where completed_at is null` to make one-open-session-per-set a hard DB invariant (F2 — MVP accepts the race and reads the most-recent open session deterministically).

## References

- Roadmap: `context/foundation/roadmap.md` (S-02, north star)
- PRD: `context/foundation/prd.md` (US-01, FR-008…FR-015, NFR Latency/Persistence)
- Map mechanic: `src/components/map/InteractiveMap.tsx`, driver `src/components/map/MapDemo.tsx:31-95`
- Distance util: `src/lib/geo.ts:27`
- Projection / bbox type: `src/lib/mapProjection.ts:15`
- API + auth pattern: `src/pages/api/sets/index.ts`, `src/pages/sets/index.astro:8`
- Schema: `supabase/migrations/20260530202638_domain_data_schema.sql`, `…20260531003200_study_history_append_only.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Session lifecycle API + scoring lib + route guard

#### Automated

- [ ] 1.1 Type checking passes: `npm run typecheck`
- [ ] 1.2 Linting passes: `npm run lint`
- [ ] 1.3 Build passes: `npm run build`

#### Manual

- [ ] 1.4 ensureOpenSession returns same session id mid-session, new id after completion
- [ ] 1.5 Attempt endpoint inserts a study_history row; foreign/invalid session rejected
- [ ] 1.6 Complete endpoint sets completed_at
- [ ] 1.7 `/study/<id>` redirects to signin when signed out

### Phase 2: Study page + quiz island

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 First card shows over an auto-framed map of the set's region
- [ ] 2.5 Click locks guess; reveals target + connector + km + correct/incorrect verdict
- [ ] 2.6 Acknowledge advances; target hidden again until next click
- [ ] 2.7 Every flashcard appears once, in insertion order
- [ ] 2.8 Tab-close mid-session then reopen resumes at next unanswered card with answers preserved
- [ ] 2.9 0-card set shows graceful message, creates no session

### Phase 3: Session summary + completion

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Summary shows correct count, accuracy %, most-missed list ordered by distance
- [ ] 3.5 completed_at set; revisiting starts a fresh session
- [ ] 3.6 All-answered session opens directly on the summary
- [ ] 3.7 Summary "back to sets" link returns to /sets
