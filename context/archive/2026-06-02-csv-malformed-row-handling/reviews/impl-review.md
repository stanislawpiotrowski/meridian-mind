<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: CSV Malformed-Row Handling (S-05)

- **Plan**: context/changes/csv-malformed-row-handling/plan.md
- **Scope**: Phase 2 of 2 (full plan)
- **Date**: 2026-06-02
- **Verdict**: APPROVED
- **Findings**: 0 critical · 0 warnings · 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — InvalidRow.values is computed but never rendered

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/csv.ts:122 (values), src/components/sets/ImportSetForm.tsx:118-128
- **Detail**: The plan's InvalidRow contract describes `values` as "carries the raw cells for display." The validator populates it, but the report UI renders only row #, field, and reason — never the offending cell value. Not a PRD violation (PRD requires field + reason only), but the report would be more useful showing the bad value. The field is currently plumbed but unused by its one consumer.
- **Fix**: Optionally surface `row.values[err.field]` next to each reason in the report list; or accept as intentional forward-plumbing.
- **Decision**: FIXED — report now renders the offending cell value (quotes omitted when blank).

### F2 — Cancel uses a raw <button> instead of the Button primitive

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/sets/ImportSetForm.tsx:139-145
- **Detail**: The import action uses the shared `Button` primitive; Cancel is a hand-rolled <button> with bespoke Tailwind. Reasonable (Button is primary-styled; Cancel wants secondary), and the file already hand-rolls glassmorphism — just noting button styling now lives in two places.
- **Fix**: Accept as-is, or add a `variant="secondary"` to Button later if a secondary style is needed elsewhere.
- **Decision**: SKIPPED — secondary styling justified; no Button variant exists yet.

### F3 — Array index as React key in the error sub-list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/sets/ImportSetForm.tsx:124
- **Detail**: `row.errors.map((err, i) => <li key={i}>)` uses the array index as key. The list is static (never reordered/filtered after render), so this is harmless here — flagged for completeness.
- **Fix**: Use `key={err.field}` (each field appears at most once per row).
- **Decision**: FIXED — key changed to `err.field`.
