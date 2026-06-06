import { describe, expect, it } from "vitest";

import type { LatLng } from "@/lib/geo";
import { boundingBox, DEFAULT_CORRECT_THRESHOLD_KM, isCorrect } from "@/lib/study";

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

describe("boundingBox", () => {
  it("encloses all points with PER-AXIS padding (not a shared pad)", () => {
    const points: LatLng[] = [
      { lat: 40, lng: -10 },
      { lat: 50, lng: 10 },
      { lat: 45, lng: 0 },
    ];
    // west=-10 east=10 (span 20) → lngPad=20*0.15=3; south=40 north=50 (span 10)
    // → latPad=10*0.15=1.5. The two pads differ — the box proves padding is
    // computed per-axis, not from a single shared span.
    const [[west, south], [east, north]] = boundingBox(points);
    expect(west).toBeCloseTo(-13, 10);
    expect(east).toBeCloseTo(13, 10);
    expect(south).toBeCloseTo(38.5, 10);
    expect(north).toBeCloseTo(51.5, 10);
    // Every input point falls strictly inside the padded box.
    for (const p of points) {
      expect(p.lng).toBeGreaterThanOrEqual(west);
      expect(p.lng).toBeLessThanOrEqual(east);
      expect(p.lat).toBeGreaterThanOrEqual(south);
      expect(p.lat).toBeLessThanOrEqual(north);
    }
  });

  it("expands a single (zero-span) point by the 0.5 floor", () => {
    const [[west, south], [east, north]] = boundingBox([{ lat: 45, lng: 10 }]);
    expect(west).toBeCloseTo(9.5, 10);
    expect(east).toBeCloseTo(10.5, 10);
    expect(south).toBeCloseTo(44.5, 10);
    expect(north).toBeCloseTo(45.5, 10);
  });

  it("expands all-coincident points by the 0.5 floor", () => {
    const coincident: LatLng[] = [
      { lat: 20, lng: -30 },
      { lat: 20, lng: -30 },
    ];
    const [[west, south], [east, north]] = boundingBox(coincident);
    expect(west).toBeCloseTo(-30.5, 10);
    expect(east).toBeCloseTo(-29.5, 10);
    expect(south).toBeCloseTo(19.5, 10);
    expect(north).toBeCloseTo(20.5, 10);
  });

  it("falls back to the world view for an empty array", () => {
    expect(boundingBox([])).toEqual([
      [-180, -85],
      [180, 85],
    ]);
  });
});
