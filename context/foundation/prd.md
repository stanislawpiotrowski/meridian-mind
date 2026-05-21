---
project: "MeridianMind"
version: 1
status: draft
created: 2026-05-21
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 5
  hard_deadline: null
  after_hours_only: true
---

# Product Requirements Document — MeridianMind

## Vision & Problem Statement

A university student studying for a fixed-syllabus geography exam (typically 50–300 named countries, capitals, mountain ranges, rivers, or climate zones) opens their atlas or lecture slides in the 1–2 weeks before the exam and tries to learn the locations by looking. The method fails because every object is visible at once: the student cannot distinguish "things I actually know" from "things I'd recognize on a labelled map but couldn't produce on a blank one under exam pressure." Hours of low-retention study yield a worse exam grade than the time invested deserved.

Three things would fix this — spaced repetition that drills the items the student doesn't yet know, spatial-click verification that forces active recall (point to it on a blank map, don't just recognize a label), and custom-set import so the specific syllabus the lecturer assigned becomes the study set directly. Each exists as a separate product: SRS apps (Anki) don't do maps; map-quiz tools (Seterra, Sporcle, World Geography Games) ship fixed canonical sets without SRS and without easy custom import; atlases and Wikipedia have data but no study mode. The combination has not been built because the three audiences (Anki users, casual quiz players, atlas readers) don't commercially overlap — building for cram students specifically is a narrow market that incumbents skip.

## User & Persona

**Primary persona — "Exam-Cram Geography Student"**: a university student majoring in geography or an adjacent earth-sciences discipline, facing a fixed-syllabus exam in 1–2 weeks. The lecturer has handed out (verbally, in slides, or as a written list) the specific set of objects — typically 50–300 countries, capitals, mountain ranges, rivers, or climate zones — that will appear on the exam. The student knows what they need to master and roughly how long they have. They reach for this product during the cram window when traditional methods (staring at an atlas, re-reading lecture slides, generic geo-quiz sites whose canonical sets do not match the syllabus) are not converting study hours into exam-ready recall.

Grounding: the user's friends studying geography. Children, hobby learners, and the user themselves are NOT in the MVP persona; they are potential future audiences and are explicitly excluded from MVP design decisions (see `## Non-Goals`).

## Success Criteria

### Primary
- The cram student completes a full first session end-to-end: registers an account, imports a 50–300 item CSV (columns: name, latitude, longitude), starts a quiz against that set, sees object names one at a time, clicks on the interactive map for each, receives distance / accuracy feedback with the correct location revealed, and reaches a session summary at the end.
- The student returns for a second session 1+ days later and the items they got wrong in the previous session have been prioritized to appear earlier and more often in the new queue.

### Secondary
- 95th-percentile click → feedback latency stays under 500 ms.

### Guardrails
- Imported sets and per-item study history persist losslessly across sessions and devices. A student can quit mid-session, switch from laptop to phone, return hours or days later, and never lose prior state.

## User Stories

### US-01: Student completes their first full study session

- **Given** a registered, signed-in student with at least one imported flashcard set
- **When** they pick a set and start a quiz
- **Then** they see object names one at a time, click the map for each, receive per-click distance feedback with the correct location revealed, advance through every flashcard in the queue, and reach a session summary at the end

#### Acceptance Criteria
- The session queue contains every item in the chosen set exactly once
- Per-click feedback is shown within 500 ms (p95) of the click (mirrors the Secondary success criterion)
- Session summary shows: number of items answered, accuracy percentage, and the list of items the student got most wrong
- Mid-session progress is preserved if the student closes the tab and re-opens

### US-02: Student returns for a second session with a prioritized queue

- **Given** a registered, signed-in student who has previously completed at least one session against a set
- **When** they start a new session against that same set
- **Then** the queue prioritizes items the student got wrong in past sessions or has not seen recently, surfacing those items earlier and more often than items they have consistently answered correctly

#### Acceptance Criteria
- Items missed in the prior session appear in the new queue before items previously answered correctly
- Items not seen for a longer time are surfaced before items seen recently
- The student does not need to configure anything — prioritization is automatic
- A student who has answered every item correctly multiple times still sees the set occasionally for retention (not zero recurrence)

### US-03 (nice-to-have): Student imports a CSV flashcard set with explicit handling of malformed rows

Priority: **nice-to-have** *(see FR-007; the MVP-required CSV behavior is the happy path, covered by FR-004 + US-01 prerequisites. US-03 documents the contract if/when the nice-to-have ships.)*

- **Given** a registered, signed-in student with a CSV file containing flashcards (columns: `name`, `latitude`, `longitude`)
- **When** they upload the CSV via the import screen
- **Then** valid rows become flashcards in a new set, and invalid rows are surfaced explicitly to the student rather than silently dropped

