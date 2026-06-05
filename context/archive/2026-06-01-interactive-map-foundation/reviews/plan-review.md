<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Interactive Map Foundation (F-02)

- **Plan**: context/changes/interactive-map-foundation/plan.md
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

8/8 referenced paths exist ✓; `dev`/`build`/`typecheck`/`lint` scripts ✓; `@/*` alias ✓; `PROTECTED_ROUTES` confirmed (`/map-demo` correctly off the allowlist) ✓; brief↔plan consistent ✓. `@astrojs/react` + React 19 present, so `client:only="react"` is valid. `world-atlas` npm metadata check failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, confirming the plan's documented `--strict-ssl=false` install workaround is still required (handled by plan, not a finding).

## Findings

### F1 — Click→coordinate path skips screen→SVG-userspace transform

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — InteractiveMap island click path + Critical Implementation Details
- **Detail**: Projection is built at the fixed `viewBox` size, but click events deliver `clientX/clientY` in CSS pixels and the SVG is CSS-scaled to its container — those pixels are not in viewBox user-space. Passing them straight to `invert()` reads correct only at a 1:1 SVG-to-viewBox size; otherwise clicks drift (worse at Poland framing). Plan named the lat/lng-order boundary and the fitExtent recompute but not this screen→user-space step.
- **Fix**: Map the event point through `svg.getScreenCTM().inverse()` (via `createSVGPoint`/`DOMPoint.matrixTransform`) to viewBox coords before `invert`; add a line to Critical Implementation Details naming it as the second half of the click boundary.
  - Strength: Removes a class of silent click-drift bugs; keeps conversion at the single boundary already designated for coordinate order.
  - Tradeoff: Minor — a few lines, no architectural change.
  - Confidence: HIGH — standard SVG-interaction gotcha; the fixed-viewBox choice makes it certain to bite without the transform.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix in plan — added to Critical Implementation Details + Phase 2 island contract)

### F2 — Phase 3 Progress folds two manual criteria into one checkbox

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress §Phase 3 (item 3.8) vs Phase 3 Manual Verification
- **Detail**: Phase 3 body lists 6 manual-verification bullets but Progress had only 5 (3.4–3.8); 3.8 merged "no console/SSR/hydration errors" and "public route works signed out" — two independently-checkable gates. Structure was otherwise well-formed, so no parse risk; purely a granularity nit.
- **Fix**: Split 3.8 into 3.8 (no console/SSR/hydration errors) and 3.9 (route works signed out).
- **Decision**: FIXED (Fix in plan — split into 3.8 + 3.9)
