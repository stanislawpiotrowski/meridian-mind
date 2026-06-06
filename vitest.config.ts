import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest config for the pure-library unit tests (test-plan §3 Phase 1).
 * Node environment — the tested libs (geo, study, mapProjection) are DOM-free.
 * The `@` alias mirrors tsconfig.json (`@/*` -> `./src/*`) so specs can import
 * `@/lib/...` exactly as production code does.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
