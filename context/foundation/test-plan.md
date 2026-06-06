# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-06 (Phase 1 complete)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the ground
   truth.

Hot-spot scope used for likelihood weighting: `src/lib/`, `src/pages/api/`,
`src/components/{map,sets,study,auth}/`, `src/pages/{sets,study,dashboard.astro}`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Spatial-click verdict or distance is wrong — projection (lat/lon↔screen) or haversine math marks a far-off click "correct" or shows a wrong km, so the student trusts a location they actually missed. | High   | High       | interview Q1; hot-spot dir `src/lib/` (mapProjection + geo churn, ~3 commits/30d each); PRD FR-010, FR-011                                    |
| 2   | Map or Dashboard renders mispositioned / clipped / broken layout despite correct math — the mechanic is unusable even when the numbers are right.                                                      | High   | High       | interview Q2; hot-spot dir `src/components/map/` (7 commits/30d), `src/pages/dashboard.astro` (3 commits/30d)                                 |
| 3   | SRS queue is mis-ordered — weak/stale items don't surface first, or well-known items never recur — silently breaking the core differentiator.                                                          | High   | Medium     | interview Q3 (running on planning default, unexamined); hot-spot dir `src/lib/` (prioritize churn, 3 commits/30d); PRD FR-016, Business Logic |
| 4   | Cross-user data leak — a student reaches another student's sets or study history via an API route that checks "logged in" but not "owns this resource" (IDOR / RLS bypass).                            | High   | Medium     | abuse/security lens; hot-spot dir `src/pages/api/` (9 commits/30d); PRD NFR Data-isolation, Access Control                                    |
| 5   | CSV import silently corrupts a set — boundary coords (lat ±90, lon ±180), non-numeric values, missing headers, or malformed rows mis-validated → student crams a wrong or incomplete set.              | High   | Medium     | hot-spot dir `src/lib/` (csv churn, 3 commits/30d); PRD US-03, FR-007 acceptance criteria                                                     |
| 6   | Study state lost across tab-close or device switch — mid-session progress or per-item history not persisted losslessly (guardrail violation).                                                          | High   | Medium     | hot-spot dir `src/lib/` (study/studySession churn), `src/pages/api/study/` (2 commits/30d); PRD FR-015 + Persistence-reliability guardrail    |

**Impact × Likelihood rubric.** High impact = user loses access, data, or
money / failure is publicly visible. Medium = feature degrades, workaround
exists. High likelihood = area changes weekly or we've been burned here.
Medium = touched occasionally, has been a bug source. High × High (R1, R2)
is protected first.

**Abuse / security lens.** The product has auth, per-user data isolation, and
accepts user input (CSV, map clicks). R4 is the mandatory abuse row:
authorization is distinct from authentication — an endpoint may correctly
confirm _you are logged in_ while failing to confirm _this resource is
yours_. R5 covers untrusted-input parity (server must not trust client CSV).

### Risk Response Guidance

