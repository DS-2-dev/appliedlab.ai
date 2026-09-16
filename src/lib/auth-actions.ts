"use server";

// Every account form posts here. Server actions rather than API routes: Next
// checks the Origin header on every action, which is the CSRF defence, and
// the form works before any JavaScript has loaded.
//
// Each action validates again whatever the browser already checked, rate
// limits by IP, and then takes one of two paths: Supabase Auth when the club
// project is configured, or the local-preview store in development.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import { hasSupabase, sessionClient } from "@/lib/data/supabase";
import { DEMO_COOKIE, devAuthAllowed } from "@/lib/auth";
import {
  isWeberEmail,
  looksLikeEmail,
  normalizeEmail,
  passwordProblem,
  safeNext,
} from "@/lib/auth-rules";
import {
  LOCAL_SESSION_COOKIE,
  checkLocalPassword,
  createLocalUser,
  findLocalUserByEmail,
  issueLocalSession,
  issueResetToken,
  readResetToken,
  setLocalPassword,
} from "@/lib/local-accounts";
import { ipFromHeaders, rateLimited } from "@/lib/rate-limit";

export type AuthField = "name" | "email" | "password" | "form";

export interface AuthState {
  errors?: Partial<Record<AuthField, string>>;
  values?: { email?: string; name?: string };
  // Set once a confirmation or reset email has gone out.
  sent?: { email: string; devLink?: string };
}

const E = copy.auth.errors;
const MINUTE = 60 * 1000;

// Where the site is being served from, for the links Supabase puts in its
// emails. Next has already checked this Origin against the host before the
// action runs, so it is safe to build URLs from.
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function limited(form: string, max: number, windowMs: number): Promise<boolean> {
  return rateLimited(ipFromHeaders(await headers()), form, { max, windowMs });
}

function emailError(email: string): string | undefined {
  if (!email) return E.emailRequired;
  if (!looksLikeEmail(email)) return E.emailInvalid;
  if (!isWeberEmail(email)) return E.emailDomain;
  return undefined;
}

function newPasswordError(password: string): string | undefined {
  switch (passwordProblem(password)) {
    case "required":
      return E.passwordRequired;
    case "short":
      return E.passwordShort;
    case "long":
      return E.passwordLong;
    default:
      return undefined;
  }
}

function has(errors: AuthState["errors"]): errors is NonNullable<AuthState["errors"]> {
  return Boolean(errors && Object.keys(errors).length);
}

async function startLocalSession(uid: string): Promise<void> {
  const { token, expires } = await issueLocalSession(uid);
  (await cookies()).set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

// --- Log in -----------------------------------------------------------------

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const values = { email };

  const errors: AuthState["errors"] = {};
  const eErr = emailError(email);
  if (eErr) errors.email = eErr;
  if (!password) errors.password = E.passwordRequired;
  if (has(errors)) return { errors, values };

  // Ten tries in fifteen minutes: room for someone who cannot remember which
  // password they used, and a wall for anyone guessing.
  if (await limited("login", 10, 15 * MINUTE)) return { errors: { form: E.rateLimited }, values };

  if (hasSupabase()) {
    const client = await sessionClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "email_not_confirmed") return { errors: { form: E.unconfirmed }, values };
      if (error.code === "invalid_credentials") return { errors: { form: E.badCredentials }, values };
      if (error.status === 429) return { errors: { form: E.rateLimited }, values };
      return { errors: { form: E.generic }, values };
    }
    redirect(next);
  }

  if (!devAuthAllowed()) return { errors: { form: E.generic }, values };
  const user = await checkLocalPassword(email, password);
  // One message for an unknown email and a wrong password, so the form never
  // says which emails have accounts.
  if (!user) return { errors: { form: E.badCredentials }, values };
  await startLocalSession(user.id);
  redirect(next);
}

// --- Sign up ----------------------------------------------------------------

