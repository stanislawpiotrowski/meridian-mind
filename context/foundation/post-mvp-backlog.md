---
project: "MeridianMind"
status: backlog
created: 2026-06-08
note: >
  Raw idea capture for after-MVP work. NOT planned, NOT sequenced for
  execution yet. MVP scope (FR-001…FR-016) + post-MVP UX layer (S-06…S-09)
  are all shipped and archived. Revisit this file when picking the next
  batch of work. See roadmap.md §Parked and prd.md §Non-Goals for the
  earlier deferral rationale.
---

# Post-MVP Backlog — idea dump

Captured across review-and-brainstorm sessions on 2026-06-08 and 2026-06-10
(the latter folding in real tester feedback). Items are grouped into candidate
slices; grouping and ordering are provisional, not committed.

## A. Learning algorithm (core — needs research first)

The deepest open questions; all touch the same modules (`src/lib/prioritize.ts`,
`src/lib/dashboard.ts`, `src/lib/study.ts`). Analyze current behavior via
`/10x-research` before changing anything. Test-plan §3 Phase 2 (SRS + CSV
oracle) is unfinished and gates safe changes here.

- **Scale-adaptive correct/incorrect verdict** — the correct/incorrect
  threshold must adapt to the set's spatial scale (continent set vs city set).
  Ties into PRD Open Question #1 (km vs m units). **Shared root with F
  (Sprawa 1 / mobile):** the map always renders at world scale regardless of
  the set, which produces three symptoms from one cause — (1) verdict
  threshold, (2) km/m unit, (3) small objects are physically un-clickable. A
  per-set `bbox` auto-frame fixes all three at once (`InteractiveMap` already
  accepts a `bbox` prop). Plan A's scale-adaptive work together with F's
  small-country fix — do not plan them separately.
  - **The 300 km constant is hardcoded in TWO places, not one** — both
    `DEFAULT_CORRECT_THRESHOLD_KM` (the verdict, `study.ts:19`) and `errorRefKm`
    (the priority error-term normalization, `prioritize.ts:38`, which is anchored
    to that same 300). For a whole-world set, 300 km demands sniper accuracy; for
    a city set, 300 km marks _everything_ correct. Both must become scale-aware
    together or the verdict and the priority score will disagree.
  - **Auto-derive, don't ask the user** — two seams already exist to do this
    without a config UI: the documented per-set `correct_threshold_km` column
    seam (`study.ts` comment), and `boundingBox()` (`study.ts:35`) which computes
    a set's span from its coordinates. Cleanest approach: derive the threshold
    from the set's bbox extent (e.g. a fraction of the bbox diagonal) at import
    or load time, feeding both the verdict and the priority error term.
- **Graded result instead of binary** — Excellent / Good / Medium / … rather
  than just correct/incorrect.
- **Graded result feeds the SRS schedule** — a better/worse hit should
  influence when the card is shown again.
- **History window question** — should prioritization consider only the last
  session, the last few sessions, or the full study history?
- **Implement an SRS algorithm (post-MVP)** — a real spaced-repetition
  algorithm is to be implemented post-MVP (advanced SRS is a current PRD
  Non-Goal; this is a deliberate revisit). Algorithm choice is intentionally
  left open here — to be worked out in a future dedicated `/10x-research`
  session before any design decisions are recorded.
- **Dashboard "cards to review" algorithm** — analyze how the current
  "N to review" count is derived; decide whether it needs improvement.

## B. Session modes (dashboard)

Depends on A (definition of "to review").

- **"Clear the board" mode** — when the dashboard shows "N to review", offer a
  mode that runs only those N cards, giving a satisfying clean-slate effect.
- **Configurable session length** — Whole set / 10 cards / 50 cards picker at
  session start (truncate the priority-ordered queue at N). Matches PRD
  Non-Goal "Configurable session length".
