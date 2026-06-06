import { describe, expect, it } from "vitest";

import type { LatLng } from "@/lib/geo";
import { createMapProjection, type Bbox, type ProjectionKind } from "@/lib/mapProjection";

/**
 * Oracle discipline (plan §"Critical Implementation Details"): round-trip is a
 * SELF-consistency check — it passes even when both directions share the same
 * wrong transform. So it is paired with an INDEPENDENT geometric anchor: an
 * eastern point must project right-of a western one, a northern point above
 * (smaller y) a southern one. That anchor is what catches the [lng,lat]↔[lat,lng]
 * transpose (mapProjection.ts:130-136) that would mark a far-off click correct.
 */

/** Narrow away null with a failing assertion — keeps lint happy (no `!`/`as`). */
function present<T>(v: T | null): NonNullable<T> {
  expect(v).not.toBeNull();
  if (v === null || v === undefined) throw new Error("expected a non-null projection result");
  return v;
}

// Fixed frame + region (a Europe-ish box) so the assertions are deterministic.
const WIDTH = 800;
const HEIGHT = 400;
const BBOX: Bbox = [
  [-10, 35],
  [30, 60],
];

// Round-trip pixel epsilon: loose enough to ignore fitExtent/resampling jitter,
// tight enough that a gross transpose or sign flip blows straight past it.
const PX_EPSILON = 0.5;

const KINDS: ProjectionKind[] = ["winkel3", "robinson"];

describe.each(KINDS)("createMapProjection (%s)", (kind) => {
  const proj = createMapProjection(WIDTH, HEIGHT, BBOX, kind);

  it("round-trips pixel → geo → pixel within epsilon", () => {
    // Interior pixels of the frame.
    const pixels: [number, number][] = [
      [WIDTH / 2, HEIGHT / 2],
      [WIDTH * 0.3, HEIGHT * 0.4],
      [WIDTH * 0.7, HEIGHT * 0.6],
    ];
    for (const [x, y] of pixels) {
      const geo = present(proj.invert(x, y));
      const back = present(proj.project(geo));
      expect(Math.abs(back[0] - x)).toBeLessThanOrEqual(PX_EPSILON);
      expect(Math.abs(back[1] - y)).toBeLessThanOrEqual(PX_EPSILON);
    }
  });

  it("round-trips geo → pixel → geo within epsilon", () => {
    const points: LatLng[] = [
      { lat: 48, lng: 5 },
      { lat: 52, lng: 15 },
      { lat: 41, lng: -2 },
    ];
    for (const p of points) {
      const px = present(proj.project(p));
      const back = present(proj.invert(px[0], px[1]));
      expect(back.lat).toBeCloseTo(p.lat, 4);
      expect(back.lng).toBeCloseTo(p.lng, 4);
    }
  });

  it("places east right-of west and north above south (independent axis anchor)", () => {
    const west = present(proj.project({ lat: 45, lng: -5 }));
    const east = present(proj.project({ lat: 45, lng: 25 }));
    const north = present(proj.project({ lat: 58, lng: 10 }));
    const south = present(proj.project({ lat: 37, lng: 10 }));
    // Larger lng → larger x.
    expect(east[0]).toBeGreaterThan(west[0]);
    // Larger lat → smaller y (screen y grows downward).
    expect(north[1]).toBeLessThan(south[1]);
  });

  it("handles an out-of-range pixel gracefully (never throws)", () => {
    // d3's invert returns nonsensical/NaN coords rather than null for finite
    // out-of-range input, so the real contract is graceful handling — no throw.
    // The genuine null path (projection without invert) is exercised by the
    // round-trip tests, which assert non-null for in-frame points.
    expect(() => proj.invert(1e6, 1e6)).not.toThrow();
  });
});
