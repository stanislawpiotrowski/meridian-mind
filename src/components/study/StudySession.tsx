import { useEffect, useRef, useState } from "react";
import InteractiveMap, { type Marker } from "@/components/map/InteractiveMap";
import { haversine, type LatLng } from "@/lib/geo";
import { isCorrect } from "@/lib/study";
import type { Bbox } from "@/lib/mapProjection";
import { Button } from "@/components/ui/button";
import SessionSummary from "@/components/study/SessionSummary";

export interface StudyFlashcard {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface PriorAttempt {
  flashcardId: string;
  distanceKm: number;
}

export interface StudySessionProps {
  sessionId: string;
  setId: string;
  flashcards: StudyFlashcard[];
  priorAttempts: PriorAttempt[];
  bbox: Bbox;
  thresholdKm: number;
}

/** One answered card, held in memory; doubles as the summary source (Phase 3). */
interface Result {
  flashcardId: string;
  distanceKm: number;
  correct: boolean;
}

type Phase = "awaiting-click" | "revealed";

/**
 * Fire-and-forget POST of one attempt, retried once. A persistent failure is
 * non-fatal: the card simply looks unanswered on a later resume (the student
 * re-answers it), since `study_history` is the source of truth for resume.
 */
async function postAttempt(sessionId: string, flashcardId: string, distanceKm: number): Promise<void> {
  const body = JSON.stringify({ flashcardId, distanceKm });
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(`/api/study/sessions/${sessionId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return;
    } catch {
      // retry
    }
  }
}

/**
 * Mark the session complete (background, retried once). Failure is non-fatal:
 * the session is functionally finished and would simply auto-resume to an empty
 * queue, which the page/island treats as "show summary".
 */
async function postComplete(sessionId: string): Promise<void> {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(`/api/study/sessions/${sessionId}/complete`, { method: "POST" });
      if (res.ok) return;
    } catch {
      // retry
    }
  }
}

export default function StudySession({ sessionId, flashcards, priorAttempts, bbox, thresholdKm }: StudySessionProps) {
  // Seed the in-memory record from prior attempts (resume). Verdict is recomputed
  // locally so the threshold stays the single source of truth.
  const [results, setResults] = useState<Result[]>(() =>
    priorAttempts.map((a) => ({
      flashcardId: a.flashcardId,
      distanceKm: a.distanceKm,
      correct: isCorrect(a.distanceKm, thresholdKm),
    })),
  );

  // First card (by insertion order) with no recorded attempt is where we resume.
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const answered = new Set(priorAttempts.map((a) => a.flashcardId));
    const next = flashcards.findIndex((f) => !answered.has(f.id));
    return next === -1 ? flashcards.length : next;
  });

  const [phase, setPhase] = useState<Phase>("awaiting-click");
  const [guess, setGuess] = useState<LatLng | null>(null);

  const done = currentIndex >= flashcards.length;
  const currentCard = done ? null : flashcards[currentIndex];

  // Stamp completion once when the queue empties — whether reached by finishing
  // the last card or by entering an already-fully-answered session (resume).
  const completedRef = useRef(false);
  useEffect(() => {
    if (done && !completedRef.current) {
      completedRef.current = true;
      void postComplete(sessionId);
    }
  }, [done, sessionId]);

  function handleMapClick(p: LatLng) {
    if (phase !== "awaiting-click" || !currentCard) return;
    const target: LatLng = { lat: currentCard.latitude, lng: currentCard.longitude };
    const distanceKm = haversine(p, target);
    const correct = isCorrect(distanceKm, thresholdKm);

    setGuess(p);
    setPhase("revealed");
    setResults((prev) => [...prev, { flashcardId: currentCard.id, distanceKm, correct }]);

    // Background persistence — never gates feedback (NFR Latency).
    void postAttempt(sessionId, currentCard.id, distanceKm);
  }

  function handleAcknowledge() {
    setGuess(null);
    setPhase("awaiting-click");
    setCurrentIndex((i) => i + 1);
  }

  // Phase-derived markers: target stays hidden during active recall (FR-009),
  // revealed only after the guess locks.
  const markers: Marker[] =
    phase === "revealed" && guess && currentCard
      ? [
          { ...guess, variant: "guess", label: "Your guess" },
          { lat: currentCard.latitude, lng: currentCard.longitude, variant: "target", label: currentCard.name },
        ]
      : [];

  const distanceKm =
    phase === "revealed" && guess && currentCard
      ? haversine(guess, { lat: currentCard.latitude, lng: currentCard.longitude })
      : null;
  const correct = distanceKm !== null ? isCorrect(distanceKm, thresholdKm) : null;

  if (done) {
    return <SessionSummary results={results} flashcards={flashcards} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-white">
        <div>
          <p className="text-sm text-blue-100/60">
            Card {currentIndex + 1} of {flashcards.length}
          </p>
          <h2 className="text-2xl font-bold">{currentCard?.name}</h2>
        </div>
        {phase === "awaiting-click" ? (
          <p className="text-sm text-blue-100/60">Click the map to place your guess</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <InteractiveMap
          className="aspect-[2/1] w-full"
          connector={phase === "revealed"}
          markers={markers}
          bbox={bbox}
          onMapClick={handleMapClick}
        />
      </div>

      {phase === "revealed" && distanceKm !== null ? (
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p>
              <span className={correct ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>
                {correct ? "Correct" : "Incorrect"}
              </span>
              {" — "}
              <span className="text-blue-100/80">{distanceKm} km away</span>
            </p>
            <Button onClick={handleAcknowledge}>
              {currentIndex + 1 >= flashcards.length ? "Finish" : "Next card"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
