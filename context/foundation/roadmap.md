---
project: "MeridianMind"
version: 1
status: draft
created: 2026-05-26
updated: 2026-06-05
prd_version: 1
main_goal: speed
top_blocker: skills
---

# Roadmap: MeridianMind

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

MeridianMind helps a university student cramming for a fixed-syllabus geography exam learn where 50–300 named objects (countries, capitals, ranges, rivers, climate zones) actually are — by drilling them with spaced repetition and forcing active recall: point to it on a blank map, don't just recognize a label. The product wedge — the one trait that, if removed, makes it indistinguishable from existing geo-quiz sites — is the bundle no incumbent ships: spaced-repetition prioritization **+** spatial-click verification **+** bring-your-own-syllabus CSV import, all in one tool.

## North star

**S-02: First full study session** — import a set, run the spatial-click quiz loop with distance feedback and a revealed correct location, and reach a session summary. This is the validation milestone: it exercises the novel mechanic end-to-end, and under the `speed` goal it ships as early as its Prerequisites allow.

> North star here means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as Prerequisites allow because everything else (set management, prioritization, import polish) only matters if this loop works.

## At a glance

| ID   | Change ID                  | Outcome (user can …)                                                | Prerequisites    | PRD refs                          | Status   |
| ---- | -------------------------- | ------------------------------------------------------------------- | ---------------- | --------------------------------- | -------- |
| F-01 | domain-data-schema         | (foundation) sets / flashcards / study-history tables + RLS         | —                | FR-004, FR-015, NFR-DataIsolation | done     |
| F-02 | interactive-map-foundation | (foundation) clickable map + lat/lon projection + haversine util    | —                | FR-010, FR-011, NFR-Latency       | ready    |
| S-01 | csv-set-import-and-list    | import a CSV set and see it listed to pick                          | F-01             | FR-004, FR-005                    | proposed |
| S-02 | first-study-session        | run a full quiz session end-to-end and see a summary                | F-01, F-02, S-01 | US-01, FR-008…FR-014, FR-015      | proposed |
| S-03 | prioritized-return-session | return to an auto-prioritized queue of weak / stale items           | S-02, F-01       | US-02, FR-015, FR-016             | proposed |
| S-04 | delete-set                 | delete a set they previously imported                               | F-01, S-01       | FR-006                            | proposed |
| S-05 | csv-malformed-row-handling | see malformed CSV rows reported and choose import-valid or cancel   | S-01             | US-03, FR-007                     | proposed |
| S-06 | navigation-shell           | see a consistent nav bar on every screen, with no dead-ends         | —                | (UX / post-MVP)                   | proposed |
| S-07 | dashboard-home             | land on a "what to do now" home after login (due / streak / resume) | F-01, S-03       | (post-MVP)                        | proposed |
| S-08 | product-landing-and-quiz   | (logged-out) understand the product and try a 10-capital mini-quiz  | F-02             | (post-MVP)                        | proposed |
| S-09 | starter-sets               | add a curated ready-made set in one click                           | S-01             | (post-MVP)                        | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                             | Note                                                                                                               |
| ------ | ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A      | Data & study loop       | `F-01` → `S-01` → `S-02` → `S-03` | Critical path. Contains the north star (`S-02`) and second validation (`S-03`).                                    |
| B      | Interactive map         | `F-02`                            | De-risks the `skills` blocker; runs parallel to A, joins at `S-02`.                                                |
| C      | Set lifecycle & polish  | `S-04` / `S-05`                   | Both branch off `S-01`, parallel with the study loop. `S-05` is nice-to-have.                                      |
| D      | Navigation & onboarding | `S-06` → `S-07`; `S-08`; `S-09`   | Post-MVP UX layer. `S-06` is cheapest (removes the Dashboard dead-end). `S-09` strengthens the `S-07` empty state. |

## Baseline

