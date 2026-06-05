# CSV Set Import & List — Implementation Plan

## Overview

Deliver roadmap slice **S-01**: a signed-in user can upload a CSV (`name, latitude, longitude`) to create a named study set (FR-004), and see all their sets listed to pick one to study (FR-005). This is the first slice to write domain rows on top of F-01's schema, and it gates the north-star slice S-02.

The browser island reads the chosen file as text and POSTs JSON `{ name, csv }`; the API route parses with papaparse, validates against the same rules the DB enforces, and inserts. Import is all-or-nothing — any malformed row rejects the whole file with one generic error; per-row reporting is deferred to S-05.

## Current State Analysis

- **Schema is ready (F-01)** — `supabase/migrations/20260530202638_domain_data_schema.sql` (+ `20260531003200_study_history_append_only.sql`, which only touches `study_history`):
  - `sets(id uuid pk default gen_random_uuid(), user_id uuid not null → auth.users on delete cascade, name text not null, created_at timestamptz not null default now())`. **No length CHECK on `name`; no unique constraint on `(user_id, name)`** — duplicate names allowed.
  - `flashcards(id, set_id → sets on delete cascade, user_id → auth.users on delete cascade, name text not null, latitude double precision not null check between -90 and 90, longitude double precision not null check between -180 and 180, created_at)`. Index on `(set_id)`. **Coordinate ranges are the only CHECKs; `name` has no length CHECK.**
  - RLS **enabled** on both; one `FOR ALL TO authenticated` owner policy each, `using / with check ((select auth.uid()) = user_id)`.
  - **Denormalized `user_id` on `flashcards` is load-bearing** — every flashcard insert must set `user_id` to the caller's id or the `WITH CHECK` rejects the row. There is no DB default for it.
  - Generated types at `src/db/database.types.ts` (`Database`, plus `Tables`/`TablesInsert`/`TablesUpdate` helpers). No schema change this slice, so no type regeneration.
- **Conventions to follow (verified):**
  - **Supabase client**: `import { createClient } from "@/lib/supabase"`, called positionally as `createClient(request.headers, cookies)`. It returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset — existing routes null-check it. The key is the anon key, so **all access runs as `authenticated` and RLS is enforced** (no service-role bypass).
  - **Imports**: the `@/` alias (`@/lib/...`, `@/components/ui/button`), not relative paths.
  - **API routes** (`src/pages/api/auth/*.ts`): `export const POST: APIRoute`; no `prerender` line (project is `output: "server"`). The existing routes are **form-POST + `context.redirect()`** handlers with no JSON body — there is **no existing JSON-API precedent**. This slice deliberately introduces a JSON route (see Implementation Approach).
  - **Auth user in a route**: read `context.locals.user` (middleware sets it for every request via `supabase.auth.getUser()`).
  - **Middleware** (`src/middleware.ts`): gates by an **allowlist** — `PROTECTED_ROUTES = ["/dashboard"]`. Only matching prefixes redirect unauthenticated users to `/auth/signin`. **`/sets` is not protected unless added here.**
  - **React islands** (`src/components/auth/*`): mounted `client:load`. Auth forms are native `<form method="POST">` + server redirect + `useFormStatus()` for pending + a prop-drilled `serverError`. Errors render via the hand-rolled `ServerError` component (`@/components/auth/ServerError`) — **there is no shadcn `Alert`**. The only shadcn primitive present is `Button` (`@/components/ui/button`); `Card`/`Input`/`Label` do **not** exist.
  - **Pages**: read `Astro.locals.user`; wrap content in `Layout`; the shared auth-aware nav is `Topbar.astro` (logged-in branch shows email + Dashboard + Sign out). `index.astro` renders a static `Welcome` hero (which includes `Topbar`); it has no per-user branch of its own. Style is glassmorphism on `bg-cosmic` (`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl`).
- **Gaps this slice fills:** no CSV parser, no zod (auth validates by hand), no data-access layer (first slice to insert domain rows), no `/sets` UI, no JSON API route. **No test runner exists** (Module 3 scope) — verification is `astro check` + scoped lint + `astro build` + manual.

