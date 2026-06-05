# Higher-res Basemap + Europe Framing Toggle — Implementation Plan

## Overview

A small, frontend-only refinement of the delivered F-02 map foundation (`context/changes/interactive-map-foundation/`). Two adjustments to `/map-demo`: (1) swap the bundled basemap from world-atlas 110m to **50m** so country borders look crisp at Europe/Poland scale instead of blocky, and (2) add a third **Europe** framing button so the demo toggles **World / Europe / Poland**. Neither touches the island's architecture or its `<InteractiveMap onMapClick markers bbox connector />` prop contract.

## Current State Analysis

- The island renders a blank basemap from a bundled TopoJSON imported at `src/components/map/InteractiveMap.tsx:7` (`import worldTopo from "@/assets/world-110m.json"`). The 110m asset (105 KB) is coarse — visibly blocky at country zoom.
- `world-atlas` already ships higher resolutions in `node_modules/world-atlas/`: `countries-50m.json` (738 KB, measured) and `countries-10m.json` (3.6 MB). The bundling pattern is a plain `src/assets/` copy + JSON import (established in F-02 Phase 1).
- The framing mechanism is already generic: `createMapProjection(w, h, bbox?)` fits any `[[west,south],[east,north]]` box via `fitExtent` over a `MultiPoint` of the corners (`src/lib/mapProjection.ts`). The island passes `bbox` straight through.
- The demo's toggle lives entirely in `src/components/map/MapDemo.tsx`: a `Framing` union (`"world" | "poland"`), a `POLAND_BBOX` constant (`[[14.12,49.0],[24.15,54.84]]`), and two `<Button>`s whose `variant` reflects the active framing. Adding a third option is a localized extension of that pattern — the island needs no change.

### Key Discoveries:

