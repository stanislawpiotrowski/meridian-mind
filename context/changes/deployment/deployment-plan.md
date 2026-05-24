# Cloudflare Workers Deployment — MeridianMind

## Context

`context/foundation/infrastructure.md` recommends Cloudflare Workers for MVP deploy. The project is already wired correctly: Astro 6.3.1, `@astrojs/cloudflare` v13.5.0, `wrangler` v4.90.0, `wrangler.jsonc` configured for Workers with `nodejs_compat`, Supabase SSR client reading from `astro:env/server`. **What's missing**: the project isn't connected to a Cloudflare account, no production Supabase project is wired in, and no deployment has happened.

The deployment path will use **Cloudflare's native Git integration (Workers Builds)** — Cloudflare watches the GitHub repo, builds on push to `master`, and deploys to Workers automatically. The agent does NOT touch production credentials; no `CLOUDFLARE_API_TOKEN` is created or stored in GitHub. The existing `.github/workflows/ci.yml` stays as a quality gate (lint + build) only — deployment is owned by Cloudflare's platform.

This plan covers a first production deploy and the operational gates around it. Each phase is tracked with checkboxes you can tick as you go.

---

## Phases

### Phase 1 — Prerequisites (human gates)

These cannot be automated. Work through each subsection in order; the end state should be: a working Cloudflare CLI on your machine, a live Supabase production project, and credentials in your password manager ready to paste into the Cloudflare dashboard in Phase 4.

#### 1.1 Cloudflare account + CLI configuration

- [x] **Create a Cloudflare account** if you don't have one — sign up at `https://dash.cloudflare.com/sign-up`. Free tier is sufficient for MVP (100k requests/day, no credit card required). Verify the email Cloudflare sends before continuing.
- [x] **Verify `wrangler` is installed** — it's already a devDependency at v4.90.0 (`package.json` line 55), so a fresh `npm install` in this repo gives you `npx wrangler` out of the box. Confirm with:

  ```powershell
  npx wrangler --version
  ```

  Expected: prints `4.90.0` (or newer). A global install (`npm install -g wrangler`) is unnecessary — `npx wrangler` uses the repo-pinned version and avoids version skew.

- [x] **Log into Cloudflare** via the OAuth browser flow:

  ```powershell
  npx wrangler login
  ```

  Opens your default browser, walks you through a permissions consent screen, and stores an OAuth token at `~/.wrangler/config/default.toml` (Windows: `C:\Users\<you>\.wrangler\config\default.toml`). If you have multiple Cloudflare accounts (personal vs work), Cloudflare prompts you to pick one — choose the one that will own the `meridian-mind` Worker.

- [x] **Verify authentication**:

  ```powershell
  npx wrangler whoami
  ```

  Expected: your account email + account ID + a list of accessible accounts. Note the **Account ID** — useful when troubleshooting deploy errors or filing Cloudflare support tickets.

- [x] **If you logged into the wrong account**, run `npx wrangler logout` and repeat the login step. Wrangler does not support multiple simultaneous sessions on one machine.

#### 1.2 Supabase production project

- [x] **Create a Supabase account** at `https://supabase.com/dashboard/sign-up` (GitHub OAuth or email). Free tier covers ~500MB DB + 50k monthly active users — plenty for MVP.
- [x] **Create a new project**: Dashboard → **New project**. Fill in:
  - **Name**: `meridian-mind` (or `meridian-mind-prod` if you anticipate a separate staging project later)
  - **Database password**: generate a strong one and **save it to your password manager immediately** — Supabase does NOT show it again. You'll need it for future `npx supabase db push` migrations. The DB password is separate from the API keys; losing it requires a dashboard reset.
  - **Region**: pick the one closest to your expected users — e.g. `eu-central-1` (Frankfurt) for European users, `us-east-1` (N. Virginia) for US East. Cloudflare Workers run globally, so the Supabase region becomes your latency floor for any DB-backed request.
  - **Pricing plan**: Free is fine for MVP.
- [x] **Wait ~2 minutes** for the project to provision (spinner in the dashboard; switches to project view once ready).
- [x] **Locate the production credentials**: navigate to **Project Settings → API**:
  - **`SUPABASE_URL`**: copy the value labeled **Project URL** — looks like `https://<random-ref>.supabase.co`
  - **`SUPABASE_KEY`**: under **Project API Keys**, copy the **`anon` `public`** key (a long JWT starting with `eyJ...`). **DO NOT** copy the `service_role` `secret` key — that key bypasses Row Level Security and must never be deployed to a public-facing Worker (see Edge Case 8).
