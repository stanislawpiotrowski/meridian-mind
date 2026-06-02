# Delete a Set — Plan Brief

> Full plan: `context/changes/delete-set/plan.md`

## What & Why

Let a signed-in user hard-delete a set they previously imported (FR-006). Sets are imported by users and never removable today; deletion closes the basic set-lifecycle gap.

## Starting Point

F-01 already shipped the schema: `sets` has `ON DELETE CASCADE` on flashcards / study_sessions / study_history, and the `sets_owner` RLS policy is `for all`. The My Sets page (`src/pages/sets/index.astro`) lists sets as full-width study links; the API (`src/pages/api/sets/index.ts`) supports create only.

## Desired End State

Each set row on `/sets` shows a delete control next to the study link. Confirming removes the set and all its dependents (cards, sessions, history) and the list re-renders without it. Deletes are owner-scoped and idempotent.

## Key Decisions Made

| Decision            | Choice                              | Why                                                           | Source |
| ------------------- | ----------------------------------- | ------------------------------------------------------------- | ------ |
| Confirmation UX     | Native `window.confirm()`           | Zero deps, satisfies FR-006's implied dialog under speed goal | Plan   |
| Post-delete refresh | Full page reload                    | Mirrors `ImportSetForm`; server re-renders authoritative list | Plan   |
| Endpoint contract   | Idempotent `204` on 0 rows          | RLS prevents cross-user delete; double-delete is harmless     | Plan   |
| Row layout          | Link + sibling delete button (flex) | Valid HTML, keeps study-click target, minimal markup change   | Plan   |
| Migration           | None                                | Cascade + RLS already exist from F-01                         | Plan   |

## Scope

**In scope:** `DELETE /api/sets/[id]` route; per-row `DeleteSetButton` island; list-row restructure.

**Out of scope:** soft-delete/undo, styled modal dialog, new deps, optimistic UI, bulk/per-card delete, any migration.

## Architecture / Approach

Thin two-layer slice. New dynamic route `DELETE /api/sets/[id].ts` self-guards auth and issues `supabase.from("sets").delete().eq("id", id)` — RLS scopes it to the owner, DB cascade purges dependents, returns 204. A `DeleteSetButton` React island confirms, calls the route, and reloads on success; the Astro row splits into a flex container so the study `<a>` and the button are valid siblings.

## Phases at a Glance

| Phase               | What it delivers                        | Key risk                                           |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| 1. DELETE API route | Owner-scoped idempotent delete endpoint | Forgetting RLS already scopes it (no manual check) |
| 2. Delete button UI | Per-row confirm + delete + reload       | Nesting a button in the existing `<a>` (invalid)   |

**Prerequisites:** F-01 (schema/RLS — done), S-01 (import/list — done).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes RLS is the sole authorization layer — the handler does no explicit ownership check (consistent with the create path).
- `confirm()` is intentionally unstyled; acceptable per the speed goal and FR-006's "implied" dialog.

## Success Criteria (Summary)

- User can delete a set from `/sets`; it's gone after reload with dependents purged.
- Cancelling the confirm is a no-op; failures surface an inline error.
- Deletes never affect another user's data.