- **Per-set mastery progress bar (dashboard)** — under each set in the dashboard
  list, show a progress bar with a % indicating how well the material is
  mastered. Cheap to render: the data is already loaded by `getDashboardData`
  (`cardCount`, `dueCount`, the `lastAttempts` map) — no new query.
  - **Sequencing: do this AFTER the SRS rework (A).** "Mastered" must be defined
    by the reworked algorithm, and the % inherits the scale-adaptive threshold
    fix (otherwise a world-scale set shows low mastery for everyone).
  - **Denominator = the whole set** (seen + unseen cards). Unseen cards count as
    not-yet-mastered, so a set with cards you haven't studied can never show
    100%. The bar = (mastered cards) / (all cards in the set).
  - **Numerator ("mastered") is intentionally left undefined for now** — to be
    settled together with the SRS work in A.
  - **Do NOT use "% not-due"** as the definition: `isDue` includes the staleness
    term, so a fully-known card becomes due after a few days and the bar would
    decay with time even without forgetting — misleading as a "mastery" signal.

## C. Import UX (small, standalone)

- **Inline import instructions** — short hint on the import screen: "pick a CSV
  with columns name, latitude, longitude; other columns are ignored".
- **.txt import** — check whether a CSV-structured file saved as plain .txt
  imports cleanly.

## D. User settings

- **Settings section** — per-user preferences.
- Map color scheme light/dark.
- Map projection choice.
- Language PL/ENG (see E).
- **Password reset** (currently a PRD Non-Goal; separate, larger flow — email).

## E. Polish localization

- Full PL version of the app with an i18n layer.
- Language toggle (flag) in the top bar. May live in settings (D).
- PRD Non-Goal; estimated ~2–3 days of scaffolding.

**Current state (verified 2026-06-10):** no i18n layer at all — every string is
hardcoded inline in `.astro` pages and `.tsx` islands; no i18n routing in
`astro.config.mjs`. Surface is small (8 pages + a handful of components), so the
_translation content itself_ is roughly an afternoon.

**The real difficulty is the dual runtime, not the text volume.** The app mixes
Astro server-rendered pages with React islands (`StudySession`, `ImportSetForm`,
`TeaserQuiz`, …). Localization must work in both, so a single React-only library
(`react-i18next`) isn't enough — you need a **shared message source** consumed by
both Astro frontmatter and the islands (via props/context). That wiring is the
work, not the translating.

**The fork that decides 1 day vs ~3 days — a product decision:**

- **PL replaces EN (no toggle)** — swap the inline strings. ~0.5–1 day, zero
  infra, loses English. Simplest if the goal is just "a Polish app" (e.g. for
  Polish tester friends).
- **PL/EN toggle** — needs a message catalog (`src/i18n/`), a locale source, and
  passing locale into the React islands. The ~2–3 day estimate. Lighter path
  here: **cookie + a simple `t(key)` dictionary** imported on both sides (no
  route restructure), rather than Astro's native `/pl/.../en/...` routing
  (cleaner URLs but restructures routes, and islands still need the locale
  passed in). Toggle ties to D (settings → language).

**Three easy-to-miss traps:**

1. **Supabase error messages** — auth errors flow through in English
   (`signup.ts` passes `error.message`); localizing them means mapping error
   codes → PL strings. Separate, tedious chunk.
2. **Confirmation email** (see I) — a separate template; the app's i18n layer
   won't cover it.
3. **Dates** — `toLocaleDateString()` with no locale (`sets/index.astro:88`)
   uses the runtime locale (likely en-US on Cloudflare Workers); needs explicit
   `pl-PL`.

## F. Mobile / responsive

Triggered by real tester feedback (2026-06-10): testers **default to opening the
app on their phones** via the browser — contradicting the PRD's desktop-first
assumption. Product decision to settle first: **does mobile get promoted from
PRD Non-Goal to a supported scenario?** If users default to phones, this may
warrant revising "desktop-first" in the PRD, not just bolting on responsiveness.

The map is NOT a tile/slippy map — it's a static **d3-geo SVG** (Winkel Tripel
projection, `world-50m.json`), `src/components/map/InteractiveMap.tsx`, with no
built-in zoom/pan. That fact splits this into two independent tracks.

### Sprawa 1 — map zoom / precision on touch (the "small countries" bug)

