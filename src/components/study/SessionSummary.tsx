import type { StudyFlashcard } from "@/components/study/StudySession";

export interface SessionResult {
  flashcardId: string;
  distanceKm: number;
  correct: boolean;
}

export interface SessionSummaryProps {
  results: SessionResult[];
  flashcards: StudyFlashcard[];
}

const MOST_MISSED_LIMIT = 5;

/**
 * Terminal summary, computed purely in-memory from the session's results
 * (FR-014): items answered, accuracy %, and the most-missed list ordered by
 * distance. No endpoint — just a render of held data.
 */
export default function SessionSummary({ results, flashcards }: SessionSummaryProps) {
  const answered = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const accuracyPct = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;

  const nameById = new Map(flashcards.map((f) => [f.id, f.name]));
  const mostMissed = [...results].sort((a, b) => b.distanceKm - a.distanceKm).slice(0, MOST_MISSED_LIMIT);

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl">
      <div>
        <h2 className="text-2xl font-bold">Session complete</h2>
        <p className="mt-1 text-blue-100/70">Nicely done — here&apos;s how it went.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-blue-100/60">Answered</p>
          <p className="text-3xl font-bold">{answered}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-blue-100/60">Accuracy</p>
          <p className="text-3xl font-bold">
            {accuracyPct}
            <span className="text-lg text-blue-100/60">%</span>
          </p>
          <p className="mt-0.5 text-xs text-blue-100/50">
            {correctCount} / {answered} correct
          </p>
        </div>
      </div>

      {mostMissed.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-blue-100/80">Most missed</h3>
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {mostMissed.map((r) => (
              <li key={r.flashcardId} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-blue-100/90">{nameById.get(r.flashcardId) ?? "Unknown"}</span>
                <span className={r.correct ? "text-sm text-emerald-300" : "text-sm text-amber-300"}>
                  {r.distanceKm} km
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <a href="/sets" className="inline-block text-purple-200 underline-offset-4 hover:underline">
        Back to sets
      </a>
    </div>
  );
}
