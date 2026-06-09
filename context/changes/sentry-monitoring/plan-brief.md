# Sentry Error Monitoring — Plan Brief

> Full plan: `context/changes/sentry-monitoring/plan.md`

## What & Why

Add Sentry error monitoring (server-side, Cloudflare Workers) so silent/runtime
failures — the swallowed-error class from M3L5 — become visible in production.
This is the reactive safety net under the proactive test pipeline.

## Starting Point

No Sentry today. Stack matches the lesson exactly: Astro 6.3.1 +
`@astrojs/cloudflare` 13 on Workers, with `nodejs_compat` and `observability`
already enabled. Typed env + a "no-op when unconfigured" pattern already exist in
`src/lib/supabase.ts`, which this change mirrors.

## Desired End State

Builds and runs unchanged with no DSN (SDK no-op). With a DSN set, thrown errors
and `console.warn`/`console.error` appear as Sentry issues. The Sentry MCP server
lets the agent query those issues from the terminal.

## Key Decisions Made

| Decision       | Choice                                          | Why                                                                             | Source |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| Console levels | `warn` + `error`                                | Catches swallowed `console.warn` (the lesson's bug class); fine at course scale | Plan   |
| Scope          | Server-only (Workers)                           | Matches lesson scope; minimal setup                                             | Plan   |
| DSN wiring     | Worker `env` + `.dev.vars` / `wrangler secret`  | Deep Dive accesses `env.SENTRY_DSN`, not `astro:env`                            | Plan   |
| Verification   | Temporary `/api/debug/sentry-test`, then delete | Deterministic, deploy-independent                                               | Plan   |
| Sentry MCP     | Include (`.mcp.json`)                           | Completes the M3L5 diagnostic loop                                              | Plan   |

## Scope

**In scope:** SDK install, custom Worker entry point wrapping the Astro handler,
`wrangler` `main` swap, DSN wiring, real-event verification, Sentry MCP server.

**Out of scope:** client/browser instrumentation, performance tracing, replay,
releases, source-map upload, alerting/quota tuning.

## Architecture / Approach

Custom Worker entry `sentry.server.config.ts` wraps
`@astrojs/cloudflare/entrypoints/server` in `Sentry.withSentry((env) => ({ dsn,
integrations: [captureConsoleIntegration] }), handler)`; `wrangler.jsonc` `main`
points at it. DSN comes from the Worker `env`. Absent DSN → no-op.

## Phases at a Glance

| Phase               | What it delivers                                                  | Key risk                                                             |
| ------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Code config      | No-op-safe Sentry wiring that builds                              | Astro 6 + adapter 13 custom-entry path must export a working handler |
| 2. Account + verify | Real warn+error events confirmed in Sentry; test endpoint removed | DSN/account setup; remembering to delete the probe                   |
| 3. Sentry MCP       | Agent queries issues from terminal                                | MCP is pre-1.0; tool names may drift                                 |

**Prerequisites:** free Sentry account (guided in Phase 2); npm installs need
`NODE_OPTIONS=--use-system-ca` on this machine.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Astro 6 custom-entry support depends on `@sentry/astro` ≥ 10.44.0 (issue #19762) — pin a compatible version at install.
- Sentry MCP is pre-1.0; verify tool names against the repo before relying on them.
- warn+error share the 5000 events/month free quota — fine now, narrow later.

## Success Criteria (Summary)

- App builds and runs no-op without a DSN.
- With a DSN, a thrown error and a `console.warn` both show up in Sentry.
- The agent can `search_issues` via the Sentry MCP server.
