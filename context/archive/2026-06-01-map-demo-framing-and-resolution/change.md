---
change_id: map-demo-framing-and-resolution
title: Higher-res basemap + Europe framing toggle on /map-demo
status: archived
created: 2026-06-01
updated: 2026-06-05
archived_at: 2026-06-05T21:41:11Z
---

## Notes

Small frontend-only refinement of the delivered F-02 map foundation (`context/changes/interactive-map-foundation/`). No architecture or island-contract changes — the `<InteractiveMap onMapClick markers bbox connector />` surface stays identical.

Two adjustments:

1. **Higher-resolution borders.** Swap the bundled basemap from world-atlas `countries-110m.json` (~110 KB, blocky at country zoom) to **`countries-50m.json`** (~700 KB, crisp at Europe/Poland scale). Decision (2026-06-01): 50m chosen over 10m — 10m (~2 MB+) only pays off at sub-country zoom, which is a PRD Open Question / out of MVP. Mechanically: bundle the 50m file into `src/assets/`, update the single JSON import + source comment in `InteractiveMap.tsx`. No code-path change.

2. **Europe framing toggle.** Add a third framing button to `/map-demo` so it toggles **World / Europe / Poland**. Demo-surface only: add a `EUROPE_BBOX` constant + third `<Button>` in `MapDemo.tsx`. The island already accepts an arbitrary `bbox`, so no island change.

Scope/sizing: single-phase quick iteration. Frontend only, no schema. Verify via `npm run build` + `/map-demo` visual check (crisper borders; Europe framing re-frames and clicks stay coordinate-accurate). Not a new roadmap milestone — refinement of the already-delivered F-02.