What testers call "pinch zoom" is **browser** zoom (visual viewport), not map
zoom — works because `Layout.astro` has `viewport content="width=device-width"`
with no `user-scalable=no`. Hard limits:

- **Small countries can't be zoomed in** — the projection is drawn at world
  scale; browser zoom only magnifies the same rendering, so the projection scale
  never changes and you still aim at a 3-pixel target (plus browsers cap
  max-scale).
- **Click precision degrades when zoomed** — clicks are inverted via
  `getScreenCTM().inverse()` (`InteractiveMap.tsx:74`); under browser zoom the
  click coords can drift from the projection, so answers get _less_ accurate.
  Real bug, not just inconvenience.

Directions (not committed):

1. **Real map zoom/pan** — `d3-zoom` or a transform on the `<g>`, with clicks
   inverted through the current matrix. Proper fix for small countries; helps
   desktop too. Most work; touches click logic + `mapProjection.test.ts`.
2. **Per-set `bbox` auto-frame** — `InteractiveMap` **already accepts a `bbox`
   prop** (`InteractiveMap.tsx:30-31`); a city/small-country set frames to its
   own bounds so the projection renders at region scale. Cheaper, reuses
   existing code. **This is the shared point with group A** — same `bbox`
   mechanism also gives A its scale-adaptive verdict threshold and km/m unit.
   See A, "Scale-adaptive correct/incorrect verdict". Plan together.
3. **Hybrid** — `bbox` for a sensible per-set start scale, `d3-zoom` for
   finger-level fine-tuning on top.

Recommendation: **#2 first** (cheap, reuses `bbox`, cures the common pain),
escalate to `d3-zoom` only if that's not enough.

### Sprawa 2 — general mobile UI comfort (pure presentation layer)

Tailwind responsive + layout only; does not touch data model or logic.

- **Viewport meta** — `width=device-width` with no `initial-scale=1` can render
  oddly on mobile; cheapest single fix (`Layout.astro:17`).
- **Map height** — SVG scales to its container; give it a sensible portrait
  height so it isn't a thin strip.
- **Feedback / reveal panel** — beside the map on desktop, stacked below on
  phone (`sm:`/`md:` breakpoints).
- **Touch targets** — acknowledge/next buttons, Topbar nav ≥44px.
- **Dashboard / import** — column layouts collapse to a stack on narrow screens.

## G. Set sharing (lecturer/student → others link), copy-on-import

A student or lecturer prepares a set and wants to send it to friends. A
"Share / generate link" button produces a link; whoever opens it gets the set.

**Chosen model: copy-on-import** (discussed 2026-06-10). The link does NOT
expose a live shared set — opening it creates the recipient's own independent
copy via the existing import path (the same mechanic S-09 starter-sets already
uses: "add" = own copy). This keeps the flat per-user isolation model intact:
the recipient never reads another user's row, they get a fresh copy that is
then entirely theirs (own study history, own per-item progress).

- **Why this over a live shared set:** a "shared reference" model would break
  NFR Data-isolation — it needs RLS rework, splitting set-ownership from study
  history, and handling author edits/deletes propagating to followers. Bigger
  project. The "public preview without account" model is also out (PRD excludes
  logged-out browsing). Copy-on-import is the cheapest model that matches the
  actual scenario ("they should _have_ the set, not _watch_ it").
- **Mechanics (sketch, not a plan):** generate an unguessable token on the set
  (`share_id`) + a "shareable" flag; a read-only `/shared/<token>` route that
  exposes only the set _definition_ (names + coordinates), never the author's
  study history; a "Add to my sets" button that copies via the existing import
  path.
- **Hard boundary:** only the set definition travels; the author's study
  history never does.
- **Open questions to settle before planning:**
  1. Token revocable / expiring, or permanent? Can the author disable the link?
  2. Login required to receive? (Per PRD, likely yes — recipient needs an
     account to study anyway.)
  3. Double-add behavior (same user opens the link twice) — same decision as
     the S-09 double-click open question (allow duplicate vs block).
- PRD Non-Goal / Access Control deferral; potential growth lever beyond the
  cram-student persona.

## H. Demo-quiz conversion CTA

