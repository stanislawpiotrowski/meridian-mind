<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Interactive Map Foundation (F-02)

- **Plan**: context/changes/interactive-map-foundation/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-06-01
- **Verdict**: APPROVED (2 minor warnings)
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Direct import of an undeclared dependency (topojson-specification)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/map/InteractiveMap.tsx:3
- **Detail**: `import type { Topology } from "topojson-specification"` imports from a package not in package.json or the lockfile. It type-resolves only because `@types/topojson-specification` ships transitively as a dependency of `@types/topojson-client`. Type-only import, so build/runtime unaffected, but violates "depend on what you import" and is fragile if `@types/topojson-client` restructures its deps.
- **Fix**: Add `@types/topojson-specification` to devDependencies so the direct import is explicitly declared.
- **Decision**: FIXED — added `@types/topojson-specification ^1.0.5` to devDependencies.

### F2 — Demo page omits <Topbar /> that sibling pages include

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/map-demo.astro:9–22
- **Detail**: Every other content page (e.g. src/pages/sets/index.astro:35) wraps content in Layout + Topbar. map-demo.astro uses Layout but omits Topbar. The page comment frames this as a deliberate auth-free isolation/showcase surface, and Topbar carries auth-aware nav that may not suit a public page — plausibly intentional.
- **Fix**: Confirm isolation intent and skip, OR add `<Topbar />` for navigation consistency.
- **Decision**: SKIPPED — Topbar-free is intentional per the auth-free isolation/showcase intent.
