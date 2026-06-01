# CSV Set Import & List — Plan Brief

> Full plan: `context/changes/csv-set-import-and-list/plan.md`

## What & Why

Roadmap slice **S-01**: let a signed-in user upload a CSV (`name, latitude, longitude`) to create a named study set (FR-004) and see their sets listed to pick one to study (FR-005). It's the first slice to write domain rows on F-01's schema and it gates the north-star slice S-02.

## Starting Point

F-01 landed the schema: `sets` + `flashcards` tables with RLS (`(select auth.uid()) = user_id`), coordinate CHECK constraints, and generated TS types. Auth, the `@/`-aliased Supabase client factory (`createClient(headers, cookies)`, which can return `null`), and the React-island conventions are live. **Gaps:** no CSV parser, no data-access layer, no `/sets` UI, no JSON API route, and no test runner. Route-gating is an **allowlist** (`PROTECTED_ROUTES = ["/dashboard"]`), so a new `/sets` page is _not_ auto-protected. The only shadcn primitive present is `Button`; auth forms hand-roll the rest and surface errors via a `ServerError` component (no shadcn `Alert`).

## Desired End State

`/sets` (reached from the home nav, redirecting to signin if logged out) shows an inline import card and a newest-first list of the user's sets (name, date, flashcard count) or an empty state. Pick a `.csv` → name prefills from the filename and is editable → import → land back on `/sets` with the new set on top. A malformed file is rejected whole with one friendly message, creating nothing. A second user never sees the first user's sets.

## Key Decisions Made

| Decision         | Choice                                                 | Why (1 sentence)                                                                                                          |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| CSV parser       | `papaparse`                                            | Correctly handles quoted fields / commas in geographic names.                                                             |
| Parse location   | Server-side; island POSTs JSON `{ name, csv }`         | Single parse+validate authority; avoids Workers multipart friction.                                                       |
| Submission style | fetch + JSON island (new pattern)                      | Must read a `File` in the browser; auth's native form-POST can't; reuses `Button`/`ServerError` so it still looks native. |
| Set name source  | Prefilled from filename, editable                      | Zero-friction default with user control.                                                                                  |
| Malformed rows   | Reject whole import, one generic error                 | Keeps S-01 thin and atomic; per-row reporting is S-05.                                                                    |
| Placement        | Dedicated `/sets` page, import inline                  | Clean "pick a set" home for S-02; room for S-04 delete.                                                                   |
| Auth gating      | Add `/sets` to `PROTECTED_ROUTES`; API self-guards 401 | Middleware is allowlist-based; a 302→HTML redirect would corrupt a fetch.                                                 |
| List row         | Name + date + count; row links to `/study/:id`         | Honors the planning choice and satisfies "pick one to study"; link 404s until S-02 (accepted).                            |
| Post-import      | Client redirect to `/sets`, new set on top             | The list is the confirmation.                                                                                             |
| Insert atomicity | Set-first, then bulk flashcards; best-effort cleanup   | PostgREST isn't transactional; avoids a Postgres RPC/migration.                                                           |

## Scope

**In scope:** papaparse dependency; a `src/lib/csv.ts` parse/validate module; `POST /api/sets` (self-guarded JSON route); a `/sets` page with a server-rendered list + empty state; the middleware gate; a Topbar nav link; an `ImportSetForm` island.

**Out of scope:** per-row malformed reporting (S-05), delete (S-04), studying / clickable rows (S-02), non-UTF-8 encodings, edit/export, unique names, pagination, adding shadcn `Card`/`Input`/`Alert`.

## Architecture / Approach

Bottom-up: (1) backend — dependency + pure parse/validate module + the create-set route (auth-guard → null-check client → parse → insert `set` then bulk-insert `flashcards`, each carrying `user_id`, with best-effort set cleanup on failure); (2) the `/sets` page + server-rendered list + middleware gate + nav link (the redirect target); (3) the import island mounted on `/sets`, closing the loop. The browser reads the file as text and POSTs JSON; the route owns all parsing and validation.

## Phases at a Glance

| Phase                        | What it delivers                                        | Key risk                                                                                |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1. Import backend            | papaparse + `csv.ts` + `POST /api/sets`                 | Non-transactional 2-table insert → orphan set on partial failure (mitigated by cleanup) |
| 2. Sets page + list + gating | `/sets` list + empty state + middleware gate + nav link | Forgetting the `PROTECTED_ROUTES` entry would leave `/sets` ungated                     |
| 3. Import UI                 | `ImportSetForm` island, full import→list loop           | New fetch+JSON pattern; must set `user_id` on inserts or RLS rejects them               |

**Prerequisites:** F-01 `domain-data-schema` — done (confirm both migrations are pushed: `npx supabase migration list --linked`). A real signed-in account for manual checks (the seed's placeholder `user_id` won't match a live session under RLS).
**Estimated effort:** ~1–2 sessions across the 3 phases; small slice by design.

## Open Risks & Assumptions

- Two-step insert isn't transactional; best-effort cleanup is accepted over adding a Postgres RPC/migration. Revisit only if orphan sets prove real.
- A fetch+JSON island and a JSON API route are new conventions for this codebase (auth uses native form POST + server redirect); justified by the file-read requirement.
- Assumes UTF-8, decimal-degree coordinates, and exact lowercase headers `name,latitude,longitude` (header flexibility / encodings are S-05).

## Success Criteria (Summary)

- A user imports a valid CSV and immediately sees the new set listed with the correct item count.
- A malformed CSV is rejected whole with one generic message and creates nothing.
- A user only ever sees their own sets; `/sets` is gated; `npm run typecheck`, scoped lint, and `npm run build` all pass.
