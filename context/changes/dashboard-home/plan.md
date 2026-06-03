# Dashboard as Home (S-07) Implementation Plan

## Overview

Today `/dashboard` is a placeholder that greets the user by email and nothing else. This change turns it into a "what to do now" home: a primary **resume / start** action, a study **streak**, a list of **recent sets each with a per-set "due" badge**, and an **onboarding empty state** for brand-new users — and it makes login land on this screen instead of the marketing page.

The whole feature is read-only aggregation over data that already exists (`sets`, `flashcards`, `study_sessions`, `study_history`) plus a small reuse of the existing priority rule in `src/lib/prioritize.ts`. No schema change, no new write path, no new island.

## Current State Analysis

Everything this slice needs is already landed by F-01, S-02, S-03, S-06, and S-09:

- **`/dashboard` is a stub.** `src/pages/dashboard.astro` renders `user.email` inside `AuthLayout` and nothing else. `AuthLayout` already includes the `Topbar` (S-06), so there is no navigation dead-end to fix — this is purely filling the screen.
- **Login does not land on the dashboard.** `src/pages/api/auth/signin.ts:19` redirects to `/`, the marketing landing (`src/pages/index.astro` → `Welcome.astro`). The marketing page has no logged-in guard, so an authenticated user who hits `/` sees marketing copy.
- **The data for counters exists and is indexed.** `study_sessions` carries `started_at` + `completed_at` (`migration 20260530202638:60-66`); `study_history` carries `flashcard_id, set_id, distance_km, created_at` with `study_history_set_scan_idx on (user_id, set_id, created_at)` (`:92`). `study_sessions_user_set_idx on (user_id, set_id)` (`:68`) backs the per-set session scan.
- **The priority rule is already a pure module.** `src/lib/prioritize.ts` exposes `priorityScore(lastAttempt | undefined, now, config)` returning higher-is-more-urgent, with never-seen → `Number.POSITIVE_INFINITY`, and `PRIORITIZATION_CONFIG`. "Due" can be defined directly on top of this so the dashboard's notion of urgency matches the study queue's ordering.
- **"Resume" already has a server concept.** `src/lib/studySession.ts:ensureOpenSession` defines the open (incomplete) session for a `(user, set)`. An open `study_sessions` row (`completed_at IS NULL`) is exactly the thing to resume; navigating to `/study/{setId}` reuses it.
- **The empty-state targets already exist on `/sets`.** `ImportSetForm` and the S-09 starter-sets section (`STARTER_SETS` / `AddStarterSetButton`) live on `src/pages/sets/index.astro`. The dashboard empty state links there rather than duplicating that UI.
- **No automated test runner is configured** (`package.json`); per project boundaries, testing is a Module 3 concern. Automated verification here is `npm run typecheck`, scoped `eslint`, and `npm run build`. Pure helpers (`computeStreak`, `isDue`) are written dependency-free so they are unit-testable later without refactoring.

## Desired End State

After signing in, a user lands on `/dashboard` and sees:

- A **primary action**: "Resume session" if they have an open (incomplete) session, otherwise "Start studying" pointed at their most-recently-active set. With zero sets, the primary action is replaced by the onboarding card.
- A **study streak**: the number of consecutive UTC days (ending today or yesterday) on which they completed at least one session.
- A **recent sets list** ordered by latest activity, each row showing the set name, its card count or last-activity hint, and a **per-set "due" badge** (count of items that are never-seen or whose priority crosses the due threshold), linking to `/study/{setId}`.
- An **empty state** (zero sets): a welcome card pointing to "Add a ready-made set" and "Import your own CSV", both linking to `/sets`.

And: signing in redirects to `/dashboard`, and a logged-in user who hits `/` is redirected to `/dashboard`.

**Verification:** a user with at least one studied set sees a non-empty recent list with correct due badges and a streak that matches their completed-session history; a brand-new user sees the onboarding card; login and `/` both land on `/dashboard` when authenticated.

### Key Discoveries

