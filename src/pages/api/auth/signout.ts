import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    // Propagate a failed sign-out instead of swallowing it: a discarded error
    // would redirect "/" as if signed out while the session cookie is still
    // live. Mirror signin/signup — surface the message on the signin page.
    const { error } = await supabase.auth.signOut();
    if (error) {
      return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
    }
  }
  return context.redirect("/");
};
