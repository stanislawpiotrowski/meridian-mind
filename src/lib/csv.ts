import Papa from "papaparse";

export interface ParsedFlashcard {
  name: string;
  latitude: number;
  longitude: number;
}

export interface RowFieldError {
  field: "name" | "latitude" | "longitude";
  reason: string;
}

export interface InvalidRow {
  /** 1-indexed ordinal among parsed (non-empty) data rows — not the physical file line. */
  row: number;
  /** Raw cell values for display; never undefined (ragged rows coerced to ""). */
  values: { name: string; latitude: string; longitude: string };
  errors: RowFieldError[];
}

export type CsvParseResult =
  | { ok: true; valid: ParsedFlashcard[]; invalid: InvalidRow[] }
  | { ok: false; error: string };

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
  // Cells are typed as possibly-undefined because a ragged row (fewer cells than
  // headers) yields missing keys under header:true — the ?? "" guards rely on this.
  const result = Papa.parse<Record<string, string | undefined>>(raw, {
    header: true,
    skipEmptyLines: true,
    delimiter: "", // empty string = auto-detect; supports "," and ";" (common in European exports)
    // Normalize header casing so `Name,Latitude,Longitude` (a common Excel export)
    // satisfies the required-header check and downstream row.name/.latitude/.longitude
    // access regardless of source casing (PRD: headers are case-insensitive).
    transformHeader: (h) => h.trim().toLowerCase(),
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

  const valid: ParsedFlashcard[] = [];
  const invalid: InvalidRow[] = [];

  rawRows.forEach((row, index) => {
    // Coerce every cell before trimming. With header:true, a ragged row (fewer
    // cells than headers) yields missing keys, so row.longitude can be undefined;
    // unguarded .trim() would throw and crash the whole parse on exactly the
    // malformed shape this slice must report. ?? "" turns it into an InvalidRow.
    const nameCell = (row.name ?? "").trim();
    const latCell = (row.latitude ?? "").trim();
    const lngCell = (row.longitude ?? "").trim();

    const errors: RowFieldError[] = [];

    if (nameCell.length < 1 || nameCell.length > MAX_NAME_LENGTH) {
      errors.push({
        field: "name",
        reason: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.`,
      });
    }

    let latitude = NaN;
    if (latCell === "") {
      errors.push({ field: "latitude", reason: "Latitude is required." });
    } else {
      latitude = Number(normalizeCoordCell(latCell));
      if (!Number.isFinite(latitude)) {
        errors.push({ field: "latitude", reason: "Latitude must be a valid number." });
      } else if (latitude < -90 || latitude > 90) {
        errors.push({ field: "latitude", reason: "Latitude must be between -90 and 90." });
      }
    }

    let longitude = NaN;
    if (lngCell === "") {
      errors.push({ field: "longitude", reason: "Longitude is required." });
    } else {
      longitude = Number(normalizeCoordCell(lngCell));
      if (!Number.isFinite(longitude)) {
        errors.push({ field: "longitude", reason: "Longitude must be a valid number." });
      } else if (longitude < -180 || longitude > 180) {
        errors.push({ field: "longitude", reason: "Longitude must be between -180 and 180." });
      }
    }

    if (errors.length === 0) {
      valid.push({ name: nameCell, latitude, longitude });
    } else {
      invalid.push({
        // 1-indexed ordinal among parsed data rows (blank lines already skipped).
        row: index + 1,
        values: { name: row.name ?? "", latitude: row.latitude ?? "", longitude: row.longitude ?? "" },
        errors,
      });
    }
  });

  return { ok: true, valid, invalid };
}
