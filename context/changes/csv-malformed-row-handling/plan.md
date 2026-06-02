# CSV Malformed-Row Handling Implementation Plan

## Overview

Deliver roadmap slice **S-05** (US-03, FR-007): a signed-in user importing a CSV with malformed rows sees every invalid row reported _before_ commit — 1-indexed row number, which field(s) failed, and a one-line reason per failure — and chooses to either import the valid rows only or cancel to fix the source file. This upgrades the S-01 import from strictly all-or-nothing to per-row reporting, without silently dropping anything.

The browser island (which already reads and encoding-decodes the file) validates rows in-place using a refactored, still-pure `parseAndValidateCsv`. When every row is valid, the import proceeds in one click exactly as today. When some rows fail, the island renders a scrollable report and offers "Import N valid rows" / "Cancel". On confirm it re-POSTs with an `importValidOnly` flag; the server re-runs the same validator (source of truth) and commits only the rows that pass.

## Current State Analysis

S-01 (`csv-set-import-and-list`) shipped the happy-path import. The relevant code:

- **`src/lib/csv.ts`** — `parseAndValidateCsv(raw): { ok: true; rows } | { ok: false; error }`. It returns on the **first** failure: missing required header, empty file, over the 1000-row cap, an out-of-range/blank/non-numeric coordinate, or a name outside 1..200 chars. No row numbers, no per-field detail. Includes a `normalizeCoordCell` helper (European `,` decimal → `.`) that must be preserved. Constants `MAX_ROWS = 1000`, `MAX_NAME_LENGTH = 200`.
- **`src/pages/api/sets/index.ts`** — `POST` self-guards on `locals.user` (401), parses JSON `{ name, csv }`, validates name (1..200) and non-empty csv, calls `parseAndValidateCsv`, relays `parsed.error` as a 400 on failure, then does the non-transactional two-step insert (set first → flashcards bulk; best-effort delete-set on flashcard-insert failure). Denormalized `user_id` is set on every row (RLS `WITH CHECK`).
- **`src/components/sets/ImportSetForm.tsx`** — island; on submit decodes the file bytes UTF-8-strict → Windows-1250 fallback (per `lessons.md`), POSTs `{ name, csv }`, shows `data.error` via `ServerError`, redirects to `/sets` on success. Uses the reused `Button` and `ServerError` primitives and hand-rolled glassmorphism Tailwind.
- **PRD US-03 / FR-007** (`context/foundation/prd.md:70-85`) fully specifies the contract. Line 84 was revised during this planning session (2026-06-02) to the forgiving-headers behavior (extras tolerated; only missing required headers block).

**No test runner exists** (Module 3 scope). Verification is `npm run typecheck` + scoped `npx eslint` on touched files + `npm run build` + manual.

## Desired End State

