---
project: meridian-mind
deployed_at: 2026-05-25
platform: cloudflare-workers
worker_name: meridian-mind
worker_url: https://meridian-mind.stanislaw-piotrowski.workers.dev
deploy_trigger: workers-builds-on-push-to-master
status: live
---

# MeridianMind — Production Deploy Record

This file is the audit trail consumed by downstream milestone-planning skills as ground truth for "what's already deployed". Update it whenever the deployment configuration changes materially.

## Live environment

| Key             | Value                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Worker URL**  | `https://meridian-mind.stanislaw-piotrowski.workers.dev` _(replace `<account>` with your Cloudflare subdomain)_ |
| **Worker name** | `meridian-mind`                                                                                                 |
| **Platform**    | Cloudflare Workers (via `@astrojs/cloudflare` adapter)                                                          |
| **Runtime**     | Astro 6.3.1 SSR, `nodejs_compat` compatibility flag                                                             |
| **Deploy date** | 2026-05-25                                                                                                      |

## Deploy trigger

**Cloudflare Workers Builds** watches the GitHub repo `stanislawpiotrowski/meridian-mind`, branch `master`. Every push to `master` triggers an automatic build + deploy. No manual deploy step, no `CLOUDFLARE_API_TOKEN` stored in GitHub — deployment is owned entirely by Cloudflare's platform.

Build sequence:

```
npm ci → npm run build → npx wrangler deploy
```

Node version: `22` (set in Workers Builds build configuration).

## Environment variables

Both stores must be populated — Workers Builds keeps build-time and runtime env separate.

| Variable       | Build-time secrets | Runtime secrets |
| -------------- | :----------------: | :-------------: |
| `SUPABASE_URL` |         ✅         |       ✅        |
| `SUPABASE_KEY` |         ✅         |       ✅        |

> **Note:** `SUPABASE_KEY` is the `anon` public key. The `service_role` secret key is **not** deployed here — it bypasses Row Level Security and must never ship to a public-facing Worker.

## Supabase auth wiring

| Setting                     | Value                                                    |
| --------------------------- | -------------------------------------------------------- |
| **Site URL**                | `https://meridian-mind.stanislaw-piotrowski.workers.dev` |
| **Redirect URLs allowlist** | `https://meridian-mind.stanislaw-piotrowski.workers.dev` |
| **Email auth**              | Enabled                                                  |

## Who can deploy

Anyone with write access to `master` on `stanislawpiotrowski/meridian-mind` triggers a deploy automatically via the Cloudflare GitHub App. The App is scoped to this repository only (not full-account access).

## Rollback procedure

**Fast rollback (~10–30 s):**

```powershell
npx wrangler rollback
```

Reverts to the previous deployment instantly.

**Rollback to a specific past deployment:**

```powershell
npx wrangler deployments list          # find the deployment ID
npx wrangler rollback <deployment-id>
```

**Dashboard rollback:**
Cloudflare dashboard → Workers & Pages → `meridian-mind` → Deployments tab → click any past deployment → **Rollback to this deployment**.

> ⚠️ Supabase DB migrations do **not** roll back with the Worker. Schema changes must be reverted manually via the Supabase dashboard or `supabase db` CLI.

## Live log streaming

```powershell
npx wrangler tail
```

Streams real-time request logs from the production Worker. Watch for `1015` (CPU time exceeded on free tier) or unhandled exceptions on auth routes.

## Out of scope (MVP boundaries)

- Custom domain (Worker stays on `*.workers.dev`)
- PR preview deployments
- `CLOUDFLARE_API_TOKEN` in GitHub Actions
- Multi-region / HA
- Supabase edge functions or connection pooler
- Automated DB migrations to production
