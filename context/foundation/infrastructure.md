---
project: MeridianMind
researched_at: 2026-05-23
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript / TypeScript
  framework: Astro (10x-astro-starter)
  runtime: Cloudflare Workers (via @astrojs/cloudflare adapter)
  auth_db: Supabase (external — email+password auth + Postgres)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The tech stack already names `cloudflare-pages` as the deployment target; Cloudflare Workers is the correct evolution of that intent — the `@astrojs/cloudflare` adapter dropped Pages support in Astro 6 and now targets Workers exclusively. Cloudflare Workers scores 5/5 on all five agent-friendly criteria: the `wrangler` CLI covers every routine operation (deploy, rollback, log-tail, secret management), the runtime is fully managed and serverless, docs are available as markdown at developers.cloudflare.com, `wrangler` exits with predictable codes and structured JSON output, and the official `workers-mcp` MCP server is GA. The free tier (100k requests/day) comfortably covers MVP traffic at zero cost.

## Platform Comparison

### Scoring Matrix

| Platform               | CLI-first                 | Managed / Serverless    | Agent-readable docs     | Stable deploy API    | MCP / Integration    | **Total**   |
| ---------------------- | ------------------------- | ----------------------- | ----------------------- | -------------------- | -------------------- | ----------- |
| **Cloudflare Workers** | Pass                      | Pass                    | Pass                    | Pass                 | Pass                 | **5 / 5**   |
| Netlify                | Pass                      | Pass                    | Pass                    | Pass                 | Pass                 | **5 / 5**   |
| Vercel                 | Pass                      | Pass                    | Pass                    | Pass                 | Partial _(MCP beta)_ | **4.5 / 5** |
| Railway                | Pass                      | Partial _(container)_   | Pass                    | Pass                 | Pass                 | **4 / 5**   |
| Fly.io                 | Pass                      | Partial _(Docker req.)_ | Partial _(no llms.txt)_ | Pass                 | Pass                 | **3.5 / 5** |
| Render                 | Partial _(rollback gaps)_ | Pass                    | Pass                    | Partial _(CLI gaps)_ | Pass                 | **3.5 / 5** |

**Interview weights applied:**

- Q1 "No persistent connections" → no hard filter applied; all platforms eligible
- Q2 "No preference on cost/DX" → neither cost nor DX weighted heavily
- Q3 "No familiarity" → no tie-breaking from prior experience
- Q4 "Single region fine" → edge-native bonus reduced but not disqualifying
- Q5 "External providers fine" → Supabase already chosen; co-location bonus irrelevant

**Cloudflare vs Netlify tiebreaker:** `tech-stack.md` already names Cloudflare as the deployment target (`cloudflare-pages`). The adapter migration to Workers is intra-platform housekeeping. Free tier advantage: 100k req/day free vs Netlify's credit-based system. Cloudflare wins.

### Shortlisted Platforms

#### 1. Cloudflare Workers _(Recommended)_

Aligns with the existing tech-stack intent (`deployment_target: cloudflare-pages` → Workers is the correct Astro 6 target on the same platform). The `wrangler` CLI is the most comprehensive in the group: `wrangler deploy` (production + staging environments), `wrangler rollback [<deployment-id>]` (revert to any prior version), `wrangler tail` (live log streaming with JSON output and filtering), `wrangler secret put` (encrypted secret management), `wrangler deployments list` (deployment history). Docs are markdown at developers.cloudflare.com and the `@astrojs/cloudflare` adapter guide at docs.astro.build. The `workers-mcp` MCP server (GA) exposes 2,500+ Cloudflare APIs to Claude/agents. Free tier: 100k requests/day, 10ms CPU per invocation, 128MB memory.

#### 2. Netlify

Scores 5/5 on all five criteria with fewer deployment-infrastructure gotchas than Cloudflare for this specific project (no adapter migration, PR preview deployments are automatic). The `netlify` CLI covers deploy, rollback, and log-tail (`netlify logs --follow`, GA May 2026). The official MCP server went GA in May 2026, enabling agents to deploy, manage env vars, and access controls via natural language. `llms.txt` is available at docs.netlify.com/llms.txt. Astro 6 support is GA via `@astrojs/netlify` adapter. The gap vs Cloudflare: free tier is credit-based (more opaque), and there's no path back toward the tech-stack's Cloudflare target.

#### 3. Vercel

Scores 4.5/5 — docked half a point because the Vercel MCP server is in **beta** as of May 2026. Otherwise a strong option: `vercel` CLI covers deploy, rollback (previous deployment only on Hobby), and log-streaming; `llms-full.txt` is available at vercel.com/docs/llms-full.txt; Astro 6 is GA via `@astrojs/vercel`; free Hobby tier handles 1M edge requests/month. The Hobby plan rollback limitation (previous deployment only, no arbitrary version selection) is a meaningful operational constraint compared to Cloudflare's arbitrary-version rollback.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Astro 6 dropped `cloudflare-pages` support in `@astrojs/cloudflare`** — the adapter now targets Workers exclusively. The GitHub Actions CI workflow configured for auto-deploy-on-merge (using the Cloudflare Pages deploy action) needs to be rewritten to use `wrangler deploy`. This is extra setup work that platforms 2 and 3 do not require.

