import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./signout";

/**
 * Test-driven bugfixing (M3L5): a swallowed-error reproduction.
 *
 * The handler called `supabase.auth.signOut()` and discarded its result, then
 * redirected to "/" unconditionally — reporting success even when the sign-out
 * failed and the session cookie may still be live. The failure case below is the
 * red test: it pins the contract that a failed sign-out must NOT land on the
 * clean "/" success page, but surface the error like its signin/signup siblings.
 */

// Mock the supabase factory so we never import `astro:env/server` and can drive
// signOut() per-test. `signOutResult` is swapped by each test before POST runs.
let signOutResult: { error: { message: string } | null };
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      signOut: () => Promise.resolve(signOutResult),
    },
  }),
}));

/**
 * Minimal Astro APIContext stand-in. `redirect` records its target and returns a
 * sentinel Response so the test asserts on WHERE the handler sends the user.
 */
function makeContext() {
  const redirect = vi.fn((location: string) => new Response(null, { status: 302, headers: { location } }));
  const context = {
    request: { headers: new Headers() },
    cookies: {},
    redirect,
  } as unknown as APIContext;
  return { context, redirect };
}

describe("POST /api/auth/signout", () => {
  beforeEach(() => {
    signOutResult = { error: null };
  });

  it("surfaces the error instead of reporting a clean success when sign-out fails", async () => {
    signOutResult = { error: { message: "network down" } };
    const { context, redirect } = makeContext();

    await POST(context);

    // The bug: the handler swallowed this error and redirected to "/" anyway.
    expect(redirect).toHaveBeenCalledWith("/auth/signin?error=network%20down");
    expect(redirect).not.toHaveBeenCalledWith("/");
  });

  it("redirects home on a successful sign-out", async () => {
    const { context, redirect } = makeContext();

    await POST(context);

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
