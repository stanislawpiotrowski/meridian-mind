---
change_id: testing-runner-bootstrap-core-math
title: Runner bootstrap + core spatial-click math unit coverage
status: implemented
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Runner bootstrap + core math".

Risks covered: Risk #1 (spatial-click verdict or distance is wrong — projection or haversine math marks a far-off click "correct" or shows a wrong km).

Test types planned: unit.

Risk response intent: prove that known real-world coordinate pairs yield the correct distance and the correct correct/incorrect verdict at the defined threshold; the test must get its oracle from independent geographic ground truth, never from the values the code under test produces. This phase also stands up the test runner (Vitest is the natural fit — Vite 7 is already in the dep tree via Astro).
