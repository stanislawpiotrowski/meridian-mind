/**
 * `d3-geo-projection` ships no bundled types and has no @types package on the
 * registry, so we declare only the factories we use (the projection finalists in
 * mapProjection.ts's PROJECTIONS registry). Each returns a standard d3-geo
 * `GeoProjection`. Add a line here when you add a projection to that registry.
 */
declare module "d3-geo-projection" {
  import type { GeoProjection } from "d3-geo";
  export function geoWinkel3(): GeoProjection;
  export function geoRobinson(): GeoProjection;
}
