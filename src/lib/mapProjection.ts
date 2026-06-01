/**
 * The single boundary where screen pixels <-> geographic coordinates are
 * converted, and where map framing lives. Renderer-agnostic and DOM-free:
 * the island (and any future replacement renderer) consumes this module;
 * nothing downstream imports d3 directly.
 *
 * Coordinate-order discipline: d3-geo speaks [longitude, latitude]; the app
 * contract speaks { lat, lng }. The conversion happens HERE and nowhere else.
 */

import { geoEquirectangular, geoPath, type GeoGeometryObjects, type GeoPath } from "d3-geo";
import type { LatLng } from "@/lib/geo";

/** [[west, south], [east, north]] — lng/lat corners of a framing box. */
export type Bbox = [[number, number], [number, number]];

export interface MapProjection {
  /** Geographic coordinate -> screen point in viewBox user-space (markers/lines). */
  project(p: LatLng): [number, number] | null;
  /** Screen point in viewBox user-space -> geographic coordinate (clicks). */
  invert(x: number, y: number): LatLng | null;
  /** Configured d3 path generator for rendering country outlines. */
  path: GeoPath;
}

/** Build a GeoJSON polygon covering the bbox, for `fitExtent` framing. */
function bboxToGeoObject(bbox: Bbox): GeoGeometryObjects {
  const [[west, south], [east, north]] = bbox;
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

/**
 * Create an equirectangular projection fitted to the given viewBox size and
 * optional framing bbox (defaults to the whole sphere = world view).
 *
 * Pan/zoom seam: a future zoom transform would compose here — apply a
 * translate/scale to the projection (or wrap project/invert with the inverse
 * transform) without touching the island's click/marker logic.
 */
export function createMapProjection(width: number, height: number, bbox?: Bbox): MapProjection {
  const projection = geoEquirectangular();
  const fitObject: GeoGeometryObjects = bbox ? bboxToGeoObject(bbox) : { type: "Sphere" };
  projection.fitExtent(
    [
      [0, 0],
      [width, height],
    ],
    fitObject,
  );

  const path = geoPath(projection);

  return {
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