- [x] **Save both values to your password manager** (or a temporary secure note) — you'll paste them into the Cloudflare dashboard in Phase 4, and again into Supabase auth callbacks in Phase 5. They are not git-secret in the cryptographic sense (the anon key is designed to ship to browsers), but treat them as deployment configuration that does not live in the repo.
- [x] **Verify email auth is enabled**: Supabase dashboard → **Authentication → Providers → Email** should show enabled (it is by default in fresh projects). The `src/pages/api/auth/signup.ts` route requires email auth to be active.
- [x] **Set the Site URL placeholder** to a non-empty value so Supabase doesn't fall back to `http://localhost:3000` on first deploy. You can put `https://meridian-mind.workers.dev` for now — Phase 5 will overwrite this with the actual deployed URL once Phase 4 reveals your Workers subdomain.

#### 1.3 GitHub repository accessibility

- [x] **Push the `meridian-mind` repo** to GitHub (public or private both work; private requires authorizing the Cloudflare GitHub App in Phase 4).
- [x] **Verify the default branch is `master`** — `git branch --show-current` should print `master`. Workers Builds will watch this branch by default in Phase 4.
- [x] **Confirm the latest commit on `master` is what you want to deploy first** — `git log -1 --oneline`. Workers Builds triggers on push, so whatever's on `master` when you finish Phase 4 will be the first build.

### Phase 2 — Local repo prep (agent work)

Small config alignments so Cloudflare's project metadata matches the repo's.

