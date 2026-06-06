# Runner Bootstrap + Core Spatial-Click Math Unit Coverage — Implementation Plan

## Overview

Stand up the project's first test runner (Vitest) and lock the spatial-click
math that Risk #1 depends on with **independent-oracle** unit tests on the pure
library functions. This is Phase 1 of `context/foundation/test-plan.md`: it
covers Risk #1 (a far-off click marked "correct" or a wrong km shown to the
student) at the cheapest layer that gives real signal — pure-function units, no
DOM, no rendering, no network. It also seeds the canonical unit-test convention
in cookbook §6.1.

## Current State Analysis

- **No test runner exists.** No `vitest.config.*` / `vite.config.*` on disk; no
  `test` script in `package.json`. Existing gates: ESLint (`lint`), `astro check`
  (`typecheck`), Husky `pre-commit` + `lint-staged` (eslint --fix on staged).
- **Vite 7 is already present** — pinned via `overrides: { vite: "^7.3.2" }`
  (`package.json:69-71`) and transitively through Astro 6. Vitest is the
  natural, lowest-friction runner.
- **Risk #1's math is three pure, DOM-free library modules** — the cleanest
  possible unit seam, no refactor needed:
  - `src/lib/geo.ts:27-37` — `haversine` (spherical, R=6371, **rounds to whole km**).
  - `src/lib/study.ts:19-24` — `DEFAULT_CORRECT_THRESHOLD_KM = 300` + `isCorrect` (inclusive `<=`).
  - `src/lib/study.ts:35-68` — `boundingBox` (pure framing; feeds `invert`'s frame).
  - `src/lib/mapProjection.ts:109-139` — `createMapProjection` (`project`/`invert`/`bounds`), with the `[lng,lat]`↔`{lat,lng}` flip isolated at `:130-136`.
- **DOM residual (out of scope):** the client-pixel→viewBox-userspace step
  (`getScreenCTM().inverse()` at `InteractiveMap.tsx:72-74`) is not unit-reachable
  and is deferred to Phase 4 / e2e. "Unit covers R1" means the math, not this DOM hop.

## Desired End State

`npm run test` runs Vitest and reports green. Three co-located spec files
(`src/lib/geo.test.ts`, `src/lib/study.test.ts`, `src/lib/mapProjection.test.ts`)
lock the distance, verdict, projection round-trip/axis-ordering, and framing
math against independent oracles. Cookbook §6.1 of `test-plan.md` documents the
canonical "how to add a unit test" pattern, and §3 Phase 1 reads `complete`.

Verify: `npm run test -- --run` exits 0 with all specs passing; a deliberately
introduced axis transpose in `mapProjection` or a `<` (vs `<=`) flip in
`isCorrect` makes the suite fail.

### Key Discoveries:

- `haversine` rounds to whole km and uses a sphere at R=6371 (`geo.ts:11,36`) —
  an external oracle (published great-circle distances) differs by ~0.1–0.3%
  (ellipsoid vs sphere) plus ±1 km rounding → assert with tolerance, never exact.
- Threshold is a single spec constant, `300` (FR-012, `study.ts:19`); the verdict
  is **inclusive** (`<=`, `study.ts:23`). Boundary oracle is the spec, not the code.
- Projection absolute pixels are frame-dependent (`fitExtent`, `mapProjection.ts:117-123`);
  round-trip is **self-consistency**, so it is paired with an independent
  anchor-ordering assertion to catch an axis swap.
- The `LatLng` math contract is `{ lat, lng }` (`geo.ts:6-9`); the DB/StudySession
  use `latitude`/`longitude` — that mapping is a separate concern, not Risk #1 math.

## What We're NOT Doing

- **Not** testing the `getScreenCTM` DOM pixel transform (`InteractiveMap.tsx:72-74`) — Phase 4 / e2e.
- **Not** testing `TeaserQuiz.tsx` — excluded by test-plan §7 (marketing/throwaway).
- **Not** testing the DB→`LatLng` shape mapping (`latitude`/`longitude` → `lat`/`lng`).
- **Not** asserting render correctness / true framing visuals — that is Risk #2 / Phase 4.
- **Not** wiring CI (the unit gate enters CI in Phase 5 of the rollout, not here).
- **Not** writing SRS, CSV, authz, or persistence tests (later rollout phases).
- **Not** fixing the Windows CRLF whole-repo lint baseline (separate housekeeping change per lessons.md).

## Implementation Approach

Bootstrap first, prove green with a trivial smoke spec, then add real tests
module-by-module so each phase is independently verifiable. Tests are
**co-located** (`src/lib/*.test.ts`) — the Vitest default, zero path config,
test next to the code it locks; this convention becomes cookbook §6.1. Every
assertion gets its oracle from an **independent** source (published distances,
the FR-012 spec constant, geometric ordering invariants), never from a value the
code under test produces.

## Critical Implementation Details

- **Oracle discipline (load-bearing).** Do NOT assert `haversine(a,b)` equals a
  value re-derived from the haversine formula, and do NOT lift the threshold from
  the code as "whatever the constant is." Distance → published city-pair
  great-circle distances with tolerance; verdict → literal `300` and inclusive
  boundary from FR-012; projection → round-trip + an _independent_ axis-ordering
  anchor (round-trip alone passes even if both directions share the same wrong
  transform).
- **Rounding & tolerance.** `haversine` returns whole km. Use a tolerance that
  absorbs sphere-vs-ellipsoid (~0.3%) plus ±1 km; assert e.g. `expect(d).toBeCloseTo(oracle, -1)`-style band or an explicit `Math.abs(d-oracle) <= max(2, oracle*0.005)`.
- **Lint verification (Windows).** Per `context/foundation/lessons.md`, the
  whole-repo `npm run lint` is red on CRLF. Verify lint as `npx eslint <changed files>`
  (the new `*.test.ts` files + config), not `npm run lint`.

## Phase 1: Test Runner Bootstrap

### Overview

Install Vitest, add minimal config and scripts, and prove the runner is green
with one trivial smoke spec before any real test is written.

### Changes Required:

#### 1. Dev dependency + scripts

**File**: `package.json`

**Intent**: Add Vitest as a dev dependency and expose `test` (watch) and
`test:run` (single-run, CI-friendly) scripts so the runner is invokable.

**Contract**: New `devDependencies` entry `vitest` (current 3.x, compatible with
the pinned Vite 7). New scripts: `"test": "vitest"`, `"test:run": "vitest run"`.
Do not alter existing `lint`/`typecheck` scripts.

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Minimal config establishing a Node test environment (pure functions,
no DOM) and the `@/` path alias the libs use so `import ... from "@/lib/geo"`
resolves in tests.

**Contract**: Export `defineConfig({ test: { environment: "node" }, resolve: { alias: { "@": <src> } } })`.
The `@` alias must mirror the resolution Astro/tsconfig already use (maps `@/*` → `src/*`).

#### 3. Smoke spec

**File**: `src/lib/__smoke__.test.ts` (new, temporary — removed at end of Phase 2)

**Intent**: A single trivial assertion proving the runner discovers and executes
co-located `*.test.ts` files and reports green. Deleted once real specs exist.

**Contract**: One `test()` with `expect(true).toBe(true)`.

### Success Criteria:

#### Automated Verification:

- Vitest installed: `npm ls vitest` resolves a version
- Runner executes green: `npm run test:run` exits 0 and reports ≥1 passing test
- `@/` alias resolves in a test importing `@/lib/geo`
- Lint clean on changed files: `npx eslint vitest.config.ts src/lib/__smoke__.test.ts` exits 0

#### Manual Verification:

- `npm run test` (watch mode) starts, watches, and re-runs on save

**Implementation Note**: After automated verification passes, pause for human
confirmation that watch mode works before proceeding to Phase 2.

---

## Phase 2: Distance & Verdict Math

### Overview

Lock `haversine` distance and `isCorrect` verdict — the oracle-sensitive heart
of Risk #1 — against independent geographic ground truth and the FR-012 spec.

### Changes Required:

#### 1. Distance tests

**File**: `src/lib/geo.test.ts` (new)

**Intent**: Prove `haversine` yields correct real-world distances and handles the
seam and degenerate cases. Oracle is published great-circle city-pair distances,
asserted with tolerance — never a value re-derived from the formula.

**Contract**: Cases: (a) 2–3 known city pairs (e.g. London–Paris, NYC–LA) vs
published great-circle km within tolerance band (sphere-vs-ellipsoid ~0.3% + ±1 km);
(b) antimeridian pair straddling ±180° yields the _short_ great-circle distance,
not the long way around; (c) identical point → exactly 0 km; (d) symmetry:
`haversine(a,b) === haversine(b,a)`.

#### 2. Verdict tests

**File**: `src/lib/study.test.ts` (new — `boundingBox` added in Phase 3)

**Intent**: Pin the inclusive 300 km boundary from FR-012 and the
threshold-parameterization seam.

**Contract**: Boundary: 299 → correct, 300 → correct (inclusive), 301 →
incorrect, using the literal `300` from the spec (not the imported constant as
the oracle). Parameterization: a custom `thresholdKm` (e.g. 100) changes the
verdict. Confirm `DEFAULT_CORRECT_THRESHOLD_KM === 300`.

#### 3. Remove smoke spec

**File**: `src/lib/__smoke__.test.ts` (delete)

**Intent**: Real specs now prove the runner; the placeholder is no longer needed.

**Contract**: File deleted; suite still green.

### Success Criteria:

#### Automated Verification:

- All specs pass: `npm run test:run` exits 0
- Suite fails if `isCorrect` is mutated `<=` → `<` (boundary genuinely pinned) — verify by temporary local mutation, then revert
- Smoke spec removed: `src/lib/__smoke__.test.ts` no longer exists
- Lint clean on changed files: `npx eslint src/lib/geo.test.ts src/lib/study.test.ts` exits 0

#### Manual Verification:

- Distance tolerances are defensible (reviewer agrees the band reflects sphere+rounding, not slop hiding a bug)

**Implementation Note**: After automated verification passes, pause for human
confirmation before Phase 3.

---

## Phase 3: Projection & Framing Math

### Overview

Lock the projection `project`/`invert` round-trip and axis ordering (catches the
`[lng,lat]` transpose that would mark a far-off click correct) and add light
coverage of `boundingBox` framing.

### Changes Required:

#### 1. Projection tests

**File**: `src/lib/mapProjection.test.ts` (new)

**Intent**: Prove the projection is self-consistent AND not axis-swapped, across
the default and one alternate to guard the registry. Round-trip is a
self-consistency check; the independent oracle is the geometric ordering anchor.

**Contract**: On a fixed `(width, height, bbox, kind)`:
(a) **Round-trip** — `project(invert(x,y)) ≈ (x,y)` within a generous pixel
epsilon (loose tolerance: catches gross transpose/sign errors, never brittle on
fit tweaks); and `invert(project(p)) ≈ p` in lat/lng.
(b) **Independent axis-ordering anchor** — a clearly-eastern point projects
right-of a clearly-western point, and a clearly-northern point projects
above (smaller y) a clearly-southern point. This catches a `[lng,lat]` transpose
or sign flip that round-trip alone cannot.
(c) Run both for default `winkel3` and one alternate (`robinson` or `natural`)
to guard the `PROJECTIONS` registry.
(d) `invert` of an out-of-range point returns `null` gracefully (no throw).

#### 2. Framing tests

**File**: `src/lib/study.test.ts` (extend)

**Intent**: Light pure-function coverage of `boundingBox` — it feeds `invert`'s
frame, so a wrong box shifts where a click maps.

**Contract**: (a) Multi-point set → box encloses all points with per-axis
padding (lng pad from lng span, lat pad from lat span — not a shared pad);
(b) single / all-coincident points → degenerate box expanded by the 0.5 floor;
(c) empty array → world-view fallback `[[-180,-85],[180,85]]`.

### Success Criteria:

#### Automated Verification:

- All specs pass: `npm run test:run` exits 0
- Suite fails if the `project` axis order is transposed (`[p.lat, p.lng]`) — verify by temporary local mutation, then revert
- Lint clean on changed files: `npx eslint src/lib/mapProjection.test.ts src/lib/study.test.ts` exits 0

#### Manual Verification:

- Round-trip epsilon is loose enough not to be brittle, tight enough to be meaningful (reviewer agrees)

**Implementation Note**: After automated verification passes, pause for human
confirmation before Phase 4.

---

## Phase 4: Cookbook + Status Sync

### Overview

Capture the canonical unit-test convention in cookbook §6.1 and advance the
rollout state so the orchestrator can resume at Phase 2.

### Changes Required:

#### 1. Cookbook §6.1

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 placeholder with the canonical "how to add a unit
test" pattern established here, so future contributors (and `/10x-tdd`) follow it.

**Contract**: §6.1 documents: location/naming (co-located `src/lib/<module>.test.ts`),
run commands (`npm run test`, `npm run test:run`), the reference test
(`src/lib/geo.test.ts` as the independent-oracle exemplar), and the
oracle-discipline rule (never assert a value the code under test produces).

#### 2. Rollout status

**File**: `context/foundation/test-plan.md` (§3) and `context/changes/testing-runner-bootstrap-core-math/change.md`

**Intent**: Mark Phase 1 complete in the rollout table and update the change
identity file.

**Contract**: §3 Phase 1 Status → `complete`. `change.md` frontmatter
`status: complete`, `updated: <today>`. Header "Last updated" line refreshed.

### Success Criteria:

#### Automated Verification:

- §6.1 no longer contains "TBD": `npx eslint`-unaffected; grep for "TBD — see §3 Phase 1" in §6.1 returns nothing
- Full suite still green: `npm run test:run` exits 0

#### Manual Verification:

- §6.1 reads as a usable recipe for someone who wasn't here
- §3 Phase 1 row shows `complete`; re-running `/10x-test-plan` would advance to Phase 2

**Implementation Note**: Final phase — confirm the whole suite is green and the
test-plan reflects completion.

---

## Testing Strategy

### Unit Tests:

- `geo.haversine` — city-pair oracle (tolerance), antimeridian short-arc, zero-distance, symmetry.
- `study.isCorrect` — FR-012 inclusive boundary (299/300/301), threshold parameterization.
- `study.boundingBox` — per-axis padding, degeneracy floor, empty→world fallback.
- `mapProjection.createMapProjection` — loose round-trip + independent axis-ordering anchor; default + one alternate; null-safety.

### Integration Tests:

- None this phase. The click→verdict integration (DOM `getScreenCTM` hop) is a Phase 4 / e2e residual, explicitly out of scope.

### Manual Testing Steps:

1. `npm run test` — watch mode starts and re-runs on save.
2. Temporarily transpose `project` axes → suite goes red; revert → green.
3. Temporarily flip `isCorrect` to `<` → boundary test goes red; revert → green.

## Performance Considerations

Pure-function units run in milliseconds; no performance concern. Node
environment (no jsdom) keeps startup minimal.

## Migration Notes

None — additive only. New dev dependency, new config, new test files. No
production code changes.

## References

- Research: `context/changes/testing-runner-bootstrap-core-math/research.md`
- Test plan: `context/foundation/test-plan.md` §2 Risk #1, §3 Phase 1, §6.1
- Lessons: `context/foundation/lessons.md` (Windows CRLF lint scoping)
- Source under test: `src/lib/geo.ts:27`, `src/lib/study.ts:19-68`, `src/lib/mapProjection.ts:109-139`
- DOM residual (out of scope): `src/components/map/InteractiveMap.tsx:72-76`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Runner Bootstrap

#### Automated

- [x] 1.1 Vitest installed: `npm ls vitest` resolves a version — f91c142
- [x] 1.2 Runner executes green: `npm run test:run` exits 0 with ≥1 passing test — f91c142
- [x] 1.3 `@/` alias resolves in a test importing `@/lib/geo` — f91c142
- [x] 1.4 Lint clean on changed files: `npx eslint vitest.config.ts src/lib/__smoke__.test.ts` exits 0 — f91c142

#### Manual

- [x] 1.5 `npm run test` watch mode starts and re-runs on save — f91c142

### Phase 2: Distance & Verdict Math

#### Automated

- [x] 2.1 All specs pass: `npm run test:run` exits 0 — a37a3ed
- [x] 2.2 Suite fails on `<=`→`<` mutation of `isCorrect` (boundary pinned), then reverted — a37a3ed
- [x] 2.3 Smoke spec removed: `src/lib/__smoke__.test.ts` no longer exists — a37a3ed
- [x] 2.4 Lint clean: `npx eslint src/lib/geo.test.ts src/lib/study.test.ts` exits 0 — a37a3ed

#### Manual

- [x] 2.5 Distance tolerances are defensible (reviewer agrees) — a37a3ed

### Phase 3: Projection & Framing Math

#### Automated

- [x] 3.1 All specs pass: `npm run test:run` exits 0
- [x] 3.2 Suite fails on transposed `project` axes, then reverted
- [x] 3.3 Lint clean: `npx eslint src/lib/mapProjection.test.ts src/lib/study.test.ts` exits 0

#### Manual

- [x] 3.4 Round-trip epsilon is loose-but-meaningful (reviewer agrees)

### Phase 4: Cookbook + Status Sync

#### Automated

- [ ] 4.1 §6.1 no longer contains the "TBD — see §3 Phase 1" placeholder
- [ ] 4.2 Full suite still green: `npm run test:run` exits 0

#### Manual

- [ ] 4.3 §6.1 reads as a usable recipe for a newcomer
- [ ] 4.4 §3 Phase 1 row shows `complete`; re-running `/10x-test-plan` advances to Phase 2
