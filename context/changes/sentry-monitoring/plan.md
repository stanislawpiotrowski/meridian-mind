# Sentry Error Monitoring (Astro + Cloudflare Workers) Implementation Plan

## Overview

Add production error monitoring via Sentry so silent/runtime failures — the
swallowed-error class from M3L5 — become visible. Server-side only (the Astro
handler on Cloudflare Workers), with `captureConsoleIntegration` forwarding
`console.warn`/`console.error` as events. The SDK is a no-op when no DSN is set,
so local and dev runs are unaffected. Finally, wire the Sentry MCP server into
Claude Code so the agent can query issues from the terminal.

## Current State Analysis

- No Sentry anywhere (`git ls-files | grep sentry` → none).
- Stack matches the M3L5 lesson exactly: Astro `6.3.1`, `@astrojs/cloudflare`
  `^13.5.0`, `output: "server"`, deploy target Cloudflare **Workers**.
- `wrangler.jsonc` already sets `main: "@astrojs/cloudflare/entrypoints/server"`,
  `compatibility_flags: ["nodejs_compat"]`, and `observability.enabled: true`.
- Typed env is declared in `astro.config.mjs` via `astro:env` (`SUPABASE_URL`,
  `SUPABASE_KEY`, both `context: "server", access: "secret", optional: true`).
  `src/lib/supabase.ts` reads them from `astro:env/server` and returns `null`
  when unset — the established "no-op when unconfigured" pattern this plan mirrors.
- `.dev.vars` and `.env*` are already gitignored. No `.mcp.json` exists yet.

## Desired End State

- `npm run build` succeeds with the Sentry server entry point as the Worker `main`.
- With **no** `SENTRY_DSN`, the app behaves exactly as today (SDK no-op).
- With a `SENTRY_DSN` set (Cloudflare secret in prod, `.dev.vars` locally), a
  thrown error and a `console.warn` both appear as issues in the Sentry project.
- `.mcp.json` defines a Sentry MCP server; the agent can run `search_issues`
  against the project.

### Key Discoveries:

