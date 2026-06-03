<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Product Landing Page + Logged-out Teaser Quiz (S-08)

- **Plan**: context/changes/product-landing-and-quiz/plan.md
- **Scope**: All 3 phases (complete)
- **Date**: 2026-06-03
- **Verdict**: APPROVED
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

### F1 — Auth pages edited despite "no auth changes" guardrail

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/auth/signin.astro:20, src/pages/auth/signup.astro:20
- **Detail**: The plan's "What We're NOT Doing" lists "No changes to auth, middleware, or PROTECTED_ROUTES." Phase 3 added "← Back to home" links to both auth pages. Benign navigation affordance (no auth logic/middleware/PROTECTED_ROUTES touched), user-requested mid-implementation to fix a UX dead-end, but still an EXTRA beyond documented plan scope.
- **Fix**: Accept as a justified in-flight scope addition; note it in the plan/change as an addendum so the source of truth reflects it. (No code change.)
- **Decision**: FIXED — addendum appended to plan.md

### F2 — client:only="react" diverges from plan's client:visible

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/Welcome.astro:73
- **Detail**: The plan's Performance section specifies `client:visible`. Implementation uses `client:only="react"` because the random per-render pickTen() seed is incompatible with SSR (hydration mismatch), and the lint-clean useEffect workaround is blocked by a setState-in-effect rule. Documented in code comment + p3 commit, matches MapDemo precedent, but the plan's Performance rationale is now stale.
- **Fix**: Reconcile the plan's Performance section with the shipped client:only decision (addendum).
- **Decision**: FIXED — addendum appended to plan.md

### F3 — Duplicated anchor-button styling instead of shared class

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/landing/TeaserQuiz.tsx:99-103
- **Detail**: The end-screen primary CTA repeats the exact long Tailwind class string used by the hero's primary anchor in Welcome.astro. Consistent with how the rest of the page styles anchor-CTAs (no shared component exists), so not a defect — just duplication that would drift if the brand button restyles.
- **Fix**: Leave as-is for MVP; consider a shared CTA class/component if a third copy appears.
- **Decision**: SKIPPED
