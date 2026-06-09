---
change_id: sentry-monitoring
title: Add Sentry error monitoring (Astro + Cloudflare Workers)
status: implementing
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

M3L5 practical task 2: configure production monitoring so swallowed/runtime
errors are visible. Stack matches the lesson exactly — Astro 6.3.1 +
@astrojs/cloudflare 13.x on Workers. Approach from the lesson Deep Dive: custom
wrangler entry point wrapping the Astro handler in `Sentry.withSentry(...)` with
`captureConsoleIntegration`, no-op when DSN is absent so local/dev is unaffected.
