<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: One-Click Curated Starter Sets

- **Plan**: context/changes/starter-sets/plan.md
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-06-03
- **Verdict**: APPROVED (with 1 warning, now resolved)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Plan prose still says "allow-duplicate" while code blocks duplicates

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/changes/starter-sets/plan.md:34 (What We're NOT Doing) + Testing Strategy step 3
- **Detail**: Shipped code blocks duplicate starter adds (AddStarterSetButton.alreadyAdded + existingSetNames in index.astro), reversing the plan's allow-duplicate decision. Recorded in commit d2e1f85 but the plan prose still documented the opposite.
- **Fix A ⭐ Recommended**: Add an addendum to plan.md documenting the reversal + rationale.
  - Strength: Updates the source of truth; matches repo's addendum habit.
  - Tradeoff: Plan becomes a slightly moving target post-approval.
  - Confidence: HIGH — decision + rationale already in d2e1f85.
  - Blind spot: None significant.
- **Fix B**: Leave plan as-is; rely on commit body.
  - Strength: Keeps approved plan immutable.
  - Tradeoff: Plan and code disagree; future review re-surfaces it.
  - Confidence: MED — only works if reviewers read git history.
  - Blind spot: Testing step 3 still asserts now-impossible behavior.
- **Decision**: FIXED via Fix A — added "## Plan Addenda → A1" to plan.md.

### F2 — Duplicate gate keys on set name, not a starter identity

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/sets/index.astro:33 (existingSetNames), :57 (alreadyAdded)
- **Detail**: alreadyAdded = existingSetNames.has(starter.title). A manually-imported set named identically shows "Added ✓"; renaming an added starter re-enables Add. Acceptable / arguably correct; called out when the approach was chosen.
- **Fix**: None needed — accept as documented behavior of the name-based gate.
- **Decision**: ACCEPTED — conscious documented edge.

### F3 — countDataRows reimplements row-counting independently of csv.ts

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/data/starter-sets/registry.ts:21-26
- **Detail**: countDataRows counts non-empty lines minus header. Matches the plan's explicit instruction and aligns with Papa.parse skipEmptyLines. Minor future-drift risk if csv.ts parsing rules change (e.g. quoted newlines); not a concern for these flat curated files.
- **Fix**: None needed — matches plan; flagged only as a future-drift note.
- **Decision**: ACCEPTED — implemented as planned.
