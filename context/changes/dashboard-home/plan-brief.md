# Dashboard as Home (S-07) — Plan Brief

> Full plan: `context/changes/dashboard-home/plan.md`

## What & Why

Today `/dashboard` is a placeholder that just greets the user by email, and login drops users on the marketing landing. This change turns `/dashboard` into a "what to do now" home — resume/start CTA, study streak, recent sets with per-set "due" badges, and an onboarding empty state — and makes login land there. It fixes the "nothing useful after login" problem (roadmap S-07).

## Starting Point

`/dashboard` renders only `user.email` (`src/pages/dashboard.astro`). Nav already exists (Topbar via AuthLayout, S-06). All the data needed exists: `study_sessions` (streak + resume), `study_history` (due/staleness), and `src/lib/prioritize.ts` already encodes the priority rule. Signin currently redirects to `/` (`api/auth/signin.ts:19`).

## Desired End State

After login the user lands on `/dashboard`: a primary "Resume session" (or "Start studying") action, a UTC study streak, a recent-sets list ordered by activity with a per-set due badge each, or — for new users — an onboarding card linking to `/sets`. Logged-in users hitting `/` are redirected to `/dashboard`.

## Key Decisions Made

| Decision         | Choice                                                               | Why                                                                      | Source |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| Scope            | Full (counters + resume), not lite                                   | Data already exists; the lite→full hedge isn't needed                    | Plan   |
| "Due" definition | Reuse `priorityScore` + a `DUE_SCORE_THRESHOLD`                      | One notion of urgency shared with the study queue; never-seen always due | Plan   |
| Due granularity  | **Per-set badges, no global headline** (modular for later sum)       | User wants to validate per-set UX first; global is a future `reduce`     | Plan   |
| Streak           | Consecutive UTC days with a completed session, today/yesterday grace | "Completed" is a real effort signal; UTC is deterministic                | Plan   |
| Resume / CTA     | Resume open session, else most-recent set; list by last activity     | Maps to `ensureOpenSession`'s open-session concept                       | Plan   |
| Landing          | signin→`/dashboard`; `/` bounces logged-in users                     | Fully realizes "land on a decision screen after login"                   | Plan   |
| Empty state      | Onboarding card linking to `/sets` (starters + CSV import)           | Reuses existing S-09/import entry points, no duplicated UI               | Plan   |

## Scope

**In scope:** rewrite `/dashboard`; new `src/lib/dashboard.ts` aggregation; `isDue`/`DUE_SCORE_THRESHOLD` in `prioritize.ts`; repoint signin redirect; guard `/` for logged-in users.

**Out of scope:** global "Due today: N" headline; schema/migration; new API routes or islands; per-user timezone; SRS due-date model; changes to study/import flows.

## Architecture / Approach

A new server-side `src/lib/dashboard.ts` issues three bounded queries (sets+flashcard-ids, the user's history, the user's sessions) and folds them into a typed `DashboardData` (per-set due counts, last-activity ordering, resume target, streak). Pure helpers `computeStreak` and `isDue` (with injected `now`) hold the math. The page is a thin renderer; redirects are two small edits.

## Phases at a Glance

| Phase                  | What it delivers                                                | Key risk                                        |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| 1. Data layer          | `isDue` + `dashboard.ts` aggregation (typed, pure math)         | Getting the due cutoff & streak grace-day right |
| 2. Dashboard UI        | Rewritten `/dashboard`: CTA, streak, recent+badges, empty state | Resume/CTA target correctness across states     |
| 3. Landing & redirects | signin→`/dashboard`; logged-in `/` guard                        | Avoiding a redirect loop with sign-out (→`/`)   |

**Prerequisites:** F-01, S-02, S-03, S-06, S-09 all landed (they are).
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- "Due" is a tuned threshold over `priorityScore`, not a calendar date — `DUE_SCORE_THRESHOLD` default needs a sanity check against real seeded history.
- UTC streak can feel off near local midnight; accepted for MVP (timezone seam documented).
- Manually testing the streak requires a backdated `study_sessions` insert (app can't write past timestamps).

## Success Criteria (Summary)

- After login the user lands on a `/dashboard` that tells them what to do next (resume/start, streak, due-per-set), not a placeholder.
- A brand-new user sees a clear onboarding card into `/sets`.
- Due badges and streak reflect the user's actual history.