| Risk | What would prove protection                                                                                                     | Must challenge                                                                                                         | Context `/10x-research` must ground                                                                                           | Likely cheapest layer                                                      | Anti-pattern to avoid                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| #1   | Known real-world coordinate pairs yield the correct distance and the correct correct/incorrect verdict at the defined threshold | "the math looks right in the demo" — verify against an **independent** geographic oracle, not values the code produces | Where projection + distance are computed; the correct/incorrect threshold; the source-of-truth correct location per flashcard | unit (pure functions)                                                      | Oracle problem — asserting the haversine/projection output the code already computes |
| #2   | Map container and Dashboard render in the expected position and size; no clipping across the supported desktop viewport         | "correct math implies correct render" — false; layout breaks independently of math                                     | Which 1–3 screens are critical; how the map mounts (React island vs Astro shell); stable render entry points                  | deterministic visual diff + **selective** multimodal review on 1–3 screens | Meaningless full-DOM snapshots that break on every styling tweak                     |
| #3   | Crafted history (some weak, some stale, some mastered) produces the FR-016 ordering; mastered items still recur occasionally    | "the planning-default ordering is correct" is unverified                                                               | The prioritization inputs (distance error, attempt count, last-seen); the ordering contract from Business Logic               | unit / integration on the rule                                             | Assertion copied from the rule's own output rather than from FR-016                  |
| #4   | User B's session cannot read or mutate User A's set or attempts on every owned-resource endpoint                                | "logged-in implies authorized"                                                                                         | Every owned-resource endpoint; where ownership is enforced (RLS vs handler); whether any query uses a service-role key        | integration / contract (two distinct users)                                | Happy-path-only single-user test that never crosses ownership                        |
| #5   | Each malformed-row class is reported (not silently dropped); valid rows import exactly per US-03                                | "valid count == row count"; "extra columns should be rejected" (PRD relaxed this)                                      | The validation rules and their oracle in US-03; header handling; commit-vs-cancel choice                                      | unit on validation                                                         | Oracle lifted from the parser; happy-path-only                                       |
| #6   | An attempt and a session completion survive a simulated tab-close / re-fetch and a fresh load                                   | "a 200 response means the write persisted"                                                                             | The persistence boundary (Supabase write + read-back); session resume entry point                                             | integration on the study API                                               | Over-mocking the persistence boundary so the test never exercises a real round-trip  |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                   | Goal (one line)                                                                          | Risks covered | Test types                                              | Status      | Change folder                                       |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------- | ----------- | --------------------------------------------------- |
| 1   | Runner bootstrap + core math | Stand up the test runner; lock the spatial-click math with independent-oracle unit tests | #1            | unit                                                    | complete    | context/changes/testing-runner-bootstrap-core-math/ |
| 2   | Domain logic                 | Prove SRS ordering and CSV validation against PRD oracles                                | #3, #5        | unit + integration                                      | not started | —                                                   |
| 3   | Authorization & persistence  | No cross-user leak; lossless study state                                                 | #4, #6        | integration                                             | not started | —                                                   |
| 4   | Visual review layer          | Map and Dashboard render correctly on 1–3 critical screens                               | #2            | deterministic visual diff + selective multimodal review | not started | —                                                   |
| 5   | Quality-gates wiring         | Lock the floor — unit + integration in CI; post-edit hook recommended local              | cross-cutting | gates                                                   | not started | —                                                   |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

Phase 4 is the only AI-native phase and it is justified: R2 is a pure
layout/render concern that classic unit tests cannot catch (interview Q2).
**When NOT to use the visual layer:** any failure a deterministic unit or
integration test already catches — keep it to 1–3 screens.

## 4. Stack

The classic test base for this project. AI-native tools carry a `checked:`
date so future readers can see which lines need re-verification.
Recommendations are grounded in the local manifest plus the MCP/tools
exposed in the current session.

| Layer                    | Tool                        | Version | Notes                                                                                                                |
| ------------------------ | --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| unit + integration       | none yet — see §3 Phase 1   | —       | No runner installed. Vitest is the natural fit (Vite 7 already in the dep tree via Astro); Phase 1 bootstraps it.    |
| API mocking              | none yet — see §3 Phase 3   | —       | Supabase write/read boundary; mock at the network/client edge only, never internal modules.                          |
| e2e                      | none yet — see §3 Phase 3/4 | —       | Astro on Cloudflare Workers; evaluate Playwright if an integration layer cannot cover R6 resume. checked: 2026-06-06 |
| visual diff / multimodal | none yet — see §3 Phase 4   | —       | 1–3 critical screens (study map, dashboard). Tool choice deferred to Phase 4 research. checked: 2026-06-06           |
| accessibility            | not planned                 | —       | Accessibility is an explicit PRD Non-Goal (§7).                                                                      |

**Stack grounding tools (current session):**

