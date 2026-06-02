import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";

interface DeleteSetButtonProps {
  setId: string;
  setName: string;
}

export default function DeleteSetButton({ setId, setName }: DeleteSetButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    // Browser confirm stands in as the "implied confirmation dialog" (FR-006).
    if (!window.confirm(`Delete "${setName}"? This permanently removes the set and its study history.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sets/${setId}`, { method: "DELETE" });
      if (response.ok) {
        // Reload so the server re-renders the authoritative list (mirrors ImportSetForm).
        window.location.reload();
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to delete set. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={loading}
        onClick={handleDelete}
        aria-label={`Delete ${setName}`}
        className="text-blue-100/60 hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="size-4" />
      </Button>
      {error && (
        <div className="absolute top-full right-0 z-10 mt-1 w-64">
          <ServerError message={error} />
        </div>
      )}
    </div>
  );
}
