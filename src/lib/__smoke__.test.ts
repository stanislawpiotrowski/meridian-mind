import { describe, expect, test } from "vitest";
import { haversine } from "@/lib/geo";

/**
 * Temporary smoke spec (test-plan §3 Phase 1). Proves Vitest discovers
 * co-located `*.test.ts` files and that the `@/` alias resolves. Removed in
 * Phase 2 once real specs exist.
 */
describe("runner smoke", () => {
  test("runner executes and reports green", () => {
    expect(true).toBe(true);
  });

  test("@/ alias resolves a lib import", () => {
    expect(typeof haversine).toBe("function");
  });
});
