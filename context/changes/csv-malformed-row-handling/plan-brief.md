# CSV Malformed-Row Handling — Plan Brief

> Full plan: `context/changes/csv-malformed-row-handling/plan.md`

## What & Why

Roadmap slice **S-05** (US-03, FR-007). Today's CSV import (S-01) is all-or-nothing: one bad row rejects the whole file with a generic message. This slice upgrades it so a user importing a CSV with malformed rows sees each invalid row reported _before_ commit — 1-indexed row number, which field(s) failed, a one-line reason — and chooses to import the valid rows only or cancel to fix the file. Nice-to-have under the `speed` goal; the contract is fully pinned by the PRD.

## Starting Point

S-01 shipped a working happy-path import: a pure `parseAndValidateCsv` (`src/lib/csv.ts`) that aborts on the first bad row, a `POST /api/sets` route that relays one error, and an `ImportSetForm` island that already decodes file bytes (UTF-8→Windows-1250) and shows errors via `ServerError`. No test runner (Module 3 scope).

## Desired End State

All-valid files import in one click, exactly as today. When some rows are invalid, the form shows a scrollable report (summary count + every invalid row) and offers "Import N valid rows" / "Cancel". Zero-valid files report all failures but disable the import button (no empty set). File-level problems (missing required header, empty, >1000 rows) show a single error with no import option. Extra columns are tolerated and ignored.

## Key Decisions Made

| Decision                              | Choice                                                   | Why                                                                                 | Source             |
| ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| Where validation runs for the preview | Client-side, reuse refactored `csv.ts`                   | No new endpoint; previewed bytes == committed bytes; instant feedback               | Plan               |
| How commit picks rows                 | Server re-parses CSV, drops invalid                      | Server stays authoritative; never trust client-sent rows                            | Plan               |
| All-valid behavior                    | Import directly, no report step                          | Preserves the must-have one-click happy path                                        | Plan               |
| Extra/unknown columns                 | Tolerated and ignored (not rejected)                     | Smoother student experience; real exports carry extra cols. **PRD line 84 revised** | Plan (revises PRD) |
| Zero valid rows                       | Report all; disable import button                        | Never create a meaningless empty set                                                | Plan               |
| Name-length & row-cap                 | Name-length → per-row invalid; 1000-row cap → file error | Name behaves like other field errors; cap protects the Worker                       | Plan               |
| Report rendering                      | Scrollable list of all invalid rows + summary            | Honors "each invalid row reported"; bounded height keeps page usable                | Plan               |

## Scope

**In scope:** per-row partition in `csv.ts`; `importValidOnly` flag on `POST /api/sets` with server re-validation; two-step report UI in `ImportSetForm`; forgiving-headers PRD revision.

**Out of scope:** inline row editing/correction; mapping report rows to physical file lines; rejecting extra columns; changing the happy path; new encodings; transactional inserts; persisting rejected rows; automated tests.

## Architecture / Approach

`parseAndValidateCsv` changes its success shape from `{ rows }` to `{ valid, invalid }` (invalid rows carry row#, raw values, per-field reasons); file-level failures stay `{ ok:false, error }`. Both callers — the API route and the island — consume the new shape. The island validates in-browser to render the report; on confirm it POSTs `{ name, csv, importValidOnly:true }` and the server re-runs the _same_ validator and commits only valid rows via S-01's unchanged set-then-flashcards two-step.

## Phases at a Glance

| Phase                                | What it delivers                                                | Key risk                                                              |
| ------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Validation core + commit contract | Partitioned `csv.ts` + `importValidOnly` route; PRD revision    | Breaking return-shape change with 2 callers; row-numbering definition |
| 2. Pre-commit report UI              | Two-step `ImportSetForm` with scrollable report + binary choice | UI state machine (form ↔ report); preserving encoding decode          |

**Prerequisites:** S-01 merged (it is). No new deps, no migration.
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Row numbers count parsed data rows (header + blank lines excluded), not physical file lines — documented as a known simplification, not engineered around.
- Server re-validation duplicates the client check; accepted as the price of keeping the server authoritative.
- Nice-to-have priority: ship only if time remains after the must-have path.

## Success Criteria (Summary)

- Invalid rows are reported before commit with row #, field(s), and reason — never silently dropped.
- The user can import valid-only (set contains exactly the valid rows) or cancel (nothing created).
- All-valid files still import in one click; file-level errors and extra columns behave as decided.