export async function signupAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const values = { email, name };

  const errors: AuthState["errors"] = {};
  if (!name) errors.name = E.nameRequired;
  const eErr = emailError(email);
  if (eErr) errors.email = eErr;
  const pErr = newPasswordError(password);
  if (pErr) errors.password = pErr;
  if (has(errors)) return { errors, values };

  if (await limited("signup", 5, 60 * MINUTE)) return { errors: { form: E.rateLimited }, values };

  if (hasSupabase()) {
    const client = await sessionClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${await siteOrigin()}/api/auth/callback?flow=email&next=/projectum`,
      },
    });
    if (error) {
      if (error.code === "user_already_exists") return { errors: { email: E.exists }, values };
      if (error.code === "weak_password") return { errors: { password: E.passwordShort }, values };
      if (error.status === 429) return { errors: { form: E.rateLimited }, values };
      // The domain trigger surfaces as a generic database error from the auth
      // API. The form already checked the domain, so reaching this means the
      // request skipped the form, and the plain domain message still fits.
      if (/database error saving new user/i.test(error.message)) {
        return { errors: { email: E.emailDomain }, values };
      }
      return { errors: { form: E.generic }, values };
    }
    // With "Confirm email" on there is no session yet. Supabase also answers
    // an already-registered address this way, deliberately, so the form does
    // not reveal which emails have accounts.
    if (data.session) redirect("/projectum");
    return { sent: { email } };
  }

  if (!devAuthAllowed()) return { errors: { form: E.generic }, values };
  const created = await createLocalUser({ email, full_name: name, password });
  if (created === "exists") return { errors: { email: E.exists }, values };
  await startLocalSession(created.id);
  redirect("/projectum");
}

// --- Forgot password --------------------------------------------------------

export async function forgotAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const values = { email };
  const eErr = emailError(email);
  if (eErr) return { errors: { email: eErr }, values };

  if (await limited("forgot", 5, 60 * MINUTE)) return { errors: { form: E.rateLimited }, values };

  if (hasSupabase()) {
    const client = await sessionClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteOrigin()}/api/auth/callback?flow=reset&next=/reset-password`,
    });
    if (error?.status === 429) return { errors: { form: E.rateLimited }, values };
    // Every other outcome, an unknown address included, reads the same.
    return { sent: { email } };
  }

  if (!devAuthAllowed()) return { errors: { form: E.generic }, values };
  const user = await findLocalUserByEmail(email);
  const devLink = user
    ? `/reset-password?token=${encodeURIComponent(await issueResetToken(user.id))}`
    : undefined;
  return { sent: { email, devLink } };
}

// --- Reset password ---------------------------------------------------------

export async function resetAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  const pErr = newPasswordError(password);
  if (pErr) return { errors: { password: pErr } };

  if (await limited("reset", 10, 15 * MINUTE)) return { errors: { form: E.rateLimited } };

  if (hasSupabase()) {
    // The reset link signed this browser in through /api/auth/callback, so
    // the recovery session is what authorises the change.
    const client = await sessionClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return { errors: { form: E.linkExpired } };
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password") return { errors: { password: E.samePassword } };
      if (error.code === "weak_password") return { errors: { password: E.passwordShort } };
      return { errors: { form: E.generic } };
    }
    redirect("/projectum");
  }

  if (!devAuthAllowed()) return { errors: { form: E.generic } };
  const uid = await readResetToken(String(form.get("token") ?? ""));
  if (!uid) return { errors: { form: E.linkExpired } };
  await setLocalPassword(uid, password);
  await startLocalSession(uid);
  redirect("/projectum");
}

// --- Log out ----------------------------------------------------------------

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  store.delete(LOCAL_SESSION_COOKIE);
  if (hasSupabase()) {
    const client = await sessionClient();
    await client.auth.signOut();
  }
  redirect("/");
}

// --- Local preview: the Projectum demo -----------------------------------------

// One click into /projectum as a demo account, for working on that page without
// signing up. Local preview only, behind the same guard as local accounts.
export async function projectumDemoAction(): Promise<void> {
  if (!devAuthAllowed()) redirect("/login");
  (await cookies()).set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/projectum");
}
