import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

// Minimal .env loader — Playwright doesn't read .env, and we don't pull in
// `dotenv` just for this. Loads E2E_USER_EMAIL / E2E_USER_PASSWORD (and the
// Supabase secrets the dev server needs) into process.env. Missing file is fine.
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env — rely on the ambient environment (e.g. CI secrets)
}

/**
 * Playwright E2E configuration for meridian-mind.
 *
 * Layering (test-plan.md §5): E2E is the slowest, most brittle layer — it runs
 * in CI, not per-edit. Locally we run a single spec against the dev server.
 *
 * Auth: we log in once (`auth.setup.ts`) and reuse the saved session via
 * `storageState`, so feature tests never depend on the login UI (test-plan.md
 * §7 excludes the auth mechanism itself from coverage).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Tests are independently runnable (own setup/data/cleanup, anti-pattern #3).
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Serialize locally: all tests share one dev-test account and one Astro dev
  // server. Under parallel workers, Vite re-optimizes deps on-demand when a second
  // worker loads a different island's dep graph (papaparse vs d3-geo), triggering
  // a server-wide reload that corrupts an in-flight test. Unique ids still protect
  // re-runs; CI against a production build (deps pre-bundled) could raise this.
  workers: 1,

  use: {
    baseURL: "http://localhost:4321",
    // Capture a trace on the first retry so failures are debuggable post-hoc.
    trace: "on-first-retry",
  },

  projects: [
    // 1. Logs in once and writes the session to playwright/.auth/user.json.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // 2. Feature tests start already authenticated.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  // Playwright starts the Astro dev server itself and reuses one already running.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
