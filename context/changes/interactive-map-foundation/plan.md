# Interactive Map Foundation — Implementation Plan

## Overview

Deliver roadmap foundation **F-02**: a reusable, render-agnostic interactive **blank** map that renders, captures click coordinates, projects lat/lon ↔ screen position, auto-frames to a supplied bounding box, and computes click→target great-circle distance (haversine, km). This is the spatial mechanic the north-star study loop (S-02) sits on — built and proven **in isolation**, with no quiz, session, or set logic.

The map is a client-only React island built on **d3-geo + a bundled world TopoJSON** rendered as SVG (no tiles, no labels, no API keys), using an **equirectangular** projection. It defaults to a full-world view but honors a **`bbox` framing prop** (via `projection.fitExtent`) so a Poland-only set renders framed on Poland. It is **static** (no user pan/zoom) but architected so pan/zoom and a renderer/basemap swap can be added later without a rewrite. A clean, auth-free `/map-demo` route exercises the whole mechanic end-to-end and is the manual-verification surface.

## Current State Analysis

- **No map library is present** (verified — `package.json` has no Leaflet/MapLibre/d3/topojson). This slice introduces the first one. F-02 is explicitly where the project's #1 `skills` blocker concentrates (`roadmap.md:87`).
- **Islands render client-side** — the map never executes in the Cloudflare Workers runtime, so the `fs`/`child_process`/CPU-cap gotchas in `infrastructure.md` do not apply to the map library itself. The binding constraint is the **SSR boundary**: d3 SVG rendering + any `window`/DOM access must never run during server render. Mitigated by mounting `client:only="react"`.
- **The PRD requires a _blank_ map** — FR-009/FR-010 are an active-recall mechanic ("point to it on a blank map, don't just recognize a label"). A tiled basemap (OSM) ships labels that defeat the mechanic; a label-free SVG country outline is the correct rendering.
- **FR-011 distance contract** — feedback is the great-circle distance in **km** between the click and the correct location. The correct location ships with the flashcard in S-02, so distance is **local math with no server round-trip** — this is how the 500 ms p95 NFR is met. F-02 owns the pure `haversine` that produces it.
- **No test runner exists** (Module 3 scope; confirmed in S-01's plan). Verification is `npm run typecheck` + scoped `eslint` on touched files + `npm run build` + manual checks on `/map-demo`.
- **Conventions to follow (verified against S-01):**
  - Islands live under `src/components/<feature>/`; pure utilities under `src/lib/`. The `@/` import alias is used everywhere (`@/lib/...`, `@/components/...`).
  - Only shadcn `Button` (`@/components/ui/button`) exists; `Card`/`Input` do not. Style is glassmorphism on `bg-cosmic` (`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl`).
  - Pages read `Astro.locals.user`, wrap content in `Layout` (`src/layouts/Layout.astro`), and use `Topbar.astro` for nav.
  - Middleware (`src/middleware.ts`) gates by an allowlist (`PROTECTED_ROUTES`). `/map-demo` is intentionally **left off** the allowlist (auth-free showcase).
  - ESLint runs `strictTypeChecked` + `stylisticTypeChecked` with `prettier`; the lint baseline on untouched files is dirty (CRLF), so the lint gate is scoped to touched files. `src/db/database.types.ts` is git-ignored by eslint. The `.astro` config disables `@typescript-eslint/no-misused-promises` (added in S-01 to work around an `astro-eslint-parser` crash).

## Desired End State

Visiting `/map-demo` (no login required) shows a blank world map of country outlines on the cosmic background. Clicking anywhere drops a "guess" marker at the clicked location, reveals a hardcoded "target" marker, draws a connector line between them, and displays the great-circle distance in km. A control toggles the framing between **World** and **Poland** — selecting Poland re-frames the same map tightly around Poland, and clicks remain coordinate-accurate at that framing. The component carries no quiz/session state; everything is driven by props.

Verify: `npm run typecheck`, scoped `eslint` on touched files, and `npm run build` all pass; the `/map-demo` manual flows in each phase's Success Criteria hold.

### Key Discoveries:

- **`client:only="react"` is mandatory** for the map island — d3 + SVG measurement needs a real DOM; SSR or Worker execution would error (per `infrastructure.md` SSR-boundary unknowns).
- **`projection.fitExtent(extent, geoObject)`** is the single mechanism for both the default world view and the `bbox` framing — pass a GeoJSON object built from the bbox (or the world land geometry) and d3 computes scale+translate. `projection.invert([x,y])` returns `[lng,lat]` and stays correct after fitting — this is the click→coordinate path.
- **`bbox` is load-bearing framing, not someday-maybe** — "static" means no _user_ pan/zoom, but the map must auto-scale to the bbox on mount (Poland set ⇒ Poland framing).
- **Render-agnostic contract** isolates downstream code from d3: S-02 depends only on `onMapClick({lat,lng})` out and `markers[]` in — never imports d3 or SVG. Swapping renderers later = reimplementing one component body to the same props.
- **world-atlas 110m** (~110 KB) is the right basemap resolution — coarse for tiny islands but perfect at continent scale; bundled as a static asset so there is no runtime network/CORS dependency.
- **haversine must be antimeridian-correct** — the great-circle formula handles the ±180° seam naturally (it uses the longitude _delta_ inside a cosine), so no special-casing is needed beyond using the standard formula; this is called out so the implementer does not "optimize" it into a broken planar approximation.

## What We're NOT Doing

- **No quiz/session/set logic** — no flashcards, no queue, no scoring, no persistence. S-02 owns all of it. F-02 stops at "click → coordinate → distance, rendered."
- **No user pan/zoom** — static framing only. The projection module leaves a seam for composing a zoom transform later; the interaction itself is out of scope.
- **No renderer-abstraction layer / basemap registry** — we ship one renderer (d3 SVG) behind a stable prop contract + an isolated projection module. No formal `MapRenderer` interface, no runtime basemap toggle. (Reversible swap is protected by the contract, not by speculative indirection.)
- **No raster/tiled basemap, no map labels** — blank outlines only (the active-recall requirement).
- **No bearing/direction or narrative feedback** ("too far west", AI tutor commentary) — explicit PRD Non-Goal. Distance km only.
- **No scale-adaptive units (km/m)** — km only; sub-country/city-scale sets are PRD Open Question #1, out of MVP.
- **No auth gating on `/map-demo`** — deliberately public so it can later be repurposed as a showcase / starter-set surface.
- **No test runner / automated unit tests** — Module 3 scope; verification is typecheck + scoped lint + build + manual.

## Implementation Approach

Build bottom-up in three independently verifiable phases: (1) the pure `haversine` util + the map dependencies + the bundled TopoJSON asset, verifiable by build; (2) the projection module (the swap/zoom/framing seam) and the `InteractiveMap` island that consumes it, verifiable by build + typecheck; (3) the `/map-demo` route that mounts the island and is the manual-verification + isolation-proof surface. Each phase ends green on typecheck / scoped-lint / build before the next.

The deliberate architecture, per the planning decisions:

- **Hard render/logic split.** `src/lib/geo.ts` (distance) and `src/lib/mapProjection.ts` (screen↔coord) are pure and dependency-light; quiz logic in S-02 imports `geo.ts` and the island's props, never d3.
- **Narrow, stable island contract.** `<InteractiveMap onMapClick markers bbox />` is the only surface S-02 couples to.
- **Seams, not abstractions.** The projection module is the single place a zoom transform or an alternate renderer's math would slot in — built now as a plain module, not a speculative interface.

## Critical Implementation Details

- **SSR boundary.** Mount as `client:only="react"`. Do not reference `window`/`document` at module top-level in any file that could be imported during SSR; keep all DOM access inside the island. `wrangler dev` will not catch a leak here — the build + a real render on `/map-demo` is the check.
- **fitExtent framing.** The projection module must (re)compute `fitExtent` from the current `bbox` (or world default) **and** the rendered SVG size. On container resize or bbox change, the projection must be recomputed or click inversion drifts. Use a measured container size (e.g. a ref + `ResizeObserver`, or a fixed aspect-ratio viewBox) — a fixed `viewBox` with `preserveAspectRatio` is the simplest correct option and avoids resize math for the static MVP.
- **Coordinate order discipline.** d3-geo speaks `[longitude, latitude]`; the app contract speaks `{ lat, lng }`. Convert at exactly one boundary (inside the projection module) so the rest of the app never juggles order — a classic source of silent lat/lng swaps.
- **Screen→user-space transform on click (second half of the click boundary).** The projection is built at the fixed `viewBox` dimensions, but a click event delivers `clientX/clientY` in CSS pixels and the SVG is CSS-scaled to fill its container — those pixels are **not** in viewBox user-space. Passing raw `clientX/clientY` straight into `invert()` reads correct only when the rendered SVG happens to equal the viewBox size 1:1; otherwise clicks drift (and any aspect-ratio mismatch makes it worse at Poland framing). Map the event point through `svg.getScreenCTM().inverse()` (via `createSVGPoint`/`DOMPoint.matrixTransform`) to viewBox coordinates **before** calling `invert`. This is the screen-side companion to the lat/lng-order conversion and belongs at the same single boundary.
- **Marker/line overlay.** Markers and the connector line are SVG elements positioned via `projection([lng,lat])` (the forward direction), layered above the country paths in the same SVG so they share the coordinate system. The km label is plain text from `haversine`.

---

## Phase 1: Pure geo util + dependencies

### Overview

Add the pure distance utility, the map rendering dependencies, and the bundled world basemap asset. No UI yet. The Phase-1 `npm run build` is the smoke test that the new deps resolve and the TopoJSON asset imports cleanly under the Cloudflare/Vite build.

### Changes Required:

#### 1. Add map + geo dependencies

**File**: `package.json`

**Intent**: Bring in the rendering and basemap libraries. d3-geo for projection/path/invert, topojson-client to convert the bundled TopoJSON to GeoJSON, world-atlas for the data.

**Contract**: Add to `dependencies`: `d3-geo`, `topojson-client`, `world-atlas`. Add to `devDependencies`: `@types/d3-geo`, `@types/topojson-client`. Install so the lockfile updates. (Install uses `--strict-ssl=false` per the environment's cert setup observed in S-01.) No script changes.

#### 2. Bundle the world basemap asset

**File**: `src/assets/world-110m.json` (new) — sourced from the `world-atlas` package's `countries-110m.json`.

**Intent**: Keep the basemap local and deterministic — no runtime network/CDN dependency for a core mechanic.

**Contract**: Place the 110m country-level TopoJSON where the island can import it through the Vite/Astro build (JSON import). If importing directly from the `world-atlas` package proves cleaner than copying, that is acceptable — the invariant is: the basemap loads with no runtime `fetch`. Document the chosen source location in a one-line comment where it is consumed.

#### 3. Pure geo utility

**File**: `src/lib/geo.ts` (new)

**Intent**: One pure, dependency-free module owning the coordinate type and the FR-011 distance contract, shared by the map, the quiz (S-02), and future SRS.

**Contract**: Export `interface LatLng { lat: number; lng: number }` and `haversine(a: LatLng, b: LatLng): number` returning the great-circle distance in **kilometers** (Earth radius 6371 km), correct across the antimeridian (standard haversine — do not substitute a planar approximation). Return value rounded to a sensible precision for display (e.g. whole km, or 1 decimal — implementer's call, documented). No d3 import.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/lib/geo.ts`
- Build succeeds with the new deps + asset import: `npm run build`
- `d3-geo`, `topojson-client`, `world-atlas` in `dependencies`; `@types/d3-geo`, `@types/topojson-client` in `devDependencies`; lockfile updated

#### Manual Verification:

- Reason-check `haversine` against a known pair (e.g. Warsaw ↔ Berlin ≈ 520 km; London ↔ Paris ≈ 344 km) via a scratch call or the Phase-3 demo

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: InteractiveMap island + projection module

### Overview

Build the projection module (the framing + screen↔coord seam) and the `client:only` React island that renders the blank map, captures clicks as coordinates, and draws guess/target markers with a connector line. Driven entirely by props — no quiz state.

### Changes Required:

#### 1. Projection module

**File**: `src/lib/mapProjection.ts` (new)

**Intent**: Isolate all screen↔coordinate math and framing so the renderer is replaceable and pan/zoom can be added later without touching the island's click/marker logic. The single boundary where `[lng,lat]` ↔ `{lat,lng}` conversion happens.

**Contract**: Export a small API around a configured d3 `geoEquirectangular` projection, e.g. a factory that takes the target SVG dimensions and an optional `bbox` and returns:

- `project(p: LatLng): [number, number]` — coordinate → screen (for markers/lines),
- `invert(x: number, y: number): LatLng` — screen → coordinate (for clicks),
- the configured projection/path needed to render country outlines.
  Framing uses `projection.fitExtent([[0,0],[w,h]], geoObject)` where `geoObject` is built from `bbox` (a `[[west,south],[east,north]]` → GeoJSON bbox polygon) or defaults to the world land geometry. Document that pan/zoom would compose a transform here. No React, no DOM.

#### 2. InteractiveMap island

**File**: `src/components/map/InteractiveMap.tsx` (new)

**Intent**: The one reusable, render-agnostic map component S-02 will consume. Renders the blank basemap, emits clicks as `{lat,lng}`, and renders supplied markers + an optional connector line with a distance label.

**Contract**: Props:

```ts
interface Marker {
  lat: number;
  lng: number;
  variant: "guess" | "target";
  label?: string;
}
interface InteractiveMapProps {
  onMapClick?: (p: LatLng) => void;
  markers?: Marker[];
  bbox?: [[number, number], [number, number]]; // [[west,south],[east,north]]; default = world
  connector?: boolean; // draw a line between the two markers + km label; default false
  className?: string;
}
```

Behavior: build the projection from `mapProjection.ts` sized to the SVG (fixed `viewBox` + `preserveAspectRatio` for the static MVP — see Critical Implementation Details); convert the bundled TopoJSON to GeoJSON via `topojson-client` and render country `<path>`s (blank, subtle stroke on the cosmic palette); on SVG click, map the event point to viewBox user-space via `svg.getScreenCTM().inverse()` (see Critical Implementation Details), then `invert` → call `onMapClick`; render markers via `project` (visually distinct guess vs target); when `connector` and both markers exist, draw a line and a km label from `haversine`. Mount only as `client:only="react"`. Imports via `@/` alias. No quiz/session state, no data fetching.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/lib/mapProjection.ts src/components/map/InteractiveMap.tsx`
- Build succeeds with the island: `npm run build`

#### Manual Verification:

- (Exercised in Phase 3 via `/map-demo`, since the island needs a mount point) — component compiles and is importable; no SSR/`window` errors at build

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: /map-demo verification surface

### Overview

Mount `InteractiveMap` on a clean, auth-free `/map-demo` route that proves the full mechanic in isolation: click → guess marker + revealed target + connector line + km, with a World/Poland framing toggle. This is F-02's "prove it in isolation" deliverable and the manual-verification surface; S-02 will reference (or cannibalize) it.

### Changes Required:

#### 1. Map demo page

**File**: `src/pages/map-demo.astro` (new)

**Intent**: A self-contained showcase/harness for the map foundation — no auth, no Supabase, no sets. Kept clean so it can later be repurposed as a public showcase or new-user starter surface.

**Contract**: Wrap in `Layout`; render a heading + brief copy and mount `<InteractiveMap client:only="react" connector ... />` with a hardcoded target coordinate (e.g. a well-known city). Provide a **World / Poland** framing toggle that switches the `bbox` prop (world default vs a Poland bounding box). Display the latest clicked coordinate and the distance km (either inside the island via `connector`, or alongside it). Glassmorphism styling consistent with existing pages. **Do not** add `/map-demo` to `PROTECTED_ROUTES`. Because the island is `client:only`, the demo's interactive state (last click, selected bbox) lives in a tiny client component or in the island itself — keep the Astro page a thin shell.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/pages/map-demo.astro`
- Build succeeds with the new route: `npm run build`

#### Manual Verification:

- `/map-demo` loads without signing in and shows a blank world map of country outlines
- Clicking the map drops a guess marker at the click point and shows the revealed target marker, a connector line, and a km distance
- The km distance is plausible for the clicked vs target location (cross-check one pair against a known value)
- Toggling to **Poland** re-frames the map tightly around Poland; clicks remain coordinate-accurate at that framing (a click on Warsaw's location reads ~Warsaw coords)
- No console errors; no SSR/hydration/`window` errors in the browser
- Visiting `/map-demo` while signed out works (route is intentionally public)

**Implementation Note**: After completing this phase and all automated verification passes, the foundation is functionally complete — confirm the full click→distance loop and the bbox framing manually.

---

## Testing Strategy

No automated test runner exists yet (testing is introduced in Module 3). Verification is the typecheck / scoped-lint / build gate plus manual checks on `/map-demo`.

### Manual Testing Steps:

1. Run `npm run dev`; open `/map-demo` (no login) → blank world map of country outlines renders on the cosmic background.
2. Click several locations → each drops a guess marker, reveals the target marker, draws the connector line, and shows a km distance.
3. Cross-check one distance against a known value (e.g. click near Berlin with a Warsaw target ≈ 520 km).
4. Toggle **Poland** framing → map re-frames on Poland; click on Warsaw's position → reported coordinate is ~Warsaw; toggle back to **World** → reframes to the world.
5. Confirm no console/SSR/hydration errors throughout.

## Performance Considerations

The map is rendered once client-side; click→distance is local math (`haversine`) with no server round-trip, comfortably inside the 500 ms p95 NFR (which S-02 must honor for per-click feedback). The 110m TopoJSON (~110 KB) is a one-time client asset; SVG country paths at 110m are light to render. No pan/zoom means no per-frame reprojection. The fixed `viewBox` avoids resize-driven reprojection for the static MVP.

## Migration Notes

No schema migration (F-02 is pure frontend). New runtime dependencies: `d3-geo`, `topojson-client`, `world-atlas`; new dev dependencies: `@types/d3-geo`, `@types/topojson-client`. A ~110 KB TopoJSON asset is added to the repo/bundle. No type regeneration.

## References

- Change identity: `context/changes/interactive-map-foundation/change.md`
- Roadmap foundation F-02: `context/foundation/roadmap.md`
- PRD FR-010/FR-011, NFR Latency, Open Question #1: `context/foundation/prd.md`
- Cloudflare/Workers + island constraints: `context/foundation/infrastructure.md`
- Island + page + styling precedent (S-01): `src/components/sets/ImportSetForm.tsx`, `src/pages/sets/index.astro`, `src/layouts/Layout.astro`, `src/middleware.ts`
- Pure-util + lint-scope precedent (S-01): `src/lib/csv.ts`, `eslint.config.js`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure geo util + dependencies

#### Automated

- [ ] 1.1 Type checking passes: `npm run typecheck`
- [ ] 1.2 Linting passes on touched files: `npx eslint src/lib/geo.ts`
- [ ] 1.3 Build succeeds with the new deps + asset import: `npm run build`
- [ ] 1.4 Map deps in `dependencies`, type deps in `devDependencies`, lockfile updated

#### Manual

- [ ] 1.5 `haversine` reason-checked against a known city pair

### Phase 2: InteractiveMap island + projection module

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes on touched files: `npx eslint src/lib/mapProjection.ts src/components/map/InteractiveMap.tsx`
- [ ] 2.3 Build succeeds with the island: `npm run build`

#### Manual

- [ ] 2.4 Component compiles and imports cleanly; no SSR/`window` errors at build

### Phase 3: /map-demo verification surface

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes on touched files: `npx eslint src/pages/map-demo.astro`
- [ ] 3.3 Build succeeds with the new route: `npm run build`

#### Manual

- [ ] 3.4 `/map-demo` loads without login; blank world map renders
- [ ] 3.5 Click drops guess marker, reveals target, draws connector line + km
- [ ] 3.6 Distance is plausible vs a known pair
- [ ] 3.7 Poland framing re-frames the map; clicks stay coordinate-accurate
- [ ] 3.8 No console/SSR/hydration errors
- [ ] 3.9 Public route works signed out
