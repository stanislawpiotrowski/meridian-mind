/**
 * Curated European-capitals dataset for the logged-out teaser quiz (S-08).
 *
 * A vetted pool of well-known European capitals (micro-states like Vaduz,
 * San Marino, Monaco, and Andorra are intentionally excluded so casual
 * visitors aren't frustrated by obscure targets). Pure module — no DOM, no d3 —
 * mirroring the style of `src/lib/geo.ts`.
 */

import type { Bbox } from "@/lib/mapProjection";

export interface Capital {
  name: string;
  lat: number;
  lng: number;
}

/**
 * Continental Europe framing box: British Isles + Iberia in the west to western
 * Russia in the east, Mediterranean to North Cape. Shared with `MapDemo.tsx` so
 * the teaser and the demo don't drift to two divergent copies.
 */
export const EUROPE_BBOX: Bbox = [
  [-11, 34],
  [40, 71],
];

/** Number of capitals presented in a single teaser run. */
export const QUIZ_LENGTH = 10;

/**
 * Vetted pool of well-known European capitals (city-center coordinates).
 * ~26 entries; micro-states deliberately omitted (see module docstring).
 */
export const CAPITALS: Capital[] = [
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Paris", lat: 48.86, lng: 2.35 },
  { name: "Madrid", lat: 40.42, lng: -3.7 },
  { name: "Lisbon", lat: 38.72, lng: -9.14 },
  { name: "Rome", lat: 41.9, lng: 12.5 },
  { name: "Berlin", lat: 52.52, lng: 13.41 },
  { name: "Amsterdam", lat: 52.37, lng: 4.9 },
  { name: "Brussels", lat: 50.85, lng: 4.35 },
  { name: "Vienna", lat: 48.21, lng: 16.37 },
  { name: "Bern", lat: 46.95, lng: 7.45 },
  { name: "Warsaw", lat: 52.23, lng: 21.01 },
  { name: "Prague", lat: 50.08, lng: 14.44 },
  { name: "Budapest", lat: 47.5, lng: 19.04 },
  { name: "Copenhagen", lat: 55.68, lng: 12.57 },
  { name: "Oslo", lat: 59.91, lng: 10.75 },
  { name: "Stockholm", lat: 59.33, lng: 18.06 },
  { name: "Helsinki", lat: 60.17, lng: 24.94 },
  { name: "Dublin", lat: 53.35, lng: -6.26 },
  { name: "Athens", lat: 37.98, lng: 23.73 },
  { name: "Bucharest", lat: 44.43, lng: 26.1 },
  { name: "Sofia", lat: 42.7, lng: 23.32 },
  { name: "Belgrade", lat: 44.79, lng: 20.45 },
  { name: "Zagreb", lat: 45.81, lng: 15.98 },
  { name: "Bratislava", lat: 48.15, lng: 17.11 },
  { name: "Ljubljana", lat: 46.06, lng: 14.51 },
  { name: "Kyiv", lat: 50.45, lng: 30.52 },
];

/**
 * Pick {@link QUIZ_LENGTH} distinct capitals in random order via a partial
 * Fisher–Yates shuffle over a copy of the pool. `rng` defaults to `Math.random`
 * and is injectable so tests can pin the order.
 */
export function pickTen(rng: () => number = Math.random): Capital[] {
  const pool = [...CAPITALS];
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, QUIZ_LENGTH);
}
