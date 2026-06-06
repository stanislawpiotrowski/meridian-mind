import { describe, expect, it } from "vitest";

import { haversine, type LatLng } from "@/lib/geo";

/**
 * Oracle discipline (plan §"Critical Implementation Details"): distances are
 * asserted against INDEPENDENT published great-circle figures, never against a
 * value re-derived from the haversine formula. `haversine` uses a sphere
 * (R=6371) and rounds to whole km, so an external oracle (often ellipsoid-based)
 * differs by ~0.3% plus ±1 km of rounding. The band below absorbs exactly that
 * and no more — it catches a real bug (wrong formula, wrong radius, axis swap)
 * while tolerating the sphere-vs-ellipsoid gap.
 */
function expectNearKm(actual: number, oracleKm: number): void {
  const tolerance = Math.max(2, oracleKm * 0.005);
  expect(Math.abs(actual - oracleKm)).toBeLessThanOrEqual(tolerance);
}

// Coordinates: city centres, conventional decimal degrees ({ lat, lng }).
const LONDON: LatLng = { lat: 51.5074, lng: -0.1278 };
const PARIS: LatLng = { lat: 48.8566, lng: 2.3522 };
const NYC: LatLng = { lat: 40.7128, lng: -74.006 };
const LA: LatLng = { lat: 34.0522, lng: -118.2437 };

describe("haversine", () => {
  it("matches published great-circle distance for London–Paris", () => {
    // Published great-circle distance ≈ 344 km.
    expectNearKm(haversine(LONDON, PARIS), 344);
  });

  it("matches published great-circle distance for NYC–LA", () => {
    // Published great-circle distance ≈ 3936 km.
    expectNearKm(haversine(NYC, LA), 3936);
  });

  it("returns the SHORT arc across the antimeridian, not the long way around", () => {
    // ±179° lng at the equator are 2° apart → ~222 km the short way; the long
    // way around (358°) would be ~39,800 km. A seam bug takes the long path.
    const near180: LatLng = { lat: 0, lng: 179 };
    const past180: LatLng = { lat: 0, lng: -179 };
    const d = haversine(near180, past180);
    expect(d).toBeLessThan(500);
    expectNearKm(d, 222);
  });

  it("returns exactly 0 for an identical point", () => {
    expect(haversine(LONDON, LONDON)).toBe(0);
  });

  it("is symmetric: haversine(a, b) === haversine(b, a)", () => {
    expect(haversine(LONDON, PARIS)).toBe(haversine(PARIS, LONDON));
    expect(haversine(NYC, LA)).toBe(haversine(LA, NYC));
  });
});
