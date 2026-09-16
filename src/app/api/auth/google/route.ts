// Starts Google sign-in. The browser lands here from the Google button and
// is sent on to Google's account picker, with the PKCE verifier cookie set on
// the way so the callback can finish the exchange.
//
// `prompt: select_account` makes Google show the picker even when a personal
// account is already signed in, which is the usual way someone ends up trying
// a Gmail address. The Weber State rule itself is enforced in the database
// and checked again in the callback, because a hint to Google is only a hint.

import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase } from "@/lib/data/supabase";
import { safeNext } from "@/lib/auth-rules";
import { routeClient } from "@/lib/supabase-route";

export async function GET(req: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.redirect(new URL("/login?error=google-unavailable", req.url));
  }
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const { client, apply } = routeClient(req);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${req.nextUrl.origin}/api/auth/callback?flow=google&next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=google-failed", req.url));
  }
  return apply(NextResponse.redirect(data.url));
}
