# Consistent Navigation Shell Implementation Plan

## Overview

Make a navigation bar render on **every** authenticated screen — including `/dashboard`, which today renders no `Topbar` and traps the user with only a Sign-out button. Rather than hand-placing `<Topbar />` on each page (the convention that let `/dashboard` slip through), we introduce an `AuthLayout` that bakes the nav shell into the layout itself, and enhance the `Topbar` with a home-linking logo, a reordered link set that surfaces "My sets" prominently, and an active-page indicator.

This is roadmap slice **S-06** — pure UX, no data model, API, or state changes.

## Current State Analysis

- **`src/components/Topbar.astro`** renders a signed-in bar (`user.email` + `Dashboard` / `My sets` / `Sign out`) or a signed-out bar (`Sign in` / `Sign up`). It reads `Astro.locals.user`. It has **no logo** and orders links `Dashboard → My sets`.
- **`Topbar` is rendered in three places** by hand: `src/pages/sets/index.astro:36` and `src/pages/study/[setId].astro:79` (both wrap content in an identical `bg-cosmic relative min-h-screen w-full overflow-hidden` → `relative z-10 p-4 sm:p-8` shell with `<Topbar />` at the top), **and `src/components/Welcome.astro:28`**, which is what the public landing `/` renders (`src/pages/index.astro:7`). The Welcome usage shows the **signed-out** Topbar branch — Phase 1 must leave that branch untouched so `/` does not regress.
- **`src/pages/dashboard.astro` does NOT render `Topbar`.** It is a vertically-centered card (`flex min-h-screen items-center justify-center`) with a welcome message and its own inline `POST /api/auth/signout` button — a navigational dead-end.
- **`src/layouts/Layout.astro`** is the only layout: it injects config `Banner`s and renders a bare `<slot />`. Title defaults to `"10x Astro Starter"`. There is no authenticated-layout abstraction; nav consistency is an unenforced per-page convention.
- Sign-out is a `<form method="POST" action="/api/auth/signout">` — this contract is reused, not changed.

### Key Discoveries:

- The `bg-cosmic` + `relative z-10 p-4 sm:p-8` shell is duplicated verbatim in `sets/index.astro:34-35` and `study/[setId].astro:77-78` — ripe for centralizing into `AuthLayout`.
- `Astro.url.pathname` is available in all `.astro` pages/components for active-link detection.
- The study route (`/study/[setId]`) matches none of the primary nav links — active-state logic must degrade gracefully (no link highlighted is fine).

## Desired End State

Every authenticated screen (`/dashboard`, `/sets`, `/study/[setId]`) renders the same nav shell via `AuthLayout`: a `Topbar` with a home logo linking to `/sets`, links ordered `Logo · My sets · Dashboard · Sign out`, and the link matching the current path visually highlighted. `/dashboard` is no longer a dead-end and adopts the same top-aligned `bg-cosmic` look as the other screens, with its redundant inline Sign-out button removed. Verified by visiting each route signed in and confirming the nav is present, links work, and the active link is highlighted.

## What We're NOT Doing

- **Not deleting or repurposing `/dashboard`** — S-07 owns turning it into a real home; here it just gains the shell and keeps its welcome content.
- **Not re-pointing the logo to `/dashboard`** — that happens in S-07 when `/dashboard` becomes the home. Today the logo goes to `/sets`.
- **Not touching the signed-out Topbar branch or auth pages** (`/auth/*`, `/`, `/map-demo`) — scope is authenticated app screens.
- **Not changing the sign-out contract** (`POST /api/auth/signout`).
- **Not adding mobile/responsive nav behavior** — desktop-first per PRD Non-Goals.

## Implementation Approach

Two phases. First enhance `Topbar` in isolation (logo, link order, active state) so it's correct wherever it renders. Then create `AuthLayout` to own the shell and migrate the three authenticated pages onto it — removing the duplicated `bg-cosmic` wrappers and the dashboard's redundant Sign-out button in the same pass.

## Phase 1: Enhance Topbar