- Docs: none — Context7 / framework docs MCP not available in current session; recommendations lean on `package.json` evidence; checked: 2026-06-06
- Search: none — Exa.ai / web search MCP not available in current session; checked: 2026-06-06
- Runtime/browser: none — Playwright MCP not available in current session; browser-layer choice deferred to Phase 4 research; checked: 2026-06-06
- Provider/platform: none — Supabase / Cloudflare / GitHub MCP not available in current session; RLS verification (R4) is a Phase 3 research task against current code; checked: 2026-06-06

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                       | Where              | Required?                    | Catches                                                   |
| ------------------------------------------ | ------------------ | ---------------------------- | --------------------------------------------------------- |
| lint + typecheck (`eslint`, `astro check`) | local + CI         | required (already wired)     | syntactic / type drift                                    |
| unit + integration                         | local + CI         | required after §3 Phase 1    | logic regressions (math, SRS, CSV, authz, persistence)    |
| post-edit hook                             | local (agent loop) | recommended after §3 Phase 5 | regressions at edit time; not a CI substitute             |
| visual diff (deterministic)                | CI on PR           | optional after §3 Phase 4    | map / dashboard rendering regressions                     |
| multimodal visual review                   | CI on PR           | optional after §3 Phase 4    | layout issues classic diff misses; selective, 1–3 screens |

Note: a Husky `pre-commit` hook + `lint-staged` already run eslint on staged
files; Phase 5 extends the floor with the test gates, it does not introduce
hooks from scratch.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

Unit tests cover **pure, DOM-free library functions** (`src/lib/*`). They run
under Vitest in a Node environment — no jsdom, no network, no rendering.

- **Location & naming.** Co-locate the spec next to the code it locks:
  `src/lib/<module>.test.ts` for `src/lib/<module>.ts`. This is the Vitest
  default — zero path config. Import the code under test via the `@/` alias
  (`import { haversine } from "@/lib/geo"`), which `vitest.config.ts` maps to
  `src/`.
- **Run commands.** `npm run test` (watch mode, re-runs on save) while
  developing; `npm run test:run` (single run, CI-friendly) to verify green.
- **Reference test.** `src/lib/geo.test.ts` is the canonical exemplar — read it
  before writing a new spec. It shows the structure (`describe` / `it`), the
  `{ lat, lng }` contract, and the oracle discipline below in practice.
- **Oracle discipline (load-bearing).** Never assert that a function equals a
  value re-derived from the same code or formula under test — that only proves
  the code agrees with itself. Get every oracle from an **independent** source:
  published great-circle distances (with a tolerance band that absorbs
  sphere-vs-ellipsoid + rounding, not slop hiding a bug), a literal spec
  constant from the PRD/FR (e.g. the inclusive `300` km threshold from FR-012,
  not the imported `DEFAULT_CORRECT_THRESHOLD_KM`), or a geometric invariant
  (east projects right-of west — catches an axis transpose that a round-trip
  alone passes). A spec is only as good as its independence from the code.
- **Prove it fails.** A new spec should go red under a deliberate local mutation
  of the code it claims to lock (e.g. `<=` → `<`, or transposed axes), then
  green again on revert. If the suite stays green through the mutation, the test
  is not pinning what you think.

### 6.2 Adding a domain-logic test (SRS ordering / CSV validation)

- TBD — see §3 Phase 2 (FR-016 ordering oracle; US-03 validation oracle).

### 6.3 Adding an integration test for an API endpoint

- TBD — see §3 Phase 3 (two-user authorization pattern; persistence round-trip for study attempts/completion).

### 6.4 Adding a visual / multimodal review for a screen

- TBD — see §3 Phase 4 (1–3 critical screens: study map, dashboard).

### 6.5 Per-rollout-phase notes

- (Filled in by `/10x-implement` as phases land.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Supabase auth mechanism** (login form, password handling, session issuance) — stock library, trusted (interview Q5). Re-evaluate if auth is customized or a non-Supabase provider is added. Note: _authorization_ (ownership checks, R4) is NOT excluded — only the authentication mechanism is.
- **Marketing landing + teaser quiz internals** — throwaway, client-side only, changes constantly (roadmap S-08). Re-evaluate if the teaser gains persistence or becomes a conversion-critical funnel.
- **Non-UTF-8 CSV encodings** — behavior explicitly undefined for MVP (PRD US-03). Re-evaluate if non-UTF-8 import becomes a real student pain.
- **Mobile / responsive layout** — desktop-first is a PRD Non-Goal. Re-evaluate if a responsive UI ships.
- **Accessibility (keyboard nav, screen reader, WCAG)** — explicit PRD Non-Goal. Re-evaluate if the user base widens.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-06
- Stack versions last verified: 2026-06-06
- AI-native tool references last verified: 2026-06-06

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