What's already in place in the codebase as of 2026-05-26 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React islands, Tailwind, shadcn/ui; auth screens built (`src/pages/auth/*`, `src/components/auth/*`). **Map library absent** (no Leaflet/MapLibre/Mapbox) — added by `F-02`.
- **Backend / API:** partial — Astro API routes exist for auth only (`src/pages/api/auth/{signin,signout,signup}.ts`); domain endpoints (sets, quiz, sessions) absent — added across `S-01`…`S-04`.
- **Data:** partial — Supabase client wired (`src/lib/supabase.ts`), `supabase/config.toml` present; **no migrations or schema** for domain entities — added by `F-01`.
- **Auth:** present — email+password signup/signin/signout + route-gating middleware (`src/middleware.ts`) + Supabase wiring live. Satisfies **FR-001, FR-002** (must-have) and **FR-003** (nice-to-have sign-out endpoint exists). No auth slice needed.
- **Deploy / infra:** present (live) — Cloudflare Workers, Workers Builds auto-deploy on push to `master`; live at `meridian-mind.stanislaw-piotrowski.workers.dev`.
- **Observability:** absent — no Sentry/OTel; `wrangler tail` only. Not promoted to a foundation: the latency NFR is met client-side and the `speed` goal avoids over-building.

## Foundations

### F-01: Domain data schema

- **Outcome:** (foundation) domain schema landed — tables for sets, flashcards (name + latitude + longitude), and per-item study history, with row-level security enforcing per-user isolation.
- **Change ID:** domain-data-schema
- **PRD refs:** FR-004, FR-005, FR-015, NFR Data-isolation, NFR Persistence-reliability, Access Control
- **Unlocks:** S-01, S-02, S-03, S-04
- **Prerequisites:** — (Supabase client already present per Baseline)
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The study-history table shape constrains the prioritization query in S-03; it must record per-attempt distance error, attempt count, and last-seen timestamp so FR-016 has its inputs. Sequenced first because every slice reads or writes it.
- **Status:** ready

### F-02: Interactive map foundation

- **Outcome:** (foundation) an interactive map renders, captures click coordinates, projects lat/lon ↔ screen position, and computes click→target distance (haversine) — the reusable mechanic the quiz loop sits on. No user-facing study flow yet.
- **Change ID:** interactive-map-foundation
- **PRD refs:** FR-010, FR-011, NFR Latency
- **Unlocks:** S-02 (north star)
- **Prerequisites:** — (frontend present; map library absent per Baseline)
- **Parallel with:** F-01, S-01
- **Blockers:** —
- **Unknowns:** — (which map library is a `/10x-plan` decision, not a roadmap blocker)
- **Risk:** This is where the #1 blocker (`skills`) concentrates — unfamiliar map library + lat/lon projection + haversine, plus the Cloudflare Workers runtime gotchas catalogued in `infrastructure.md`. Broken out as a focused de-risking foundation so the hard mechanic is proven in isolation before S-02 wires it into the full session. Kept deliberately lean to respect the `speed` goal — it is the must-have map plumbing S-02 needs anyway, just front-loaded.
- **Status:** ready

## Slices

### S-01: Import a CSV set and see it listed

- **Outcome:** user can upload a CSV (columns `name`, `latitude`, `longitude`) to create a set, and see all their imported sets in a list to pick one to study.
- **Change ID:** csv-set-import-and-list
- **PRD refs:** FR-004, FR-005, US-01 (prerequisite)
- **Prerequisites:** F-01
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** — (happy-path import only; malformed-row UX is S-05)
- **Risk:** Happy-path CSV parse only — non-UTF-8 encodings and malformed rows are explicitly out of this slice (S-05 / Open Question). First user-facing slice; gates the north star, so keep it thin.
- **Status:** proposed

### S-02: First full study session

