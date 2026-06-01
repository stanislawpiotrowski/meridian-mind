import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

/**
 * Stamp `completed_at` so the session is no longer "open" and won't be
 * auto-resumed. Idempotent: completing an already-complete session is a no-op
 * success. RLS scopes the update to the owner's row.
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

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only stamp rows that are still open — keeps the call idempotent and avoids
  // moving an already-set completion timestamp.
  const { error } = await supabase
    .from("study_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("completed_at", null);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to complete session." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