### Overview

Add a home-linking logo, reorder the signed-in links to surface "My sets," and highlight the active link. No layout changes yet — `Topbar` keeps rendering in its current two locations until Phase 2.

### Changes Required:

#### 1. Topbar component

**File**: `src/components/Topbar.astro`

**Intent**: Add a brand logo/wordmark on the left linking to `/sets` (home for now), reorder the signed-in links to `My sets · Dashboard · Sign out`, and apply an active-state style to whichever link matches the current route. Keep the signed-out branch unchanged in content/order.

**Contract**:

- Read `const pathname = Astro.url.pathname;` in the frontmatter.
- Logo is an `<a href="/sets">` containing the MeridianMind wordmark, placed at the start of the bar (the email can move beside it or stay on the right — implementer's call within the existing flex layout). **The logo belongs to the signed-in branch only** — the signed-out branch (rendered on the public `/` via `Welcome.astro`) stays exactly as-is, so signed-out visitors get no `/sets` link that middleware would bounce to sign-in.
- A link is "active" when `pathname === href` (use exact match; `/study/...` matching no primary link is the accepted graceful case). Apply a distinguishing class (e.g. the brighter `text-purple-100` + `underline`, or `aria-current="page"`) to the active link only.
- Signed-in link order in markup: My sets, Dashboard, Sign out (logo precedes all).
- Sign out remains the existing `<form method="POST" action="/api/auth/signout">` button.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- On `/sets`, the logo and links render; "My sets" appears before "Dashboard"; the "My sets" link is highlighted as active.
- Logo click navigates to `/sets`.
- On `/study/[setId]`, no primary link is highlighted and the bar still renders cleanly (no error).
- The public landing `/` (signed-out, via `Welcome.astro`) is visually unchanged — no logo, signed-out links intact.
- Sign out still signs the user out.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: AuthLayout and page migration

### Overview

Create an `AuthLayout` that owns the `bg-cosmic` shell + `Topbar` + content slot, then migrate `dashboard`, `sets`, and `study` onto it. Remove the duplicated per-page wrappers and the dashboard's redundant inline Sign-out button.

### Changes Required:

#### 1. AuthLayout component

**File**: `src/layouts/AuthLayout.astro` (new)

**Intent**: A layout for authenticated screens that wraps the base `Layout`, renders the shared `bg-cosmic` container, places `<Topbar />` at the top, and exposes a `<slot />` for page content. This makes the nav shell structural rather than per-page convention.

**Contract**:

- Props: `title?: string` (forwarded to `Layout`).
- Composition: `<Layout title={title}>` → `<div class="bg-cosmic relative min-h-screen w-full overflow-hidden">` → `<div class="relative z-10 p-4 sm:p-8">` → `<Topbar />` then `<slot />`. (Mirrors the existing wrapper in `sets/index.astro:34-36`.)
- Inner content-width containers (`max-w-2xl`, `max-w-3xl`, etc.) stay in the pages, not the layout.

#### 2. Migrate My Sets page

**File**: `src/pages/sets/index.astro`

**Intent**: Replace the hand-rolled `Layout` + `bg-cosmic` wrapper + `<Topbar />` with `AuthLayout`, keeping the inner `max-w-2xl` content block untouched.

**Contract**: Swap `import Layout` → `import AuthLayout`; drop the `import Topbar` line and the two wrapper `<div>`s and `<Topbar />`; wrap the `max-w-2xl` block directly in `<AuthLayout title="My Sets">`. Server-side data fetching is unchanged.

#### 3. Migrate Study page

**File**: `src/pages/study/[setId].astro`

**Intent**: Same migration as the sets page — use `AuthLayout`, drop the duplicated wrapper and Topbar import, keep the `max-w-3xl` content and all session logic.

**Contract**: Swap `import Layout` → `import AuthLayout`; remove `import Topbar`, the wrapper `<div>`s, and `<Topbar />`; wrap the `max-w-3xl` block in `<AuthLayout title={`Study — ${set.name}`}>`. The redirect/session/queue frontmatter is unchanged.

#### 4. Migrate and restyle Dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Move dashboard onto `AuthLayout` so it gains the nav shell, change its layout from vertically-centered to the same top-aligned `bg-cosmic` content flow as the other screens, and remove its now-redundant inline Sign-out button (Topbar provides the canonical one).

**Contract**: Replace `import Layout` → `import AuthLayout`; remove the `flex min-h-screen items-center justify-center` centering (content sits in a `max-w-*` block inside the layout slot like the other pages); delete the inline `<form action="/api/auth/signout">` button. Keep the welcome heading + `user.email` message.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- All three pages import `AuthLayout` and none still import `Topbar` directly: `grep -l "AuthLayout" src/pages/dashboard.astro src/pages/sets/index.astro "src/pages/study/[setId].astro"` lists all three, and `grep -rn "import Topbar" src/pages` returns nothing (quote the bracketed `[setId]` path so the shell doesn't glob it)

#### Manual Verification:

- `/dashboard` renders the Topbar (no longer a dead-end); "Dashboard" link is highlighted as active; only one Sign-out affordance (in Topbar) exists.
- `/sets` and `/study/[setId]` look unchanged from before aside from the enhanced Topbar (logo, link order, active state).
- All three screens share the same `bg-cosmic` top-aligned shell.
- Navigating logo → /sets, My sets → /sets, Dashboard → /dashboard all work from every screen.
- Sign out works from each screen.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps:

1. Sign in; land on `/sets` — confirm logo + `My sets · Dashboard · Sign out` order, "My sets" highlighted.
2. Click "Dashboard" — confirm Topbar present, "Dashboard" highlighted, welcome message shown, single Sign-out (in Topbar), top-aligned cosmic layout.
3. From `/sets`, open a set to `/study/[setId]` — confirm Topbar renders, no primary link highlighted, study session works.
4. Click the logo from each screen — confirm it returns to `/sets`.
5. Click Sign out from each screen — confirm sign-out works.

(No unit/integration tests — pure presentational Astro components; the project has no component-test harness for `.astro` files.)

## References

- Change identity: `context/changes/navigation-shell/change.md`
- Roadmap slice S-06: `context/foundation/roadmap.md` (lines 159-169)
- Existing shell to centralize: `src/pages/sets/index.astro:34-36`
- Dead-end being fixed: `src/pages/dashboard.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Enhance Topbar

#### Automated

- [x] 1.1 Type checking passes (`npm run typecheck`) — 6a7f29c
- [x] 1.2 Linting passes (`npm run lint`) — 6a7f29c
- [x] 1.3 Production build succeeds (`npm run build`) — 6a7f29c

#### Manual

- [x] 1.4 Logo + reordered links render on /sets; "My sets" highlighted active — 6a7f29c
- [x] 1.5 Logo click navigates to /sets — 6a7f29c
- [x] 1.6 /study renders Topbar cleanly with no primary link highlighted — 6a7f29c
- [x] 1.7 Public landing / (signed-out) is visually unchanged — no logo, signed-out links intact — 6a7f29c
- [x] 1.8 Sign out still works — 6a7f29c

### Phase 2: AuthLayout and page migration

#### Automated

- [x] 2.1 Type checking passes (`npm run typecheck`) — a266019
- [x] 2.2 Linting passes (`npm run lint`) — a266019
- [x] 2.3 Production build succeeds (`npm run build`) — a266019
- [x] 2.4 All three migrated pages use AuthLayout (no stray Topbar imports) — a266019

#### Manual

- [x] 2.5 /dashboard renders Topbar, "Dashboard" active, single Sign-out, cosmic top-aligned layout — a266019
- [x] 2.6 /sets and /study unchanged aside from enhanced Topbar — a266019
- [x] 2.7 All three screens share the same shell — a266019
- [x] 2.8 Logo / My sets / Dashboard navigation works from every screen — a266019
- [x] 2.9 Sign out works from each screen — a266019
