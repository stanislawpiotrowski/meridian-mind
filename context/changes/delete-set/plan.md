# Delete a Set Implementation Plan

## Overview

Let a signed-in user hard-delete a set they previously imported (FR-006). Deletion is a single `DELETE /api/sets/[id]` route plus a per-row delete control on the My Sets page. A browser `confirm()` stands in as the "implied confirmation dialog"; on success the page reloads to re-render the authoritative list. Soft-delete / undo is an explicit Non-Goal.

## Current State Analysis

- **Data layer is complete (F-01).** `supabase/migrations/20260530202638_domain_data_schema.sql` declares `sets` with `ON DELETE CASCADE` on every dependent FK — `flashcards` (`:39`), `study_sessions` (`:63`), `study_history` (`:85-86`). Deleting one `sets` row purges all dependents at the DB level. **No migration is needed.**
- **RLS already covers DELETE.** The `sets_owner` policy (`:28-32`) is `for all`, so a delete is auto-scoped to `auth.uid() = user_id`. A delete targeting another user's set (or a non-existent id) simply affects 0 rows — no leak, no error.
- **API has create only.** `src/pages/api/sets/index.ts` exposes `POST` with a consistent shape: 401 self-guard on `context.locals.user`, `createClient(headers, cookies)`, JSON error bodies. There is no dynamic `[id]` route yet.
- **The list row is a single full-width anchor.** `src/pages/sets/index.astro:54-66` renders each set as `<li><a href="/study/:id">…</a></li>`. A button cannot nest inside that anchor (invalid HTML), and the page is server-rendered, so any interactive delete must be a React island.
- **Post-action convention is a reload.** `src/components/sets/ImportSetForm.tsx:49` navigates via `window.location` after a successful mutation rather than mutating client state.
- **No dialog/toast primitives.** `src/components/ui/` contains only `button.tsx`; the project has no Radix dialog or sonner. `confirm()` keeps this slice dependency-free.

## Desired End State

On `/sets`, every set row shows a delete control beside the existing study link. Clicking it asks for confirmation; on confirm, the set and all its flashcards / sessions / history are removed and the list re-renders without that set. Deleting is owner-scoped and idempotent. Verified by: importing a set, deleting it, and seeing it gone after reload — with the row's dependents purged in the DB.

### Key Discoveries:

- Cascade + RLS make this a thin slice — no schema work (`...domain_data_schema.sql:39-86`, `:28-32`).
- Mirror the `POST` self-guard pattern for the new `DELETE` handler (`src/pages/api/sets/index.ts:5-13,54-61`).
- Row restructure required because the whole row is currently one `<a>` (`src/pages/sets/index.astro:54-66`).
- Reload-after-mutation is the established pattern (`ImportSetForm.tsx:49`).

## What We're NOT Doing

- No soft-delete, trash, or undo (PRD Non-Goal).
- No styled/modal confirmation dialog and no new dependency — `confirm()` only.
- No optimistic / client-side list state — full reload after delete.
- No bulk delete, no per-flashcard delete (FR-006 is set-level).
- No new migration; the cascade and RLS already exist.

## Implementation Approach

Two phases: first the server endpoint (independently verifiable), then the UI that calls it. The endpoint relies entirely on RLS for authorization and on `ON DELETE CASCADE` for dependent cleanup, returning `204` regardless of affected-row count (idempotent). The UI keeps the existing study link intact and adds a sibling delete button inside a flex row, extracted into a small client island.

## Phase 1: DELETE API route

### Overview

Add a dynamic route that deletes one set by id for the authenticated owner.

### Changes Required:

#### 1. Set delete endpoint

**File**: `src/pages/api/sets/[id].ts` (new)

**Intent**: Expose `DELETE` so the client can remove a set. Authorization and dependent cleanup are delegated to RLS and `ON DELETE CASCADE` respectively; the handler only needs to guard auth, validate the id, and issue the delete.

