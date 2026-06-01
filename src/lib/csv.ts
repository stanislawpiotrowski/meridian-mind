import Papa from "papaparse";

export interface ParsedFlashcard {
  name: string;
  latitude: number;
  longitude: number;
}

export type CsvParseResult = { ok: true; rows: ParsedFlashcard[] } | { ok: false; error: string };

const MAX_ROWS = 1000;
const MAX_NAME_LENGTH = 200;

/**
 * Normalize a coordinate cell to use a period as the decimal separator.
 * Handles European-locale CSV exports where comma is used instead of period
 * (e.g. "41,063919" → "41.063919"). Values that already contain a period, or
 * that contain both "," and "." (thousands-separator notation), are left unchanged
 * and will fail the Number() check if they are not valid coordinates.
 */
function normalizeCoordCell(cell: string): string {
  if (cell.includes(",") && !cell.includes(".")) {
    return cell.replace(",", ".");
  }
  return cell;
}

export function parseAndValidateCsv(raw: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    delimiter: "", // empty string = auto-detect; supports "," and ";" (common in European exports)
  });

  // Verify required headers are present
  const headers = result.meta.fields ?? [];
  const required = ["name", "latitude", "longitude"];
  for (const col of required) {
    if (!headers.includes(col)) {
      return { ok: false, error: `CSV is missing required column: ${col}` };
    }
  }

  const rawRows = result.data;

  if (rawRows.length === 0) {
    return { ok: false, error: "CSV must contain at least one data row." };
  }

  if (rawRows.length > MAX_ROWS) {
    return { ok: false, error: `CSV must not exceed ${MAX_ROWS} rows.` };
  }

  const rows: ParsedFlashcard[] = [];

  for (const row of rawRows) {
    const name = row.name.trim();
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        error: `Each flashcard name must be between 1 and ${MAX_NAME_LENGTH} characters.`,
      };
    }

    const latCell = row.latitude.trim();
    const lngCell = row.longitude.trim();

    if (latCell === "" || lngCell === "") {
      return { ok: false, error: "Each row must have non-empty latitude and longitude values." };
    }

    const latitude = Number(normalizeCoordCell(latCell));
    const longitude = Number(normalizeCoordCell(lngCell));

    if (!Number.isFinite(latitude)) {
      return { ok: false, error: "Latitude must be a valid number." };
    }
    if (!Number.isFinite(longitude)) {
      return { ok: false, error: "Longitude must be a valid number." };
    }

    if (latitude < -90 || latitude > 90) {
      return { ok: false, error: "Latitude must be between -90 and 90." };
    }
    if (longitude < -180 || longitude > 180) {
      return { ok: false, error: "Longitude must be between -180 and 180." };
    }

    rows.push({ name, latitude, longitude });
  }

  return { ok: true, rows };
}