2. **Node.js API gaps are runtime failures, not build failures.** The `nodejs_compat` flag polyfills many Node.js APIs, but `fs`, `child_process`, and `net` remain unavailable. Any transitive dependency in the Supabase JS client, Astro plugins, or React islands that touches these APIs will produce a runtime error in Workers — not caught at build time, not caught by `wrangler dev` (which is more permissive than the actual runtime).

3. **CPU time limit is a hard ceiling, not a quota.** Free: 10ms CPU/invocation; Paid (Standard): 30ms; Unbound: 50ms. A worker killed by the CPU cap returns a `1015` error, not a user-readable 500. The PRD's 500ms p95 latency SLA for click feedback is for the UI layer; if the backing worker is killed on a cold Supabase auth check, the SLA is violated with no useful error message.

4. **Two separate secret stores create operational confusion.** `wrangler.toml` `[vars]` (committed to source control, visible) vs Workers Secrets via `wrangler secret put` (encrypted, not in toml). Supabase credentials must go into Workers Secrets — but `import.meta.env.SUPABASE_*` in Astro reads from `[vars]` at build time and from Secrets at runtime. Getting this wrong either leaks credentials to git or causes build-time SSG failures.

5. **PR preview deployments are not automatic on Workers.** Cloudflare Pages had first-class automatic PR preview URLs. Workers requires explicit preview environments in `wrangler.toml` and manual deploy commands per PR. Netlify and Vercel handle PR previews automatically out of the box.

### Pre-mortem — How This Could Fail

The team treated "Cloudflare Pages in the tech-stack" as "Cloudflare will be easy" and started building. On week 2, `wrangler pages deploy` returned a deprecation notice — the adapter targets Workers now. Three days went into reconfiguring GitHub Actions from the Pages deploy action to `wrangler deploy`. Preview deployments stopped appearing on PRs because Workers doesn't auto-provision preview branches. On week 3, a security audit flagged the Supabase anon key committed to `wrangler.toml [vars]` instead of Workers Secrets — it had been added there because `import.meta.env.SUPABASE_ANON_KEY` "just worked" locally. Rotating mid-sprint cost a day. On week 4, intermittent 1015 errors appeared in production on the first request after an idle period — the Supabase client initialization was hitting the CPU cap on cold requests. The fix (lazy initialization, avoiding heavy imports at module load) took two days to diagnose because `wrangler dev` never reproduced it. Five weeks of runway; three weeks building features; two weeks on deploy infrastructure.

### Unknown Unknowns

- **`wrangler dev` is an emulator, not the Workers runtime.** It polyfills more Node.js APIs and has no CPU cap. Code passing local tests can fail on actual Workers. The only reliable test environment is a `--env staging` Workers deploy.
- **Workers Secrets are runtime-only — not available during Astro's build/prerender phase.** `wrangler secret put SUPABASE_URL` sets a runtime secret, but any SSG-prerendered Astro page that calls Supabase at build time reads from `[vars]` or `.env` — not Secrets. Mixing SSR and prerendered pages requires understanding which credentials are needed at build time vs request time.
- **The GitHub Actions token for `wrangler deploy` requires _Account > Workers Scripts > Edit_ scope** — not the generic "API Tokens > Edit" referenced in many community tutorials. Incorrect scope produces a cryptic `missing permissions` error without naming the specific scope.
- **Supabase JS client opens a fresh HTTPS connection per Workers invocation** (no connection pooling across V8 isolates). At low MVP load this is fine; at sustained concurrent load, TLS handshake overhead accumulates and can look like DB performance issues.

## Operational Story

- **Preview deploys**: Not automatic on Workers. Must configure a `[env.preview]` in `wrangler.toml` and deploy manually via `wrangler deploy --env preview`. Consider adding a GitHub Actions step on PR open/update. Preview Workers are accessible at `<worker-name>-preview.<account>.workers.dev`. No protection by default — add Cloudflare Access if needed.
- **Secrets**: Runtime secrets live in Workers Secrets, set via `wrangler secret put <KEY>`. Build-time env vars (needed for Astro SSG prerendering) live in `wrangler.toml [vars]` or GitHub Actions secrets passed as `--var` flags. Supabase `SUPABASE_URL` and `SUPABASE_ANON_KEY` go in Workers Secrets for runtime; if any page prerendered, add them as GitHub Actions secrets passed at build time. Rotation: `wrangler secret put <KEY>` followed by `wrangler deploy` to pick up the new value.
- **Rollback**: `wrangler rollback [<deployment-id>]` — reverts to the specified prior deployment (or the previous one if no ID given). Deployment IDs listed via `wrangler deployments list`. Time-to-revert: ~10–30 seconds. Data caveat: Supabase DB migrations do not roll back automatically; schema changes must be manually reverted if the rollback changes data expectations.
- **Approval**: Human-only actions — rotate Supabase primary service-role key, drop a Supabase table/database, modify DNS records, transfer project ownership, change Workers account-level API tokens. Agent-permitted unattended actions — `wrangler deploy` (redeploy), `wrangler rollback` (revert to prior Workers version), `wrangler tail` (read logs), `wrangler secret put` (update a specific secret by name), `wrangler deployments list` (query history).
- **Logs**: `wrangler tail` — streams live console logs and exceptions from the running Worker. Supports `--format json` for structured output, `--ip-address self` to filter by requester, and `--search <string>` to filter by message content. For Supabase query logs, use the Supabase dashboard (not accessible via Cloudflare CLI).

