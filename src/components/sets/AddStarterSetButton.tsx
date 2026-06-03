import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";

interface AddStarterSetButtonProps {
  title: string;
  csv: string;
  /** True when the user already has a set with this title — render a disabled "Added" state. */
  alreadyAdded?: boolean;
}

export default function AddStarterSetButton({ title, csv, alreadyAdded = false }: AddStarterSetButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mirror ImportSetForm.postSet: POST the CSV verbatim, surface data.error on
  // failure, redirect to /sets on success. Allow-duplicate — no name check.
  async function handleAdd() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, csv, importValidOnly: false }),
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

  if (alreadyAdded) {
    return (
      <Button type="button" variant="secondary" disabled>
        Added ✓
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" disabled={loading} onClick={() => void handleAdd()}>
        {loading ? "Adding…" : "Add"}
      </Button>
      <ServerError message={error} />
    </div>
  );
}
