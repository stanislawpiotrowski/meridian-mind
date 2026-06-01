---
change_id: csv-set-import-and-list
title: Import a CSV set and see it listed to pick
status: implemented
created: 2026-05-31
updated: 2026-06-01
archived_at: null
---

## Notes

Seeded from roadmap item **S-01** (`context/foundation/roadmap.md`, Stream A — data & study loop).

- **Outcome:** user can upload a CSV (columns `name`, `latitude`, `longitude`) to create a set, and see all their imported sets in a list to pick one to study.
- **PRD refs:** FR-004, FR-005; US-01 (prerequisite).
- **Prerequisites:** F-01 `domain-data-schema` — done (schema + RLS landed).
- **Parallel with:** F-02 `interactive-map-foundation`.
- **Gates:** the north star S-02 `first-study-session`.
- **Scope boundary (keep thin):** happy-path CSV parse only. Non-UTF-8 encodings and malformed-row UX are explicitly out — that's S-05 `csv-malformed-row-handling`. Set deletion is S-04.
- **Plan decisions (2026-05-31):** papaparse, server-side parsing (island POSTs JSON `{name, csv}`), filename-prefilled editable name, reject-whole-on-bad-row, dedicated `/sets` page with inline import, inert list rows (name+date+count), redirect to `/sets` post-import. See `plan.md` / `plan-brief.md`.