- **Outcome:** user can start a quiz against a chosen set, see one object name at a time, click the map to answer, get distance + correct/incorrect feedback with the correct location revealed, advance through the full queue on acknowledge, and reach a session summary — with mid-session progress preserved across a tab close.
- **Change ID:** first-study-session
- **PRD refs:** US-01, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, NFR Latency, NFR Persistence-reliability
- **Prerequisites:** F-01, F-02, S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Scale-adaptive distance units for sub-country sets (FR-011) — Owner: user. Block: no (MVP target sets are continent-scale; km is the right granularity — see Open Roadmap Questions #1).
- **Risk:** The validation milestone — bundles the novel spatial-click mechanic with per-item attempt recording (FR-015) and mid-session persistence. The p95 < 500 ms feedback NFR is met client-side: the correct location ships with the flashcard, so distance is local math with no server round-trip. Largest slice; keep the queue logic trivial (full set, each item exactly once) — ordering comes later in S-03.
- **Status:** proposed

### S-03: Prioritized return session

- **Outcome:** user starting a new session against a previously-studied set gets an auto-prioritized queue — items they got wrong or haven't seen recently appear earlier and more often, while well-known items still recur occasionally — with no configuration required.
- **Change ID:** prioritized-return-session
- **PRD refs:** US-02, FR-015, FR-016, Business Logic
- **Prerequisites:** S-02, F-01
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Prioritization formula granularity — Leitner-box vs the degenerate "missed-items-first" form. Owner: user/team. Block: no (PRD states the simplest ordering that satisfies FR-016 is acceptable).
- **Risk:** Second validation milestone (US-02). Depends on S-02 having produced per-item history. Keep the rule the simplest form that satisfies FR-016 — advanced SRS scoring is an explicit Non-Goal.
- **Status:** proposed

### S-04: Delete a set

- **Outcome:** user can delete a set they previously imported.
- **Change ID:** delete-set
- **PRD refs:** FR-006
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small. Hard delete with an implied confirmation dialog (soft-delete with undo is an explicit Non-Goal). Off the north-star path and fully parallelizable.
- **Status:** proposed

### S-05: CSV import with malformed-row handling

- **Outcome:** user importing a CSV with malformed rows sees each invalid row reported before commit (1-indexed row number, which field failed, one-line reason) and chooses to either import valid rows only or cancel to fix the source file.
- **Change ID:** csv-malformed-row-handling
- **PRD refs:** US-03, FR-007
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Nice-to-have per PRD priority; sequenced last. Under the `speed` goal, ship only if time remains after the must-have path. Header/encoding validation contract is fully specified in US-03 acceptance criteria.
- **Status:** proposed

### S-06: Consistent navigation shell

- **Outcome:** a top nav bar (with a logo linking home) renders on **every** authenticated screen — including the study session — so there are no dead-ends; today `/dashboard` renders no `Topbar` and traps the user. Link order surfaces "My sets" prominently.
- **Change ID:** navigation-shell
- **PRD refs:** — (UX polish; not a PRD FR)
- **Prerequisites:** — (existing `src/components/Topbar.astro`, `src/pages/dashboard.astro`)
- **Parallel with:** S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small, pure-UX. Cheapest item in stream D and removes the current navigation trap. Does **not** delete `/dashboard` — S-07 repurposes it. Sequence first in stream D.
- **Status:** proposed

### S-07: Dashboard as home

- **Outcome:** after login the user lands on a decision screen instead of `/sets` directly: "Due today: N" + "Start session", a study streak, recent sets / "resume", and an empty state that points to add-a-ready-made-set or import-CSV.
- **Change ID:** dashboard-home
- **PRD refs:** — (post-MVP; builds on FR-015/FR-016 data)
- **Prerequisites:** F-01 (data), S-03 (prioritization powers the "due today" count)
- **Parallel with:** S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - "Due today" and streak counters require per-item review dates / session history. If absent, ship a "lite" version (recent sets + resume) first, counters later. Owner: user. Block: no.
- **Risk:** Depends on the data model; consider a lite → full split. This is the screen that fixes the "nothing after login" problem.
- **Status:** proposed

### S-08: Product landing + teaser quiz

- **Outcome:** `/` is rewritten from the generic "10x Astro Starter" template into a MeridianMind landing (spaced repetition / click-to-verify on the map / bring-your-own CSV) plus a mini-quiz: 10 random European capitals, click the map, distance feedback in km, end screen with a sign-up CTA. No account, no persistence (client-side only).
- **Change ID:** product-landing-and-quiz
- **PRD refs:** — (post-MVP; note PRD scopes public browsing out of MVP)
- **Prerequisites:** F-02 (map component; reuse `/map-demo`, `/study/[setId]`)
- **Parallel with:** S-06, S-09
- **Blockers:** —
- **Unknowns:**
  - Quiz as a section on `/` vs a dedicated `/try` route. Owner: user. Block: no.
- **Risk:** Medium — slimming the session component into a logged-out mode. Converts visitors by showing the mechanic rather than describing it.
- **Status:** proposed

### S-09: One-click starter sets

- **Outcome:** curated CSV sets ship inside the app; "add" creates the user's **own copy** via the existing import path (reuse CSV validation / `ImportSetForm`). Entry points: the S-07 empty state and a "Start with a ready-made set" section in `/sets`.
- **Change ID:** starter-sets
- **PRD refs:** — (post-MVP; strengthens onboarding / S-07 empty state)
- **Prerequisites:** S-01
- **Parallel with:** S-06, S-08
- **Blockers:** —
- **Unknowns:**
  - Behavior on double-click (allow duplicate vs block). Per-user copy keeps the data model unchanged. Owner: user. Block: no.
- **Risk:** The real work is data — sourcing and **verifying** coordinates (especially Polish national-park centroids); the logic is trivial (reuse import). Three starter sets (format `name, latitude, longitude`):
  - **A. Crown of the Earth — 9 peaks** (combined Bass+Messner, intentional). `name` carries elevation; continent classification only on the disputed entries: `Mount Everest (8848 m)`, `Aconcagua (6961 m)`, `Denali / McKinley (6190 m)`, `Kilimanjaro (5895 m)`, `Vinson Massif (4892 m)`, `Elbrus (5642 m, Europe per Messner/Bass)`, `Mont Blanc (4810 m, Europe per some geographers)`, `Puncak Jaya (4884 m, Oceania per Messner)`, `Mount Kosciuszko (2230 m, Australia per Bass)`.
  - **B. European capitals — all 48.** `name` = bare name; point = city center.
  - **C. National Parks of Poland — all 23.** `name` = bare name; point = park **centroid** (not the HQ).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                  | GitHub issue                                                        | Suggested issue title                       | Ready for `/10x-plan` | Notes                                             |
| ---------- | -------------------------- | ------------------------------------------------------------------- | ------------------------------------------- | --------------------- | ------------------------------------------------- |
| F-01       | domain-data-schema         | [#1](https://github.com/stanislawpiotrowski/meridian-mind/issues/1) | Foundation: domain data schema + RLS        | yes                   | No prerequisites; unblocks the whole graph        |
| F-02       | interactive-map-foundation | [#2](https://github.com/stanislawpiotrowski/meridian-mind/issues/2) | Foundation: interactive map + distance util | yes                   | No prerequisites; de-risks the `skills` blocker   |
| S-01       | csv-set-import-and-list    | [#3](https://github.com/stanislawpiotrowski/meridian-mind/issues/3) | Import a CSV set and list sets              | no                    | Needs F-01 done first                             |
| S-02       | first-study-session        | [#4](https://github.com/stanislawpiotrowski/meridian-mind/issues/4) | First full study session (north star)       | no                    | Needs F-01, F-02, S-01 — the validation milestone |
| S-03       | prioritized-return-session | [#5](https://github.com/stanislawpiotrowski/meridian-mind/issues/5) | Prioritized return session (SRS queue)      | no                    | Needs S-02 to have produced per-item history      |
| S-04       | delete-set                 | [#6](https://github.com/stanislawpiotrowski/meridian-mind/issues/6) | Delete an imported set                      | no                    | Needs F-01, S-01; parallel with the study loop    |
| S-05       | csv-malformed-row-handling | [#7](https://github.com/stanislawpiotrowski/meridian-mind/issues/7) | CSV import: report malformed rows           | no                    | Nice-to-have; needs S-01                          |
| S-06       | navigation-shell           | — (post-MVP)                                                        | Consistent navigation shell (no dead-ends)  | yes                   | No prerequisites; removes the Dashboard dead-end  |
| S-07       | dashboard-home             | — (post-MVP)                                                        | Dashboard as "what to do now" home          | no                    | Needs F-01, S-03; lite-vs-full per data model     |
| S-08       | product-landing-and-quiz   | — (post-MVP)                                                        | Product landing + 10-capital teaser quiz    | no                    | Needs F-02; logged-out, client-side only          |
| S-09       | starter-sets               | — (post-MVP)                                                        | One-click curated starter sets              | no                    | Needs S-01; main work is verifying coordinates    |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. One row per `F-NN` / `S-NN`.

**Migrated to GitHub Issues on 2026-05-26.** Epic [#8 · Roadmap: MeridianMind MVP](https://github.com/stanislawpiotrowski/meridian-mind/issues/8) tracks all 7 as a stream-grouped checklist. Taxonomy: labels `roadmap:foundation|slice`, `status:ready|proposed`, `priority:must-have|nice-to-have`, `north-star`; milestone `MVP v1`.

## Open Roadmap Questions

1. **Scale-adaptive distance feedback for sub-country sets (FR-011)** — km feedback is too coarse for city/district/building-scale sets. Candidate resolutions: (a) auto-detect set spatial bounds at import and pick a unit (km/m); (b) per-set configurable unit at import; (c) leave km-only for MVP and record the limitation. Owner: user. Block: gates nothing — S-02 proceeds with km-only since MVP target sets are continent-scale. (Lifted verbatim from PRD `## Open Questions` #1.)

## Parked

- **Password reset flow** — Why parked: PRD §Non-Goals; 1–2 week cram window makes forgotten-password risk low; lost-access users re-register.
- **Edit a flashcard's name or coordinates after import** — Why parked: PRD §Non-Goals; workflow is import → study → re-import.
- **Cross-session progress history beyond the per-session summary** — Why parked: PRD §Non-Goals; per-item history is used internally (FR-015) but no long-term analytics view.
- **Explicit pause / resume mid-session affordance** — Why parked: PRD §Non-Goals; lossless persistence covers tab-close, but no explicit pause surface.
- **In-app lecturer publishing of sets to a class** — Why parked: PRD §Non-Goals / §Access Control; lecturers share CSVs out-of-band.
- **Polish (or any non-English) UI localization** — Why parked: PRD §Non-Goals; English-only MVP despite Polish persona; i18n costs ~2–3 days against the timeline (reinforced by `speed` goal).
- **Basic accessibility (keyboard nav, screen reader, WCAG)** — Why parked: PRD §Non-Goals; excluded from MVP NFRs.
- **Mobile / responsive UI** — Why parked: PRD §Non-Goals; desktop-first; multi-device guardrail satisfied by data sync, not UI adaptation.
- **Configurable session length (pick N questions)** — Why parked: PRD §Non-Goals; MVP queue is always the full ordered set ("All").
- **AI-generated flashcard sets** — Why parked: PRD §Non-Goals; blurs the bring-your-own-syllabus wedge.
- **AI-generated tutor feedback per click** — Why parked: PRD §Non-Goals; per-click LLM dependency is heavy for MVP; factual distance feedback only.
- **Custom / advanced spaced-repetition scoring (SuperMemo, SM-2)** — Why parked: PRD §Non-Goals; the bundle is the differentiator, not algorithm sophistication.
- **Social features and gamification** — Why parked: PRD §Non-Goals; leaderboards/streaks/badges/shared sets don't match the cram-student persona.

## Done

- **F-01: (foundation) domain schema landed — tables for sets, flashcards (name + latitude + longitude), and per-item study history, with row-level security enforcing per-user isolation.** — Archived 2026-06-05 → `context/archive/2026-05-27-domain-data-schema/`. Lesson: —.
