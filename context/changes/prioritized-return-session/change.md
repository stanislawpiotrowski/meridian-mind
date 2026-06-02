---
change_id: prioritized-return-session
title: Prioritized return session — auto-ordered queue surfacing weak and stale items
status: plan_reviewed
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Roadmap item S-03 (from `context/foundation/roadmap.md`). Outcome: a user starting a new session against a previously-studied set gets an auto-prioritized queue — items they got wrong or haven't seen recently appear earlier and more often, while well-known items still recur occasionally — with no configuration required. PRD refs: US-02, FR-015, FR-016. Prerequisites: S-02 (first-study-session, must have produced per-item history), F-01. Keep the rule the simplest form that satisfies FR-016 — advanced SRS scoring (SuperMemo/SM-2) is an explicit Non-Goal. Open: prioritization formula granularity (Leitner-box vs degenerate "missed-items-first") — simplest ordering acceptable per PRD.
