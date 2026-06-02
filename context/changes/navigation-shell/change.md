---
change_id: navigation-shell
title: Consistent navigation shell on every authenticated screen (no dead-ends)
status: implementing
created: 2026-06-02
updated: 2026-06-03
archived_at: null
---

## Notes

Roadmap S-06. A top nav bar (with a logo linking home) renders on **every** authenticated screen — including the study session — so there are no dead-ends; today `/dashboard` renders no `Topbar` and traps the user. Link order surfaces "My sets" prominently.

- PRD refs: — (UX polish; not a PRD FR)
- Prerequisites: — (existing `src/components/Topbar.astro`, `src/pages/dashboard.astro`)
- Parallel with: S-08, S-09
- Risk: Small, pure-UX. Cheapest item in stream D and removes the current navigation trap. Does **not** delete `/dashboard` — S-07 repurposes it.
