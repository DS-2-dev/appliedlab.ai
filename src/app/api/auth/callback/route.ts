// Where every emailed or redirected sign-in comes back to: Google, the
// confirmation link from sign-up, and the password reset link. It turns the
// code (or token hash) into a session, checks the account is allowed, and
// sends the person on.
//
// `flow` says which door they came through, so a failure gets the right
// message: a stale email link reads differently from a cancelled Google
// sign-in.

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { hasSupabase } from "@/lib/data/supabase";
import { isWeberEmail, safeNext } from "@/lib/auth-rules";
import { routeClient } from "@/lib/supabase-route";
import type { Profile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const flow = params.get("flow");
  const toLogin = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
  const failure = flow === "google" ? "google-failed" : "link-expired";

  if (!hasSupabase()) return NextResponse.redirect(new URL("/login", req.url));

  // Supabase reports provider-side failures in the query string. The only
  // database error an account can hit on creation is the Weber State trigger
  // in supabase/002-member-accounts.sql, so that one gets the domain message.
  const providerError = params.get("error_description") ?? params.get("error");
  if (providerError) {
    return toLogin(/database error saving new user/i.test(providerError) ? "google-domain" : failure);
  }

  // A reset link goes to the reset form, which safeNext would otherwise refuse
  // as an auth page. Everything else goes wherever it was headed.
  const destination =
    flow === "reset" ? "/reset-password" : safeNext(params.get("next"));
  const { client, apply } = routeClient(req);

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let error: unknown = null;
  if (code) {
    ({ error } = await client.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await client.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    return toLogin(failure);
  }
  if (error) return toLogin(failure);

  const { data } = await client.auth.getUser();
  const user = data.user;
  if (!user?.email) return toLogin(failure);

  // Belt and braces behind the trigger: an account that somehow exists with
  // another domain is signed straight back out.
  const refuse = async (reason: string) => {
    await client.auth.signOut();
    return apply(toLogin(reason));
  };
  if (!isWeberEmail(user.email)) return refuse("google-domain");

  const { data: profile } = await client
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as Pick<Profile, "status"> | null)?.status === "removed") return refuse("removed");

  return apply(NextResponse.redirect(new URL(destination, req.url)));
}
