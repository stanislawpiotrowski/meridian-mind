---
project: "CityBreakPlanner"
context_type: greenfield
created: 2026-05-20
updated: 2026-05-20
checkpoint:
  current_phase: 3
  phases_completed: [1, 2]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "missing-match / generic results + decision paralysis + workflow friction"
    - topic: "insight (why this is underserved)"
      decision: "User stated: 'There is a lack of tourist attraction recommendations tailored to specific interest profiles.' — restates the pain; sharper insight pending (see Open Questions)."
    - topic: "primary persona scope"
      decision: "single named user — myself + family; build for personal use first"
    - topic: "auth model"
      decision: "email + password registration and login"
    - topic: "user roles"
      decision: "flat — every user is the same kind; each owns their own preferences and plan history"
  frs_drafted: 0
  quality_check_status: pending
---

# Shape Notes — CityBreakPlanner

Seed idea (from `idea-notes.md`): an AI-driven planner that quickly produces a short city-break itinerary of tourist attractions matched to a user's profile (cultural vs. nature/active), presented visually on a map with photos.

## Vision & Problem Statement

When the user and their family plan a weekend city break, finding interesting attractions that actually match their interest profile (cultural vs. nature/active) takes roughly two hours of tab-switching between Google Maps, travel blogs, and miscellaneous web pages — and the result is still a generic, popular-for-everyone list rather than a shortlist tuned to the family's taste. The friction is concrete (multi-source workflow, no profile filter, decision paralysis across long generic lists), not abstract.

The gap that makes this product worth building: profile-aware, taste-filtered attraction selection across an arbitrary city. Existing tools surface popular-for-everyone results; the user wants results filtered by a simple cultural-vs-nature axis with visual confirmation (photo + map) so they can converge on a shortlist in minutes rather than hours. _Note: the precise reason this gap persists today (LLM agents only recently feasible, engagement-driven incentives at incumbents, visual-first UX still uncommon) is captured as an Open Question for sharper articulation later._

## User & Persona

**Primary persona — "Planning Parent"**: an individual planning a 2–3 day weekend city break with their family. They have a clear interest profile (lean toward culture, or lean toward nature/active) but no patience for sifting through 50-item generic lists or reading three travel blogs per attraction. They reach for this product the evening before a trip (or a few evenings ahead) with a city already chosen and the question "what should we actually do there, given who we are?".

The MVP serves this single primary persona; broadening to a wider audience is deferred (see `## Non-Goals` once written in Phase 6).

## Access Control

Multi-user web app with email + password authentication. Each user registers their own account and signs in with credentials. The model is flat — every authenticated user has the same capabilities: they own their own preferences (default cultural-vs-nature interest profile) and their own plan history; they cannot see another user's plans or preferences. There is no admin role in the MVP.

Sign-up vs sign-in: standard registration creates a new account; sign-in authenticates an existing account. Unauthenticated visitors hitting a gated route (plan generation, preferences, history) are redirected to a login/register screen. Public, unauthenticated browsing of the app is out of scope for the MVP.

## Phase 3 — work-in-progress (paused 2026-05-20)

**Status:** flow sketched and confirmed; scope-cost surfaced; scope-path decision PENDING.

**MVP flow (confirmed by user):**

1. User opens the app → lands on login/register
2. User registers an account (email + password)
3. User sets default preferences (cultural vs. nature/active)
4. User enters a target city and submits
5. AI pipeline searches + filters attractions for that city + profile (≤ 30s)
6. Plan renders: interactive map with photo + label per attraction
7. Plan is auto-saved to user's history; revisitable in a panel

**Scope-cost reality (user acknowledged):** original 3-week target too tight; realistic estimate at full original scope is ~5–7 weeks of after-hours work.

**Expensive pieces identified:**
- ① AI agent search across an arbitrary city — 1–2 weeks
- ② Photo retrieval + fallbacks per attraction — 3–5 days
- ③ Interactive map + geocoding — 3–5 days
- ④ User accounts + auth + history persistence — 3–5 days
- ⑤ ≤ 30s perf target — performance work

**Scope-down moves on the table (pending user pick):**
- A. Pre-seed 3–5 cities (cache attractions + photos at build time)
- B. Single LLM call instead of multi-agent orchestration
- C. Drop persisted history (current plan only)
- D. Drop user accounts (localStorage prefs) — contradicts idea-notes; less likely

**Open decision (next session):** pick scope path. Candidate paths:
- A + B + C → ~3-week target (recommended)
- A + B only → ~4-week target (keeps history)
- Commit to full scope, ~5–7 weeks with explicit timeline acknowledgment
- Restart Step 3 with a different first flow

**User requested clarification** before picking — to be re-engaged on next resume.

## Open Questions

1. **Sharper articulation of the insight** — why does generic-list, engagement-optimized recommendation persist as the status quo? Candidate framings: (a) LLM agents capable of taste-filtering across an open city only recently became feasible, (b) incumbent tools optimize for engagement/ads, not 5-minute decisions, (c) visual-first map+photo UX is still underbuilt. Owner: user. Block: no — the PRD ships with the pain articulated even if the insight is rough.

<!-- More PRD-anticipating sections will be appended phase by phase. -->
