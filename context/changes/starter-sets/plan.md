# One-Click Curated Starter Sets Implementation Plan

## Overview

Ship three curated, ready-made flashcard sets that a logged-in user can add to their own account in one click. "Adding" reuses the existing CSV import path end-to-end: it creates the user's **own independent copy** by POSTing a bundled CSV string to `/api/sets`, so the data model is untouched and the server stays authoritative on validation.

The substantive work is **data**: authoring and verifying 80 coordinates (9 world peaks, 48 European capitals, 23 Polish national-park centroids) with a documented provenance trail. The wiring — a small registry, an "Add" client island, and two entry points on `/sets` — is deliberately thin.

## Current State Analysis

- **Import path is clean and reusable.** `ImportSetForm.tsx:35` (`postSet`) POSTs `{ name, csv, importValidOnly }` to `/api/sets` and redirects to `/sets` on success. The endpoint (`src/pages/api/sets/index.ts`) is server-authoritative: it re-runs `parseAndValidateCsv` on the raw CSV string, inserts a `sets` row, then bulk-inserts `flashcards` (with denormalized `user_id` for RLS), and best-effort-cleans-up the set if the flashcard insert fails. A starter "add" needs **no backend change**.
- **The validation contract our data must satisfy** (`src/lib/csv.ts`): required headers `name,latitude,longitude` (case-insensitive, comma or semicolon delimited), `name` 1–200 chars, `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180], ≤ 1000 data rows. Coordinate cells accept comma OR period decimal separators (`normalizeCoordCell`). Our curated CSVs must parse with **zero invalid rows** or the one-click promise breaks.
- **`/sets` is the live entry-point surface.** `src/pages/sets/index.astro:39` mounts `ImportSetForm`; lines 42–46 render an empty-state card ("No sets yet. Import a CSV above to get started.") when the user has no sets.
- **S-07 dashboard is not built.** `src/pages/dashboard.astro` is a stub. The change references "the S-07 empty state," but S-07 (`dashboard-home`) is still `proposed`. Per decision, we scope entry points to `/sets` (section + existing empty state) and leave the dashboard hook for when S-07 is actually built.

### Key Discoveries:

- `postSet` in `src/components/sets/ImportSetForm.tsx:35-57` is the exact behavior the Add island mirrors: POST JSON, on `!ok` show `data.error`, on success `window.location.href = "/sets"`.
- The endpoint already guards zero-valid (`index.ts:68`) and invalid-without-flag (`index.ts:60`), so a malformed starter CSV fails loudly server-side — a useful backstop during data authoring.
- Lesson (lessons.md): scope lint to changed files (`npx eslint <files>`), not whole-repo `npm run lint`, on this Windows/CRLF checkout.
- Lesson (lessons.md): the `File.text()`/encoding hazard applies to **uploaded** files. Our starter CSVs are repo-committed and imported as build-time strings, so the decoding concern does not apply — but the CSVs MUST be saved UTF-8 so Polish diacritics (e.g. "Białowieski", "Ojcowski") survive.

## Desired End State

A logged-in user visiting `/sets` sees a "Start with a ready-made set" section listing the three curated sets (title + card count). Clicking "Add" on any one creates an independent copy in their account and lands them back on `/sets` with the new set present. A brand-new user with no sets sees the same starters surfaced in the empty-state card. Each set's pins render in the correct geographic location on the study map (verified for a Polish park centroid and a peak).

Verify by: adding each of the three sets from a clean account → three new sets appear in `/sets` with correct card counts (9 / 48 / 23) → opening one in study renders pins at the right places.

## What We're NOT Doing

- **Not** building or modifying the S-07 dashboard (it's a stub; entry point deferred to that slice).
- **Not** adding a new backend endpoint or changing the `sets`/`flashcards` schema — full reuse of `/api/sets`.
- **Not** sharing a single global set across users — every add is a per-user copy.
- **Not** blocking or de-duplicating repeated adds (allow-duplicate, no name check — per decision; users have S-04 delete to clean up).
- **Not** adding continent labels to peak names (overridden: strict `Name (elevation m)` for all peaks).
- **Not** making starter CSVs user-editable or admin-managed; they are static, repo-committed assets.

## Implementation Approach

Author the three sets as real `.csv` files committed under `src/data/starter-sets/`, imported as raw strings (Vite `?raw`) into a small typed registry. A client island renders an "Add" button per registry entry and POSTs that exact CSV string to `/api/sets` — the same bytes the manual importer would send — so there is no data-shape drift and the server re-validates identically. Entry points consume the registry on `/sets`.

Data correctness is treated as first-class: a `data-notes.md` records the source and derivation method for every non-trivial coordinate (all 23 park centroids, the elevation figures, the capital city-center basis), so verification is reviewable rather than blind-trusted.

## Phase 1: Curated Data Authoring & Provenance

### Overview

Author and verify the three curated CSV datasets and document their provenance. This is the bulk of the effort and the primary risk surface.

### Changes Required:

#### 1. Crown of the Earth — peaks

**File**: `src/data/starter-sets/crown-of-the-earth.csv`

**Intent**: Nine summits combining the Bass and Messner seven-summits lists. Each `name` carries elevation in the **strict** format `Name (elevation m)` — no continent labels. The summit coordinate (not a base camp or trailhead) is the point.

**Contract**: Header row `name,latitude,longitude`; 9 data rows. Names: `Mount Everest (8848 m)`, `Aconcagua (6961 m)`, `Denali (6190 m)`, `Kilimanjaro (5895 m)`, `Vinson Massif (4892 m)`, `Elbrus (5642 m)`, `Mont Blanc (4810 m)`, `Puncak Jaya (4884 m)`, `Mount Kosciuszko (2230 m)`. Coordinates are each summit's lat/lng to ≥4 decimal places. Must pass `parseAndValidateCsv` with zero invalid rows. UTF-8 encoded.

#### 2. European capitals

**File**: `src/data/starter-sets/european-capitals.csv`

**Intent**: All 48 European capitals, bare names, each point being the city center.

**Contract**: Header `name,latitude,longitude`; 48 data rows; bare capital names (no country suffix); coordinates = recognized city-center point per capital, ≥4 decimal places. Zero invalid rows. UTF-8 (diacritics: e.g. "Chișinău", "Reykjavík").

#### 3. National Parks of Poland

**File**: `src/data/starter-sets/polish-national-parks.csv`

**Intent**: All 23 Polish national parks, bare names, each point being the park **centroid** — explicitly NOT the park HQ/visitor office.

**Contract**: Header `name,latitude,longitude`; 23 data rows; bare park names with Polish diacritics (e.g. "Białowieski", "Ojcowski", "Gór Stołowych"); coordinates = geographic centroid of each park's boundary, ≥4 decimal places. Zero invalid rows. UTF-8.

#### 4. Provenance documentation

**File**: `context/changes/starter-sets/data-notes.md`

**Intent**: Make verification auditable. Record, per set, the source and method behind each non-trivial value so the human spot-check (and any future correction) has a reference.

**Contract**: One section per set. For peaks: source for each elevation and summit coordinate. For capitals: the city-center basis used. For Polish parks: how each centroid was derived (boundary source + centroid method), since this is the highest-risk data and the one place where "centroid ≠ HQ" must be demonstrable. Note any judgment calls (e.g. parks with non-contiguous areas).

### Success Criteria:

#### Automated Verification:

- Each CSV's first line is exactly the header `name,latitude,longitude` and data-row counts are exactly 9 / 48 / 23 respectively.
- Files are valid UTF-8 (no U+FFFD replacement characters present).

> Note: there is no test runner or `tsx` in this repo, and `astro build` does **not** invoke `parseAndValidateCsv` on these CSVs. The authoritative "zero invalid rows" proof therefore happens at the Phase 2/3 **add** step: a successful POST that creates a set with the exact expected card count (9 / 48 / 23) demonstrates every row passed server-side validation. The header/count/UTF-8 checks above are the cheap pre-flight; the add test is the real gate.

#### Manual Verification:

- A spot-check sample of coordinates (at minimum: one Polish park centroid, one peak summit, one capital) plots in the correct location on a map.
- Park coordinates are visibly centroids, not HQ/town locations, for the spot-checked sample.
- Peak names all follow `Name (elevation m)` exactly; capitals and parks are bare names.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the data spot-check before proceeding.

---

## Phase 2: Starter Registry + Add Island

### Overview

Package the CSVs into a typed registry and build the client island that adds a chosen set via the existing import endpoint.

### Changes Required:

#### 1. Starter-set registry

**File**: `src/data/starter-sets/registry.ts`

**Intent**: Expose the three CSVs to the UI as a typed list, importing each CSV as a raw string so the exact committed bytes are what gets POSTed.

**Contract**: Import each `.csv` via Vite `?raw` (e.g. `import crown from "./crown-of-the-earth.csv?raw"`). Export an ordered array of `{ id: string; title: string; csv: string; count: number }`. `id` is a stable slug; `title` is the user-facing set name used as the created set's `name` (e.g. "Crown of the Earth", "European Capitals", "National Parks of Poland"). `count` MUST be **derived** from the imported CSV (count non-empty data lines, excluding the header) at module load — never hardcoded — so the displayed count can never drift from the file. If `?raw` typing needs a declaration, add it to the existing `src/env.d.ts` (or an ambient `.d.ts`).

#### 2. Add-starter client island

**File**: `src/components/sets/AddStarterSetButton.tsx`

**Intent**: A button that POSTs a starter set's CSV to `/api/sets` and redirects to `/sets`, mirroring `ImportSetForm.postSet`. Allow-duplicate: no name-existence check.

**Contract**: Props `{ title: string; csv: string }`. On click: POST JSON `{ name: title, csv, importValidOnly: false }` to `/api/sets`; on `!response.ok` surface `data.error` (reuse `ServerError`); on success `window.location.href = "/sets"`. Loading state disables the button and shows "Adding…" (mirror `ImportSetForm` loading/error idioms and styling). No new fetch/error patterns — copy the established one.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck` (registry types + `?raw` imports resolve).
- Linting passes on changed files: `npx eslint src/data/starter-sets/registry.ts src/components/sets/AddStarterSetButton.tsx`.
- Build succeeds: `npm run build` (confirms `?raw` CSV imports bundle).

