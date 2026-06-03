---
change_id: dashboard-home
title: Dashboard as a "what to do now" home after login
status: implementing
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Roadmap item S-07 (`context/foundation/roadmap.md`). After login the user lands on a decision screen instead of `/sets` directly: "Due today: N" + "Start session", a study streak, recent sets / "resume", and an empty state that points to add-a-ready-made-set or import-CSV.

- Prerequisites: F-01 (data), S-03 (prioritization powers the "due today" count).
- Open unknown: "Due today" and streak counters require per-item review dates / session history. If absent, ship a "lite" version (recent sets + resume) first, counters later. Owner: user. Block: no.
- Risk: depends on the data model; consider a lite → full split. This is the screen that fixes the "nothing after login" problem. Builds on FR-015/FR-016 data; post-MVP (no PRD FR).
