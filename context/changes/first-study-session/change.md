---
change_id: first-study-session
title: First full study session (north star) — spatial-click quiz loop end-to-end
status: implemented
created: 2026-06-01
updated: 2026-06-02
archived_at: null
---

## Notes

Roadmap item **S-02** (north star) from `context/foundation/roadmap.md`. Outcome: user can start a quiz against a chosen set, see one object name at a time, click the map to answer, get distance + correct/incorrect feedback with the correct location revealed, advance through the full queue on acknowledge, and reach a session summary — with mid-session progress preserved across a tab close.

- Prerequisites: F-01 (domain-data-schema), F-02 (interactive-map-foundation), S-01 (csv-set-import-and-list) — all present in the codebase.
- PRD refs: US-01, FR-008…FR-014, FR-015, NFR Latency, NFR Persistence-reliability.
- Keep queue logic trivial (full set, each item exactly once); ordering/prioritization is S-03.
- km-only distance units for MVP (continent-scale sets) — Open Roadmap Question #1.
