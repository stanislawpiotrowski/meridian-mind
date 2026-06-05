import { useMemo, useRef } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";
// Bundled world-atlas `countries-50m.json` (copied to src/assets at build time);
// imported as JSON so the basemap loads with no runtime fetch/CORS dependency.
import worldTopo from "@/assets/world-50m.json";
import { createMapProjection, type Bbox } from "@/lib/mapProjection";
import { haversine, type LatLng } from "@/lib/geo";

// Map palette ("daylight"): light-blue ocean, ivory land, slate borders/ink —
// a light, classic-atlas look replacing the earlier dark/transparent scheme.
const OCEAN = "#dbeafe";
const LAND = "#fefce8";
const BORDER = "#94a3b8";
const CONNECTOR = "#334155";
const INK = "#1e293b";

export interface Marker {
  lat: number;
  lng: number;
  variant: "guess" | "target";
  label?: string;
}

export interface InteractiveMapProps {
  onMapClick?: (p: LatLng) => void;
  markers?: Marker[];
  /** [[west,south],[east,north]] framing box; omitted = world view. */
  bbox?: Bbox;
  /** Draw a line + km label between the guess and target markers. */
  connector?: boolean;
  className?: string;
}

// Fixed viewBox: 2:1 matches equirectangular's full-world aspect. The SVG is
// CSS-scaled to fill its container; clicks are mapped back to this user-space
// via getScreenCTM().inverse() before inversion (see Critical Implementation Details).
const VIEW_W = 1000;
const VIEW_H = 500;

const MARKER_FILL: Record<Marker["variant"], string> = {
  guess: "#f59e0b", // amber
  target: "#34d399", // emerald
};

export default function InteractiveMap({
  onMapClick,
  markers = [],
  bbox,
  connector = false,
  className,
}: InteractiveMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { projection, countries } = useMemo(() => {
    const proj = createMapProjection(VIEW_W, VIEW_H, bbox);
    const topo = worldTopo as unknown as Topology;
    const collection = feature(topo, topo.objects.countries) as FeatureCollection;
    return { projection: proj, countries: collection.features };
  }, [bbox]);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onMapClick) return;
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const coord = projection.invert(point.x, point.y);
    if (coord) onMapClick(coord);
  }

  const guess = markers.find((m) => m.variant === "guess");
  const target = markers.find((m) => m.variant === "target");

  const guessXY = guess ? projection.project(guess) : null;
  const targetXY = target ? projection.project(target) : null;
  const drawConnector = connector && guessXY !== null && targetXY !== null;
  const distanceKm = guess && target ? haversine(guess, target) : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ backgroundColor: OCEAN }}
      className={className}
      onClick={handleClick}
      role="presentation"
    >
      <g>
        {countries.map((f, i) => {
          const d = projection.path(f);
          return d ? <path key={i} d={d} fill={LAND} stroke={BORDER} strokeWidth={0.5} /> : null;
        })}
      </g>

      {drawConnector ? (
        <line
          x1={guessXY[0]}
          y1={guessXY[1]}
          x2={targetXY[0]}
          y2={targetXY[1]}
          stroke={CONNECTOR}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      ) : null}

      {markers.map((m, i) => {
        const xy = projection.project(m);
        if (!xy) return null;
        return (
          <g key={i}>
            <circle cx={xy[0]} cy={xy[1]} r={5} fill={MARKER_FILL[m.variant]} stroke="white" strokeWidth={1} />
            {m.label ? (
              <text x={xy[0] + 8} y={xy[1] + 4} fill={INK} fontSize={12}>
                {m.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {drawConnector && distanceKm !== null ? (
        <text
          x={(guessXY[0] + targetXY[0]) / 2}
          y={(guessXY[1] + targetXY[1]) / 2 - 6}
          fill={INK}
          fontSize={13}
          fontWeight={600}
          textAnchor="middle"
        >
          {`${String(distanceKm)} km`}
        </text>
      ) : null}
    </svg>
  );
}