## Risk Register

| Risk                                                                                                           | Source           | Likelihood | Impact | Mitigation                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@astrojs/cloudflare` adapter dropped Pages support; CI pipeline written for Pages needs rewriting for Workers | Research finding | H          | M      | Rewrite GitHub Actions workflow to use `wrangler deploy` before first commit; test locally with `wrangler dev` and `--env staging` deploy                                  |
| Node.js API gaps cause runtime failures not caught by `wrangler dev` or build step                             | Devil's advocate | M          | H      | Audit Supabase JS client and Astro adapter for `fs`/`child_process`/`net` usage; run a `--env staging` Workers deploy as part of CI, not just `wrangler dev`               |
| CPU time ceiling (10–30ms free/paid) kills worker on slow Supabase auth on cold start                          | Devil's advocate | L          | M      | Use paid Unbound plan ($0.40/M req) if cold-start CPU spikes surface; profile Supabase client initialization; defer heavy imports to request time                          |
| Supabase credentials committed to `wrangler.toml [vars]` instead of Workers Secrets                            | Devil's advocate | M          | H      | Use `wrangler secret put` for all sensitive keys; set `[vars]` only for non-secret config; add `wrangler.toml` review to PR checklist                                      |
| PR preview deployments not automatic; blocks fast feedback loop on UI changes                                  | Devil's advocate | H          | L      | Add explicit `wrangler deploy --env preview` step to PR GitHub Actions workflow; accept the manual step as a known constraint                                              |
| `wrangler dev` emulator permits code that fails on actual Workers runtime                                      | Unknown unknowns | M          | M      | Run all CI test suites against a real `--env staging` Workers deploy, not just local `wrangler dev`                                                                        |
| Workers Secrets not available during Astro build/prerender phase                                               | Unknown unknowns | M          | M      | Audit which pages use prerendering (SSG) vs on-demand SSR; Supabase calls from prerendered pages need build-time env vars passed via GitHub Actions secrets + `--var` flag |
| GitHub Actions token scope mismatch causes cryptic `missing permissions` on `wrangler deploy`                  | Unknown unknowns | M          | L      | Create a scoped API token with exactly `Account > Workers Scripts > Edit` and document the required scopes in the deploy plan                                              |
| Supabase HTTPS connection-per-invocation overhead accumulates under sustained concurrent load                  | Unknown unknowns | L          | L      | Monitor p95 latency after first real traffic; if connection overhead is visible, add Supabase Pooler or Supabase edge functions to keep connections warm                   |

## Getting Started

1. **Install wrangler** (already likely present in the 10x-astro-starter, but verify version):

   ```bash
   npm install -g wrangler
   wrangler --version   # should be 3.x or 4.x
   ```

2. **Authenticate wrangler** with your Cloudflare account:

   ```bash
   wrangler login
   ```

   This opens a browser OAuth flow. After login, wrangler stores credentials in `~/.wrangler/config/default.toml`.

3. **Verify `wrangler.toml` targets Workers** (not Pages). The `@astrojs/cloudflare` adapter in Astro 6 requires Workers. Your `wrangler.toml` should have:

   ```toml
   name = "meridian-mind"
   main = "dist/_worker.js"          # Astro outputs the worker entrypoint here
   compatibility_date = "2025-01-01"
   compatibility_flags = ["nodejs_compat"]
   ```

   If you see `[site]` or `bucket = "./dist"` config, that's the Pages format — remove it and follow the [Astro Cloudflare adapter docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/).

4. **Add Supabase credentials as Workers Secrets** (not in `wrangler.toml`):

   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   ```

   These are prompted interactively. They are encrypted at rest and injected at request time only.

5. **First production deploy**:
   ```bash
   npm run build        # Astro build → dist/_worker.js
   wrangler deploy      # pushes dist/_worker.js to Cloudflare Workers
   ```
   Verify with `wrangler tail` to stream live logs from the deployed worker.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions workflow files)
- Production-scale architecture (multi-region, HA, DR)
- Supabase infrastructure decisions (already established in tech-stack.md)
