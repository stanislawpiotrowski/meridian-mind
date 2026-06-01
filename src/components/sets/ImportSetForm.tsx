import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";

export default function ImportSetForm() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    if (picked) {
      setName(picked.name.replace(/\.csv$/i, ""));
    }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // file.text() always decodes as UTF-8, which mangles Windows-1250 CSVs
      // (the Polish Excel default): bytes like 0xB3 ("ł") aren't valid UTF-8 and
      // become U+FFFD ("�"). Decode bytes ourselves — UTF-8 strict first, then
      // fall back to Windows-1250 so diacritics survive import.
      const buf = await file.arrayBuffer();
      let csv: string;
      try {
        csv = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        csv = new TextDecoder("windows-1250").decode(buf);
      }
      const response = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), csv }),
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
