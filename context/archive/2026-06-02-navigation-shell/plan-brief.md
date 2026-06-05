# Consistent Navigation Shell — Plan Brief

> Full plan: `context/changes/navigation-shell/plan.md`

## What & Why

Make a nav bar render on **every** authenticated screen so there are no dead-ends. Today `/dashboard` renders no `Topbar` and traps the user with only a Sign-out button. This is roadmap slice S-06 — pure UX.

## Starting Point

`Topbar.astro` exists (no logo; links `Dashboard → My sets`) and is hand-placed in only `sets/index.astro` and `study/[setId].astro`. `dashboard.astro` is a centered card with no Topbar. The base `Layout.astro` has no nav concept — consistency is an unenforced per-page convention, which is how `/dashboard` slipped through.

## Desired End State

`/dashboard`, `/sets`, and `/study/[setId]` all render the same shell via a new `AuthLayout`: a `Topbar` with a home logo (→ `/sets`), links ordered `Logo · My sets · Dashboard · Sign out`, and the current page highlighted. `/dashboard` adopts the shared cosmic look and loses its redundant inline Sign-out button.

## Key Decisions Made

| Decision                  | Choice                                  | Why                                                                             | Source |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| Nav placement             | New `AuthLayout` wrapper                | Structurally guarantees no screen forgets the nav — fixes the trap's root cause | Plan   |
| Logo target               | `/sets`                                 | Lands users on a useful screen; S-07 will re-point to `/dashboard` later        | Plan   |
| Link order                | `Logo · My sets · Dashboard · Sign out` | Surfaces "My sets" per roadmap directive                                        | Plan   |
| Dashboard restyle         | Align to bg-cosmic top layout           | Visual consistency across all screens                                           | Plan   |
| Dashboard Sign-out button | Remove (use Topbar's)                   | One canonical sign-out affordance                                               | Plan   |
| Active link               | Highlight via `Astro.url.pathname`      | Standard "where am I" cue; cheap                                                | Plan   |

## Scope

**In scope:** enhance `Topbar` (logo, order, active state); new `AuthLayout`; migrate `dashboard` / `sets` / `study` onto it; remove dashboard's duplicate Sign-out.

**Out of scope:** deleting/repurposing `/dashboard` (S-07); signed-out Topbar, auth pages, `/`, `/map-demo`; sign-out contract; responsive/mobile nav.

## Architecture / Approach

`AuthLayout.astro` wraps base `Layout` + the shared `bg-cosmic` container + `<Topbar />` + a `<slot/>`. Pages drop their duplicated wrapper markup and render content directly inside `AuthLayout`. `Topbar` reads `Astro.url.pathname` for active-link styling.

## Phases at a Glance

| Phase                     | What it delivers                                        | Key risk                                                                      |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Enhance Topbar         | Logo, reordered links, active-state                     | Active match for `/study` (no link) — handled by exact-match graceful default |
| 2. AuthLayout + migration | Shell layout + all 3 pages migrated, dup button removed | Visual regression on sets/study during wrapper swap                           |

**Prerequisites:** none.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes `.astro` presentational components need no automated tests (project has no Astro component-test harness) — verification is manual.
- Logo target `/sets` is interim; S-07 must re-point it when `/dashboard` becomes home.

## Success Criteria (Summary)

- Nav bar renders on `/dashboard`, `/sets`, and `/study/[setId]` — no dead-ends.
- Logo links home, "My sets" is prominent, current page is highlighted.
- Exactly one Sign-out affordance per screen; all screens share one visual shell.
