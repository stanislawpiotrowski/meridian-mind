# Runner Bootstrap + Core Spatial-Click Math — Plan Brief

> Full plan: `context/changes/testing-runner-bootstrap-core-math/plan.md`
> Research: `context/changes/testing-runner-bootstrap-core-math/research.md`

## What & Why

Phase 1 of the test rollout: stand up the project's first test runner (Vitest)
and lock the spatial-click math behind Risk #1 — projection or haversine math
marking a far-off click "correct" or showing a wrong km, so a student trusts a
location they actually missed. The fix is independent-oracle unit tests at the
cheapest layer that gives real signal.

## Starting Point

No test runner exists (no config, no `test` script). Vite 7 is already in the
dep tree (pinned via `overrides`, present through Astro 6). Risk #1's math
already lives in three pure, DOM-free libs (`geo.ts`, `study.ts`,
`mapProjection.ts`) — an ideal unit seam that needs no refactor.

## Desired End State

`npm run test` runs Vitest green. Three co-located specs lock distance, verdict,
projection round-trip/axis-ordering, and framing math against independent
oracles. Cookbook §6.1 documents the canonical unit-test pattern and §3 Phase 1
reads `complete`.

## Key Decisions Made

| Decision             | Choice                                      | Why (1 sentence)                                                                   | Source   |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| Test runner          | Vitest                                      | Vite 7 already in the tree; lowest-friction, zero new build infra.                 | Research |
| Distance oracle      | Published city-pair km, tolerance band      | Avoids the oracle problem; absorbs sphere-vs-ellipsoid + ±1 km rounding.           | Research |
| Verdict oracle       | Literal FR-012 300 km, inclusive boundary   | Pin 299/300/301 from the spec, not the code constant.                              | Research |
| Projection invariant | Loose pixel round-trip + independent anchor | Catches gross transpose/sign without brittleness on legitimate fit tweaks.         | Plan     |
| boundingBox coverage | Light coverage now                          | Pure, free, and it feeds `invert`'s frame — touches Risk #1's chain.               | Plan     |
| Test file convention | Co-located `src/lib/*.test.ts`              | Vitest default, zero path config, test beside the code it locks (→ cookbook §6.1). | Plan     |

## Scope

**In scope:** Vitest bootstrap; unit tests for `haversine`, `isCorrect`,
`createMapProjection` (round-trip + axis ordering, default + one alternate),
`boundingBox`; cookbook §6.1; Phase 1 status sync.

**Out of scope:** `getScreenCTM` DOM pixel transform (Phase 4/e2e), `TeaserQuiz`
(§7 exclusion), DB→LatLng mapping, render correctness (Risk #2/Phase 4), CI
wiring (Phase 5), CRLF lint baseline fix (separate housekeeping).

## Architecture / Approach

Bootstrap → prove green with a trivial smoke spec → add real tests
module-by-module so each phase is independently verifiable. Node test
environment (no DOM), `@/` alias mirrored from tsconfig. Every assertion draws
its oracle from an independent source, never from the code under test.

## Phases at a Glance

| Phase                        | What it delivers                               | Key risk                                         |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| 1. Test runner bootstrap     | Vitest installed, config, scripts, smoke green | Alias/env misconfig hiding import failures       |
| 2. Distance & verdict math   | `geo.test.ts` + `isCorrect` boundary           | Tolerance too slack, hiding a real distance bug  |
| 3. Projection & framing math | `mapProjection.test.ts` + `boundingBox`        | Round-trip self-consistency masking an axis swap |
| 4. Cookbook + status sync    | §6.1 recipe; Phase 1 marked complete           | §6.1 too thin to be a usable reference           |

**Prerequisites:** none beyond the existing repo; npm install access for Vitest.
**Estimated effort:** ~1 session across 4 small phases.

## Open Risks & Assumptions

- Vitest 3.x is compatible with the pinned Vite 7 (expected; verify on install).
- Loose round-trip tolerance is a deliberate trade — it will not catch small
  fit/scale drift (that surfaces in Phase 4 visual review).
- Whole-repo lint stays red on Windows CRLF; verify lint on changed files only.

## Success Criteria (Summary)

- `npm run test:run` exits 0; all spatial-click math specs pass.
- Mutating `isCorrect` (`<=`→`<`) or transposing `project` axes turns the suite red.
- Cookbook §6.1 is a usable recipe and §3 Phase 1 reads `complete`.
