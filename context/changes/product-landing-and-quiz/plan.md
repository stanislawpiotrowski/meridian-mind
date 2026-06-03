# Product Landing Page + Logged-out Teaser Quiz (S-08) Implementation Plan

## Overview

Replace the generic "10x Astro Starter" content on `/` with a MeridianMind product landing page, and embed a logged-out, client-side-only teaser quiz: 10 random European capitals drawn from a curated pool, click the map to answer, get great-circle distance + correct/incorrect feedback with the correct location revealed, advance through all 10, and reach a score screen with a sign-up CTA. No account, no API, no persistence. The teaser mirrors the real study loop so visitors experience the product's novel mechanic instead of reading about it.

## Current State Analysis

- `/` (`src/pages/index.astro`) renders `Welcome.astro` inside `Layout.astro`. `Welcome.astro` is pure boilerplate: "10x Astro Starter" hero, Sign In / Sign Up buttons, and three starter feature cards (Auth / Modern Stack / DX). `Layout.astro` injects `Topbar` via `Welcome.astro`.
- `Topbar.astro` already branches on `Astro.locals.user`: logged-in shows brand + "My sets" / "Dashboard" / "Sign out"; logged-out shows "Not signed in" + "Sign in" / "Sign up".
- The map stack is fully reusable and proven logged-out:
  - `InteractiveMap.tsx` — pure React, bundled topojson basemap (`@/assets/world-50m.json`), no fetch/auth. Takes `markers`, `bbox`, `connector`, `onMapClick`. Marker variants `guess` (amber) / `target` (emerald).
  - `MapDemo.tsx` — the click→guess→distance showcase pattern, and the source of `EUROPE_BBOX = [[-11,34],[40,71]]`.
  - `StudySession.tsx` — the full quiz loop (`awaiting-click` → `revealed` phases, hidden target during recall, reveal on click, "Next card"/"Finish", terminal `SessionSummary`). Coupled to persistence via `postAttempt`/`postComplete` + `sessionId` + the attempts/complete API.
- Pure, dependency-free libs ready to reuse: `haversine` (`src/lib/geo.ts`, returns whole km), `isCorrect` + `DEFAULT_CORRECT_THRESHOLD_KM = 300` (`src/lib/study.ts`).
- `/` is **not** in `PROTECTED_ROUTES` (`src/middleware.ts` gates only `/dashboard`, `/sets`, `/study`). Middleware always populates `Astro.locals.user` (null when logged out). No auth changes required.
- `/map-demo` is the existing precedent for an auth-free public page that mounts a map island.

### Key Discoveries:

- `EUROPE_BBOX` already exists in `MapDemo.tsx:18` — lift it into the teaser (or a shared constant) rather than re-deriving.
- `StudySession.tsx` is the structural template for the teaser loop, but its persistence coupling (`postAttempt`, `postComplete`, `sessionId`, `priorAttempts`) must be stripped — the teaser is a **new** stateless component, not a refactor of `StudySession` (decision: avoid regressing the must-have S-02 component).
- `SessionSummary.tsx` is typed to `StudyFlashcard` (string `id`) and hardcodes a "Back to sets" link — not directly reusable; the teaser gets its own lightweight summary with a sign-up CTA + "Try again".
- `InteractiveMap` hides/reveals the target purely by which markers it's handed — the teaser reproduces `StudySession`'s phase-derived marker logic (empty markers during recall; guess+target after click).
- Lint gate is unreliable repo-wide on this Windows/CRLF checkout — verify with `npx eslint <changed files>`, not `npm run lint` (see `context/foundation/lessons.md`).

## Desired End State

Visiting `/` (logged out) shows a MeridianMind landing: a hero naming the product and its wedge, three feature cards (spaced repetition / click-to-verify on the map / bring-your-own CSV), and a teaser-quiz section. Playing the quiz runs 10 European capitals end-to-end with live distance feedback and a final score screen offering "Sign up" and "Try again". A logged-in visitor sees the same page, but the hero/Topbar CTAs point to the app ("Go to my sets") instead of sign-up. No network calls are made by the quiz; nothing is persisted.

