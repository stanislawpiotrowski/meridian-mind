import crownCsv from "./crown-of-the-earth.csv?raw";
import capitalsCsv from "./european-capitals.csv?raw";
import parksCsv from "./polish-national-parks.csv?raw";
import catalogDestinationsCsv from "./catalog-destinations-2016.csv?raw";
import slovakiaCzechiaHungaryCsv from "./tourist-attractions-slovakia-czechia-hungary.csv?raw";

export interface StarterSet {
  /** Stable slug — used as the React key / element id. */
  id: string;
  /** User-facing set name; also sent as the created set's `name`. */
  title: string;
  /** Raw CSV bytes, POSTed verbatim to /api/sets (same payload the manual importer sends). */
  csv: string;
  /** Card count, derived from the CSV so it can never drift from the file. */
  count: number;
}

/**
 * Count data rows in a CSV string: non-empty lines minus the header. Mirrors
 * Papa.parse(skipEmptyLines), so the displayed count matches what /api/sets
 * actually imports. Derived at module load — never hardcode the count.
 */
function countDataRows(csv: string): number {
  const nonEmpty = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  // First non-empty line is the header.
  return Math.max(0, nonEmpty.length - 1);
}

export const STARTER_SETS: StarterSet[] = [
  { id: "crown-of-the-earth", title: "Crown of the Earth", csv: crownCsv, count: countDataRows(crownCsv) },
  { id: "european-capitals", title: "European Capitals", csv: capitalsCsv, count: countDataRows(capitalsCsv) },
  {
    id: "polish-national-parks",
    title: "Parki Narodowe w Polsce",
    csv: parksCsv,
    count: countDataRows(parksCsv),
  },
  {
    id: "catalog-destinations-2016",
    title: "destynacje wg katalogów na egzamin 2016",
    csv: catalogDestinationsCsv,
    count: countDataRows(catalogDestinationsCsv),
  },
  {
    id: "tourist-attractions-slovakia-czechia-hungary",
    title: "Atrakcje turystyczne Słowacji Czech i Węgier",
    csv: slovakiaCzechiaHungaryCsv,
    count: countDataRows(slovakiaCzechiaHungaryCsv),
  },
];