- Astro 6 + `@astrojs/cloudflare` 13 needs a **custom Worker entry point** that
  wraps the adapter's default handler in `Sentry.withSentry(...)`; `wrangler`'s
  `main` points at that file instead of the adapter default (M3L5 Deep Dive,
  Sentry issue #19762).
- `Sentry.withSentry((env) => ({...}), handler)` receives the Workers runtime
  `env` — so `SENTRY_DSN` is a Worker binding/secret, not an `astro:env` field.
- Empty/absent DSN → SDK initializes in no-op mode (events captured, not sent),
  which is what keeps local/dev clean.

## What We're NOT Doing

- No client-side (browser) instrumentation — server/Workers only.
- No performance tracing, session replay, releases, or source-map upload.
- No alerting rules / quota tuning (noted as post-MVP in Migration Notes).
- Not changing the existing `signout` fix or any business logic.

## Implementation Approach

Mirror the lesson's Deep Dive: install the two SDK packages, add a custom Worker
entry point that wraps the Astro handler, repoint `wrangler.jsonc` `main`, and
read `SENTRY_DSN` from the Worker `env`. Keep everything no-op-safe so the build
and local dev never depend on a DSN. Verify with a throwaway endpoint, then
remove it. Add the MCP server last, as an independent tooling step.

## Critical Implementation Details

- **Entry-point swap is load-bearing**: once `wrangler.jsonc` `main` points at
  `sentry.server.config.ts`, that file MUST re-export a working handler wrapping
  `@astrojs/cloudflare/entrypoints/server`, or every request breaks. Verify the
  build output and a local `wrangler dev`/`astro build` before moving on.
- **DSN lives in the Worker `env`, not `astro:env`**: set it via `.dev.vars`
  (`SENTRY_DSN=...`) locally and `wrangler secret put SENTRY_DSN` in prod. Do not
  add it to the `astro.config.mjs` env schema.

## Phase 1: Code configuration (no-op safe)

### Overview

Install the SDK, add the Sentry Worker entry point, repoint `main`, and document
the DSN var. Everything must build and run no-op without a DSN.

### Changes Required:

#### 1. SDK dependencies

**File**: `package.json`

**Intent**: Add the two packages the lesson specifies for Astro-on-Cloudflare
server monitoring.

**Contract**: `@sentry/astro` and `@sentry/cloudflare` as dependencies
(versions supporting the Astro 6 custom-entry path — `@sentry/astro` ≥ 10.44.0
per issue #19762). Install with `NODE_OPTIONS=--use-system-ca` (repo memory: npm
fails `UNABLE_TO_VERIFY_LEAF_SIGNATURE` otherwise).

#### 2. Sentry Worker entry point

**File**: `sentry.server.config.ts` (new, repo root)

**Intent**: Wrap the Cloudflare adapter's default server handler in Sentry so all
Worker requests are instrumented; forward console warn/error as events.

**Contract**: Default-exports `Sentry.withSentry((env) => ({ dsn: env.SENTRY_DSN, integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })] }), handler)` where `handler` is the default import from `@astrojs/cloudflare/entrypoints/server`. Empty/absent `env.SENTRY_DSN` → no-op.

```typescript
import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);
```

#### 3. Repoint the Worker entry

**File**: `wrangler.jsonc`

**Intent**: Make the Sentry-wrapped file the Worker entry instead of the adapter
default.

**Contract**: `main` changes from `"@astrojs/cloudflare/entrypoints/server"` to
`"./sentry.server.config.ts"`. No other keys change.

#### 4. Worker env typing for SENTRY_DSN

**File**: `src/env.d.ts` (or a `worker-configuration.d.ts` if generated)

**Intent**: Type `env.SENTRY_DSN` so `sentry.server.config.ts` type-checks.

**Contract**: Declare an `Env` interface member `SENTRY_DSN?: string` visible to
the entry point. If `wrangler types` generates `Env`, prefer that; otherwise add
a minimal ambient declaration.

#### 5. Local DSN documentation

**File**: `.dev.vars.example` (new)

**Intent**: Show contributors which var to set locally without committing a
secret (`.dev.vars` is already gitignored).

**Contract**: One line — `SENTRY_DSN=` with a comment that an empty value = no-op.

### Success Criteria:

#### Automated Verification:

- [ ] Dependencies install: `NODE_OPTIONS=--use-system-ca npm install`
- [ ] Build passes with no DSN set: `npm run build`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes on changed files: `npx eslint sentry.server.config.ts`

#### Manual Verification:

- [ ] App runs locally with no DSN and behaves exactly as before (no Sentry calls, no errors in console)

**Implementation Note**: Pause for manual confirmation after automated checks pass before Phase 2.

---

## Phase 2: Sentry account + real-event verification

### Overview

Create the free Sentry project, obtain the DSN, and prove that both a thrown
error and a `console.warn` reach Sentry — then remove the test harness.

### Changes Required:

#### 1. Sentry account + DSN (guided manual step)

**File**: (none — external)

**Intent**: Stand up the free Developer-plan project and get its DSN.

**Contract**: A working DSN, set locally in `.dev.vars` (`SENTRY_DSN=...`) and in
prod via `wrangler secret put SENTRY_DSN`. Walk the user through signup → create
project (platform: Cloudflare/JavaScript) → copy DSN.

#### 2. Temporary verification endpoint

**File**: `src/pages/api/debug/sentry-test.ts` (new, REMOVED at end of phase)

**Intent**: Deterministically emit one captured `console.warn` and one thrown
error so we can confirm the full path to Sentry.

**Contract**: A `GET` handler that calls `console.warn("sentry-test: warn")` and
then throws an `Error("sentry-test: thrown")`. No auth guard needed (throwaway).

### Success Criteria:

#### Automated Verification:

- [ ] Build still passes: `npm run build`

#### Manual Verification:

- [ ] With DSN set, hitting `/api/debug/sentry-test` produces a `console.warn` issue AND a thrown-error issue in the Sentry dashboard
- [ ] The temporary endpoint file is deleted after verification (`git status` shows no `src/pages/api/debug/` left)

**Implementation Note**: Pause for manual confirmation (the user must see the events in Sentry) before Phase 3.

---

## Phase 3: Sentry MCP server in Claude Code

### Overview

Let the agent query Sentry issues from the terminal, completing the M3L5
diagnostic loop.

### Changes Required:

#### 1. MCP server definition

**File**: `.mcp.json` (new, repo root)

**Intent**: Register `@sentry/mcp-server` so Claude Code can call `search_issues`
/ `get_sentry_resource`.

**Contract**: An `mcpServers.sentry` entry running
`npx @sentry/mcp-server@latest` with the access token supplied via env/arg. The
token is a secret — reference it from the environment, do not hardcode it in a
committed file. (Pre-1.0: confirm tool names against the getsentry/sentry-mcp
repo before relying on them.)

### Success Criteria:

#### Automated Verification:

- [ ] `.mcp.json` is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8'))"`

#### Manual Verification:

- [ ] After restarting Claude Code, the Sentry MCP server connects and a `search_issues` query returns the project's issues (e.g. the `sentry-test` events from Phase 2)

**Implementation Note**: Final phase — confirm MCP connectivity with the user.

---

## Testing Strategy

### Unit Tests:

- None warranted — this is configuration/wiring, not business logic. The no-op
  behavior is covered by the build-with-no-DSN check.

### Integration Tests:

- The temporary `/api/debug/sentry-test` endpoint (Phase 2) is the integration
  probe for the full app→Sentry path.

### Manual Testing Steps:

1. Build with no DSN → app works, no Sentry traffic.
2. Set DSN, hit the test endpoint → warn + error appear in Sentry.
3. Restart Claude Code → MCP `search_issues` returns those issues.

## Performance Considerations

`captureConsoleIntegration` adds negligible per-request overhead. The real cost
is quota: warn+error share the free plan's 5000 events/month. Fine at course
scale; see Migration Notes for scaling.

## Migration Notes

- As traffic grows, narrow `levels` to `["error"]` or switch to explicit
  `Sentry.captureException` for chosen cases to avoid burning quota on warnings
  (M3L5 Deep Dive).
- Source-map upload / releases via `sentry-cli` are a later concern, out of scope.

## References

- Lesson: `context/sp_temp/m3l5_debugowanie-z-ai-od-stack-trace.md` (Deep Dive)
- Sentry Astro+Cloudflare guide: https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/
- Sentry MCP: https://github.com/getsentry/sentry-mcp
- No-op-when-unconfigured pattern: `src/lib/supabase.ts:7`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Code configuration (no-op safe)

#### Automated

- [x] 1.1 Dependencies install: `NODE_OPTIONS=--use-system-ca npm install`
- [x] 1.2 Build passes with no DSN set: `npm run build`
- [x] 1.3 Type checking passes: `npm run typecheck`
- [x] 1.4 Linting passes on changed files: `npx eslint sentry.server.config.ts`

#### Manual

- [x] 1.5 App runs locally with no DSN and behaves exactly as before

### Phase 2: Sentry account + real-event verification

#### Automated

- [ ] 2.1 Build still passes: `npm run build`

#### Manual

- [ ] 2.2 With DSN set, `/api/debug/sentry-test` produces a warn issue AND an error issue in Sentry
- [ ] 2.3 The temporary endpoint file is deleted after verification

### Phase 3: Sentry MCP server in Claude Code

#### Automated

- [ ] 3.1 `.mcp.json` is valid JSON

#### Manual

- [ ] 3.2 Sentry MCP server connects and `search_issues` returns the project's issues
