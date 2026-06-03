<!-- PLAN-REVIEW-REPORT -->

# Plan Review: One-Click Curated Starter Sets

- **Plan**: context/changes/starter-sets/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: SOUND (one low-effort fix recommended)
- **Findings**: 0 critical · 1 warning · 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | WARNING |

## Grounding

7/7 paths ✓ (ImportSetForm, api/sets/index, lib/csv, sets/index.astro, dashboard.astro, env.d.ts, ServerError), symbols ✓ (postSet, parseAndValidateCsv, ServerError, sets.length===0), brief↔plan ✓, Progress↔Phase ✓ (3 phases, all criteria mapped). Verified: no test runner / no tsx in repo; `.astro/types.d.ts` references `astro/client` so `?raw` imports are already typed.

## Findings

### F1 — Phase 1 "zero invalid rows" gate has no runnable mechanism

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria / Automated (1.1)
- **Detail**: Criterion 1.1 required CSVs to "parse with zero invalid rows (quick Node/script check ... or assert via Phase 2 registry build)." The repo has no test runner and no tsx, so the standalone script path is unspecified friction; and `astro build` never invokes `parseAndValidateCsv`, so the registry-build fallback gives false assurance. Real validation only happens server-side at POST time.
- **Fix A ⭐ Recommended**: Reframe 1.1 — Phase 1 gate = header + row counts (9/48/23) + UTF-8; prove zero-invalid via the Phase 2/3 add returning the exact expected count (server validates every row).
  - Strength: No new tooling; uses the server-authoritative validator the plan already relies on (index.ts:49-73).
  - Tradeoff: Bad data isn't caught until the add step.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Add scripts/validate-starters.ts run via `npx tsx` asserting `invalid.length===0`.
  - Strength: Catches bad rows at authoring time.
  - Tradeoff: Net-new ad-hoc tooling in a repo with no test infra.
  - Confidence: MED.
  - Blind spot: ESM/path resolution unverified.
- **Decision**: FIXED via Fix A — reframed Phase 1 automated criteria + added note; renumbered Progress 1.1–1.5.

### F2 — Registry `count` hardcoded instead of derived from the CSV

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — registry.ts contract
- **Detail**: `count` stored as a field can drift from the CSV if the file is edited; the CSV string is already in the registry so count can be derived at module load.
- **Fix**: Derive count from the imported CSV (non-empty data lines) rather than hardcoding.
- **Decision**: FIXED — registry contract now mandates deriving `count` from the CSV.

### F3 — Registry `description?` field is unused

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 (registry.ts) / Phase 3 (section render)
- **Detail**: Type includes `description?: string` but Phase 3 renders only title + count + Add button.
- **Fix**: Drop `description?` from the type; add back when a UI needs it.
- **Decision**: FIXED — `description?` removed from the registry type.