- **Resolution swap is a one-line import change + asset copy** — `InteractiveMap.tsx:7` is the single consumer; the source comment on lines 5–6 documents the asset origin and must be updated to name the 50m source.
- **Europe framing is demo-surface only** — `MapDemo.tsx` is the only file that defines framings; the island and projection module are framing-agnostic.
- **50m chosen over 10m** — 10m (3.6 MB) only pays off at sub-country zoom (PRD Open Question #1, out of MVP); 50m is the country/continent sweet spot at ~7× the 110m size but still a one-time client asset.
- **Continental Europe bbox** = `[[-11, 34], [40, 71]]` (decided 2026-06-01): British Isles + Iberia in the west to western Russia in the east, Mediterranean to North Cape.

## Desired End State

On `/map-demo`, country borders render noticeably crisper at Poland and Europe framing (no blocky 110m edges). Three framing buttons — **World**, **Europe**, **Poland** — switch the map; selecting **Europe** re-frames tightly on the continent and clicks remain coordinate-accurate at that framing. The old 110m asset is removed from the repo.

Verify: `npm run typecheck`, scoped `eslint` on touched files, and `npm run build` all pass; the `/map-demo` manual checks below hold.

## What We're NOT Doing

- **No 10m resolution** — out of MVP (sub-country zoom is a PRD Open Question).
- **No island or projection-module changes** — the `bbox` contract already supports arbitrary framings; this change does not touch `InteractiveMap.tsx` logic or `mapProjection.ts`.
- **No new framings beyond Europe** — World/Europe/Poland only.
- **No pan/zoom, no dynamic resolution switching by zoom level** — static framing, single bundled asset.
- **No changes to the island's props, markers, connector, or distance behavior.**
- **No automated test runner** — still Module 3 scope; verification is typecheck + scoped lint + build + manual.

## Implementation Approach

Single phase, two independent edits sharing one verification surface (`/map-demo`):

1. **Basemap resolution**: copy `node_modules/world-atlas/countries-50m.json` to `src/assets/world-50m.json`, repoint the import in `InteractiveMap.tsx` (and its source comment), and delete the now-unused `src/assets/world-110m.json`.
2. **Europe toggle**: extend the `Framing` union and add a `EUROPE_BBOX` constant + a third `<Button>` in `MapDemo.tsx`, mapping the active framing to the right `bbox` (or `undefined` for World).

## Phase 1: Higher-res basemap + Europe toggle

### Overview

Swap the bundled basemap to 50m and add the Europe framing button. Build is the smoke test that the larger asset imports cleanly; `/map-demo` is the visual + interaction check.

### Changes Required:

#### 1. Bundle the 50m basemap and repoint the import

**File**: `src/assets/world-50m.json` (new), `src/components/map/InteractiveMap.tsx`, `src/assets/world-110m.json` (delete)

**Intent**: Replace the coarse 110m basemap with the crisper 50m one so borders look good at country/continent scale. The 110m asset is removed since it has no remaining consumer.

**Contract**: Copy `node_modules/world-atlas/countries-50m.json` → `src/assets/world-50m.json`. In `InteractiveMap.tsx`, change the import on line 7 to `world-50m.json` and update the source comment (lines 5–6) to name `countries-50m.json` as the origin. The TopoJSON shape is identical (`topology.objects.countries`), so the `feature(topo, topo.objects.countries)` conversion is unchanged. Delete `src/assets/world-110m.json`.

#### 2. Add the Europe framing toggle

**File**: `src/components/map/MapDemo.tsx`

**Intent**: Give the demo a third framing so users can compare World / Europe / Poland. Demo-surface only — the island is unchanged.

**Contract**: Extend the `Framing` union to `"world" | "europe" | "poland"`. Add `const EUROPE_BBOX: Bbox = [[-11, 34], [40, 71]]`. Add a third `<Button>` (label "Europe") following the existing active-variant pattern (`variant={framing === "europe" ? "default" : "outline"}`). Map the active framing to the `bbox` prop: `europe → EUROPE_BBOX`, `poland → POLAND_BBOX`, `world → undefined`. A `switch`/lookup replaces the current `framing === "poland" ? POLAND_BBOX : undefined` ternary.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes on touched files: `npx eslint src/components/map/InteractiveMap.tsx src/components/map/MapDemo.tsx`
- Build succeeds with the 50m asset: `npm run build`
- Old asset removed: `src/assets/world-110m.json` no longer exists; `src/assets/world-50m.json` exists

#### Manual Verification:

- `/map-demo` loads and country borders are visibly crisper than before (no blocky 110m edges), especially at Poland/Europe framing
- Three buttons render: World, Europe, Poland; the active one is highlighted
- Selecting **Europe** re-frames tightly on the continent; clicks remain coordinate-accurate (a click on a known location reads plausible coords / distance)
- World and Poland framings still work as before; connector + km distance still render
- No console/SSR/hydration errors

**Implementation Note**: After automated verification passes, pause for manual confirmation on `/map-demo` before closing the phase.

---

## Testing Strategy

No automated test runner exists yet (Module 3 scope). Verification is the typecheck / scoped-lint / build gate plus manual checks on `/map-demo`.

### Manual Testing Steps:

1. `npm run dev`; open `/map-demo` → borders render crisper than the prior 110m version.
2. Click **Europe** → map re-frames on the continent; click a known spot (e.g. near Warsaw) → coords/distance plausible.
3. Click **World** and **Poland** → both still frame correctly; markers, connector, and km label still work.
4. Confirm no console/SSR/hydration errors.

## Performance Considerations

The 50m asset is ~738 KB vs ~105 KB at 110m — a one-time client bundle increase (~630 KB), acceptable for a client-only island loaded on demand at `/map-demo`. SVG path rendering at 50m is heavier than 110m but still rendered once (no pan/zoom, no per-frame reprojection); the existing `useMemo` keyed on `bbox` keeps the TopoJSON→GeoJSON conversion and projection construction off the render path. No server impact (client-only).

## Migration Notes

No schema change. Asset delta only: add `src/assets/world-50m.json`, remove `src/assets/world-110m.json`. No dependency changes (`world-atlas` already installed). No type regeneration.

## References

- Change identity: `context/changes/map-demo-framing-and-resolution/change.md`
- Foundation being refined: `context/changes/interactive-map-foundation/plan.md`
- Basemap consumer: `src/components/map/InteractiveMap.tsx:5-7`
- Framing/toggle surface: `src/components/map/MapDemo.tsx`
- Generic framing mechanism: `src/lib/mapProjection.ts` (`createMapProjection`, `fitExtent` over corner MultiPoint)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Higher-res basemap + Europe toggle

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — 6612d92
- [x] 1.2 Linting passes on touched files: `npx eslint src/components/map/InteractiveMap.tsx src/components/map/MapDemo.tsx` — 6612d92
- [x] 1.3 Build succeeds with the 50m asset: `npm run build` — 6612d92
- [x] 1.4 `world-110m.json` removed; `world-50m.json` exists — 6612d92

#### Manual

- [x] 1.5 `/map-demo` borders visibly crisper (no blocky 110m edges) — 6612d92
- [x] 1.6 Three buttons (World/Europe/Poland); active highlighted — 6612d92
- [x] 1.7 Europe re-frames on the continent; clicks coordinate-accurate — 6612d92
- [x] 1.8 World/Poland still work; connector + km still render — 6612d92
- [x] 1.9 No console/SSR/hydration errors — 6612d92
