import { describe, expect, it } from "vitest";

import { DEFAULT_CORRECT_THRESHOLD_KM, isCorrect } from "@/lib/study";

/**
 * Oracle discipline (plan §"Critical Implementation Details"): the boundary
 * oracle is the FR-012 SPEC value (literal 300, inclusive), NOT the imported
 * constant. Lifting the threshold from the code would make the test pass for any
 * value the code happens to hold; pinning the literal makes the test fail if the
 * spec constant ever drifts.
 */
describe("isCorrect", () => {
  it("treats the 300 km boundary as inclusive (FR-012)", () => {
    // Spec: a guess within 300 km (inclusive) is correct.
    expect(isCorrect(299)).toBe(true);
    expect(isCorrect(300)).toBe(true); // inclusive <= boundary
    expect(isCorrect(301)).toBe(false);
  });

  it("honours a custom thresholdKm parameter", () => {
    expect(isCorrect(100, 100)).toBe(true); // inclusive at the custom boundary
    expect(isCorrect(101, 100)).toBe(false);
    expect(isCorrect(150, 200)).toBe(true);
  });

  it("defaults the threshold to the FR-012 spec value of 300", () => {
    expect(DEFAULT_CORRECT_THRESHOLD_KM).toBe(300);
  });
});