**Contract**: `export const DELETE: APIRoute`. Reads `context.params.id`; returns `401` when `context.locals.user` is absent (mirror `index.ts:5-13`), `400` when `id` is missing/empty, `500` when `createClient` returns null or the delete errors. On success returns `204` with no body — idempotent: a 0-row result (already-deleted or not-owned, since RLS filters it out) is still `204`. The delete is `supabase.from("sets").delete().eq("id", id)`; no `.select()` count check.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck` (or project's `astro check`)
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- `DELETE /api/sets/<own-set-id>` returns 204 and the set/flashcards/history are gone from the DB.
- `DELETE /api/sets/<other-users-set-id>` returns 204 but leaves that set intact (RLS no-op).
- `DELETE /api/sets/<id>` while signed out returns 401.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before starting Phase 2.

---

## Phase 2: Delete button UI

### Overview

Surface a per-row delete control on `/sets` that confirms, calls the endpoint, and reloads.

### Changes Required:

#### 1. Delete button island

**File**: `src/components/sets/DeleteSetButton.tsx` (new)

**Intent**: A small client component that, given a set id (and name for the prompt), confirms with the user, calls the DELETE endpoint, and reloads the page on success. Surfaces an error inline on failure, matching `ImportSetForm`'s `loading`/`error` handling.

**Contract**: Default export `DeleteSetButton({ setId, setName }: { setId: string; setName: string })`. On click: `window.confirm(...)` → if confirmed, `fetch(\`/api/sets/${setId}\`, { method: "DELETE" })`→ on`response.ok`call`window.location.reload()`, else show an error (reuse `ServerError` or equivalent). Disable the button while the request is in flight. Renders an icon/text button styled consistently with the cosmic UI.

#### 2. List row restructure

**File**: `src/pages/sets/index.astro`

**Intent**: Split the full-width anchor so the study link and the delete button are valid siblings, and mount the delete island per row.

**Contract**: Replace each `<li>`'s single `<a>` (`:54-66`) with a flex container: the existing name/meta block stays an `<a href="/study/:id">` (study-click target preserved), and `<DeleteSetButton client:load setId={set.id} setName={set.name} />` sits as a sibling. Import the component in the frontmatter. No change to the empty-state branch.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- A delete button appears on each set row; the row's study link still navigates to `/study/:id`.
- Clicking delete and cancelling the confirm leaves the set in place.
- Confirming deletes the set; after reload it's gone and the cards/history are purged.
- Deleting the last set shows the "No sets yet" empty state.
- A failed delete surfaces an inline error and does not reload.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps:

1. Import a CSV set, confirm it lists with a card count.
2. Click delete → cancel → set remains.
3. Click delete → confirm → set disappears after reload.
4. In the DB, confirm flashcards / study_sessions / study_history for that set id are gone (cascade).
5. Delete all sets → empty state renders.
6. (Isolation) With a second account's set id, issue a DELETE and confirm it's untouched.

## Migration Notes

None — no schema change. Cascade and RLS were established in F-01.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-04)
- Schema (cascade + RLS): `supabase/migrations/20260530202638_domain_data_schema.sql:28-86`
- API create pattern: `src/pages/api/sets/index.ts:5-13,54-61`
- List page + row markup: `src/pages/sets/index.astro:54-66`
- Mutation-then-reload pattern: `src/components/sets/ImportSetForm.tsx:49`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DELETE API route

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes
- [x] 1.3 Build succeeds

#### Manual

- [ ] 1.4 DELETE own set returns 204 and purges dependents
- [ ] 1.5 DELETE other user's set returns 204 but leaves it intact
- [ ] 1.6 DELETE while signed out returns 401

### Phase 2: Delete button UI

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes
- [ ] 2.3 Build succeeds

#### Manual

- [ ] 2.4 Delete button shows per row; study link still works
- [ ] 2.5 Cancel confirm leaves set in place
- [ ] 2.6 Confirm deletes set; gone after reload, dependents purged
- [ ] 2.7 Deleting last set shows empty state
- [ ] 2.8 Failed delete surfaces inline error, no reload
