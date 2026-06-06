---
date: 2026-06-06T00:00:00Z
researcher: Stanislaw Piotrowski
git_commit: a9baaa9aa55fe949e2580b04da56982e70ef40cc
branch: master
repository: meridian-mind
topic: "Phase 1 grounding — spatial-click verdict & distance math (Risk #1)"
tags: [research, codebase, geo, projection, study, test-runner, risk-1]
status: complete
last_updated: 2026-06-06
last_updated_by: Stanislaw Piotrowski
---

# Research: Phase 1 grounding — spatial-click verdict & distance math (Risk #1)

**Date**: 2026-06-06
**Researcher**: Stanislaw Piotrowski
**Git Commit**: a9baaa9aa55fe949e2580b04da56982e70ef40cc
**Branch**: master
**Repository**: meridian-mind

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` (change
`testing-runner-bootstrap-core-math`) against current code. Risk #1: the
spatial-click verdict or distance is wrong — projection (lat/lon↔screen) or
haversine math marks a far-off click "correct" or shows a wrong km. Locate:
where projection and click→target distance are computed; the correct/incorrect
threshold; the per-flashcard source-of-truth correct location; any existing
test runner; the cheapest useful test layer and pure-function seams.

## Summary

Risk #1's math lives in **three pure, DOM-free, d3-free-or-d3-contained library
modules** — exactly the cheapest possible unit-test surface. The risk
decomposes into **two independent failures**, and they do not share a test
strategy:

1. **Distance + verdict** (`geo.haversine`, `study.isCorrect`) — fully pure,
   trivially unit-testable, and the right place to apply the independent-oracle
   discipline the plan demands.
2. **Projection round-trip** (`mapProjection.project` / `invert`) — pure given
   `(width, height, bbox, kind)`, deterministic (no DOM, no randomness), but
   **its absolute pixel output is meaningless in isolation** because it is
   fitted by `fitExtent`. The robust invariant here is _round-trip_ and
   _ordering_, not absolute coordinates. **Round-trip is a self-consistency
   check, NOT an independent oracle** — see the oracle warning below.

A third part of Risk #1 — the **client-pixel → viewBox-userspace** step
(`getScreenCTM().inverse()` in `InteractiveMap.tsx:72-74`) — is **DOM-bound and
NOT cheaply unit-testable**. The plan's "unit covers R1" must not be read to
imply the full click→verdict pipeline is unit-covered. That last DOM hop is a
genuine residual for Phase 4 / e2e, and the plan should say so explicitly.

**No test runner exists.** No `vitest.config.*` / `vite.config.*` on disk; no
test script in `package.json`. Vitest is the natural runner (Vite 7 is pinned
via `overrides` and present transitively through Astro 6).

## Detailed Findings

### Where distance is computed (the oracle-sensitive part)

`src/lib/geo.ts:27-37` — `haversine(a: LatLng, b: LatLng): number`:

```ts
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(EARTH_RADIUS_KM * c); // EARTH_RADIUS_KM = 6371 (geo.ts:11)
}
```

- **Pure, dependency-free, no DOM, no d3.** The cleanest possible unit seam.
- Two model facts the test oracle must account for: it uses a **spherical**
  Earth at **R = 6371 km** (not the WGS84 ellipsoid that published
  "great-circle distance" tools often use), and it **rounds to whole km**
  (`Math.round`). An independent oracle (published city-pair distances) will
  differ by a small fraction (ellipsoid vs sphere ~0.1–0.3%) plus ±1 km from
  rounding → assert with a tolerance (e.g. ±0.5% or a few km), never exact
  equality to an external figure, and never equality to a value re-derived from
  the same haversine formula.
- Antimeridian behavior is claimed correct in the doc-comment (longitude delta
  inside a cosine). **Worth an explicit test**: a pair straddling ±180° (e.g.
  near the date line) must yield the short great-circle distance, not the long
  way around. This is a real, cheap, high-signal case.

### Where the verdict + threshold live

`src/lib/study.ts:19-24`:

```ts
export const DEFAULT_CORRECT_THRESHOLD_KM = 300; // FR-012
export function isCorrect(distanceKm: number, thresholdKm = DEFAULT_CORRECT_THRESHOLD_KM): boolean {
  return distanceKm <= thresholdKm; // inclusive
}
```

- Threshold is **300 km**, defined **once** here and threaded as a parameter
  (the page passes it down: `src/pages/study/[setId].astro:97`
  `thresholdKm={DEFAULT_CORRECT_THRESHOLD_KM}`). Single source of truth — good.
- Verdict is **inclusive** (`<=`). The boundary unit test must pin this:
  299 → correct, 300 → correct, 301 → incorrect. The oracle for the verdict is
  **FR-012 (300 km, inclusive)** — a spec constant — not anything the code
  computes.

### Where the click→target distance + verdict are wired (consumers)

These are the integration points; they are **not** the cheapest unit surface
but they show that the pure functions are the real seam:

- `src/components/study/StudySession.tsx` (the production study quiz):
  - `:113-114` `const distanceKm = haversine(p, target); const correct = isCorrect(distanceKm, thresholdKm);`
  - `:142` distance to current card uses `{ lat: currentCard.latitude, lng: currentCard.longitude }` ← **source of truth** (see schema below).
  - `:83` replays prior attempts through `isCorrect(a.distanceKm, thresholdKm)`.
- `src/components/map/InteractiveMap.tsx`:
  - `:75` `const coord = projection.invert(point.x, point.y)` — click → geo.
  - `:72-74` `getScreenCTM().inverse()` DOM transform (the non-unit-testable hop).
  - `:94-97` `project(guess)` / `project(target)` for markers; `haversine(guess, target)` for the readout.
- `src/components/landing/TeaserQuiz.tsx` (`:49-50`, `:83-85`) also calls
  `haversine` + `isCorrect`, but on a `{ lat, lng }` card shape and is the
  **throwaway marketing teaser** — **excluded by test-plan §7** ("Marketing
  landing + teaser quiz internals"). Do not target it in Phase 1.

### Source-of-truth "correct location" per flashcard

`src/db/database.types.ts` — `flashcards` table carries `latitude: number` and
`longitude: number` (Row `:32-33`, Insert `:41-42`, Update `:50-51`). The
production study path reads these directly (`StudySession.tsx:142`,
`currentCard.latitude` / `currentCard.longitude`). Note the **shape mismatch**
the codebase straddles: the DB/StudySession use `latitude`/`longitude`; the
`LatLng` domain type (`geo.ts:6-9`) and the teaser use `lat`/`lng`. Phase 1
math tests operate on the `LatLng` (`lat`/`lng`) contract — the DB→LatLng
mapping is a separate concern (not Risk #1 math).

### Where projection (lat/lon ↔ screen) is computed

`src/lib/mapProjection.ts:109-139` — `createMapProjection(width, height, bbox?, kind?)`
returns `{ project, invert, path, bounds }`:

- `project(p)` → `projection([p.lng, p.lat]) ?? null` (`:130-132`) — **note the
  [lng, lat] order flip**; d3 speaks `[lng, lat]`, the app speaks `{lat, lng}`,
  and the flip happens _only here_ (`:8-9` doc-comment). A swapped-axis
  regression here is precisely the "marks a far-off click correct" failure —
  **a high-signal test is: a known anchor (e.g. a city) projects to a point that
  inverts back to the same lat/lng, AND lat/lng are not transposed** (assert a
  clearly-eastern point lands right-of-centre and a clearly-northern point lands
  above-centre — independent ordering signal that catches an axis swap).
- `invert(x, y)` → `{ lat: inverted[1], lng: inverted[0] }` (`:133-136`) — the
  inverse flip. Round-trips with `project`.
- The projection is fitted via `fitExtent([[0,0],[w,h]], fitObject)`
  (`:117-123`), so **absolute pixel coordinates depend entirely on `(w,h,bbox)`**
  — there is no fixed "this lat/lng = this pixel" without restating the frame.
- Default projection is **Winkel Tripel** (`DEFAULT_PROJECTION = "winkel3"`,
  `:39`), from `d3-geo-projection`. `geoNaturalEarth1`/`geoRobinson` are
  registered alternates (`:33-37`).
- `bboxToGeoObject` (`:77-98`) clamps to ±180/±90 and traces a densified
  LineString ring — relevant to framing/Risk #2, not directly to the
  click-verdict oracle.

`boundingBox(points, padFraction)` (`study.ts:35-68`) is pure and computes the
frame from a set's coordinates — testable, but its failure mode is _framing_
(Risk #2), not _verdict_ (Risk #1). In scope only insofar as a wrong bbox
shifts where `invert` maps a click; the round-trip invariant covers that.

### Existing test runner / config

**None.** Confirmed absent: no `vitest.config.*`, no `vite.config.*`, no `test`
/ `test:*` script in `package.json`. Vite 7 is present (`overrides: { vite: "^7.3.2" }`)
and transitively via Astro 6. Vitest is the natural, lowest-friction runner.
Existing gates today: ESLint (`lint`), `astro check` (`typecheck`), and a Husky
`pre-commit` + `lint-staged` (eslint --fix on staged). See lessons.md: **scope
"lint passes" to changed files** (`npx eslint <files>`), the whole-repo gate is
red on Windows due to CRLF.

## Code References

- `src/lib/geo.ts:27-37` — `haversine` (pure distance; R=6371; rounds to whole km).
- `src/lib/geo.ts:6-9` — `LatLng` (`{ lat, lng }`) domain contract.
- `src/lib/study.ts:19` — `DEFAULT_CORRECT_THRESHOLD_KM = 300` (FR-012).
- `src/lib/study.ts:22-24` — `isCorrect` (inclusive `<=`).
- `src/lib/study.ts:35-68` — `boundingBox` (pure framing; Risk #2-adjacent).
- `src/lib/mapProjection.ts:109-139` — `createMapProjection` (project/invert/bounds).
- `src/lib/mapProjection.ts:130-136` — the `[lng,lat]` ↔ `{lat,lng}` flips.
- `src/components/study/StudySession.tsx:113-114,142` — production consumer.
- `src/components/map/InteractiveMap.tsx:72-76,94-97` — click DOM transform + invert + haversine readout.
- `src/db/database.types.ts:32-33` — flashcards `latitude`/`longitude` source of truth.
- `src/components/landing/TeaserQuiz.tsx:49-50,83-85` — teaser (excluded, §7).

## Architecture Insights

- The math is deliberately layered into **pure libs** (`geo.ts`, `study.ts`)
  and a **renderer-agnostic projection boundary** (`mapProjection.ts`) with a
  hard rule that the `[lng,lat]`↔`{lat,lng}` flip happens in one place. This is
  an ideal unit seam — Phase 1 needs no refactor to test the core math.
- Risk #1 is genuinely **two oracles in one risk**:
  - distance/verdict → **independent spec/geographic oracle** (city pairs,
    FR-012 threshold);
  - projection → **invariants** (round-trip identity within tolerance; axis
    ordering / no transpose), because absolute pixels are frame-dependent.
- **DOM residual:** the client-pixel→userspace `getScreenCTM` step
  (`InteractiveMap.tsx:72-74`) is not unit-reachable. Phase 1 should state that
  the unit layer covers the math but not this DOM hop, which falls to Phase 4 /
  e2e — otherwise "unit covers R1" overclaims.

## Oracle-Problem Warnings (must reach the plan)

1. **Distance:** do NOT assert `haversine(a,b)` equals a value re-computed from
   the haversine formula. Use **published great-circle distances for known
   city pairs** as the external oracle, with tolerance for sphere-vs-ellipsoid
   (~0.1–0.3%) and ±1 km rounding. Include an **antimeridian** pair and an
   **identical-point → 0 km** case.
2. **Verdict:** oracle is **FR-012 = 300 km, inclusive**. Pin the boundary
   (299/300/301). Do not lift the threshold from the code into the assertion as
   "whatever the constant is" — write `300` (and the boundary semantics) from
   the spec.
3. **Projection:** `project(invert(x,y)) ≈ (x,y)` (and the lat/lng round-trip)
   is a **self-consistency** check, not an independent oracle — it would pass
   even if both directions shared the same wrong transform. Pair it with an
   **independent ordering/anchor** assertion (a known eastern/northern point
   lands right/above of a known western/southern one) to catch an axis swap or
   sign flip, which round-trip alone cannot.

## Hot-spot evidence check (challenge §2)

`src/lib/` churn as the likelihood signal for Risk #1 is **validated, with a
caveat**: 15 commits touched `src/lib/` in the last 30 days; the geo/projection
files specifically churned recently (`900bc85` per-axis framing fix,
`1f55e96` Winkel Tripel + framing, `6495c6f` scoring lib). The churn is real and
the directory is the right neighbourhood. **Caveat to carry into the plan:** the
hot-spot is a _directory signal_, and the recent churn there is concentrated in
**framing/projection-fit (Risk #2 territory)** more than in the
distance/verdict math, which has been stable. That does not lower Risk #1's
priority (a far-off-click-marked-correct failure is High/High on impact), but it
means the projection round-trip + axis-ordering tests are the part most exposed
to ongoing change, while `haversine`/`isCorrect` are stable and cheap to lock
once.

## Cheapest useful test layer

**Unit (Vitest), on the pure library functions** — no DOM, no rendering, no
network:

- `geo.haversine` — city-pair distances vs independent oracle; antimeridian;
  zero-distance; tolerance-based.
- `study.isCorrect` — FR-012 boundary (299/300/301), threshold parameterization.
- `mapProjection.createMapProjection` — round-trip identity (tolerance) on a
  fixed `(w,h,bbox,kind)` + independent axis-ordering/anchor assertions; cover
  the default Winkel Tripel and at least one alternate to guard the registry.

Promote nothing to e2e for this phase. The single thing unit _cannot_ reach —
the `getScreenCTM` pixel transform — should be explicitly named as out-of-scope
for Phase 1 and deferred to the visual/e2e layer (Phase 4), not silently
implied as covered.

## Open Questions

- Should the projection round-trip test also assert tolerance bounds tight
  enough to catch a _small_ fit/scale regression, or only gross errors? (Plan
  decision: pick a tolerance that reflects "a student would notice", e.g. a
  fraction of the correct-threshold in km when inverted, not raw pixels.)
- Is `boundingBox` worth a Phase 1 unit test, or does it belong with Risk #2
  (framing) in Phase 4? (Leaning: light pure-function coverage now since it is
  free and feeds `invert`'s frame, full render-correctness later.)

## Related Research

- `context/foundation/test-plan.md` §2 Risk #1, §3 Phase 1, §6.1 cookbook stub.
- `context/foundation/lessons.md` — Windows CRLF lint scoping (affects how the
  Phase 1 gate is verified).
  </content>
  </invoke>
