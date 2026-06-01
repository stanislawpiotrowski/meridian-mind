import { useState } from "react";
import InteractiveMap, { type Marker } from "@/components/map/InteractiveMap";
import { haversine, type LatLng } from "@/lib/geo";
import type { Bbox } from "@/lib/mapProjection";
import { Button } from "@/components/ui/button";

// Hardcoded target — Warsaw — chosen so it stays in frame at both World and
// Poland framings. F-02 owns no quiz state; this is demo-only scaffolding.
const TARGET: Marker = { lat: 52.2297, lng: 21.0122, variant: "target", label: "Warsaw" };

const POLAND_BBOX: Bbox = [
  [14.12, 49.0],
  [24.15, 54.84],
];

type Framing = "world" | "poland";

export default function MapDemo() {
  const [framing, setFraming] = useState<Framing>("world");
  const [guess, setGuess] = useState<LatLng | null>(null);

  const markers: Marker[] = guess ? [{ ...guess, variant: "guess", label: "Guess" }, TARGET] : [TARGET];

  const distanceKm = guess ? haversine(guess, TARGET) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={framing === "world" ? "default" : "outline"}
          onClick={() => {
            setFraming("world");
          }}
        >
          World
        </Button>
        <Button
          variant={framing === "poland" ? "default" : "outline"}
          onClick={() => {
            setFraming("poland");
          }}
        >
          Poland
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <InteractiveMap
          className="aspect-[2/1] w-full"
          connector
          markers={markers}
          bbox={framing === "poland" ? POLAND_BBOX : undefined}
          onMapClick={(p) => {
            setGuess(p);
          }}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-blue-100/80 backdrop-blur-xl">
        {guess ? (
          <p>
            Last click:{" "}
            <span className="text-white">
              {guess.lat.toFixed(2)}°, {guess.lng.toFixed(2)}°
            </span>
            {" — "}
            distance to {TARGET.label}: <span className="font-semibold text-white">{distanceKm} km</span>
          </p>
        ) : (
          <p>Click anywhere on the map to drop a guess marker.</p>
        )}
      </div>
    </div>
  );
}
