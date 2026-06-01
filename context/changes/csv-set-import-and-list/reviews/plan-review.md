<!-- PLAN-REVIEW-REPORT -->

# Plan Review: CSV Set Import & List

- **Plan**: context/changes/csv-set-import-and-list/plan.md
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: REVISE → SOUND after triage (all 5 findings fixed)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | FAIL    |

## Grounding

Existing paths 11/11 ✓ (package.json, middleware.ts, lib/supabase.ts, the F-01 migration, Topbar/dashboard/index/auth routes, ServerError/button/FormField/SubmitButton, database.types.ts); new-file paths N/A (csv.ts, api/sets/index.ts, sets/index.astro, ImportSetForm.tsx — intentionally absent). Symbols ✓ (`createClient`, `PROTECTED_ROUTES`, `locals.user`). brief↔plan ✓ (note: brief also carries the "inert rows" wording — F2 fix touches both). No `docs/reference/contract-surfaces.md` — surface check skipped.

## Findings

### F1 — Phase blocks use `- [ ]` checkboxes; contract reserves them for Progress

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1/2/3 — Success Criteria (Automated + Manual)
- **Detail**: The Progress-format contract (`references/progress-format.md`) and `10x-implement/SKILL.md:48` require Phase blocks to contain **plain `- ` bullets** — `[ ]`/`[x]` live ONLY in the canonical `## Progress` section. This plan's Success Criteria use `- [ ]` (24 of them across the three phases). The already-shipped F-01 plan used plain `- ` bullets in its Success Criteria and `[ ]` only in Progress. `/10x-implement` derives "next pending step" and completion `count([x])/count([ ]+[x])` from these markers; duplicated checkboxes outside Progress risk a document-order mis-scan and inflate the denominator. The skill's own rule says treat this as CRITICAL.
- **Fix**: In Phase 1–3 Success Criteria only, convert each `- [ ] ` to `- `. Leave the `## Progress` section (rows `1.1…3.8`) exactly as-is — it is already well-formed and matches every Success-Criteria bullet.
- **Decision**: FIXED — converted all 24 Phase-block checkboxes to plain `- ` bullets; `[ ]` now appears only in `## Progress`.

### F2 — "Inert rows" contradicts the planning decision to link rows to /study/:id

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: What We're NOT Doing (l.47); Phase 2 §1 (l.153); brief Key Decisions
- **Detail**: During planning you chose the list-row option **"Name + date + count, Study link to future /study/:id"**. The plan instead specifies rows rendered **inert — no link** (l.153, l.47, and the brief). Beyond the decision mismatch, FR-005 and the roadmap S-01 outcome both say "pick one to study"; inert rows show the list but offer nothing to pick. This is the slice's stated end state doing 90% and stopping at the "pick" verb.
- **Fix A ⭐ Recommended**: Honor the decision — make each row a link to `/study/<set.id>`.
  - Strength: Matches your explicit choice and satisfies "pick one to study" literally; defines the entry contract S-02 implements against.
  - Tradeoff: The link 404s until S-02 ships (you accepted this dead-end in the option text).
  - Confidence: HIGH — trivial markup; `set.id` is already in the query.
  - Blind spot: A 404 in a demo build looks broken to a non-author; mitigate with a tooltip/`title="Studying lands in S-02"` if desired.
- **Fix B**: Keep rows inert — update the decision record (plan l.47/153 + brief) to say so and note the change of mind.
  - Strength: No dead link; honest about what exists this slice.
  - Tradeoff: Diverges from the option you picked; "pick to study" remains visual-only until S-02.
  - Confidence: HIGH — text-only edit.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — list rows link to `/study/<set.id>` (honors the planning-time choice). Updated: plan Phase 2 §1, Desired End State, the §What We're NOT Doing bullet, a new Phase 2 verification (2.9 in the phase block + Progress), and the brief's List-row decision. The target 404s until S-02 (accepted).

### F3 — Coordinate validation can silently coerce a missing value to (0,0)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 `src/lib/csv.ts` (l.99)
- **Detail**: The rule "latitude/longitude parse to finite numbers within range" is under-specified for the empty case. `Number("")` and `Number("   ")` both return `0` — finite and in range — so a row with a blank coordinate would silently become a valid `(0, 0)` (Gulf of Guinea) instead of being rejected. PRD US-03 explicitly classifies "missing either coordinate" and "non-numeric coordinate" as invalid; even though per-row reporting is S-05, S-01's reject-whole gate must still _detect_ these, so the parse must be strict. (`Number.parseFloat` has the mirror trap: `parseFloat("12abc") === 12`.)
- **Fix**: Specify the numeric check precisely in the contract: reject the row if the trimmed cell is empty, then require the entire trimmed string to be a valid number (e.g. guard empty → then `Number(trimmed)` with `Number.isFinite` reject, which also rejects `"12abc"` → `NaN`). Reject `NaN`/`±Infinity` before the range check.
- **Decision**: FIXED — `src/lib/csv.ts` contract (Phase 1 §2) now spells out empty-cell rejection before the finite-number/range check.

### F4 — Malformed JSON request body throws an uncaught 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 `src/pages/api/sets/index.ts` (l.111)
- **Detail**: "Parse the JSON body" via `await request.json()` throws a `SyntaxError` on a malformed/empty body, which would surface as an unhandled 500 rather than the intended `400 { error }`. Low likelihood from the first-party island, but the route is now a public JSON endpoint.
- **Fix**: Wrap the body parse in try/catch and return `400 { error }` on parse failure, before the field validation.
- **Decision**: FIXED — added a dedicated try/catch body-parse step returning `400` to the `POST /api/sets` contract (Phase 1 §3).

### F5 — New fetch+JSON route/island pattern + papaparse-in-Workers are unproven here

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Implementation Approach (l.58); Phase 1 §1/§3; Phase 3 §1
- **Detail**: Two firsts for this codebase, both reasonable but worth de-risking: (1) the first JSON API route + first fetch-based island (auth uses native form-POST + redirect) — this becomes the de-facto pattern S-02/S-03/S-04 will copy, so getting the response-shape/error convention right here matters beyond this slice; a recurring-rule candidate for `/10x-lesson`. (2) papaparse has not been run in the Cloudflare Workers runtime; its synchronous string parse is pure JS, but bundlers sometimes pull a Node `stream` shim. The Phase 1 `npm run build` (Workers build) already exercises this, so the risk is contained — just don't defer the build check.
- **Fix**: No plan change required. Optionally add a one-line note to Phase 1 success criteria that `npm run build` is the papaparse-in-Workers smoke test, and earmark the JSON-route/fetch-island convention for a `/10x-lesson` if S-02 review echoes it.
- **Decision**: FIXED via Note in plan — Phase 1 Overview now calls `npm run build` the papaparse-in-Workers smoke test; Implementation Approach earmarks the JSON-route/fetch-island convention for `/10x-lesson` if S-02 echoes it. (Titles untouched, so Progress↔Phase matching is preserved.)
