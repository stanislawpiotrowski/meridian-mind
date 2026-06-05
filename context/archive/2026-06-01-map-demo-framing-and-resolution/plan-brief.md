# Higher-res Basemap + Europe Framing Toggle — Plan Brief

> Full plan: `context/changes/map-demo-framing-and-resolution/plan.md`

## What & Why

A small frontend-only refinement of the delivered F-02 map foundation. The 110m basemap looks blocky at country zoom, and `/map-demo` only offers World/Poland framing. We swap to the crisper 50m basemap and add a third **Europe** framing button.

## Starting Point

The island renders a blank basemap from `src/assets/world-110m.json` (imported once at `InteractiveMap.tsx:7`). The demo's framing toggle lives entirely in `MapDemo.tsx` (a `Framing` union + `POLAND_BBOX` + two buttons). The projection module already fits any `bbox` via `fitExtent`, so framing is generic.

## Desired End State

`/map-demo` shows crisper country borders at Poland/Europe scale, with three framing buttons — World / Europe / Poland. Europe re-frames tightly on the continent with coordinate-accurate clicks. The old 110m asset is removed.

## Key Decisions Made

| Decision           | Choice                             | Why (1 sentence)                                                                             | Source |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| Basemap resolution | 50m (738 KB)                       | Crisp at country/continent scale; 10m (3.6 MB) only helps sub-country zoom (out of MVP).     | Plan   |
| Old asset          | Delete `world-110m.json`           | No remaining consumer after the swap; keep the repo clean.                                   | Plan   |
| Europe bbox        | `[[-11,34],[40,71]]` (continental) | Tight fill of mainland Europe + British Isles; Iceland sits at the western edge.             | Plan   |
| Scope of edits     | Demo + island import only          | The `bbox` contract already supports arbitrary framings — no island/projection logic change. | Plan   |

## Scope

**In scope:** bundle `world-50m.json` + repoint the import; delete `world-110m.json`; add `EUROPE_BBOX` + a third toggle button in `MapDemo.tsx`.

**Out of scope:** 10m resolution; island/projection-module changes; new framings beyond Europe; pan/zoom or zoom-adaptive resolution; any change to props/markers/connector/distance behavior.

## Architecture / Approach

Two independent edits across two files. (1) Asset swap: copy the 50m TopoJSON into `src/assets/`, change the single JSON import + its source comment in `InteractiveMap.tsx`, delete the 110m file — the `topology.objects.countries` shape is identical, so no conversion change. (2) Toggle: extend the `Framing` union and add a `EUROPE_BBOX` constant + third `<Button>` in `MapDemo.tsx`, mapping the active framing to the island's `bbox` prop.

## Phases at a Glance

| Phase                                 | What it delivers                                         | Key risk                                                    |
| ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Higher-res basemap + Europe toggle | 50m borders on `/map-demo` + World/Europe/Poland framing | 50m asset (~738 KB) bundles/renders cleanly under the build |

**Prerequisites:** F-02 implemented (done); `world-atlas` installed (done).
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- 50m asset (~738 KB) is an acceptable one-time client bundle increase for a demo island loaded on demand (assumed yes).
- `countries-50m.json` exposes the same `objects.countries` structure as 110m (true for world-atlas; verified by build).

## Success Criteria (Summary)

- Borders on `/map-demo` are visibly crisper than the 110m version.
- Three framing buttons work; Europe frames the continent with coordinate-accurate clicks; World/Poland unchanged.
- `npm run typecheck`, scoped `eslint`, and `npm run build` all pass.