## Desired End State

A signed-in user reaches `/sets` from the home nav, sees an inline import card and a newest-first list of their sets (name, created date, flashcard count) — each row linking to its study page at `/study/<id>` — or an empty state. They pick a `.csv`, the name field prefills from the filename and is editable, they import, and on success they land back on `/sets` with the new set at the top. A malformed file (bad/missing column, out-of-range coordinate, empty) is rejected whole with a single friendly message and creates nothing. A second user never sees the first user's sets. Visiting `/sets` while signed out redirects to `/auth/signin`.

Verify: `npm run typecheck`, scoped lint on touched files, and `npm run build` all pass; the manual flows in each phase's Success Criteria hold.

### Key Discoveries:

- **Middleware is allow-list gating** (`src/middleware.ts:4`, `:18`) — `/sets` must be added to `PROTECTED_ROUTES` to be auth-gated; it is not automatic.
- Denormalized `user_id` must be set on **both** the `sets` insert and every `flashcards` insert (`...20260530202638_domain_data_schema.sql:40`,`:54`; confirmed in `context/changes/domain-data-schema/reviews/impl-review.md`).
- PostgREST embedded aggregate gives per-set counts in one query: `select("id, name, created_at, flashcards(count)")` returns `flashcards: [{ count }]`; read as `row.flashcards[0]?.count ?? 0`.
- Two-table insert via PostgREST is **not transactional** — set-first then flashcards; delete the set if the flashcard insert fails. No RPC exists for atomicity.
- `createClient(...)` can return `null`; both the route and the page must handle that.
- DB CHECK constraints exist only for coordinates (`-90..90`, `-180..180`). The route mirrors those to fail fast with a friendly message; the `name` length bound is an application choice, not a DB rule.
- papaparse runs synchronously on a string — fine inside a Cloudflare Worker; no streaming/file APIs needed.

## What We're NOT Doing

- **Per-row malformed reporting** (1-indexed row, field, reason, import-valid-only vs cancel) — that's **S-05**. Here, any bad row → one generic error, import nothing.
- **Deleting sets** — **S-04** (the `/api/sets/` folder leaves room for `[id].ts` later).
- **Building the study session / quiz loop** — **S-02** owns `/study/<id>` and everything behind it. List rows link to `/study/<set.id>` (honoring the planning decision, so "pick one to study" works literally), but that target 404s until S-02 ships — an accepted dead-end for this slice.
- **Non-UTF-8 encodings** — out of scope (S-05 / Open Roadmap Question).
- **Editing a set or flashcard after import**, **CSV export** — PRD Non-Goals.
- **Transactional multi-row insert via a Postgres RPC** — using best-effort cleanup instead (see Critical Implementation Details); revisit only if orphan sets prove to be a real problem.
- **Adding shadcn `Card`/`Input`/`Alert`** — hand-roll Tailwind to match the existing auth forms, reusing `Button` and `ServerError`.
- **Unique/dedup set names, pagination, drag-and-drop, multi-file import, progress bars** — unneeded at MVP volumes.

## Implementation Approach

Build bottom-up in three independently verifiable phases: (1) the import backend (dependency + parse/validate module + `POST /api/sets`), verifiable by an API call; (2) the `/sets` page, its server-rendered list, the middleware gate, and a nav link, so the redirect target exists and FR-005 is met; (3) the import island mounted on `/sets`, closing the loop so an upload appears in the list. Each phase ends green on typecheck/scoped-lint/build before the next.

Note on convention: the auth forms submit as native `<form method="POST">` and let the server redirect. This slice instead uses a **fetch + JSON island** because it must read a `File` in the browser and send a structured body. That is a deliberate new pattern for this codebase, justified by the file-read requirement; it reuses the existing `Button` and `ServerError` primitives so the surface still looks native. Because this is the first JSON route + fetch island, it sets the convention S-02/S-03/S-04 will copy — earmark it for `/10x-lesson` if the S-02 review echoes the same pattern choice.

