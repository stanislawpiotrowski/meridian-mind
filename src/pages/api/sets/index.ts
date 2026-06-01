import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { parseAndValidateCsv } from "@/lib/csv";

export const POST: APIRoute = async (context) => {
  // Auth guard — middleware populates locals.user; API routes self-guard with 401
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse JSON body — malformed body throws SyntaxError
  let name: unknown;
  let csv: unknown;
  try {
    const body = (await context.request.json()) as Record<string, unknown>;
    name = body.name;
    csv = body.csv;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate name and csv fields
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName || trimmedName.length > 200) {
    return new Response(JSON.stringify({ error: "Set name must be between 1 and 200 characters." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof csv !== "string" || csv.trim().length === 0) {
    return new Response(JSON.stringify({ error: "CSV content is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse and validate CSV rows
  const parsed = parseAndValidateCsv(csv);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
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

  // Insert the set row
  const { data: setData, error: setError } = await supabase
    .from("sets")
    .insert({ user_id: user.id, name: trimmedName })
    .select("id")
    .single();

  if (setError) {
    return new Response(JSON.stringify({ error: "Failed to create set." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const setId = setData.id;

  // Bulk-insert flashcards — denormalized user_id is required by RLS
  const flashcardRows = parsed.rows.map((row) => ({
    set_id: setId,
    user_id: user.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
  }));

  const { error: flashcardsError } = await supabase.from("flashcards").insert(flashcardRows);

  if (flashcardsError) {
    // Best-effort cleanup — delete the orphan set
    await supabase.from("sets").delete().eq("id", setId);
    return new Response(JSON.stringify({ error: "Failed to import flashcards." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ set: { id: setId, name: trimmedName } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
