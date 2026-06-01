---
change_id: interactive-map-foundation
title: Interactive map foundation — clickable blank map + distance util
status: impl_reviewed
created: 2026-06-01
updated: 2026-06-01
archived_at: null
---

## Notes

Seeded from roadmap foundation **F-02** (`context/foundation/roadmap.md`, Stream B — interactive map).

- **Outcome:** a reusable interactive blank map renders, captures click coordinates, projects lat/lon ↔ screen, auto-frames to a `bbox`, and computes click→target distance (haversine). No user-facing study flow (that's S-02).
- **PRD refs:** FR-010, FR-011, NFR Latency.
- **Prerequisites:** — (frontend present; map library absent per Baseline).
- **Parallel with:** F-01 (done), S-01 (done).
- **Gates:** the north star S-02 `first-study-session`.
- **Plan decisions (2026-06-01):** d3-geo + bundled world-atlas TopoJSON (110m), equirectangular projection, full-world default with a load-bearing `bbox` framing prop (auto fitExtent), static (no user pan/zoom — pan/zoom is a future seam), `client:only="react"` island, render-agnostic prop contract (`onMapClick` + `markers[]` + `bbox`), markers + distance line rendered in-component, pure `haversine` in `src/lib/geo.ts`, verified via a clean auth-free `/map-demo` route. See `plan.md` / `plan-brief.md`.