- After the logged-out demo quiz, show a clean "benefits of creating an
  account" message: more ready-made sets, suggested cards to study + progress
  tracking, ability to import your own sets.

## I. Account confirmation email quality

Tester feedback (2026-06-10): the signup confirmation email is generic and
mentions "Supabase" — meaningless to the user. Notes only, no decisions taken.

- **Where it lives:** no template in repo — `supabase/templates/` doesn't exist
  and all `[auth.email.template.*]` blocks in `config.toml` are commented out.
  The current email is the **hosted Supabase project's default "Confirm your
  signup" template**, edited in the dashboard, not in code.
- **Confirmation is ON in prod** even though local `config.toml:209` has
  `enable_confirmations = false` — signup redirects to `/auth/confirm-email`
  (`signup.ts:19`). Local config doesn't drive the hosted project until pushed.
- **Not in PRD/roadmap** — email confirmation arrived as a Supabase default, not
  a deliberate product decision.
- **Two fix paths:** (A) edit in the Supabase dashboard — fast, but not
  versioned (drifts from repo, against the repo-docs-in-English/reproducibility
  preference); (B) config-as-code — add `[auth.email.template.confirmation]` to
  `config.toml` + a `supabase/templates/confirmation.html` (template vars
  `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}`). Versioned,
  reproducible.
- **Production caveat:** Supabase's default email sender is heavily
  rate-limited (`config.toml:182`, `email_sent = 2`/hour, test-only). Reliable
  branded sending needs custom SMTP (`[auth.email.smtp]`, currently commented,
  lines 220-227 — e.g. Resend/SendGrid). Changing the copy alone doesn't lift
  the send limit.
- **Open product question (undecided):** should email confirmation even stay?
  For the 1–2-week cram persona it's friction; keeping it is a security call.
  Relates to D (password reset is also an email-flow Non-Goal).

## J. Navigation / onboarding UX polish (small, pure presentation)

No data/logic; Tailwind + anchors + link targets only.

- **Dashboard empty-state deep-links** — the new-user empty state offers "Add a
  ready-made set" and "Import your own CSV", but both link to bare `/sets`
  (`dashboard.astro:39,44`), landing at the top rather than the relevant
  section. Fix: give the two `/sets` sections `id`s (`#ready-made`, `#import`)
  and point each button at its anchor. Add `scroll-mt-*` on the targets so a
  (sticky) Topbar doesn't cover the section heading after the jump.
- **Swap section order in `/sets`** — today: Import CSV (top), then ready-made,
  then the user's sets (`sets/index.astro:44/48/73`). Proposal: ready-made on
  top, Import CSV below. Rationale: for a new user (the empty-state audience)
  one-click ready-made is a lower barrier than preparing+uploading a CSV;
  putting the easier path first matches onboarding intent (S-09 strengthened the
  empty state). Anchors from the deep-link item work regardless of order.
- **Topbar order + "home" consistency** — today the order is My sets →
  Dashboard → Sign out, and the logo links to `/sets` (`Topbar.astro:17,23-32`),
  but login lands on `/dashboard` (S-07 made it the home). Inconsistency: the
  app's start screen is `/dashboard` while the logo + first nav item point at
  `/sets` — a leftover from S-06 (which surfaced "My sets" before S-07 existed).
  Fix: make the home the consistent zero point — order **Dashboard → My sets →
  Sign out**, and link the logo to `/dashboard`. Convention: the home screen
  sits leftmost/first and the logo returns to it.
- **Optional: rename "Dashboard" → "Home"** — "Dashboard" is a perfectly valid,
  conventional name; only nuance is it slightly connotes metrics/analytics,
  while this screen is action-oriented (Start studying / Resume / N to review /
  streak). "Home" is the one cleaner alternative. Cosmetic — do only if desired;
  consistency (home = logo = first nav item) matters more than the label.

---

## Quality / risk note (not a feature, but flagged)

Test rollout (test-plan.md §3) is only at Phase 1. Before reworking the SRS
core (group A), Phase 2 (SRS + CSV oracle) and Phase 3 (cross-user
authorization leak, R4) are the safety net. Consider finishing those first.