## Critical Implementation Details

- **Denormalized `user_id` is mandatory.** Set `user_id = locals.user.id` on the `sets` insert and on every `flashcards` row, or RLS `WITH CHECK` rejects the insert. There is no DB default.
- **Non-transactional two-step insert.** Insert the `set`, get its `id` (`.select("id").single()`), then bulk-insert the flashcards array. If the flashcard insert errors, delete the just-created set (best-effort) and return 500 so no orphan empty set lingers. On the happy path this failure is essentially infra-only, since row values are pre-validated against the CHECK rules.
- **Transport for parsing.** The island sends JSON `{ name: string, csv: string }` where `csv = await file.text()` — not `multipart/form-data`. Avoids Cloudflare Workers `request.formData()` friction and keeps a clean contract S-05 can reuse.
- **Auth gating is split.** The **page** `/sets` is gated by adding it to `PROTECTED_ROUTES` (middleware redirect — correct for a page). The **API** `/api/sets` is _not_ added there (a 302→HTML redirect would corrupt a fetch); instead it self-guards on `locals.user` and returns `401 { error }`. Both still see `locals.user` because middleware populates it on every request.
- **Count extraction.** From `select("id, name, created_at, flashcards(count)")`, read `row.flashcards[0]?.count ?? 0`.
- **Lint baseline is dirty.** ~1000 pre-existing CRLF errors exist on untouched files (per F-01). Scope the lint gate to touched files (`npx eslint <files>`); do not expect global `npm run lint` to be green.

---

## Phase 1: Import backend

### Overview

Add the CSV dependency, a pure parse-and-validate module, and the `POST /api/sets` route that turns a raw CSV + name into a `set` row plus its `flashcards`, enforcing per-user ownership and atomic all-or-nothing semantics. The Phase-1 `npm run build` (a Cloudflare Workers build) doubles as the papaparse-in-Workers smoke test — this is the parser's first use in that runtime, so don't defer it.

### Changes Required:

#### 1. Add papaparse dependency

**File**: `package.json`

**Intent**: Add a robust CSV parser that correctly handles quoted fields and embedded commas (geographic names like "Washington, D.C.").

**Contract**: Add `papaparse` to `dependencies` and `@types/papaparse` to `devDependencies`; install so the lockfile updates. No script changes.

#### 2. CSV parse & validate module

**File**: `src/lib/csv.ts` (new)

