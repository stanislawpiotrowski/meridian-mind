import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

/**
 * Append one acknowledged attempt to the append-only `study_history` log.
 * Called in the background by the quiz island; off the latency path. Inserts
 * only — `study_history` is append-only by RLS and is the durable source of
 * truth for resume (and S-03 analytics).
 */
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = context.params.id;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session id." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let flashcardId: unknown;
  let distanceKm: unknown;
  try {
    const body = (await context.request.json()) as Record<string, unknown>;
    flashcardId = body.flashcardId;
    distanceKm = body.distanceKm;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof flashcardId !== "string" || typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) {
    return new Response(JSON.stringify({ error: "flashcardId (string) and distanceKm (number) are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve set_id from the session (RLS-scoped to the owner) rather than
  // trusting the client. A foreign/invalid session yields no row → reject.
  const { data: session } = await supabase.from("study_sessions").select("set_id").eq("id", sessionId).maybeSingle();

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase.from("study_history").insert({
    user_id: user.id,
    session_id: sessionId,
    set_id: session.set_id,
    flashcard_id: flashcardId,
    distance_km: distanceKm,
  });

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to record attempt." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