#### Acceptance Criteria
- A CSV whose rows are all valid produces a set containing every row as a flashcard (covers FR-004; MVP-required)
- A row is "invalid" if it: is missing the `name` value, is missing either coordinate, has a non-numeric coordinate, has a latitude outside `[-90, 90]`, or has a longitude outside `[-180, 180]`
- Each invalid row is reported to the student *before the import finalizes*, with: row number (1-indexed for human readability), which field(s) failed validation, and a one-line reason per failure
- The student is offered an explicit choice before commit: (a) proceed with only the valid rows imported into the new set, or (b) cancel the import to fix the source file and retry
- If the student picks (a), the resulting set contains exactly the valid rows; invalid rows are not silently dropped — the student saw them first
- The CSV's first row is expected to contain column headers `name`, `latitude`, `longitude` (case-insensitive); a file missing headers, with unrecognized headers, or with extra columns is reported as an error before row-level validation begins
- The CSV is expected to be UTF-8 encoded. Files in other encodings (e.g., Windows-1250) may render geographic names with diacritics ("Wrocław", "Kraków") incorrectly; behavior with non-UTF-8 files is undefined for the MVP and may be addressed post-MVP

## Functional Requirements

### Account & Authentication

- **FR-001**: Student can register a new account with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "Email + password adds friction for a one-time-use cram tool; magic-link / OAuth might be lower-abandonment." Resolution: kept — Phase 2 explicitly evaluated OAuth and magic-link and rejected both for cost-of-infra reasons; the timeline acknowledgment in Phase 3 already accepted the friction.

- **FR-002**: Student can sign in with their existing email and password. Priority: must-have
  > Socrates: Counter-argument considered: "Persistent session cookies make manual sign-in rare; explicit sign-in is over-engineered." Resolution: kept — sign-in is the necessary counterpart to register; both exist regardless of cookie persistence.

- **FR-003**: Student can sign out from any authenticated screen. Priority: nice-to-have
  > Socrates: Counter-argument considered: "Shared-device case (university computer labs) makes sign-out a security must-have, not nice-to-have." Resolution: kept as nice-to-have — lab-computer scenario is real but minor in a 2-week personal-device-dominant cram window; promotable post-MVP if it surfaces.

### Set Management

- **FR-004**: Student can upload a CSV file containing flashcard objects (columns: `name`, `latitude`, `longitude`). Priority: must-have
  > Socrates: Counter-argument considered: "Students get syllabi as PDF / slides / Word; CSV-only adds a manual conversion step that may kill adoption." Resolution: kept — CSV is universal and simplest; PDF / slide import is a clean post-MVP feature.

- **FR-005**: Student can view a list of all sets they have imported and pick one to study. Priority: must-have
  > Socrates: Counter-argument considered: "A list view becomes noise once a student has 10+ sets; needs search/filter even at MVP." Resolution: kept — cram students typically have 1–3 sets in the MVP window; search/filter is post-MVP.

