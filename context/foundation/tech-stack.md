---
starter_id: 10x-astro-starter
package_manager: npm
project_name: meridian-mind
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo developer building MeridianMind — an interactive geo-flashcard web app for cram-mode geography students — in a 5-week after-hours window. The 10x Astro Starter is the recommended default for `(web-app, js)` and clears all four agent-friendly gates (explicit TypeScript types end-to-end, convention-based via Astro file-routing + Supabase schema-first data, popular within JS training data, well-documented). It pre-wires the three biggest tech-forcing features in the PRD: email + password auth (FR-001/2/3 via Supabase), persistent cross-session storage for sets and per-item study history (FR-015 via Supabase Postgres), and an interactive map UX through React islands (FR-010/11). Cloudflare Pages is the starter's first deployment default and the cheapest path to first deploy. CI runs on GitHub Actions with auto-deploy-on-merge — the shape the starter ships. Scaffolding confidence is first-class (registered with a valid CLI but not yet end-to-end-verified); expect mostly-smooth scaffolding with occasional manual steps. AI features are explicit Non-Goals in the PRD; SRS prioritization runs synchronously, so no background-jobs feature is needed at MVP.
