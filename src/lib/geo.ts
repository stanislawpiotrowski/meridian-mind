/**
 * Pure, dependency-free geospatial primitives shared by the map island,
 * the study quiz (S-02), and any future SRS scoring. No d3, no DOM.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two points in kilometers (FR-011).
 *
 * Uses the standard haversine formula, which is correct across the
 * antimeridian: the longitude delta lives inside a cosine, so the ±180°
 * seam needs no special-casing. Do NOT substitute a planar approximation —
 * it breaks at high latitudes and across the seam.
 *
 * Returned value is rounded to whole kilometers for display.
 */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));

  return Math.round(EARTH_RADIUS_KM * c);
}