#### Manual Verification:

- Clicking "Add" on a registry entry creates a set and redirects to `/sets` with the new set present and correct card count.
- A server-rejected add (simulated) surfaces the error inline without navigating.

**Implementation Note**: Pause for human confirmation after this phase before wiring entry points.

---

## Phase 3: Entry-Point Wiring on `/sets`

### Overview

Surface the starters on the `/sets` page: a dedicated section and the existing empty-state card.

### Changes Required:

#### 1. "Start with a ready-made set" section

**File**: `src/pages/sets/index.astro`

**Intent**: Render a section listing each registry entry (title, count, and an `AddStarterSetButton` island) so any user can add a curated set.

**Contract**: Import the registry and `AddStarterSetButton`. Add a section (consistent with the existing card styling — `rounded-2xl border border-white/10 bg-white/10 … backdrop-blur-xl`) iterating registry entries; each row shows title + `count` cards + an `<AddStarterSetButton client:load title={…} csv={…} />`. Placement: below the existing `ImportSetForm` block.

#### 2. Empty-state surfacing

**File**: `src/pages/sets/index.astro`

**Intent**: For users with zero sets, point them at the starters from within the empty-state card rather than only "Import a CSV above."

**Contract**: Update the `sets.length === 0` branch (`index.astro:42-46`) to reference the ready-made sets section (e.g. copy nudging toward "add a ready-made set above"). Reuse the same registry/island already on the page — do not duplicate the add buttons' logic.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`.
- Linting passes on changed files: `npx eslint src/pages/sets/index.astro`.
- Build succeeds: `npm run build`.

