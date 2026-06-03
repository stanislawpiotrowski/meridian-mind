# Product Landing Page + Logged-out Teaser Quiz (S-08) — Plan Brief

> Full plan: `context/changes/product-landing-and-quiz/plan.md`

## What & Why

Rewrite `/` from the generic "10x Astro Starter" template into a MeridianMind product landing page with an embedded, client-side-only teaser quiz (10 random European capitals). The point is to convert visitors by letting them _experience_ the click-to-verify-on-the-map mechanic, not just read about it — no account required.

## Starting Point

`/` renders `Welcome.astro` (starter boilerplate) inside `Layout.astro`. The map stack is fully reusable and already runs logged-out: `InteractiveMap` (pure React, bundled basemap), `MapDemo` (click→distance pattern + `EUROPE_BBOX`), and `StudySession` (the full quiz loop, but coupled to persistence). `/` is unprotected; `Topbar` already branches on auth state.

## Desired End State

A logged-out visitor lands on MeridianMind branding (hero + 3 wedge cards), plays a 10-capital quiz with live km distance feedback and a revealed correct location, and reaches a score screen offering "Sign up" and "Try again". Logged-in visitors see the same page with CTAs pointing into the app. The quiz makes zero network calls.

## Key Decisions Made

| Decision              | Choice                                 | Why                                                         | Source |
| --------------------- | -------------------------------------- | ----------------------------------------------------------- | ------ |
| Quiz placement        | Section on `/` (`client:visible`)      | One page, shows the hook with no extra click                | Plan   |
| Teaser fidelity       | Mirror real loop, new stateless island | Authentic preview without regressing the authed component   | Plan   |
| Landing content       | Full rewrite + 3 wedge cards           | On-message with the product wedge; clean break from starter | Plan   |
| Capital data          | 10 random from curated ~24-30 pool     | Replayable variety; avoids obscure micro-states             | Plan   |
| End screen            | Score + sign-up CTA + replay           | Converts on the hook while allowing replay                  | Plan   |
| Map framing/threshold | `EUROPE_BBOX` + 300km default          | Consistent with product defaults                            | Plan   |
| Logged-in `/`         | Show landing, adapt CTAs to "my sets"  | No surprising redirect; Topbar already branches             | Plan   |

## Scope

**In scope:** Landing rewrite, curated capitals dataset, stateless `TeaserQuiz` island, auth-adaptive CTAs.

**Out of scope:** Any backend/API/persistence, refactoring `StudySession`/`SessionSummary`, auth/middleware changes, a `/try` route, non-European capitals, scale-adaptive units.

## Architecture / Approach

Static-first: Phase 1 adds the capitals lib + page copy (no React). Phase 2 builds `TeaserQuiz.tsx` in isolation — structurally modeled on `StudySession` but with all persistence stripped, reusing `InteractiveMap`, `haversine`, and `isCorrect`/300km. Phase 3 mounts it on `/` via `client:visible` and verifies both auth states.

## Phases at a Glance

| Phase                     | What it delivers                             | Key risk                                      |
| ------------------------- | -------------------------------------------- | --------------------------------------------- |
| 1. Data + landing rewrite | Capitals dataset + MeridianMind landing copy | Sourcing/verifying coordinates; copy quality  |
| 2. Teaser quiz island     | Stateless `TeaserQuiz.tsx`                   | Correctly stripping persistence from the loop |
| 3. Wire-up + verification | Quiz mounted on `/`; both auth states pass   | `client:visible` mount; logged-in CTA branch  |

**Prerequisites:** None beyond the existing F-02 map foundation (present).
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- Capital coordinates must be verified (the dataset is the main correctness surface).
- `EUROPE_BBOX` should be extracted to a shared module to avoid divergence between `MapDemo` and the teaser.
- 300km threshold is generous for dense Europe — most clicks will read "correct" (accepted per decision).

## Success Criteria (Summary)

- Logged-out `/` plays a full 10-capital quiz end-to-end with a score + sign-up CTA, no network calls.
- "Try again" reshuffles a fresh random 10; "Sign up" → `/auth/signup`.
- Logged-in `/` shows the same page with app-facing CTAs.
