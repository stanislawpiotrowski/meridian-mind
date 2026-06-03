# One-Click Curated Starter Sets — Plan Brief

> Full plan: `context/changes/starter-sets/plan.md`

## What & Why

Ship three curated, ready-made flashcard sets a logged-in user can add in one click, to strengthen onboarding (the S-07 empty state and a section on `/sets`). "Adding" reuses the existing CSV import path and creates the user's **own copy**, so the data model is unchanged.

## Starting Point

The manual CSV import already works end-to-end: `ImportSetForm` POSTs `{ name, csv, importValidOnly }` to `/api/sets`, which re-validates via `parseAndValidateCsv` and inserts the set + flashcards. `/sets` hosts the importer and an empty-state card. S-07's dashboard is still a stub.

## Desired End State

On `/sets`, a "Start with a ready-made set" section lists three curated sets with card counts; one click adds an independent copy and returns the user to `/sets`. Zero-set users see the same starters in the empty state. Pins render in the correct geographic spots on the study map.

## Key Decisions Made

| Decision            | Choice                                           | Why (1 sentence)                                             | Source |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------ | ------ |
| Data packaging      | `.csv` files imported as raw strings (`?raw`)    | Exact bytes run the same validation path; diff-friendly.     | Plan   |
| Add flow            | Client island POSTs to existing `/api/sets`      | Full reuse, zero backend change, server stays authoritative. | Plan   |
| Duplicate handling  | Allow duplicate, no name check                   | Zero logic; per-user copies are independent; S-04 cleans up. | Plan   |
| Entry points        | `/sets` section + `/sets` empty state            | Both live today; S-07 dashboard is an unbuilt stub.          | Plan   |
| Coordinate sourcing | Agent authors + provenance doc, user spot-checks | Auditable verification of the high-risk data.                | Plan   |
| Peak name format    | Strict `Name (elevation m)`, no continent labels | User override of the change spec; uniform across 9 peaks.    | Plan   |
| Definition of done  | All 3 add cleanly (0 invalid) + map spot-check   | Verifies the full user-visible promise incl. data accuracy.  | Plan   |

## Scope

**In scope:** Three curated CSVs (9 peaks / 48 capitals / 23 Polish park centroids) + provenance doc; a typed registry; an `AddStarterSetButton` island; `/sets` section + empty-state wiring.

**Out of scope:** S-07 dashboard; new endpoints/schema changes; global shared sets; duplicate-blocking; continent labels; admin-editable starters.

## Architecture / Approach

CSVs committed under `src/data/starter-sets/`, imported `?raw` into `registry.ts` (`{ id, title, csv, count }`). `AddStarterSetButton` mirrors `ImportSetForm.postSet` — POST the bundled CSV to `/api/sets`, redirect to `/sets`. `/sets/index.astro` consumes the registry for the section and empty state.

## Phases at a Glance

| Phase                            | What it delivers                   | Key risk                                              |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| 1. Data authoring & provenance   | 3 verified CSVs + `data-notes.md`  | Coordinate accuracy — esp. Polish park centroids.     |
| 2. Registry + Add island         | Typed registry + client add button | `?raw` import typing; mirroring existing fetch idiom. |
| 3. Entry-point wiring on `/sets` | Section + empty-state surfacing    | Minor — styling/copy consistency, no regression.      |

**Prerequisites:** S-01 import path (exists). **Estimated effort:** ~2–3 sessions; Phase 1 (data) dominates.

## Open Risks & Assumptions

- Polish park **centroids** (not HQ) are the riskiest data; provenance doc + map spot-check mitigate.
- `?raw` CSV imports may need an ambient type declaration in `src/env.d.ts`.
- CSVs must be saved UTF-8 so Polish diacritics survive (committed assets, so the `File.text()` hazard does not apply).

## Success Criteria (Summary)

- Each of the three sets adds via one click with zero invalid rows, creating an independent per-user copy (9 / 48 / 23 cards).
- Sampled pins (a Polish centroid + a peak) render in the correct location on the study map.
- The manual CSV import flow is unaffected.
