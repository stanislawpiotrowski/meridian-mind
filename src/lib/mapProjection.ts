/**
 * The single boundary where screen pixels <-> geographic coordinates are
 * converted, and where map framing lives. Renderer-agnostic and DOM-free:
 * the island (and any future replacement renderer) consumes this module;
 * nothing downstream imports d3 directly.
 *
 * Coordinate-order discipline: d3-geo speaks [longitude, latitude]; the app
 * contract speaks { lat, lng }. The conversion happens HERE and nowhere else.
 */

import { geoNaturalEarth1, geoPath, type GeoGeometryObjects, type GeoPath, type GeoProjection } from "d3-geo";
import { geoWinkel3, geoRobinson } from "d3-geo-projection";
import type { LatLng } from "@/lib/geo";

/** [[west, south], [east, north]] — lng/lat corners of a framing box. */
export type Bbox = [[number, number], [number, number]];

/**
 * Projection extension point.
 *
 * The app ships a single chosen projection (`DEFAULT_PROJECTION`), but the whole
 * pipeline is parameterised by `ProjectionKind` so changing it later is cheap:
 *  - to change the global default → edit `DEFAULT_PROJECTION` (one line);
 *  - to add a candidate → import its factory and add one entry to `PROJECTIONS`;
 *  - to let users pick at runtime → pass a `kind` down from a settings value
 *    (InteractiveMap already accepts a `projection` prop); no map code changes.
 *
 * The registry intentionally keeps the finalists we evaluated on the map-preview
 * branch, so swapping the default is a known-good one-liner rather than research.
 */
export type ProjectionKind = "winkel3" | "robinson" | "natural";

const PROJECTIONS: Record<ProjectionKind, () => GeoProjection> = {
  winkel3: geoWinkel3, // Winkel Tripel — NatGeo reference; lowest average distortion. Current default.
  robinson: geoRobinson, // Robinson — straighter parallels, more robust to narrow latitude crops.
  natural: geoNaturalEarth1, // Natural Earth — softer oval look; best only in a full-world frame.
};

export const DEFAULT_PROJECTION: ProjectionKind = "winkel3";

export interface MapProjection {
  /** Geographic coordinate -> screen point in viewBox user-space (markers/lines). */
  project(p: LatLng): [number, number] | null;
  /** Screen point in viewBox user-space -> geographic coordinate (clicks). */
  invert(x: number, y: number): LatLng | null;
  /** Configured d3 path generator for rendering country outlines. */
  path: GeoPath;
  /**
   * Tight projected bounds of the framed area, [[x0,y0],[x1,y1]] in viewBox
   * user-space. fitExtent centres the map inside the requested width×height and
   * leaves margins whenever the projection's aspect ratio differs from that box
   * (e.g. Natural Earth / Robinson on a 2:1 frame). Using these bounds as the
   * SVG viewBox crops those margins so the map fills its frame for any projection.
   */
  bounds: [[number, number], [number, number]];
}

/**
 * Build the geo object `fitExtent` frames to (and that we measure for `bounds`)
 * from a bbox.
 *
 * Uses a closed LineString ring of the bbox edges, NOT a MultiPoint of the 4
 * corners. Two reasons:
 *  - A Polygon would be wrong: d3-geo treats polygons as *spherical*, so a
 *    hand-built ring with the wrong winding is read as its complement (whole
 *    planet minus the box). A LineString is a path, not an area, so it carries
 *    no winding/complement ambiguity — same safety the old MultiPoint had.
 *  - A MultiPoint of 4 corners is *geometrically wrong for curved projections*
 *    (Natural Earth, Robinson, Winkel Tripel, Mollweide…): the projected corners
 *    are not the map's extent — the parallels/meridians along the edges bow well
 *    outside them. d3 resamples a LineString's edges along the projection, so the
 *    ring traces the true curved outline and path.bounds() returns the real
 *    extent. (Cylindrical equirectangular is unaffected — its edges are straight.)
 *
 * The ring is densified so even very long edges resample cleanly.
 */
function bboxToGeoObject(bbox: Bbox): GeoGeometryObjects {
  // Clamp to valid geographic range. boundingBox() pads by a fraction of the
  // LARGER lat/lng span and applies it to both axes without clamping, so a
  // whole-world set yields a box running past ±90 lat / ±180 lng. Winkel Tripel
  // (like other curved projections) diverges past the poles, which would squish
  // the real world into a sliver while the frame is sized to extrapolated garbage.
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const west = clamp(bbox[0][0], -180, 180);
  const south = clamp(bbox[0][1], -90, 90);
  const east = clamp(bbox[1][0], -180, 180);
  const north = clamp(bbox[1][1], -90, 90);
  const steps = 64;
  const ring: [number, number][] = [];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  // Trace the four edges S→E along south, up east, W along north, down west.
  for (let i = 0; i < steps; i++) ring.push([lerp(west, east, i / steps), south]);
  for (let i = 0; i < steps; i++) ring.push([east, lerp(south, north, i / steps)]);
  for (let i = 0; i < steps; i++) ring.push([lerp(east, west, i / steps), north]);
  for (let i = 0; i < steps; i++) ring.push([west, lerp(north, south, i / steps)]);
  ring.push([west, south]); // close
  return { type: "LineString", coordinates: ring };
}

/**
 * Create a projection fitted to the given viewBox size and optional framing bbox
 * (defaults to the whole sphere = world view). `kind` defaults to the app's
 * chosen projection; pass a different one to support a user/setting override.
 *
 * Pan/zoom seam: a future zoom transform would compose here — apply a
 * translate/scale to the projection (or wrap project/invert with the inverse
 * transform) without touching the island's click/marker logic.
 */
export function createMapProjection(
  width: number,
  height: number,
  bbox?: Bbox,
  kind: ProjectionKind = DEFAULT_PROJECTION,
): MapProjection {
  const projection = PROJECTIONS[kind]();
  const fitObject: GeoGeometryObjects = bbox ? bboxToGeoObject(bbox) : { type: "Sphere" };
  projection.fitExtent(
    [
      [0, 0],
      [width, height],
    ],
    fitObject,
  );

  const path = geoPath(projection);
  const bounds = path.bounds(fitObject);

  return {
    bounds,
    project(p: LatLng): [number, number] | null {
      return projection([p.lng, p.lat]) ?? null;
    },
    invert(x: number, y: number): LatLng | null {
      const inverted = projection.invert?.([x, y]);
      return inverted ? { lat: inverted[1], lng: inverted[0] } : null;
    },
    path,
  };
}
