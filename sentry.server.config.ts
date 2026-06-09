import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

/**
 * Custom Cloudflare Worker entry point (referenced as `main` in wrangler.jsonc).
 * Wraps the Astro adapter's default handler in Sentry so every Worker request is
 * instrumented. `captureConsoleIntegration` forwards console.warn/error as Sentry
 * events — this is what makes a swallowed `console.warn` (M3L5) visible in prod.
 *
 * No-op when SENTRY_DSN is absent (empty string): the SDK initializes but sends
 * nothing, so local/dev runs are unaffected — mirroring the createClient() pattern
 * in src/lib/supabase.ts. DSN comes from the Worker `env` (.dev.vars locally,
 * `wrangler secret put SENTRY_DSN` in prod), not from astro:env.
 */
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);
