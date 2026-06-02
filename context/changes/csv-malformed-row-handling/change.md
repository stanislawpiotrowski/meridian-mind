---
change_id: csv-malformed-row-handling
title: CSV import with malformed-row reporting and import-valid-or-cancel
status: impl_reviewed
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Seeded from roadmap slice **S-05** (`context/foundation/roadmap.md`).

- **Outcome:** user importing a CSV with malformed rows sees each invalid row reported before commit (1-indexed row number, which field failed, one-line reason) and chooses to either import valid rows only or cancel to fix the source file.
- **PRD refs:** US-03, FR-007
- **Prerequisites:** S-01 (csv-set-import-and-list)
- **Parallel with:** S-02, S-03, S-04
- **Risk:** Nice-to-have per PRD priority; sequenced last. Under the `speed` goal, ship only if time remains after the must-have path. Header/encoding validation contract is fully specified in US-03 acceptance criteria.
