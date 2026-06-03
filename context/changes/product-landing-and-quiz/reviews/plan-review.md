<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Product Landing Page + Logged-out Teaser Quiz (S-08)

- **Plan**: context/changes/product-landing-and-quiz/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

8/8 paths ✓, 2/2 symbols ✓, brief↔plan ✓. `Welcome.astro` imported only by `index.astro` (dashboard hit is plain text). `EUROPE_BBOX` unexported in MapDemo (extraction is correct). Both `client:load` (study) and `client:only="react"` (map-demo) precedents exist.

## Findings

### F1 — End-screen "Sign up" CTA doesn't adapt to auth state

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — TeaserQuiz final screen
- **Detail**: Hero adapts CTAs for logged-in users but the teaser end screen hardcoded "Sign up" → /auth/signup. A logged-in visitor would finish on a "Sign up" CTA.
- **Fix**: Added a `primaryCta: {label, href}` prop computed by the Astro page from `Astro.locals.user`; end-screen CTA now adapts. Added Phase 3 manual check 3.8.
- **Decision**: FIXED (Fix in plan)

### F2 — Logged-out hero CTA set unresolved across phases

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 vs Phase 3
- **Detail**: Phase 1 fixed CTAs as Sign up + Sign in; Phase 3 introduced "Try the demo" only parenthetically. Final hero button set unpinned.
- **Fix**: Pinned hero CTA set in Phase 1 — logged-out: primary "Try the demo" (→ #try) + secondary "Sign up"; logged-in: primary "Go to my sets" + secondary "Try the demo". Dropped the redundant Sign-in hero button.
- **Decision**: FIXED (Fix in plan)

### F3 — Hydration directive diverges from precedents / weak perf rationale

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Contract + Performance Considerations
- **Detail**: `client:visible` defers hydration, not download; the bundled basemap ships regardless. `client:load` proves InteractiveMap SSRs, so client:visible builds fine.
- **Fix**: Kept `client:visible`; rewrote the Performance note to state it defers hydration (not download) and that client:load confirms SSR is clean.
- **Decision**: FIXED (Fix in plan)

### F4 — 300km threshold makes most European clicks read "correct"

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — already an accepted decision
- **Dimension**: End-State Alignment
- **Detail**: In dense Europe the 300km default scores most clicks "correct," undersells the precision feedback the teaser is meant to showcase. Explicitly accepted during planning.
- **Fix**: None (accepted). A teaser-local tighter threshold (e.g. 150km) remains a one-constant change if revisited.
- **Decision**: ACCEPTED