A signed-in user on `/sets` picks a `.csv`. If every row is valid, the import behaves exactly as in S-01 — one click, redirect to `/sets`, new set on top. If one or more rows are invalid (missing name, missing/blank coordinate, non-numeric coordinate, latitude outside `[-90,90]`, longitude outside `[-180,180]`, or name over 200 chars), the form shows a report: a summary line ("12 of 300 rows invalid — 288 will import") and a scrollable list of every invalid row (row #, field(s), one-line reason). The user clicks "Import 288 valid rows" (committing exactly the valid rows) or "Cancel" (nothing created, file untouched). If _zero_ rows are valid, the report still lists all failures but the import button is disabled — only Cancel is offered, so no empty set is ever created. File-level problems (missing required header, empty file, over 1000 rows) are reported as a single error before any row reporting, with no import option. Extra columns in the CSV are tolerated and ignored.

Verify: `npm run typecheck`, scoped lint on touched files, and `npm run build` all pass; the manual flows in each phase's Success Criteria hold.

### Key Discoveries:

- `parseAndValidateCsv` is pure (no I/O) — it runs unchanged in the browser island, so the report needs no new endpoint (`src/lib/csv.ts:28`).
- The island already owns encoding decode (`ImportSetForm.tsx:31-37`); keeping validation client-side means the bytes the user previews are exactly the bytes committed — no double-decode divergence.
- The server must re-validate on commit because validation now lives client-side; the existing `POST /api/sets` already calls the same function, so re-validation is essentially free and keeps the server authoritative.
- Row numbering must be defined: papaparse with `skipEmptyLines: true` drops blank lines, so a parsed-data-row ordinal will not equal the physical file line. We use the **1-indexed ordinal among parsed data rows** and document this as a known simplification.
- The two-step insert and denormalized `user_id` requirement are unchanged from S-01 (`api/sets/index.ts:64-97`).
- Lint baseline is dirty (~1000 pre-existing CRLF errors on untouched files); scope the lint gate to touched files (per S-01 plan).

## What We're NOT Doing

- **Editing invalid rows inline / in-app correction** — the choice is binary (import-valid-only or cancel-and-fix-the-file), per PRD line 82. No row editor.
- **Mapping report row numbers to physical CSV line numbers** — we count parsed data rows, not file lines (header + blank lines excluded). Documented, not engineered around.
- **Rejecting extra/unknown columns** — explicitly tolerated and ignored per the revised PRD line 84.
- **Changing the all-valid happy path** — an all-valid file imports in one click, no interstitial report.
- **Non-UTF-8 encoding handling beyond the existing UTF-8→Windows-1250 fallback** — unchanged from S-01; out of scope.
- **Transactional multi-row insert / RPC** — keep S-01's non-transactional set-then-flashcards with best-effort cleanup.
- **Persisting or logging rejected rows server-side** — the report is ephemeral (shown before commit); nothing about invalid rows is stored.
- **A test runner / automated tests** — Module 3 scope.

## Implementation Approach

Build in two independently verifiable phases. Phase 1 reshapes the data contract bottom-up: `parseAndValidateCsv` returns a partition (valid rows + invalid rows with per-field reasons) while keeping file-level errors as a distinct outcome, and `POST /api/sets` gains an `importValidOnly` flag so it can commit a partial set after re-validating. With Phase 1 green, the backend can already import-valid-only; an API call proves it. Phase 2 rebuilds the island into a two-step flow that validates in-browser, renders the report, and drives the confirm/cancel choice — closing the loop. Each phase ends green on typecheck / scoped-lint / build before the next.

The validator's return shape is the linchpin. Today's `{ ok: true; rows }` becomes `{ ok: true; valid; invalid }`; the existing route and the island both consume the new shape. File-level failures stay `{ ok: false; error }`. This is a breaking change to one internal module with exactly two callers, both updated in this plan.

## Critical Implementation Details

- **Row numbering is a parsed-data ordinal, not a file line.** Because `skipEmptyLines: true` discards blank lines, the report's "row N" is the Nth non-empty data row after the header, 1-indexed. Document this in a code comment and the report UI copy ("row" refers to data rows) so a user diffing against their spreadsheet isn't surprised by an off-by-blank-line.
- **Server re-validation is authoritative.** The island validates for the preview, but the commit path (`importValidOnly: true`) re-parses the same `csv` string server-side and commits only the rows the server itself classifies valid. Never trust a client-sent row array — the request body stays `{ name, csv, importValidOnly? }`, never parsed rows.
- **Zero-valid guard.** When `importValidOnly` is true but the server finds zero valid rows, return `400` (do not create an empty set). The island independently disables the import button in this state, but the server enforces it too.
- **Encoding decode stays in the island, before validation.** Validation runs on the already-decoded string so the previewed and committed bytes match (`lessons.md` rule).
- **Name-length and row-cap classification differ.** An over-200-char name is a **per-row** invalid reason (it joins the per-field error list). The 1000-row cap and empty-file and missing-header checks remain **file-level** errors reported before row partitioning.

---

## Phase 1: Validation core + commit contract

### Overview

Refactor `parseAndValidateCsv` to partition rows into valid and invalid (with per-row, per-field reasons) while preserving file-level errors, and extend `POST /api/sets` to accept an `importValidOnly` flag that re-validates and commits only valid rows. Update the two callers' expectations and the PRD acceptance criterion already revised in this session.

### Changes Required:

#### 1. Refactor the CSV validator to partition rows

**File**: `src/lib/csv.ts`

**Intent**: Replace the first-failure, all-or-nothing model with one that collects every invalid row and its per-field reasons, while still short-circuiting on file-level problems (missing required header, empty file, over the row cap). Keep `normalizeCoordCell`, the constants, and the exact validity rules (blank-coordinate guard, finite-number check, ranges, name 1..200) — only the _aggregation_ changes.

**Header case-insensitivity** (closes a PRD gap, prd.md:84 — "headers … (case-insensitive)"). The current `headers.includes(col)` check is case-sensitive, so `Name,Latitude,Longitude` (a common Excel export) is wrongly rejected as a missing-header file-level error. Pass `transformHeader: (h) => h.trim().toLowerCase()` to the `Papa.parse` options so both the required-header check and downstream `row.name` / `row.latitude` / `row.longitude` access work regardless of source casing — no other code changes needed. Add `transformHeader` to the manual verification: a CSV with title-cased headers imports cleanly.

**Contract**: Keep `ParsedFlashcard`. Add:

- `interface RowFieldError { field: "name" | "latitude" | "longitude"; reason: string }`
- `interface InvalidRow { row: number; values: { name: string; latitude: string; longitude: string }; errors: RowFieldError[] }` — `row` is the 1-indexed parsed-data ordinal; `values` carries the raw cells for display.
- Change the success arm of `CsvParseResult` to `{ ok: true; valid: ParsedFlashcard[]; invalid: InvalidRow[] }`. The failure arm `{ ok: false; error: string }` stays and is used **only** for file-level errors (missing header, zero rows, over `MAX_ROWS`).
- `parseAndValidateCsv(raw)`: file-level checks first (unchanged, return `{ ok:false, error }`). Then iterate rows; for each, accumulate `RowFieldError`s across all three fields (do not stop at the first failing field); a row with zero errors pushes to `valid`, otherwise an `InvalidRow` (with its 1-indexed ordinal and raw cell values) pushes to `invalid`. Return `{ ok: true, valid, invalid }`. Name-length violation is a `name` field error; blank/non-numeric/out-of-range coordinates are `latitude`/`longitude` field errors with the existing one-line messages.
- **Guard undefined cells (ragged rows).** With papaparse `header:true`, a data row that has fewer cells than headers yields a row object with **missing keys** (`row.longitude` is `undefined`), so the current unguarded `row.longitude.trim()` would throw — crashing the whole parse on exactly the malformed shape this slice must report. Coerce every cell before trimming: `const name = (row.name ?? "").trim()` (same for `latitude`/`longitude`). A missing/blank `name` becomes a `name` field error; a missing/blank coordinate reuses the existing blank-coordinate field error. The raw `values` stored on the `InvalidRow` should likewise use `row.x ?? ""` so display never sees `undefined`. This makes ragged rows ordinary `InvalidRow`s instead of exceptions.

#### 2. Extend the create-set route with `importValidOnly`

**File**: `src/pages/api/sets/index.ts`

**Intent**: Let the route commit a partial set after re-validating server-side, while preserving the existing all-or-nothing default for an unflagged request (so the happy path is unchanged and a flagless malformed post is still rejected).

**Contract**: Request JSON becomes `{ name: string, csv: string, importValidOnly?: boolean }`. After the existing auth/body/name/csv guards, call the refactored `parseAndValidateCsv(csv)`:

- File-level `{ ok:false }` → `400 { error }` (unchanged behavior).
- `{ ok:true, valid, invalid }`:
  - If `invalid.length > 0` and **not** `importValidOnly` → `400 { error: "<n> row(s) are invalid." }` (defensive; the client normally only posts unflagged when `invalid` is empty).
  - If `valid.length === 0` → `400 { error: "No valid rows to import." }` (covers the all-invalid + flag case; never create an empty set).
  - Otherwise commit `valid` via the **existing** set-then-flashcards two-step (denormalized `user_id`, best-effort cleanup unchanged). Success → `200 { set: { id, name } }`.

#### 3. PRD acceptance-criterion revision (forgiving headers)

**File**: `context/foundation/prd.md`

**Intent**: Record the planning-session decision that extra/unknown columns are tolerated, not rejected.

**Contract**: US-03 acceptance bullet (line 84) revised to: missing required header → file-level error; extra columns tolerated and ignored. _(Already applied in this session — verify it reads as intended.)_

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/lib/csv.ts src/pages/api/sets/index.ts`
- Build succeeds: `npm run build`

#### Manual Verification:

- POST `{ name, csv }` with an all-valid CSV (no flag) → 200; set + N flashcards created (unchanged happy path)
- POST `{ name, csv, importValidOnly: true }` with a CSV mixing valid and invalid rows → 200; the new set contains **exactly** the valid rows, none of the invalid ones
- POST with `importValidOnly: true` where every row is invalid → 400 ("No valid rows"); no set created
- POST with invalid rows and **no** flag → 400; nothing created
- POST with a missing required header / empty file / >1000 rows → 400 file-level error before any row handling

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Pre-commit report UI

### Overview

Rebuild `ImportSetForm` into a two-step flow: decode + validate in-browser, import directly when all rows are valid, otherwise render a scrollable report of every invalid row and offer import-valid-only / cancel.

### Changes Required:

#### 1. Two-step import form with report state

**File**: `src/components/sets/ImportSetForm.tsx`

**Intent**: Add a client-side validate step between file-decode and POST. Keep the existing decode logic and primitives; introduce a "report" view state that lists invalid rows and drives the binary choice.

**Contract**: Add state for the parse result / report (e.g. `report: { valid: ParsedFlashcard[]; invalid: InvalidRow[] } | null`) and the decoded `csv` string. Import `parseAndValidateCsv` and its types from `@/lib/csv`. Flow on submit:

- Decode bytes (existing UTF-8→Windows-1250 logic), then `parseAndValidateCsv(csv)`.
- File-level `{ ok:false }` → set `error` via `ServerError` (existing behavior).
- `invalid.length === 0` → POST `{ name, csv }` (no flag) and redirect on success (existing happy path, one click).
- `invalid.length > 0` → render the **report view** instead of posting: a summary line ("`<invalid>` of `<total>` rows invalid — `<valid>` will import"), a scrollable region (bounded max-height, glassmorphism styling) listing each invalid row as row # + field(s) + reason, and two actions: an "Import `<n>` valid rows" `Button` (disabled when `valid.length === 0`) and a "Cancel" control that clears the report back to the form. Confirm action POSTs `{ name, csv, importValidOnly: true }`, surfaces `data.error` on failure, redirects on success.
- Preserve `loading` disabling and pending label on both POST paths. Copy should make clear "row" = data row (per the row-numbering note).

#### 2. (If extracted) Invalid-rows report component

**File**: `src/components/sets/InvalidRowsReport.tsx` (new — optional)

**Intent**: Keep `ImportSetForm` readable by isolating the report list rendering if it grows past a few lines. Optional; inline in `ImportSetForm` is acceptable if small.

**Contract**: Presentational component taking `invalid: InvalidRow[]`, `validCount`, `totalCount`; renders the summary line + scrollable list. No data fetching. Hand-rolled Tailwind matching the glassmorphism card.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/components/sets/ImportSetForm.tsx` (and `InvalidRowsReport.tsx` if created)
- Build succeeds: `npm run build`

#### Manual Verification:

- All-valid CSV → imports in one click, redirects to `/sets`, new set on top (no report shown)
- CSV with some invalid rows → report appears with correct summary count and every invalid row listed (row #, field(s), reason); the page does not navigate away
- Clicking "Import N valid rows" → set created with exactly the valid rows; redirect to `/sets`
- Clicking "Cancel" → returns to the form, nothing created, file selection intact (or cleanly resettable)
- All-invalid CSV → report lists all rows, import button disabled, only Cancel works; no set created
- File-level error (missing header / empty / >1000 rows) → single error via `ServerError`, no report
- A CSV with an extra column (e.g. `id`) but otherwise valid → imports cleanly, extra column ignored
- Diacritics survive (Windows-1250 file): "Wrocław" imports intact (encoding decode preserved)

**Implementation Note**: After completing this phase and all automated verification passes, the slice is functionally complete — confirm the full loop manually.

---

## Testing Strategy

No automated test runner exists yet (Module 3 scope). Verification is the typecheck / scoped-lint / build gate plus manual checks.

### Manual Testing Steps:

1. Sign in; go to `/sets`. Import an all-valid CSV (~50–300 rows, including a quoted name with a comma) → one click, set appears on top with correct count.
2. Import a CSV with a handful of bad rows (missing name, blank coordinate, `"12abc"` longitude, latitude `200`, a 250-char name) → report shows each with row #, field, reason; summary count correct.
3. From the report, click "Import N valid rows" → set created with exactly the valid count; verify in `/sets` and Supabase Studio (no invalid rows present).
4. Repeat step 2 and click "Cancel" → nothing created.
5. Import a CSV where every row is invalid → report lists all, import disabled, only Cancel.
6. Import a file missing the `latitude` column / an empty file → single file-level error, no report.
7. Import a CSV carrying an extra `id` column → imports cleanly.
8. Import a Windows-1250 file with Polish diacritics → names render correctly.

## Performance Considerations

Validation runs in-browser on ≤300 rows (papaparse + a linear scan) — sub-millisecond, no perceptible delay. The commit path re-parses the same string server-side (also ≤300 rows) — negligible. DB writes are the unchanged two round-trips (set insert + bulk flashcards). No new round-trips beyond the single commit POST.

## Migration Notes

No schema migration (F-01 schema reused as-is). No new dependencies (papaparse already present from S-01). No type regeneration. The only breaking change is internal: `parseAndValidateCsv`'s return shape — both callers (`api/sets/index.ts`, `ImportSetForm.tsx`) are updated in this plan.

## References

- Change identity: `context/changes/csv-malformed-row-handling/change.md`
- Roadmap slice S-05: `context/foundation/roadmap.md:142`
- PRD US-03 / FR-007: `context/foundation/prd.md:70-85`, `:111`
- Prerequisite S-01 plan: `context/changes/csv-set-import-and-list/plan.md`
- Encoding rule: `context/foundation/lessons.md`
- Files changed: `src/lib/csv.ts`, `src/pages/api/sets/index.ts`, `src/components/sets/ImportSetForm.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Validation core + commit contract

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes on touched files: `npx eslint src/lib/csv.ts src/pages/api/sets/index.ts`
- [x] 1.3 Build succeeds: `npm run build`

#### Manual

- [x] 1.4 All-valid CSV (no flag) → 200; set + N flashcards created
- [x] 1.5 Mixed CSV with `importValidOnly: true` → 200; set contains exactly the valid rows
- [x] 1.6 All-invalid CSV with `importValidOnly: true` → 400; no set created
- [x] 1.7 Invalid rows with no flag → 400; nothing created
- [x] 1.8 Missing header / empty / >1000 rows → 400 file-level error before row handling

### Phase 2: Pre-commit report UI

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes on touched files: `npx eslint src/components/sets/ImportSetForm.tsx`
- [ ] 2.3 Build succeeds: `npm run build`

#### Manual

- [ ] 2.4 All-valid CSV imports in one click, no report shown
- [ ] 2.5 Mixed CSV shows report with correct summary and every invalid row (row #, field, reason)
- [ ] 2.6 "Import N valid rows" creates a set with exactly the valid rows
- [ ] 2.7 "Cancel" returns to the form, nothing created
- [ ] 2.8 All-invalid CSV → report shown, import disabled, only Cancel
- [ ] 2.9 File-level error → single error via `ServerError`, no report
- [ ] 2.10 CSV with an extra column imports cleanly (extra ignored)
- [ ] 2.11 Windows-1250 file → diacritics survive import