- **FR-006**: Student can delete a set they previously imported. Priority: must-have
  > Socrates: Counter-argument considered: "Hard delete is risky; soft delete with undo is safer, especially for a cram student who could lose hours of study history." Resolution: kept — hard delete is simplest; confirmation dialog is implied (not separately FR'd). Soft delete with undo is post-MVP polish.

- **FR-007**: When the app parses an imported CSV, malformed rows (missing name, missing or invalid lat/lon) are surfaced explicitly to the student rather than silently dropped. Priority: nice-to-have
  > Socrates: Counter-argument considered: "Cram students value completeness; silent drops cause exam-day failure on dropped items — should be must-have." Resolution: kept as nice-to-have — user explicitly demoted this in Phase 4 to control scope; risk is documented in `## Non-Goals` (no silent-drop guarantee in MVP) and would be promoted post-MVP if it surfaces as a real pain.

### Study Session (Quiz Loop)

- **FR-008**: Student can start a study quiz against a chosen set. Priority: must-have
  > Socrates: Counter-argument considered: "Why force explicit 'start'? Auto-start when student picks a set — one less click." Resolution: kept — explicit start lets the student preview the set if they want; one click is not significant friction.

- **FR-009**: Student sees the name of one object at a time during a quiz. Priority: must-have
  > Socrates: Counter-argument considered: "Showing the next few upcoming object names reduces cognitive load." Resolution: kept — one-at-a-time IS the active-recall mechanic; previewing breaks the spaced-repetition contract.

- **FR-010**: Student can click anywhere on the interactive map to answer "where is this object?". Priority: must-have
  > Socrates: Counter-argument considered: "Free click might be too forgiving; drag-pin from a list could match cram-student mental models better." Resolution: kept — free click matches the cognitive task being tested (recall the location, then point). Drag-pin is a different mechanic; post-MVP variant.

- **FR-011**: After each click, the student sees feedback: distance error (in km) between their click and the correct location, the correct location revealed on the map, and a clear correct / incorrect indicator. Priority: must-have
  > Socrates: Counter-argument considered: "Km feedback is meaningless for city-scale sets (districts within Warsaw); unit/scale should be adaptive or per-set configurable." Resolution: kept with Open Question — MVP target sets (countries, capitals, ranges) are continent-scale where km is the right granularity; sub-country sets would need scale-adaptive feedback. See `## Open Questions` #1.

- **FR-012**: The quiz advances to the next flashcard after the student acknowledges feedback. Priority: must-have
  > Socrates: Counter-argument considered: "Auto-advance is impatient; student needs absorb-time on the correct location." Resolution: kept — the FR already specifies "after the student acknowledges feedback", which is a manual step; the apparent tension dissolves on close reading.

- **FR-013**: A study session ends when all flashcards in its queue have been answered. Priority: must-have
  > Socrates: Counter-argument considered: "Long sets (300 items) force marathon sessions; should support in-session breaks." Resolution: kept — the lossless-persistence guardrail implies the student can quit the tab and resume mid-session; explicit "break" affordance is post-MVP.

- **FR-014**: At session end, the student sees a summary (number of items shown, accuracy, items they struggled with). Priority: must-have
  > Socrates: Counter-argument considered: "A bare summary screen is fluff; students want to move on, not study it." Resolution: kept — the summary IS the "reason to come back tomorrow"; without it, the link between items the student struggled with and tomorrow's queue is invisible.

### Cross-Session Persistence & Prioritization

- **FR-015**: The app records per-item performance (last attempt's distance error, attempt count, last-seen time) and persists it across sessions. Priority: must-have
  > Socrates: Counter-argument considered: "Per-item data is sensitive (reveals what the student doesn't know); should be per-item deletable at any time." Resolution: kept — persistence is foundational. FR-006 (delete set) is set-level deletion; per-item deletion is over-engineering for MVP and can be added post-MVP if privacy concerns surface.

- **FR-016**: When a student starts a new session against a previously-studied set, the queue is ordered to prioritize items the student got wrong or has not seen recently. Priority: must-have
  > Socrates: Counter-argument considered: "Even the simplest queue logic adds complexity; basic 'missed items first' might be sufficient and simpler to ship." Resolution: kept — the bundle of spaced-repetition prioritization, spatial click, and custom-set import IS the differentiator. "Missed items first" is a degenerate form of the rule that still satisfies the FR as written (it prioritizes wrong items and ages older-seen items); the spirit is preserved whether the implementation is a classic Leitner-box or its simplest possible form.

## Non-Functional Requirements

- **Latency** — Per-click feedback is rendered within 500 ms (p95) of the click. *(Mirrors the Secondary success criterion.)*
- **Persistence reliability** — Imported sets and per-item study history survive any combination of session end, browser close, device change, and time gap without loss.
- **Data isolation** — A user cannot observe, infer, or recover any data belonging to another user via the app's UI or any externally-reachable endpoint.
- **Desktop browser support** — The app remains usable on the current and previous major versions of Chrome, Firefox, Safari, and Edge on desktop.
- **Auth security baseline** — A failed login does not lock out a legitimate user who mistypes their password three times in a row, but credential-stuffing at scale is rejected before reaching the auth check.
- **Data retention after account deletion** — Imported sets and per-item study data are purged within 30 days of the user deleting their account.

## Business Logic

Given a student's history of distance errors and the time elapsed since each location was last shown, the app constructs a question set that prioritizes the objects the student struggled with most or hasn't seen in a long time, while still including well-known items occasionally for retention.

The rule consumes two streams of per-item data, both produced by the student's own activity inside the app: (1) the distance error of every past click on the item, in km — how well the student knows that location; and (2) the timestamp of the last session in which the item appeared — how long it has been out of the student's view. These are the only inputs; nothing about the lecturer, the course, the syllabus, or other students enters the rule.

The output is an ordered queue of items for the student's next study session against this set. Items the student has consistently clicked with high error, or that have not appeared for a long time, sit earlier in the queue and appear more often than items the student has consistently clicked accurately and seen recently. Well-known items still appear occasionally for retention; the queue is never empty of them.

The student does not configure or tune the rule. They start a session against a previously-studied set, and the queue is already prioritized — struggling items appear first; consistently-nailed items appear only occasionally. The session summary at the end implicitly reveals which items still need work, which the student reads as the brief for the next session's composition.

## Access Control

Multi-user web application with email + password authentication. Each student registers their own account and signs in with credentials. The model is flat — every authenticated user has the same capabilities: they own their own imported flashcard sets, manage their own study history, and view their own per-session summaries; they cannot see another user's sets or progress. There is no lecturer / admin / publisher role in the MVP.

Sign-up vs. sign-in: standard registration creates a new account; sign-in authenticates an existing account. Unauthenticated visitors hitting a gated route (importing sets, running a study session, viewing progress) are redirected to a login/register screen. Public, unauthenticated browsing of the app — including any "demo set" landing surface — is out of scope for the MVP.

Lecturer-shares-set workflows are explicitly out-of-band for the MVP: a lecturer hands the syllabus CSV to students via email or LMS attachment; each student imports it themselves into their own account. In-app role-based publishing (lecturer pushes a set to a class) is deferred to post-MVP (recorded in `## Non-Goals` below).

## Non-Goals

The following are explicitly out of scope for the MVP. They are recorded here so they are not lost; they are eligible for post-MVP revisits only after the MVP scope is shipped and learnings are in hand.

- **Password reset flow** — deferred. The MVP cram window is 1–2 weeks; the risk of a student forgetting a freshly-set password within that window is low. Lost-access users can re-register with a different email until the post-MVP password-reset flow ships.
- **Edit a flashcard's name or coordinates after import** — deferred. The workflow is "import → study → re-import if the set is wrong". Re-add post-MVP if friction surfaces.
- **Cross-session progress history beyond the per-session summary** — deferred. The app uses per-item history internally (see FR-015), but the student does not get a separate "long-term progress" view. Re-add post-MVP for users who want retention analytics over weeks.
- **Pause / resume mid-session as an explicit affordance** — deferred. The lossless-persistence guardrail implies state survives a closed tab, but there is no explicit "pause" affordance or mid-session resume surface. Re-add post-MVP if mid-session interruption becomes a common pain.
- **In-app lecturer publishing of sets to a class** — deferred (recorded also in `## Access Control`). Lecturers share CSVs out-of-band via email or LMS attachment for the MVP.
- **Polish (or any non-English) UI localization** — deferred. MVP UI is English-only despite the Polish-speaking persona; localization scaffolding would cost ~2–3 days against the 5-week timeline. Revisit post-MVP if Polish-language adoption is a blocker.
- **Basic accessibility (keyboard navigation, screen reader compatibility, WCAG)** — deferred. Not required by the cram-student persona explicitly; cheap to commit to at MVP and expensive to retrofit later, but explicitly excluded from MVP NFRs. Revisit post-MVP if the user base widens to include users with accessibility needs.
- **Mobile / responsive UI** — deferred. MVP is desktop-first; the multi-device persistence guardrail is satisfied by data sync, not by UI adaptation. Students can use the desktop site on tablets/phones but the layout will not be optimized for small screens.
- **Configurable session length (pick N questions per session: All / 10 / 50 …)** — deferred to post-MVP. The MVP queue always contains the full ordered set, effectively "All". The post-MVP feature would let the student pick a target count at session start; the algorithm would then surface the top N items by priority (a small refinement of the locked business rule — truncating the priority-ordered queue at N). Default behavior if/when implemented: "All" (current behavior preserved as the unselected default).
- **AI-generated flashcard sets (LLM creates the set from a prompt)** — deferred. The MVP wedge is bring-your-own-syllabus CSV import; LLM-generated sets blur the differentiator. Re-add post-MVP if the wedge is proven and a "starter set generation" feature would meaningfully help onboarding.
- **AI-generated tutor feedback per click** — deferred. Per-click LLM-generated commentary (e.g., *"you were close — try a bit further west"*) would add a per-click LLM-infrastructure dependency that is heavy for MVP. The MVP gives factual distance feedback only (FR-011); narrative feedback is post-MVP if user value is demonstrated.
- **Custom / advanced spaced-repetition scoring (SuperMemo, SM-2, hand-rolled scoring math)** — deferred. The MVP uses the simplest queue ordering that satisfies FR-016. Advanced scoring is not the differentiator — the *bundle* is the gap, not the algorithm sophistication. Re-add post-MVP only if retention quality becomes the binding constraint.
- **Social features and gamification** — deferred. Leaderboards, shared / public sets, streaks, badges, public profiles, comments, follow graphs, achievement systems. None matches the cram-student persona; all are common scope-creep traps for study apps. Re-add post-MVP only if user research shows these would change behavior.

## Open Questions

1. **Scale-adaptive distance feedback for sub-country sets (FR-011)** — FR-011 currently specifies km feedback after each click. For sets at city / district / building scale (e.g., "monuments of the Warsaw old town", "districts of Kraków"), km is too coarse to be meaningful. Candidate resolutions: (a) auto-detect set spatial bounds at import time and pick a unit (km / m); (b) make the unit per-set configurable at import; (c) leave km-only for MVP and capture the limitation as a known gap. Owner: user. Block: no — MVP target sets are continent-scale, so the gap is post-MVP unless small-scale sets become common usage.
