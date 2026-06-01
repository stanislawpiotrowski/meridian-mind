/**
 * Scoring & config for the study quiz (S-02). Single home for the
 * correct-answer threshold so the value is defined once and threaded as a
 * parameter rather than hardcoded in the API and the island. Pure number math —
 * no DOM, no d3 — mirroring the dependency-free style of `src/lib/geo.ts`.
 */

import type { LatLng } from "@/lib/geo";
import type { Bbox } from "@/lib/mapProjection";

/**
 * A guess within this many kilometers of the target counts as correct (FR-012).
 *
 * Future per-set-override seam: a `correct_threshold_km` column on `sets` would
 * be loaded by the page and flow into the `thresholdKm` parameter of
 * `isCorrect` below. No column and no UI exist yet — this is the documented
 * single point of change.
 */
export const DEFAULT_CORRECT_THRESHOLD_KM = 300;

/** Verdict for a single attempt: correct iff within the threshold (inclusive). */
export function isCorrect(distanceKm: number, thresholdKm: number = DEFAULT_CORRECT_THRESHOLD_KM): boolean {
  return distanceKm <= thresholdKm;
}

/**
 * Auto-fit framing box from a set's flashcard coordinates, padded so markers
 * aren't flush to the map edge. Returns `[[west,south],[east,north]]` matching
 * the `Bbox` contract consumed by `createMapProjection`.
 *
 * A single point (or all-coincident points) degenerates to a zero-size box;
 * the padding below still expands it to a small framed region. `padFraction`
 * is applied to the larger of the lat/lng spans so the aspect stays sensible.
 */
export function boundingBox(points: LatLng[], padFraction = 0.15): Bbox {
  if (points.length === 0) {
    // Defensive: no points means world view. Callers with cards never hit this.
    return [
      [-180, -85],
      [180, 85],
    ];
  }

  let west = points[0].lng;
  let east = points[0].lng;
  let south = points[0].lat;
  let north = points[0].lat;

  for (const p of points) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }

  // Pad by a fraction of the larger span, with a small floor so a single
  // point still yields a usable box rather than a zero-size frame.
  const span = Math.max(east - west, north - south);
  const pad = Math.max(span * padFraction, 0.5);

  return [
    [west - pad, south - pad],
    [east + pad, north + pad],
  ];
}