#### Manual Verification:

- `/sets` shows the three starters with correct counts; adding each yields three new sets (9 / 48 / 23 cards).
- A clean account (zero sets) sees the empty-state nudge toward the starters.
- Opening an added set in study renders pins correctly for a sampled Polish park centroid and a peak.
- No regression to the existing manual CSV import flow.

**Implementation Note**: Pause for final human confirmation of the end-to-end one-click experience and map spot-check.

---

## Testing Strategy

### Unit / Validation:

- Assert each starter CSV passes `parseAndValidateCsv` with `invalid.length === 0` and the expected `valid.length` (9 / 48 / 23). This can be a throwaway script or a lightweight check at registry build time.

### Integration / Manual:

1. From a clean account, add each of the three starter sets; confirm three sets appear with correct card counts.
2. Open one added set in study; confirm pins render at correct locations (spot-check a Polish centroid + a peak summit).
3. Add the same starter twice; confirm a second independent copy is created (allow-duplicate).
4. Confirm the manual `ImportSetForm` flow still works unchanged.
5. Confirm the empty-state nudge appears for a zero-set account.

## Performance Considerations

Negligible. The three CSVs are tiny (≤48 rows) and bundled as build-time strings. No new queries on `/sets` beyond importing static data.

## Migration Notes

None — no schema or data migration. Starter sets are static assets; adding one uses the existing insert path.

## References

- Reuse target: `src/components/sets/ImportSetForm.tsx:35` (`postSet`)
- Endpoint: `src/pages/api/sets/index.ts`
- Validation contract: `src/lib/csv.ts`
- Entry-point page: `src/pages/sets/index.astro:39,42`
- Roadmap slice: `context/foundation/roadmap.md` (S-09)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Curated Data Authoring & Provenance

#### Automated

- [x] 1.1 Each CSV header is `name,latitude,longitude` and data-row counts are 9 / 48 / 23 — fcc5970
- [x] 1.2 Files are valid UTF-8 (no replacement characters) — fcc5970

#### Manual

- [x] 1.3 Spot-check sample coordinates plot correctly on a map — fcc5970
- [x] 1.4 Park coordinates are centroids, not HQ, for the sample — fcc5970
- [x] 1.5 Peak names follow `Name (elevation m)`; capitals/parks bare — fcc5970

### Phase 2: Starter Registry + Add Island

#### Automated

- [x] 2.1 Type checking passes (`npm run typecheck`) — 7856846
- [x] 2.2 Linting passes on changed files — 7856846
- [x] 2.3 Build succeeds (`npm run build`) — 7856846

#### Manual

- [x] 2.4 Clicking Add creates a set and redirects with correct count
- [x] 2.5 Server-rejected add surfaces error inline without navigating

### Phase 3: Entry-Point Wiring on `/sets`

#### Automated

- [x] 3.1 Type checking passes (`npm run typecheck`)
- [x] 3.2 Linting passes on changed files
- [x] 3.3 Build succeeds (`npm run build`)

#### Manual

- [x] 3.4 `/sets` shows three starters; adding yields 9 / 48 / 23 cards
- [x] 3.5 Zero-set account sees empty-state nudge toward starters
- [x] 3.6 Added set renders pins correctly (Polish centroid + peak)
- [x] 3.7 No regression to manual CSV import flow
