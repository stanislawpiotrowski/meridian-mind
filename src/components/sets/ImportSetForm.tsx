import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { parseAndValidateCsv, type InvalidRow, type ParsedFlashcard } from "@/lib/csv";

interface Report {
  csv: string;
  valid: ParsedFlashcard[];
  invalid: InvalidRow[];
}

export default function ImportSetForm() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // When set, the file had invalid rows and we show the pre-commit report instead
  // of posting. Null means we're in the normal form state.
  const [report, setReport] = useState<Report | null>(null);
  // The file input is uncontrolled, so clearing `file` state won't reset the
  // filename it displays — we reset it via this ref on Cancel.
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setReport(null);
    setError(null);
    if (picked) {
      setName(picked.name.replace(/\.csv$/i, ""));
    }
  }

  // POST the set; surfaces data.error on failure, redirects to /sets on success.
  async function postSet(csv: string, importValidOnly: boolean) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), csv, importValidOnly }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        window.location.href = "/sets";
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setError(null);

    // file.text() always decodes as UTF-8, which mangles Windows-1250 CSVs
    // (the Polish Excel default): bytes like 0xB3 ("ł") aren't valid UTF-8 and
    // become U+FFFD ("�"). Decode bytes ourselves — UTF-8 strict first, then
    // fall back to Windows-1250 so diacritics survive import. Validation runs on
    // this decoded string so previewed and committed bytes match.
    let csv: string;
    try {
      const buf = await file.arrayBuffer();
      try {
        csv = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        csv = new TextDecoder("windows-1250").decode(buf);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      return;
    }

    const result = parseAndValidateCsv(csv);

    // File-level error (missing header, empty, >1000 rows) — single error, no report.
    if (!result.ok) {
      setError(result.error);
      return;
    }

    // All rows valid → one-click happy path, no interstitial report.
    if (result.invalid.length === 0) {
      void postSet(csv, false);
      return;
    }

    // Some rows invalid → show the report and let the user choose.
    setReport({ csv, valid: result.valid, invalid: result.invalid });
  }

  function handleCancelReport() {
    setReport(null);
    setError(null);
    // Cleanly reset the file selection so the input no longer displays the stale
    // filename — nothing was created, so the user starts fresh.
    setFile(null);
    setName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (report) {
    const total = report.valid.length + report.invalid.length;
    const canImport = report.valid.length > 0;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
        <h2 className="mb-2 text-lg font-semibold">Review malformed rows</h2>
        <p className="mb-4 text-sm text-blue-100/80">
          {report.invalid.length} of {total} rows invalid — {report.valid.length} will import.{" "}
          <span className="text-blue-100/50">(&ldquo;Row&rdquo; counts data rows, blank lines excluded.)</span>
        </p>

        <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
          {report.invalid.map((row) => (
            <li key={row.row} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <span className="font-medium text-red-300">Row {row.row}</span>
              <ul className="mt-1 space-y-0.5 text-blue-100/80">
                {row.errors.map((err, i) => (
                  <li key={i}>
                    <span className="font-medium">{err.field}</span>: {err.reason}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <ServerError message={error} />

        <div className="mt-4 flex gap-3">
          <Button
            type="button"
            disabled={loading || !canImport}
            onClick={() => void postSet(report.csv, true)}
            className="flex-1"
          >
            {loading ? "Importing…" : `Import ${report.valid.length} valid rows`}
          </Button>
          <button
            type="button"
            onClick={handleCancelReport}
            disabled={loading}
            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {!canImport && (
          <p className="mt-3 text-xs text-blue-100/50">Every row is invalid — fix the source file and try again.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <h2 className="mb-4 text-lg font-semibold">Import a set from CSV</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="csv-file" className="mb-1 block text-sm text-blue-100/80">
            CSV file <span className="text-blue-100/50">(columns: name, latitude, longitude)</span>
          </label>
          <input
            id="csv-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="w-full cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:border-white/30"
          />
        </div>

        <div>
          <label htmlFor="set-name" className="mb-1 block text-sm text-blue-100/80">
            Set name
          </label>
          <input
            id="set-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="e.g. Europe capitals"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
        </div>

        <ServerError message={error} />

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Importing…" : "Import set"}
        </Button>
      </form>
    </div>
  );
}