Verify: load `/` logged out → see MeridianMind branding (no "10x Astro Starter"); play through 10 capitals → reach score screen → "Try again" restarts with a fresh random 10; "Sign up" routes to `/auth/signup`. Load `/` logged in → CTAs read "Go to my sets". `npx eslint` on touched files, `npm run build`, and `astro check` all pass.

## What We're NOT Doing

- No backend, API route, database, or persistence of teaser results.
- No refactor of `StudySession.tsx`, `SessionSummary.tsx`, or the study API — the teaser is independent.
- No changes to auth, middleware, or `PROTECTED_ROUTES`.
- No `/try` route or deep-link alias — quiz is a section on `/` only.
- No non-European or sub-country capitals; no scale-adaptive distance units (km only, per roadmap Open Question #1).
- No leaderboard, no streak, no most-missed analytics beyond a simple score.
- No mobile/responsive-specific work beyond what the existing Tailwind classes already provide.

## Implementation Approach

Three phases, smallest-risk-first ordering: (1) static data + page copy (no React), (2) the interactive island in isolation (the real risk surface), (3) integration + cross-state verification. The teaser island is modeled structurally on `StudySession.tsx` but with all persistence removed and an in-memory results array as the only state. The map, distance math, and correctness threshold are reused verbatim from the existing libs so the teaser's feedback is identical to the real product's.

## Phase 1: Capital data + landing page rewrite

### Overview

Add the curated European-capitals dataset and replace the boilerplate landing content with MeridianMind product copy and auth-adaptive CTAs. No React island yet.

### Changes Required:

#### 1. Curated European capitals dataset

**File**: `src/lib/teaserCapitals.ts` (new)

**Intent**: Provide a vetted pool of ~24-30 well-known European capitals (name + verified coordinates) and a helper to pick a random 10 for a quiz run. Keeps obscure micro-state capitals out so casual visitors aren't frustrated.

**Contract**: Export `interface Capital { name: string; lat: number; lng: number }`, a `CAPITALS: Capital[]` constant (~24-30 entries; exclude micro-states like Vaduz/San Marino/Monaco/Andorra), and `pickTen(rng?): Capital[]` returning 10 distinct capitals in random order. Coordinates are city-center lat/lng, verified to whole-/two-decimal precision. Pure module, no DOM/d3 — mirrors the style of `src/lib/geo.ts`.

#### 2. Landing page content rewrite

**File**: `src/components/Welcome.astro`

**Intent**: Replace starter hero + feature cards with MeridianMind messaging: a hero stating the product and wedge, three feature cards (spaced repetition, click-to-verify on the map, bring-your-own CSV), and a placeholder slot/section where the Phase 2 quiz island will mount. Make hero CTAs auth-adaptive.

**Contract**: Keep the existing cosmic-background + `Topbar` shell. Hero headline → MeridianMind + tagline; replace the three `<svg>` feature cards' copy with the three wedge points. Hero CTA set branches on `Astro.locals.user`:

- logged-out → **primary "Try the demo"** (anchor link → `#try`) + **secondary "Sign up"** (`/auth/signup`). (Drop the old "Sign in" hero button — `Topbar` already exposes Sign in; the hero's job is to push into the demo.)
- logged-in → **primary "Go to my sets"** (`/sets`) + secondary "Try the demo" (`#try`).

Add the `id="try"` section anchor for the quiz, populated in Phase 3. (If cleaner, the rewrite may move markup into `index.astro` and drop `Welcome.astro` — implementer's call; Topbar must still render.)

#### 3. Page title

**File**: `src/pages/index.astro`

**Intent**: Pass a MeridianMind page title to `Layout` so the tab no longer reads "10x Astro Starter".

**Contract**: `<Layout title="MeridianMind — ...">`. (Default `Layout` title also still says "10x Astro Starter"; out of scope to change globally — set it here on `/`.)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes on touched files: `npx eslint src/lib/teaserCapitals.ts src/components/Welcome.astro src/pages/index.astro`
- Build succeeds: `npm run build`

#### Manual Verification:

- `/` shows MeridianMind hero + 3 wedge cards; no "10x Astro Starter" text remains on the page or tab title.
- Logged-out CTAs read Sign up / Sign in; logged-in CTAs read "Go to my sets".

**Implementation Note**: After automated verification passes, pause for human manual confirmation before Phase 2.

---

## Phase 2: Stateless teaser quiz island

### Overview

Build the persistence-free quiz component reproducing the real study loop, ending in a score screen with sign-up + replay.

### Changes Required:

#### 1. Teaser quiz component

**File**: `src/components/landing/TeaserQuiz.tsx` (new)

**Intent**: Render a logged-out quiz over 10 random capitals: show one capital name, hide the target, accept a map click, reveal target + guess + km + correct/incorrect, advance on acknowledge, and show a score screen at the end. All state in-memory; no fetch, no sessionId.

**Contract**: Default-export React component taking a single `primaryCta: { label: string; href: string }` prop (so the end-screen CTA adapts to auth state — see below); calls `pickTen()` internally on mount and on replay. Internal state mirrors `StudySession`: `phase: "awaiting-click" | "revealed"`, `currentIndex`, in-memory `results: { name; distanceKm; correct }[]`, and the 10-capital queue held in state (so "Try again" reshuffles). Reuse `InteractiveMap` with `bbox = EUROPE_BBOX`, `haversine`, and `isCorrect(distanceKm, DEFAULT_CORRECT_THRESHOLD_KM)`. Markers are phase-derived (empty during `awaiting-click`; guess+target with `connector` after click), copying `StudySession.tsx:132-138`. Final screen (when `currentIndex >= 10`): score (`N / 10` + accuracy %), the `primaryCta` rendered as a primary link, and a "Try again" button that reshuffles and resets to index 0. Use the existing glass/`backdrop-blur` Tailwind styling and the `Button` UI component for consistency with `StudySession`.

**Contract note (auth-adaptive CTA)**: The end-screen CTA must adapt the same way the hero does — `primaryCta` is computed by the Astro page from `Astro.locals.user`: logged-out → `{ label: "Sign up", href: "/auth/signup" }`; logged-in → `{ label: "Go to my sets", href: "/sets" }`. This keeps the teaser island auth-agnostic (it takes no Supabase dependency) while avoiding a "Sign up" CTA shown to an already-authenticated visitor.

**Contract note (EUROPE_BBOX)**: Either import `EUROPE_BBOX` from a shared location or re-declare the same `[[-11,34],[40,71]]` constant. Prefer extracting it to `src/lib/teaserCapitals.ts` (or a small shared map-constants module) and updating `MapDemo.tsx` to import it, to avoid two divergent copies.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes on touched files: `npx eslint src/components/landing/TeaserQuiz.tsx`
- Build succeeds: `npm run build`

#### Manual Verification:

- (Verified once mounted in Phase 3.) Component compiles and is importable.

**Implementation Note**: After automated verification passes, pause for human manual confirmation before Phase 3.

---

## Phase 3: Wire-up + cross-state verification

### Overview

Mount the quiz as a section on `/` and verify the full logged-out and logged-in experiences.

### Changes Required:

#### 1. Embed the quiz section

**File**: `src/components/Welcome.astro` (or `index.astro`, per Phase 1 outcome)

**Intent**: Place `TeaserQuiz` in the `id="try"` section reserved in Phase 1, with a short "Try it now" heading/intro, mounted so the island loads only when scrolled into view. The hero "Try the demo" CTA (defined in Phase 1) scrolls here.

**Contract**: Compute `primaryCta` from `Astro.locals.user` (logged-out → Sign up / `/auth/signup`; logged-in → Go to my sets / `/sets`), then import `TeaserQuiz` and render `<TeaserQuiz client:visible primaryCta={primaryCta} />` inside the `id="try"` section. Add a one-line section header consistent with the page's existing typography. Confirm a logged-out hero CTA (e.g. "Try the demo") scrolls to `#try`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes on touched files: `npx eslint <touched files>`
- Build succeeds: `npm run build`

#### Manual Verification:

- Logged out: `/` renders the quiz section; playing through 10 capitals shows hidden target during recall, then target + km + verdict on click; "Next"/"Finish" advances; score screen appears after #10.
- "Try again" restarts with a fresh random 10; "Sign up" routes to `/auth/signup`.
- Quiz makes no network requests (verify in DevTools Network tab).
- Logged in: same page renders; hero CTAs read "Go to my sets"; quiz still playable.
- Logged in: the teaser **end screen** CTA also reads "Go to my sets" (→ `/sets`), not "Sign up".
- No console errors; map basemap renders framed to Europe.

**Implementation Note**: Final phase — confirm all manual checks before closing the change.

---

## Testing Strategy

### Manual Testing Steps:

1. Logged out, load `/` — confirm MeridianMind branding, 3 wedge cards, quiz section.
2. Play the quiz: verify target is hidden until click, distance/verdict match expectations for a known-distance click, advance through all 10.
3. Reach score screen — verify score math, "Sign up" → `/auth/signup`, "Try again" reshuffles.
4. Open DevTools Network — confirm zero requests during the quiz.
5. Sign in, reload `/` — confirm CTAs switch to "Go to my sets" and quiz still works.

## Performance Considerations

`TeaserQuiz` mounts via `client:visible` so the island's **hydration** is deferred until the quiz section scrolls into view — the hero and feature cards stay interactive-free static HTML and paint immediately. Note this defers hydration, not download: the island's JS (including the bundled topojson basemap) is fetched per Astro's normal bundling regardless of directive. `client:load` (used by `study/[setId]`) confirms `InteractiveMap` SSRs cleanly, so `client:visible` builds without an SSR issue. Distance feedback is local math (no round-trip), trivially within the latency NFR.

## References

- Quiz loop template: `src/components/study/StudySession.tsx`
- Map showcase pattern + `EUROPE_BBOX`: `src/components/map/MapDemo.tsx`
- Reused libs: `src/lib/geo.ts` (`haversine`), `src/lib/study.ts` (`isCorrect`, `DEFAULT_CORRECT_THRESHOLD_KM`)
- Public auth-free page precedent: `src/pages/map-demo.astro`
- Lessons: `context/foundation/lessons.md` (scoped lint on Windows/CRLF)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Capital data + landing page rewrite

#### Automated

- [x] 1.1 Type checking passes: `npx astro check`
- [x] 1.2 Linting passes on touched files
- [x] 1.3 Build succeeds: `npm run build`

#### Manual

- [x] 1.4 `/` shows MeridianMind hero + 3 wedge cards; no "10x Astro Starter" remains
- [x] 1.5 CTAs are auth-adaptive (Sign up/in vs. Go to my sets)

### Phase 2: Stateless teaser quiz island

#### Automated

- [ ] 2.1 Type checking passes: `npx astro check`
- [ ] 2.2 Linting passes on touched files
- [ ] 2.3 Build succeeds: `npm run build`

#### Manual

- [ ] 2.4 Component compiles and is importable

### Phase 3: Wire-up + cross-state verification

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes on touched files
- [ ] 3.3 Build succeeds: `npm run build`

#### Manual

- [ ] 3.4 Logged-out: full 10-capital loop works (hidden target → reveal → advance → score)
- [ ] 3.5 "Try again" reshuffles; "Sign up" → `/auth/signup`
- [ ] 3.6 Quiz makes zero network requests (DevTools)
- [ ] 3.7 Logged-in: hero CTAs read "Go to my sets"; quiz still playable; no console errors
- [ ] 3.8 Logged-in: teaser end-screen CTA reads "Go to my sets" (→ `/sets`), not "Sign up"