**Intent**: One pure function that parses raw CSV text and either returns clean, typed rows or a single generic error — the atomic, happy-path-only gate. Coordinate validation mirrors the DB CHECK rules so failures are friendly, not raw Postgres errors. Deliberately carries **no** per-row detail (that's S-05).

**Contract**: Export `type ParsedFlashcard = { name: string; latitude: number; longitude: number }` and a discriminated result `type CsvParseResult = { ok: true; rows: ParsedFlashcard[] } | { ok: false; error: string }`. Export `parseAndValidateCsv(raw: string): CsvParseResult`. Rules, in order, each returning `{ ok: false, error }` on failure:

- Parse via papaparse with `{ header: true, skipEmptyLines: true }`.
- Required headers present (exact lowercase): `name`, `latitude`, `longitude`.
- At least one data row; reject an empty file/zero rows.
- A sane upper bound on row count (reject absurd inputs, e.g. > 1000 rows) to protect the Worker — generic error.
- Each row: `name` trimmed length 1..200 (application bound — the DB does not enforce length). For `latitude`/`longitude`: **reject the row if the trimmed cell is empty/blank** (guard against `Number("") === 0` silently becoming a valid `(0,0)`), then require the trimmed cell to be a complete finite numeric literal (`Number(cell)` with `Number.isFinite`, which also rejects `"12abc"` → `NaN`); finally enforce the ranges `[-90,90]` / `[-180,180]`.
- On all-valid: `{ ok: true, rows }` with coordinates coerced to `number` and `name` trimmed.

#### 3. Create-set API route

**File**: `src/pages/api/sets/index.ts` (new)

**Intent**: Authenticated JSON endpoint that creates a set and its flashcards from an uploaded CSV, following the insert/cleanup ordering above. Establishes the slice's JSON-route convention.

**Contract**: `export const POST: APIRoute`. Request JSON `{ name: string, csv: string }`. Behavior:

- Guard auth via `context.locals.user`; if absent → `401 { error }`.
- Parse the JSON body inside a try/catch — a malformed/empty body (`request.json()` throws `SyntaxError`) → `400 { error }`, not an uncaught 500.
- Validate `name` (trimmed 1..200) and that `csv` is a non-empty string; else `400 { error }`.
- `parseAndValidateCsv(csv)`; on `!ok` → `400 { error }`.
- `createClient(context.request.headers, context.cookies)`; if `null` → `500 { error: "Supabase is not configured" }` (mirrors the existing routes' null-check).
- Insert `sets` row `{ user_id: locals.user.id, name }`, `.select("id").single()`; on error → `500 { error }`.
- Bulk-insert flashcards mapped to `{ set_id, user_id: locals.user.id, name, latitude, longitude }` via one `.insert([...])`.
- If the flashcard insert errors → delete the set by id (best-effort) and return `500 { error }`.
- Success → `200 { set: { id, name } }`. Use `new Response(JSON.stringify(...), { status, headers: { "Content-Type": "application/json" } })` (or `Response.json`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/lib/csv.ts src/pages/api/sets/index.ts`
- Build succeeds with the new route: `npm run build`
- `papaparse` + `@types/papaparse` present in `package.json` and the lockfile

#### Manual Verification:

- As an authenticated user, POST `{ name, csv }` with a valid CSV → 200; one `sets` row and N `flashcards` rows exist (Supabase Studio), all with the caller's `user_id`
- POST with a malformed CSV (out-of-range coordinate / missing `latitude` column / empty file) → 400 with a generic error; no rows created
- POST while unauthenticated → 401, nothing created
- No orphan empty set remains if the flashcard insert fails (reason through / simulate)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Sets page + list + gating (FR-005)

### Overview

Create the server-rendered `/sets` page that lists the user's sets newest-first with name, date, and flashcard count, plus an empty state; gate it in middleware; and link to it from the shared nav. This builds the redirect target before the import form that uses it.

### Changes Required:

#### 1. Sets list page

**File**: `src/pages/sets/index.astro` (new)

**Intent**: Show the signed-in user their sets so they can pick one to study (the pick action lands in S-02). Pure server read; no island needed for the list.

**Contract**: In frontmatter, read `const { user } = Astro.locals` and, for type-safety + defense in depth, `if (!user) return Astro.redirect("/auth/signin")` (middleware already guards, but `user` is typed nullable). Create the client with `createClient(Astro.request.headers, Astro.cookies)`; if `null`, render an empty/config state (the `Layout` Banner already warns). Query `from("sets").select("id, name, created_at, flashcards(count)").eq("user_id", user.id).order("created_at", { ascending: false })`. Render inside `Layout` (with `Topbar`): a heading, a placeholder slot where the import island mounts in Phase 3, then either the list (each row: name, locale-formatted `created_at`, count via `row.flashcards[0]?.count ?? 0`, the row linking to `/study/<set.id>`) or an empty-state prompt. Hand-rolled Tailwind matching the glassmorphism card style; no shadcn `Card`/`Table`.

#### 2. Gate /sets in middleware

**File**: `src/middleware.ts`

**Intent**: Make `/sets` require authentication, matching how `/dashboard` is protected.

**Contract**: Add `"/sets"` to the `PROTECTED_ROUTES` array. No other change. (Do **not** add `/api/sets` — it self-guards with a 401 in Phase 1.)

#### 3. Link to /sets from the nav

**File**: `src/components/Topbar.astro`

**Intent**: Give the logged-in user a way to reach their sets from the home page.

**Contract**: In the `user ?` (logged-in) branch, add a "My sets" link to `/sets` alongside the existing Dashboard link, styled identically. No change to the logged-out branch.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/pages/sets/index.astro src/middleware.ts src/components/Topbar.astro`
- Build succeeds with the new page: `npm run build`

#### Manual Verification:

- With ≥1 set (created via Phase 1 or manual insert), `/sets` lists each with name, formatted date, and correct item count, newest first
- With no sets, `/sets` shows the empty state
- The home page nav shows a working "My sets" link to `/sets` when logged in
- Visiting `/sets` while signed out redirects to `/auth/signin`
- A second user does not see the first user's sets
- Each set row links to `/study/<id>` (the target 404s until S-02 — expected this slice)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Import UI (FR-004 client)

### Overview

Add the `ImportSetForm` React island to `/sets`: pick a file, name prefilled-and-editable, submit reads the file text and POSTs JSON to the Phase-1 route, errors surface inline, and success redirects back to `/sets` with the new set on top — closing the import → list loop.

### Changes Required:

#### 1. Import form island

**File**: `src/components/sets/ImportSetForm.tsx` (new)

**Intent**: The client half of import — a fetch+JSON form (the new pattern), reusing existing primitives so it looks native.

**Contract**: `useState` for `file: File | null`, `name: string`, `error: string | null`, `loading: boolean` (manual loading, since `useFormStatus` only works for native form submits). Render a hand-rolled glassmorphism card containing: a file `<input type="file" accept=".csv,text/csv">`, a labeled text `<input>` for the editable name (Tailwind styled like `FormField`'s `inputBase`), the reused `ServerError` (`@/components/auth/ServerError`) for the error, and a full-width `Button` (`@/components/ui/button`) disabled while loading with a pending label. On file select, set the file and prefill `name` from the filename with `.csv` stripped. On submit: `e.preventDefault()`; require a file and non-empty name; `const csv = await file.text()`; `fetch("/api/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, csv }) })`; on `!response.ok` read `data.error` into `error`; on success `window.location.href = "/sets"`. Imports via the `@/` alias.

#### 2. Mount the island on /sets

**File**: `src/pages/sets/index.astro`

**Intent**: Place the import card at the top of the sets page.

**Contract**: Import `ImportSetForm` from `@/components/sets/ImportSetForm` and render `<ImportSetForm client:load />` in the placeholder slot from Phase 2.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/components/sets/ImportSetForm.tsx src/pages/sets/index.astro`
- Build succeeds with the island: `npm run build`

#### Manual Verification:

- Selecting a `.csv` prefills the name from the filename (sans `.csv`); the name is editable before submit
- Submitting a valid CSV imports and redirects to `/sets` with the new set at the top
- Submitting a malformed CSV shows the generic error via `ServerError` and stays on the page (no set created)
- The submit button is disabled and shows a loading label during the request
- End-to-end: import a continent-scale CSV (~50–300 rows) → set appears listed with the right count (US-01 import→list portion); feels responsive (well within the import budget)

**Implementation Note**: After completing this phase and all automated verification passes, the slice is functionally complete — confirm the full loop manually.

---

## Testing Strategy

No automated test runner exists yet (testing is introduced in Module 3). Verification is the typecheck / scoped-lint / build gate plus manual checks.

### Manual Testing Steps:

1. Sign up / sign in; from the home nav click "My sets" → `/sets` (empty state shows).
2. Import a valid CSV (`name,latitude,longitude`, ~50–300 continent-scale rows, including a quoted name with a comma) → redirected to `/sets`, new set on top with the correct count.
3. Re-import the same file → a second set appears (duplicate names allowed by design).
4. Import a file with a missing column, an out-of-range coordinate, and an empty file → each rejected with a generic error; nothing created.
5. Sign in as a second user → their `/sets` is empty; they cannot see the first user's sets.
6. Sign out, visit `/sets` directly → redirected to `/auth/signin`.

## Performance Considerations

papaparse on ≤300 rows is sub-millisecond; the import is two DB round-trips (one set insert, one bulk flashcards insert), comfortably inside the import budget. The list query is a single indexed read on `sets.user_id` with an embedded count; fine at MVP volumes (a user has few sets) — no pagination needed. (The 500 ms p95 NFR is about per-click study feedback in S-02, not import; noted to avoid conflating the two.)

## Migration Notes

No schema migration (F-01 schema is reused as-is). Confirm both F-01 migrations are actually applied to the remote project before relying on the schema: `npx supabase migration list --linked` (per the F-01 review, the append-only follow-up may have been authored before a successful push, and `db push` needs `SUPABASE_DB_PASSWORD` in the environment). The only dependency change is adding `papaparse` / `@types/papaparse`. No type regeneration needed since no columns change.

## References

- Change identity: `context/changes/csv-set-import-and-list/change.md`
- Roadmap slice S-01: `context/foundation/roadmap.md`
- PRD FR-004/FR-005, US-01: `context/foundation/prd.md`
- Schema + RLS: `supabase/migrations/20260530202638_domain_data_schema.sql`; F-01 review `context/changes/domain-data-schema/reviews/impl-review.md`
- Route pattern (form-POST baseline): `src/pages/api/auth/signin.ts`
- Island + error/button primitives: `src/components/auth/SignUpForm.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/ui/button.tsx`
- Page / locals / nav pattern: `src/pages/dashboard.astro`, `src/components/Topbar.astro`, `src/middleware.ts`, `src/lib/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Import backend

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — 211b788
- [x] 1.2 Linting passes on touched files: `npx eslint src/lib/csv.ts src/pages/api/sets/index.ts` — 211b788
- [x] 1.3 Build succeeds with the new route: `npm run build` — 211b788
- [x] 1.4 `papaparse` + `@types/papaparse` present in `package.json` and the lockfile` — 211b788

#### Manual

- [x] 1.5 Valid CSV POST → 200; set + flashcards rows created with caller's `user_id` — 211b788
- [x] 1.6 Malformed CSV POST → 400 generic error; no rows created — 211b788
- [x] 1.7 Unauthenticated POST → 401; nothing created — 211b788
- [x] 1.8 No orphan empty set if the flashcard insert fails — 211b788

### Phase 2: Sets page + list + gating (FR-005)

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — d46b066
- [x] 2.2 Linting passes on touched files: `npx eslint src/pages/sets/index.astro src/middleware.ts src/components/Topbar.astro` — d46b066
- [x] 2.3 Build succeeds with the new page: `npm run build` — d46b066

#### Manual

- [x] 2.4 `/sets` lists sets with name, formatted date, correct count, newest first — d46b066
- [x] 2.5 `/sets` shows the empty state with no sets — d46b066
- [x] 2.6 Home nav shows a working "My sets" link to `/sets` when logged in — d46b066
- [x] 2.7 Signed-out visit to `/sets` redirects to `/auth/signin` — d46b066
- [x] 2.8 A second user does not see the first user's sets — d46b066
- [x] 2.9 Each set row links to `/study/<id>` (404 until S-02 expected) — d46b066

### Phase 3: Import UI (FR-004 client)

#### Automated

- [x] 3.1 Type checking passes: `npm run typecheck` — 6a4e7e2
- [x] 3.2 Linting passes on touched files: `npx eslint src/components/sets/ImportSetForm.tsx src/pages/sets/index.astro` — 6a4e7e2
- [x] 3.3 Build succeeds with the island: `npm run build` — 6a4e7e2

#### Manual

- [x] 3.4 File select prefills editable name from filename (sans `.csv`) — 6a4e7e2
- [x] 3.5 Valid CSV imports and redirects to `/sets`, new set on top — 6a4e7e2
- [x] 3.6 Malformed CSV shows generic error via `ServerError`; nothing created — 6a4e7e2
- [x] 3.7 Submit button disabled + loading label during request — 6a4e7e2
- [x] 3.8 End-to-end import (~50–300 rows) appears listed with correct count — 6a4e7e2