- `priorityScore` already returns `+Infinity` for never-seen items (`src/lib/prioritize.ts`), so "due" is a thin predicate on top of it — never-seen is always due; seen items are due above a documented cutoff.
- `ensureOpenSession` (`src/lib/studySession.ts:27`) defines "open session" as `completed_at IS NULL`, most-recent `started_at` — the resume target the dashboard should surface.
- Recent-set "last activity" is derivable from `study_sessions` (`started_at`/`completed_at`) without a new column; for sets never studied, fall back to `sets.created_at`.
- The per-set due count is the modular primitive the user asked for: a future global "Due today: N" headline is a sum over the per-set counts, not a new query.
- Data volume is "small" per the PRD, so loading all of a user's sets, history, and sessions and aggregating in memory is well within budget and keeps the query count low (3 queries).

## What We're NOT Doing

- **No global "Due today: N" headline** in this version. The user chose per-set due badges first, to validate the UX. The per-set count is built as a reusable primitive so a global sum can be added later without reshaping the data layer. (Conscious scope choice.)
- **No schema change, no migration, no new API route, no new island.** Read-only aggregation over existing tables; the dashboard page is server-rendered Astro.
- **No new SRS due-date model.** "Due" is defined via the existing `priorityScore`, not stored per-item review dates (none exist).
- **No changes to the study/session/import flows.** `/study/[setId]`, `ImportSetForm`, starter sets, and `ensureOpenSession` are consumed, not modified.
- **No timezone personalization.** Streak is computed in UTC (deterministic, server-side); a per-user timezone is a documented future seam.
- **No cross-session analytics view** (PRD Non-Goal) beyond the streak and due counts surfaced here.

## Implementation Approach

A new pure-ish data module `src/lib/dashboard.ts` owns all aggregation: it issues three bounded queries (sets-with-flashcard-ids, all of the user's `study_history`, all of the user's `study_sessions`) and folds them into a typed `DashboardData` view model — per-set rows (id, name, due count, last-activity timestamp, whether an open session exists), the resume/primary-CTA target, and the streak. The streak and due math are isolated as pure functions (`computeStreak`, and a `isDue` predicate added to `prioritize.ts`) so they are deterministic and testable.

The dashboard page becomes a thin renderer over `DashboardData`: empty state when there are no sets, otherwise the CTA + streak + recent list. The landing/redirect wiring is two small edits: repoint the signin redirect and guard the marketing index.

Building the data layer first (Phase 1) lets the math be verified in isolation before any UI exists; the UI (Phase 2) and redirects (Phase 3) are then mechanical.

## Critical Implementation Details