- [ ] Update `wrangler.jsonc` line 3: `"name": "10x-astro-starter"` → `"name": "meridian-mind"` (must match the Cloudflare Worker name created in Phase 4 — otherwise `wrangler tail` / `wrangler rollback` won't find the project)
- [ ] Update `context/foundation/tech-stack.md` frontmatter: `deployment_target: cloudflare-pages` → `deployment_target: cloudflare-workers` (per user decision; brings the upstream contract in line with the adapter reality and `infrastructure.md`)
- [ ] Commit both changes with message `chore: align project name with cloudflare workers target` and push to `master` so the renamed worker is what Cloudflare picks up

### Phase 3 — Optional: local sanity check with `wrangler dev`

CLI login is already done in Phase 1.1. This phase is an OPTIONAL smoke test — boot the Worker locally before connecting Cloudflare's Git integration. Phase 6 verifies the same things against the real production environment (more reliable), so you can skip this and go straight to Phase 4 if you prefer.

- [ ] Create a local `.env` file at the repo root with your Supabase credentials from Phase 1.2:

  ```
  SUPABASE_URL=https://<your-ref>.supabase.co
  SUPABASE_KEY=eyJ...
  ```

  This file is git-ignored (verify with `git status` — it should not appear as untracked). Astro's `astro:env/server` reads it during local dev only.

- [ ] Build and boot:

  ```powershell
  npm run build
  npx wrangler dev
  ```

  Opens the worker locally on `http://localhost:8787`. Test signup/signin to confirm the Supabase wiring works end-to-end against your production Supabase project.

- [ ] **Caveat**: `wrangler dev` is an _emulator_. It polyfills more Node.js APIs than the real Workers runtime and has no CPU cap. Code passing here can still fail on actual Workers (see Edge Case 5). Treat this as a smoke test, not a guarantee.

### Phase 4 — Connect repo to Workers Builds (Cloudflare dashboard)

This is a one-time human setup in the Cloudflare dashboard.

- [ ] Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**
- [ ] Authorize Cloudflare's GitHub App on your account/org; grant access to the `meridian-mind` repo only (not full-account)
- [ ] Select repo `meridian-mind`, branch `master`
- [ ] **Worker name**: enter exactly `meridian-mind` (MUST match `wrangler.jsonc` `name` set in Phase 2)
- [ ] **Build configuration**:
  - Build command: `npm run build`
  - Deploy command: `npx wrangler deploy` (default — leave as-is)
  - Root directory: `/` (default)
  - Node version: `22` (matches `.github/workflows/ci.yml` line 17)
- [ ] **Build variables and secrets** (Settings → Build → Build variables and secrets) — needed at _build time_ because `astro:env/server` validates the schema during `astro build`:
  - Add `SUPABASE_URL` — type: **Secret** (encrypted)
  - Add `SUPABASE_KEY` — type: **Secret** (encrypted)
- [ ] **Runtime variables and secrets** (Settings → Variables and Secrets) — needed at _request time_ for SSR pages calling Supabase:
  - Add `SUPABASE_URL` — type: **Secret**
  - Add `SUPABASE_KEY` — type: **Secret**
  - These are duplicates of the build vars by design — Workers Builds keeps the two phases separated; setting only one half causes silent failure (see Edge Cases)

### Phase 5 — Wire Supabase auth callbacks (Supabase dashboard)

After Phase 4 the Worker is reachable at `https://meridian-mind.<account>.workers.dev`. Supabase needs to know about this URL or every auth flow (signup confirmation email, password reset link) will redirect to a localhost or default URL and fail.

- [ ] Supabase dashboard → **Authentication** → **URL Configuration**
- [ ] Set **Site URL** to `https://meridian-mind.<account>.workers.dev` (replace `<account>` with your Workers subdomain — visible in Cloudflare dashboard after Phase 4)
- [ ] Add the same URL to **Redirect URLs** (allowlist)
- [ ] If you plan to use a custom domain later (out of scope for MVP), add it here at the same time

### Phase 6 — First production deploy + verification

- [ ] Trigger first build — either push any commit to `master`, or in Cloudflare dashboard → your Worker → **Deployments** tab → **Retry deployment** / **Deploy now**
- [ ] Watch the build log in Cloudflare dashboard (Deployments tab → click the running build); expect `npm ci` → `npm run build` → `wrangler deploy` → green checkmark
- [ ] Visit `https://meridian-mind.<account>.workers.dev` — landing page should render (SSR)
- [ ] Test the signup flow at `/signup` (route exists at `src/pages/api/auth/signup.ts`); a confirmation email should appear in your Supabase inbox
- [ ] Click the confirmation link; should land back on the deployed worker (not localhost) — proves Phase 5 wired up correctly
- [ ] Test the signin flow at `/signin` and verify session cookie is set
- [ ] In a separate terminal, run `npx wrangler tail` — live-stream logs from the production worker; confirm no `1015` (CPU exceeded) errors or unhandled exceptions on the auth flow

### Phase 7 — Persist deploy artifact (agent work)

The Module 1 Lesson 5 contract says the approved deploy plan lives at `context/deployment/deploy-plan.md`. Milestone-planning skills downstream consume this as ground truth for "what's already deployed".

- [ ] Create `context/deployment/` directory
- [ ] Write `context/deployment/deploy-plan.md` capturing: deployed worker URL, build/runtime env vars configured, deploy trigger (Workers Builds on push to `master`), rollback command, who can deploy (anyone with master commit access via Cloudflare's GitHub App)

---

## Critical files to modify

| File                                           | Change                                                       | Phase   |
| ---------------------------------------------- | ------------------------------------------------------------ | ------- |
| `wrangler.jsonc` line 3                        | `name` field: `10x-astro-starter` → `meridian-mind`          | Phase 2 |
| `context/foundation/tech-stack.md` frontmatter | `deployment_target: cloudflare-pages` → `cloudflare-workers` | Phase 2 |
| `context/deployment/deploy-plan.md`            | New file — deploy artifact for downstream consumption        | Phase 7 |

No code changes. `astro.config.mjs`, `src/lib/supabase.ts`, `src/middleware.ts`, the auth API routes, and `wrangler.jsonc` (other than `name`) are already correct for Workers.

**Explicitly NOT touched:**

- `.github/workflows/ci.yml` — stays as quality gate (lint + build on PR + push). No deploy step added. No `CLOUDFLARE_API_TOKEN` GitHub secret created.
- `package.json` scripts — no `deploy` script needed; Workers Builds invokes `npx wrangler deploy` directly.
- `supabase/config.toml` — local dev config only; unrelated to prod.

---

## Edge cases & extra support

The following are pre-known traps surfaced in `infrastructure.md` (Devil's Advocate, Pre-mortem, Unknown Unknowns sections). Each has a concrete mitigation built into the phases above; this section explains the _why_ so you can recognize the symptom if it surfaces:

1. **Build vars and runtime vars are two separate stores** (`Settings > Build` vs `Settings > Variables and Secrets`). Setting only one silently breaks. Symptom: build succeeds but `createClient(...)` returns `null` at runtime (because `src/lib/supabase.ts` lines 7-9 guard on `!SUPABASE_URL || !SUPABASE_KEY` and return `null`) — auth routes return 500 with no obvious cause. **Mitigation: Phase 4 sets both.**

2. **`astro:env/server` `optional: true` means silent failure** (`astro.config.mjs` lines 18-22). Missing creds at runtime won't throw — Supabase calls just return null clients. **Mitigation: Phase 6 explicitly tests signup/signin end-to-end, not just that the page renders.**

3. **Supabase auth redirects break without Phase 5.** Symptom: signup works, confirmation email arrives, but clicking the link lands on `http://localhost:3000` or `https://<default>.supabase.co` instead of your worker — user appears stuck in unconfirmed state. **Mitigation: Phase 5 is mandatory; do not skip even though signup _appears_ to succeed without it.**

4. **CPU time cap = 10ms on the free tier.** Heavy work at module load (e.g. eager Supabase client init) can blow the cap on the first cold request and return a cryptic `Error 1015`. The current `src/lib/supabase.ts` already does the right thing — `createClient` is called per-request, not at module top-level. **Don't refactor it to a module-level singleton.** If 1015s appear under real traffic, the fix is either lazy init of any new heavy imports or upgrading to the paid Standard plan ($5/mo, 30ms cap).

5. **`wrangler dev` is an emulator, not the runtime.** Code passing local tests can fail on actual Workers (more permissive Node.js polyfills, no CPU cap locally). **Mitigation: Phase 6 verifies on the actual deployed URL, not via local `wrangler dev`. Treat the first deploy as the integration test.**

6. **Worker name must match `wrangler.jsonc`.** If you name the Cloudflare project `meridianmind` (no dash) but `wrangler.jsonc` says `meridian-mind`, then `wrangler tail` / `wrangler rollback` will print `worker not found` even though the worker exists in the dashboard. **Mitigation: Phase 2 sets the name, Phase 4 reuses the exact same string.**

7. **Cloudflare GitHub App scope.** When authorizing in Phase 4, grant access to _only_ the `meridian-mind` repo — not "all repositories on your account". This limits blast radius if the Cloudflare integration is ever compromised.

8. **Anon key vs service-role key.** Phase 1 specifies the `anon` key. The `service_role` key bypasses Row Level Security and must never be deployed to a Worker that serves end users. If the wrong key gets used, Supabase's RLS policies become useless and the database is effectively open.

9. **Custom domain.** Out of scope for this plan. By default the worker is at `https://meridian-mind.<account>.workers.dev`. Custom domain requires the domain to be on Cloudflare DNS first; can be added later via Cloudflare dashboard → Worker → Settings → Triggers → Add Custom Domain.

10. **Rollback procedure.** Two paths: (a) `npx wrangler rollback` reverts to the previous deployment in ~10-30s; `npx wrangler rollback <deployment-id>` reverts to a specific past deployment (IDs via `npx wrangler deployments list`); (b) Cloudflare dashboard → Worker → Deployments tab → click any past deployment → **Rollback to this deployment**. **Supabase DB migrations do NOT roll back with the worker** — schema changes must be reverted manually via the Supabase dashboard.

---

## Verification

End-to-end smoke test that the deploy is healthy:

1. **HTTP reachability**: `curl -I https://meridian-mind.<account>.workers.dev` returns `200 OK` (or `302` on the landing page if there's a redirect).
2. **SSR rendering**: View source of the landing page in a browser — should see server-rendered HTML, not just a hydration shell.
3. **Supabase reachability**: From the browser, visit `/signup`, enter a fresh email. Check the Supabase dashboard → Authentication → Users — a new unconfirmed user should appear within seconds.
4. **Auth callback round-trip**: Open the confirmation email (Supabase Inbucket in local dev, or the real email in prod), click the link, land back on the deployed worker URL (not localhost).
5. **Live logs healthy**: `npx wrangler tail` running for ~60 seconds during the test flow shows the expected request lines for `/signup`, `/api/auth/signup`, `/dashboard` etc., with no exceptions or `1015` errors.
6. **Rollback works**: As a one-time drill, `npx wrangler deployments list` → pick the previous deployment → `npx wrangler rollback <id>` → re-curl the URL → confirm previous version served. Then roll forward by re-deploying or `wrangler rollback` again with the latest ID.

If all six pass, mark Phase 6 complete and proceed to Phase 7.

---

## Out of scope

Per `infrastructure.md` and the user's stated decisions, the following are NOT addressed:

- GitHub Actions deploy step (deploy is owned by Workers Builds, not GH Actions)
- `CLOUDFLARE_API_TOKEN` GitHub secret (not needed — no CI deploy path)
- PR preview deployments via `[env.preview]` in `wrangler.jsonc` (Workers Builds will auto-create preview versions on non-master branch pushes via `wrangler versions upload`, but no explicit preview URL routing is configured)
- Custom domain (worker stays on `*.workers.dev` for MVP)
- Multi-region / HA / DR
- Supabase pooler / edge functions for connection warming
- Docker / CI/CD beyond the existing quality gate
- Supabase database migrations to production (separate concern, run via `npx supabase db push` outside this plan)
