import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const DELETE: APIRoute = async (context) => {
  // Auth guard — middleware populates locals.user; API routes self-guard with 401
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = context.params.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Set id is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Supabase client — null when env vars are missing
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Owner scoping is enforced by RLS (sets_owner policy); dependents (flashcards,
  // study_sessions, study_history) are purged by ON DELETE CASCADE. Idempotent:
  // a 0-row result (already-deleted or not-owned) still returns 204.
  const { error } = await supabase.from("sets").delete().eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to delete set." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
