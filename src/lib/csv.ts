import Papa from "papaparse";

export interface ParsedFlashcard {
  name: string;
  latitude: number;
  longitude: number;
}

export type CsvParseResult = { ok: true; rows: ParsedFlashcard[] } | { ok: false; error: string };

const MAX_ROWS = 1000;
const MAX_NAME_LENGTH = 200;

export function parseAndValidateCsv(raw: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
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

    const latitude = Number(latCell);
    const longitude = Number(lngCell);

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