- **"Due" must stay consistent with the study queue, and means "to review" — not "weak".** Define due on top of the existing `priorityScore` rather than inventing a parallel staleness rule, so the dashboard's urgency and the study page's ordering can never drift. Never-seen items (`priorityScore` → `+Infinity`) are always due; seen items are due when their score crosses a `DUE_SCORE_THRESHOLD` documented next to `PRIORITIZATION_CONFIG`. **Score geometry to be explicit about:** with the shipped config (`wRecency 0.5`, `stalenessRefMs 3 days`), the staleness term alone reaches `0.5` after 3 days regardless of accuracy, and the max seen score is `1.0`. A single threshold therefore cannot separate "merely stale" from "freshly missed" — both sit near `0.5`. This is intentional: the badge counts items **to review** (never-seen, OR not reviewed in a few days, OR last answered wrong), not a "weak items only" set. Set `DUE_SCORE_THRESHOLD ≈ 0.5` so any item carrying a full dominant term qualifies, and the badge/label in Phase 2 must read in "to review" language so a large early count reads as expected, not alarming. A "weak items only" variant (error-only, ignoring staleness) is a deliberate Non-Goal here because it would make due diverge from the study-queue order.
- **Streak "current" window.** A streak counts consecutive UTC days each having ≥1 session with `completed_at` set, walking backward from today; the run is only "current" if it includes **today or yesterday** (a one-day grace so the streak doesn't visually reset the moment a new UTC day begins). If the most recent completed-session day is older than yesterday, the streak is 0. `now` is injected into `computeStreak` so it is deterministic and testable.
- **Last-attempt extraction mirrors S-03.** Order `study_history` by `created_at` descending and keep the first row seen per `flashcard_id` — that item's most recent attempt. This is the same reduction `src/pages/study/[setId].astro:61-66` already performs; reuse the `LastAttempt` shape from `prioritize.ts`.

## Phase 1: Dashboard data layer

### Overview

Add a reusable `isDue` predicate to the priority module, then a new `src/lib/dashboard.ts` that aggregates the user's sets, history, and sessions into a typed `DashboardData` view model. Pure functions for the math; no DOM, no rendering.

### Changes Required:

#### 1. Due predicate + threshold

**File**: `src/lib/prioritize.ts`

**Intent**: Express "is this item due?" once, on top of the existing score, so the dashboard and the study queue share one notion of urgency and a future global counter can reuse it.

**Contract**:

- `DUE_SCORE_THRESHOLD` — exported constant placed next to `PRIORITIZATION_CONFIG`, documented as the cutoff above which a _seen_ item counts as **due (= "to review")**. Set it to the contribution of a single dominant term — i.e. `min(wError, wRecency)` (≈ `0.5` with the shipped config) — so an item that is either fully stale OR fully missed qualifies, while a recently-and-accurately-answered item (both terms low) does not. The comment must state explicitly that staleness alone qualifies a card as "to review" — that is intended, not a bug (see Critical Implementation Details).
- `isDue(lastAttempt: LastAttempt | undefined, now: Date, config = PRIORITIZATION_CONFIG): boolean` — pure. Returns `true` when `priorityScore(...) >= DUE_SCORE_THRESHOLD`. Because never-seen → `+Infinity`, never-seen items are always due. No snippet needed; this is a one-line predicate over the existing function.

#### 2. Dashboard aggregation module

**File**: `src/lib/dashboard.ts` (new)

**Intent**: Single server-side entry point that turns the user's domain rows into everything the dashboard page renders, keeping all query and fold logic out of the `.astro` frontmatter.

**Contract**:

- Exported types:
  - `DashboardSet` — `{ id: string; name: string; cardCount: number; dueCount: number; lastActivityAt: string; hasOpenSession: boolean }`. `cardCount` is `flashcards(id).length` from query 1 (no extra query).
  - `DashboardData` — `{ sets: DashboardSet[]; streak: number; resume: { setId: string; isResume: boolean } | null; isEmpty: boolean; loadError: boolean }` where `resume` is the primary-CTA target (`isResume: true` when it points at an open session), `isEmpty` is `sets.length === 0 && !loadError`, and `loadError` is `true` when the **sets query itself errored** (distinct from a user who genuinely has no sets).
- `computeStreak(completedDates: string[], now: Date): number` — pure. Given the `completed_at` timestamps of completed sessions, returns the consecutive-UTC-day run ending today-or-yesterday (see Critical Implementation Details). Dedupe to UTC calendar days internally.
- `getDashboardData(supabase, userId, now = new Date()): Promise<DashboardData>` — issues three queries and folds them:
  1. `sets` for the user: `select("id, name, created_at, flashcards(id)")` — gives each set its flashcard ids for the due scan.
  2. `study_history` for the user: `select("flashcard_id, set_id, distance_km, created_at")` ordered `created_at` descending — reduce to a `Map<flashcardId, LastAttempt>` keeping the first (latest) row per flashcard (mirror `study/[setId].astro:61-66`).
  3. `study_sessions` for the user: `select("set_id, started_at, completed_at")`.
  - Per set: `dueCount` = number of its flashcards where `isDue(lastAttempts.get(id), now)`; `lastActivityAt` = the latest of that set's session `completed_at`/`started_at`, falling back to the set's `created_at`; `hasOpenSession` = any session with `completed_at == null`.
  - `sets` sorted by `lastActivityAt` descending.
  - `resume`: if any set has an open session, the most-recently-active such set with `isResume: true`; else the most-recently-active set with `isResume: false`; else `null`.
  - `streak`: `computeStreak` over all sessions' non-null `completed_at`.
  - Use the typed Supabase client pattern already used in `src/lib/studySession.ts` (`SupabaseClient<Database>`). Degrade softly without throwing, but **distinguish the sets query**: if the sets query returns an error, set `loadError: true` (and return empty sets) so the page can show a neutral "couldn't load" message instead of the onboarding empty state. A failed history or sessions query is benign — treat as empty (zero due / zero streak); only the sets query drives `loadError`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes (changed files): `npx eslint src/lib/prioritize.ts src/lib/dashboard.ts`

#### Manual Verification:

- `isDue` returns `true` for a never-seen item and for a clearly stale/badly-missed seen item, and `false` for a recently-and-accurately-answered item (verified by a scratch call / inspection).
- `computeStreak` returns the correct run for: a session today + yesterday + the day before (3); a gap (resets); only sessions older than yesterday (0); empty input (0).
- `getDashboardData` shape matches `DashboardData` and per-set `dueCount` reflects the seeded history.

**Implementation Note**: After this phase and automated verification pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Dashboard page UI

### Overview

Rewrite `src/pages/dashboard.astro` to render `DashboardData`: the primary resume/start CTA, the streak, the recent-sets list with per-set due badges, and the zero-sets onboarding card.

### Changes Required:

#### 1. Rewrite the dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the placeholder body with a real "what to do now" home driven entirely by `getDashboardData`, reusing the existing glass-card styling already used on `/sets` and the current dashboard.

**Contract**:

- Frontmatter: guard `if (!user) return Astro.redirect("/auth/signin")` (consistent with `sets/index.astro:10`), create the typed client, call `getDashboardData(supabase, user.id)`.
- When `loadError`: render a neutral "Couldn't load your dashboard — try refreshing" card (no onboarding CTA, no list), so a transient failure never tells a returning user to "add a set".
- When `isEmpty`: render an onboarding card — a short welcome line plus two links to `/sets` labelled for "Add a ready-made set" and "Import your own CSV". No counters, no list.
- Otherwise render:
  - A **primary CTA** linking to `/study/{resume.setId}`, labelled "Resume session" when `resume.isResume`, else "Start studying".
  - A **streak** display (e.g. "🔥 N-day streak"); when `streak === 0`, render an encouraging zero-state line rather than "0-day streak".
  - A **recent sets list**: each row links to `/study/{set.id}`, shows `set.name`, its `cardCount` (e.g. "N cards"), and a **"to review" badge** showing `dueCount` (e.g. "N to review"; render a muted "All caught up" / no-badge when `dueCount === 0`). Use "to review" language, not "weak"/"due" — the count is intentionally inclusive of stale-but-known items (see F1 / Critical Implementation Details).
- Keep `AuthLayout` (Topbar/nav) as-is. No client islands required — this is static server-rendered markup.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes (changed files): `npx eslint src/pages/dashboard.astro`
- Production build succeeds: `npm run build`

#### Manual Verification:

- A user with ≥1 studied set sees the recent list ordered by last activity, with due badges that match seeded history.
- The primary CTA reads "Resume session" and lands on the open session when one exists; otherwise reads "Start studying" and opens the most-recently-active set.
- The streak matches the user's completed-session history (and shows the zero-state line when there is no current streak).
- A brand-new user (zero sets) sees only the onboarding card, and both its links reach `/sets`.

**Implementation Note**: After this phase and automated verification pass, pause for manual confirmation before Phase 3. This is the slice's user-visible validation milestone.

---

## Phase 3: Landing & redirect wiring

### Overview

Make login land on the dashboard, and stop logged-in users from seeing the marketing landing.

### Changes Required:

#### 1. Repoint the signin redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After a successful sign-in, send the user to the new decision screen instead of the marketing page.

**Contract**: change the success redirect target (`:19`) from `/` to `/dashboard`. Error redirects are unchanged.

#### 2. Guard the marketing landing for logged-in users

**File**: `src/pages/index.astro`

**Intent**: A logged-in visitor hitting `/` should land on their dashboard, not the marketing copy.

**Contract**: in the frontmatter, if `Astro.locals.user` is set, `return Astro.redirect("/dashboard")`. Logged-out visitors continue to see `Welcome`. (`Astro.locals.user` is populated by `src/middleware.ts` for all routes.)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes (changed files): `npx eslint src/pages/api/auth/signin.ts src/pages/index.astro`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Signing in redirects to `/dashboard`.
- Visiting `/` while logged in redirects to `/dashboard`; visiting `/` while logged out still shows the marketing landing.
- Sign-out (which redirects to `/`) shows the marketing landing (no redirect loop).

**Implementation Note**: After this phase and automated verification pass, pause for manual confirmation.

---

## Testing Strategy

No automated test runner is configured (Module 3 concern). The math helpers (`isDue`, `computeStreak`) are written pure/deterministic with an injected `now` so they can be unit-tested later without refactoring.

### Manual Testing Steps:

1. Brand-new account (no sets) → sign in → confirm redirect to `/dashboard` shows only the onboarding card; both links reach `/sets`.
2. Add a starter set (via `/sets`), study a few cards, leave the session open → return to `/dashboard` → confirm the primary CTA reads "Resume session" and the set appears with a due badge.
3. Complete a full session → return to `/dashboard` → confirm the due badge drops (accurately-answered, recently-seen items no longer due) and the streak shows 1 day.
4. Seed a backdated completed session (direct SQL insert into `study_sessions` with `completed_at` on a prior UTC day — append-only/default-`now()` prevents writing this via the app) → confirm consecutive days extend the streak and a gap resets it.
5. Visit `/` while logged in → confirm redirect to `/dashboard`; sign out → confirm `/` shows the marketing landing with no loop.

## Performance Considerations

Three bounded queries per dashboard load (sets+flashcard-ids, the user's history, the user's sessions), each scoped to one user and backed by existing indexes (`study_history_set_scan_idx`, `study_sessions_user_set_idx`). Aggregation is in-memory over a small dataset (PRD `data_volume: small`). Off any latency-critical path.

## Migration Notes

- **No DB migration.** Read-only against existing tables.
- **Global "Due today: N" seam:** the per-set `dueCount` is the primitive; a future global headline is `sets.reduce((n, s) => n + s.dueCount, 0)` in the page — no data-layer change.
- **Per-user timezone seam:** `computeStreak` takes `now`; a future per-user tz would shift the day-bucketing input, leaving the data layer otherwise unchanged.
- **Due-cutoff tuning seam:** `DUE_SCORE_THRESHOLD` is the single point of change, sitting beside `PRIORITIZATION_CONFIG`.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-07, lines 171-182)
- Priority rule reused for "due": `src/lib/prioritize.ts` (`priorityScore`, `PRIORITIZATION_CONFIG`)
- Open-session / resume concept: `src/lib/studySession.ts:27`
- Last-attempt reduction to mirror: `src/pages/study/[setId].astro:61-66`
- Empty-state targets (starters + import): `src/pages/sets/index.astro`
- Schema (sessions/history + indexes): `supabase/migrations/20260530202638_domain_data_schema.sql:60-93`
- Signin redirect: `src/pages/api/auth/signin.ts:19`; middleware populating `locals.user`: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dashboard data layer

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes (changed files): `npx eslint src/lib/prioritize.ts src/lib/dashboard.ts`

#### Manual

- [x] 1.3 `isDue` correct for never-seen, stale/missed, and recent-accurate items
- [x] 1.4 `computeStreak` correct for consecutive, gap, stale-only, and empty inputs
- [x] 1.5 `getDashboardData` shape matches `DashboardData`; per-set `dueCount` reflects seeded history

### Phase 2: Dashboard page UI

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes (changed files): `npx eslint src/pages/dashboard.astro`
- [ ] 2.3 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.4 Recent list ordered by last activity with due badges matching seeded history
- [ ] 2.5 Primary CTA resumes an open session, else "Start studying" on most-recent set
- [ ] 2.6 Streak matches completed-session history (zero-state line when none)
- [ ] 2.7 Zero-sets user sees only the onboarding card; both links reach `/sets`

### Phase 3: Landing & redirect wiring

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes (changed files): `npx eslint src/pages/api/auth/signin.ts src/pages/index.astro`
- [ ] 3.3 Production build succeeds: `npm run build`

#### Manual

- [ ] 3.4 Sign-in redirects to `/dashboard`
- [ ] 3.5 `/` redirects logged-in users to `/dashboard`; logged-out still see marketing landing
- [ ] 3.6 Sign-out lands on `/` with no redirect loop
