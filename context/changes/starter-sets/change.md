---
change_id: starter-sets
title: One-click curated starter sets
status: plan_reviewed
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Roadmap slice S-09. Curated CSV sets ship inside the app; "add" creates the user's **own copy** via the existing import path (reuse CSV validation / `ImportSetForm`). Entry points: the S-07 empty state and a "Start with a ready-made set" section in `/sets`.

- PRD refs: — (post-MVP; strengthens onboarding / S-07 empty state)
- Prerequisites: S-01 (csv-set-import-and-list — existing import path to reuse)
- Parallel with: S-06, S-08
- Open question: behavior on double-click (allow duplicate vs block). Per-user copy keeps the data model unchanged. Owner: user. Block: no.
- Risk: The real work is data — sourcing and **verifying** coordinates (especially Polish national-park centroids); logic is trivial (reuse import). Three starter sets (`name, latitude, longitude`):
  - **A. Crown of the Earth — 9 peaks** (combined Bass+Messner). `name` carries elevation; continent classification only on disputed entries: Mount Everest (8848 m), Aconcagua (6961 m), Denali / McKinley (6190 m), Kilimanjaro (5895 m), Vinson Massif (4892 m), Elbrus (5642 m, Europe per Messner/Bass), Mont Blanc (4810 m, Europe per some geographers), Puncak Jaya (4884 m, Oceania per Messner), Mount Kosciuszko (2230 m, Australia per Bass).
  - **B. European capitals — all 48.** `name` = bare name; point = city center.
  - **C. National Parks of Poland — all 23.** `name` = bare name; point = park **centroid** (not the HQ).
