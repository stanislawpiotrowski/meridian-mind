import { useState } from "react";
import InteractiveMap, { type Marker } from "@/components/map/InteractiveMap";
import { haversine, type LatLng } from "@/lib/geo";
import { isCorrect, DEFAULT_CORRECT_THRESHOLD_KM } from "@/lib/study";
import { Button } from "@/components/ui/button";
import { pickTen, EUROPE_BBOX, type Capital } from "@/lib/teaserCapitals";

export interface TeaserQuizProps {
  /**
   * End-screen primary CTA, computed by the Astro page from `Astro.locals.user`
   * so the island stays auth-agnostic: logged-out → Sign up / `/auth/signup`,
   * logged-in → Go to my sets / `/sets`.
   */
  primaryCta: { label: string; href: string };
}

/** One answered capital, held in memory; the score screen's only data source. */
interface Result {
  name: string;
  distanceKm: number;
  correct: boolean;
}

type Phase = "awaiting-click" | "revealed";

/**
 * Logged-out, persistence-free teaser quiz over a random 10 European capitals.
 * Structurally mirrors `StudySession` (phase machine +
 * phase-derived markers) but strips all persistence: no fetch, no sessionId,
 * no API. State lives entirely in memory and resets on "Try again".
 */
export default function TeaserQuiz({ primaryCta }: TeaserQuizProps) {
  // The 10-capital queue lives in state so "Try again" can reshuffle it. The
  // random `pickTen()` runs only on the client — the page mounts this island
  // with `client:only="react"` (no SSR), so there is no server/client render to
  // mismatch on the random order.
  const [queue, setQueue] = useState<Capital[]>(() => pickTen());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("awaiting-click");
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const done = currentIndex >= queue.length;
  const currentCard = done ? null : queue[currentIndex];

  function handleMapClick(p: LatLng) {
    if (phase !== "awaiting-click" || !currentCard) return;
    const target: LatLng = { lat: currentCard.lat, lng: currentCard.lng };
    const distanceKm = haversine(p, target);
    const correct = isCorrect(distanceKm, DEFAULT_CORRECT_THRESHOLD_KM);

    setGuess(p);
    setPhase("revealed");
    setResults((prev) => [...prev, { name: currentCard.name, distanceKm, correct }]);
  }

  function handleAcknowledge() {
    setGuess(null);
    setPhase("awaiting-click");
    setCurrentIndex((i) => i + 1);
  }

  function handleTryAgain() {
    setQueue(pickTen());
    setCurrentIndex(0);
    setPhase("awaiting-click");
    setGuess(null);
    setResults([]);
  }

  // Phase-derived markers: target stays hidden during recall, revealed only
  // after the guess locks (mirrors StudySession.tsx:132-138).
  const markers: Marker[] =
    phase === "revealed" && guess && currentCard
      ? [
          { ...guess, variant: "guess", label: "Your guess" },
          { lat: currentCard.lat, lng: currentCard.lng, variant: "target", label: currentCard.name },
        ]
      : [];

  const distanceKm =
    phase === "revealed" && guess && currentCard
      ? haversine(guess, { lat: currentCard.lat, lng: currentCard.lng })
      : null;
  const correct = distanceKm !== null ? isCorrect(distanceKm, DEFAULT_CORRECT_THRESHOLD_KM) : null;

  if (done) {
    const score = results.filter((r) => r.correct).length;
    const accuracy = results.length > 0 ? Math.round((score / results.length) * 100) : 0;
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white backdrop-blur-xl">
        <h3 className="text-2xl font-bold">Quiz complete</h3>
        <p className="text-lg text-blue-100/80">
          You scored <span className="font-semibold text-emerald-300">{score}</span> / {queue.length} ({accuracy}%
          accuracy)
        </p>
        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
          <a
            href={primaryCta.href}
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-purple-500"
          >
            {primaryCta.label}
          </a>
          <Button
            variant="outline"
            onClick={handleTryAgain}
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-white">
        <div>
          <p className="text-sm text-blue-100/60">
            Capital {currentIndex + 1} of {queue.length}
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
          bbox={EUROPE_BBOX}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Reserve the feedback row's height in both phases so revealing the
          verdict doesn't shift the map/page up and down between clicks. */}
      <div className="min-h-[72px]">
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
                {currentIndex + 1 >= queue.length ? "Finish" : "Next capital"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
