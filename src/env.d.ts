declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}

/**
 * Cloudflare Worker runtime bindings. SENTRY_DSN is read by the Sentry entry
 * point (sentry.server.config.ts); optional so an absent value = SDK no-op.
 */
interface Env {
  SENTRY_DSN?: string;
}
