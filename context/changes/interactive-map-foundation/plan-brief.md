# Interactive Map Foundation — Plan Brief

> Full plan: `context/changes/interactive-map-foundation/plan.md`

## What & Why

Build the reusable spatial mechanic the study loop sits on: a clickable **blank** map that captures click coordinates, projects lat/lon ↔ screen, auto-frames to a bounding box, and computes click→target great-circle distance (km). It's roadmap foundation **F-02** — deliberately built and proven _in isolation_ because it concentrates the project's #1 `skills` blocker (unfamiliar map library + projection math + Workers/SSR boundary) before S-02 wires it into a full session.

## Starting Point

S-01 (CSV import + set list) and F-01 (schema) are done. There is **no map library** in the codebase. Islands render client-side (so the map never hits the Workers runtime); the binding constraint is keeping all DOM/`window` access out of SSR. No test runner exists — verification is typecheck + scoped lint + build + manual.

## Desired End State

A clean, auth-free `/map-demo` page renders a blank world map of country outlines. Clicking drops a "guess" marker, reveals a "target" marker, draws a connector line, and shows the distance in km. A World/Poland toggle re-frames the map to a bbox, and clicks stay coordinate-accurate at any framing. No quiz/session logic — everything is prop-driven.

## Key Decisions Made

| Decision              | Choice                                                    | Why (1 sentence)                                                                              | Source |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Rendering approach    | d3-geo + bundled world TopoJSON (SVG)                     | Truly blank map (no labels/tiles/keys), `invert()` gives screen→coord free, fully client-side | Plan   |
| Projection            | Equirectangular                                           | Simplest screen↔coord mental model; no meaningful distortion at continent scale               | Plan   |
| Extent                | Full world + load-bearing `bbox` prop                     | Works for any set now; `bbox` auto-frames (Poland set ⇒ Poland view) via `fitExtent`          | Plan   |
| Interactivity         | Static (no user pan/zoom)                                 | Matches the recall mechanic; pan/zoom left as a projection-module seam                        | Plan   |
| Swap/basemap strategy | Stable props + isolated projection module                 | Reversible swap & pan/zoom-ready without speculative renderer-interface indirection           | Plan   |
| Island contract       | `onMapClick` + `markers[]` + `bbox` (+ connector)         | Exactly what S-02 needs; render-agnostic so quiz code never imports d3                        | Plan   |
| Feedback rendering    | Markers + distance line in-component                      | Proves the full spatial-feedback mechanic in isolation                                        | Plan   |
| SSR boundary          | `client:only="react"`                                     | d3/SVG/`window` never run during SSR or in the Worker                                         | Plan   |
| Basemap data          | Bundled world-atlas 110m (~110 KB)                        | Deterministic, no runtime network/CORS dependency                                             | Plan   |
| Distance util         | `haversine(a,b)→km` + shared `LatLng` in `src/lib/geo.ts` | One pure, dependency-free FR-011 contract shared app-wide                                     | Plan   |
| Verification surface  | Clean auth-free `/map-demo` route                         | Fulfills "prove in isolation"; reusable later as a showcase/starter surface                   | Plan   |

## Scope

**In scope:** pure `haversine` + `LatLng`; d3-geo/topojson/world-atlas deps + bundled basemap; isolated projection module (framing + screen↔coord + zoom seam); `InteractiveMap` island (blank map, click capture, guess/target markers, connector line + km); `/map-demo` route with World/Poland framing toggle.

**Out of scope:** any quiz/session/set logic (S-02); user pan/zoom; renderer-abstraction layer / basemap registry; raster tiles or map labels; bearing/narrative feedback; km/m scale-adaptive units; auth on `/map-demo`; automated tests.

## Architecture / Approach

Three pure/clean layers with a hard render-vs-logic split: `geo.ts` (distance math, no d3) and `mapProjection.ts` (screen↔coord + `fitExtent` framing, the single `[lng,lat]`↔`{lat,lng}` boundary and the future zoom seam) are dependency-light modules; `InteractiveMap.tsx` is a `client:only` island that consumes both and exposes a narrow prop contract. S-02 depends only on that contract — never on d3 — which is what makes the renderer reversible.

## Phases at a Glance

| Phase                      | What it delivers                                                             | Key risk                                                           |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Geo util + deps         | `geo.ts` (haversine + LatLng), map deps, bundled 110m TopoJSON               | New deps / asset import resolving under the Cloudflare+Vite build  |
| 2. Map island + projection | `mapProjection.ts` + `InteractiveMap.tsx` (blank map, clicks, markers, line) | SSR/`window` leak; `fitExtent`+`invert` correctness; lat/lng order |
| 3. /map-demo               | Auth-free showcase + World/Poland framing toggle; manual-verify surface      | bbox reframing keeping clicks coordinate-accurate                  |

**Prerequisites:** none beyond the current repo (F-01, S-01 done). **Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- `client:only` must be airtight — `wrangler dev` won't catch an SSR `window` leak; the build + a real `/map-demo` render is the check.
- `fitExtent` must recompute on bbox change or click inversion drifts; a fixed `viewBox`+`preserveAspectRatio` avoids resize math for the static MVP.
- 110m basemap is coarse for tiny islands — irrelevant at MVP continent scale.
- Assumes the npm cert workaround from S-01 (`--strict-ssl=false`) is still needed for installs.

## Success Criteria (Summary)

- Clicking `/map-demo` yields an accurate, plausible km distance to the target with guess/target markers + connector line.
- Toggling to a Poland bbox re-frames the map and clicks remain coordinate-accurate.
- typecheck + scoped lint + build pass; no SSR/hydration/console errors; route works signed out.
