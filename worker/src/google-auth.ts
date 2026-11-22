import { normalizeEmail, roleForEmail, type AccountRole } from "@/lib/email-rules";
import { isThumbnail } from "@/lib/projects";
import { createUser, issueSession } from "./accounts";
import { page } from "./account-approval";
import {
  type AccountEnv, type UserRow, cleanPersonName, hmac, randomToken,
  same, sendEmail, sha256,
} from "./account-helpers";

export interface GoogleEnv extends AccountEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS: string;
}

const NONCE_COOKIE = "g_nonce";
const STATE_TTL_MS = 10 * 60 * 1000;

const b64url = (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (text: string) => atob(text.replace(/-/g, "+").replace(/_/g, "/"));

function back(origin: string, fragment: Record<string, string>, clearCookie = false): Response {
  const headers = new Headers({ "cache-control": "no-store", "referrer-policy": "no-referrer", location: `${origin}/login/#${new URLSearchParams(fragment)}` });
  if (clearCookie) headers.append("set-cookie", `${NONCE_COOKIE}=; Path=/auth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
}

// Only the Lab's own sites, and only a same-site path to go on to.
function allowedOrigin(env: GoogleEnv, origin: string | null): string | null {
  const list = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return origin && list.includes(origin) ? origin : null;
}

function cleanNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next.slice(0, 300) : "/w";
}

function readCookie(req: Request, name: string): string | null {
  const found = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

// The Google picture, downsized by Google and kept inline like an upload.
// Best effort: no picture is fine.
async function googlePicture(url: unknown): Promise<string | null> {
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  try {
    const res = await fetch(url.replace(/=s\d+(-c)?$/, "=s256-c"));
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 280_000) return null;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const data = `data:${type};base64,${btoa(binary)}`;
    return isThumbnail(data) ? data : null;
  } catch {
    return null;
  }
}

async function googleStart(req: Request, env: GoogleEnv): Promise<Response> {
  const url = new URL(req.url);
  const origin = allowedOrigin(env, url.searchParams.get("origin"));
  if (!origin) return page("That link doesn't work", "Start from the Lab's login page.", 400);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return back(origin, { error: "google-unavailable" });

  // From Sign up, the role the person picked. A new account whose Google
  // address gives a different role is turned back with a note on which
  // address to use. The role itself still comes from the address.
  const picked = url.searchParams.get("role");
  const role = picked === "rep" || picked === "member" || picked === "partner" ? picked : null;
  const nonce = randomToken();
  // The page's own nonce, handed back with the session so the login page
  // only takes a session it asked for: a link carrying someone else's
  // session can't sign a visitor in as them.
  const pageNonce = url.searchParams.get("nonce") ?? "";
  if (!/^[\w-]{16,64}$/.test(pageNonce)) return back(origin, { error: "google-failed" });
  const payload = b64url(
    JSON.stringify({ o: origin, n: cleanNext(url.searchParams.get("next")), r: role, c: pageNonce, nonce, exp: Date.now() + STATE_TTL_MS }),
  );
  const state = `${payload}.${await hmac(env.AUTH_SECRET, `google:${payload}`)}`;
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", new URL("/auth/google/callback", req.url).toString());
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");
  return new Response(null, {
    status: 302,
    headers: {
      location: google.toString(),
      "set-cookie": `${NONCE_COOKIE}=${nonce}; Path=/auth/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

async function googleCallback(req: Request, env: GoogleEnv): Promise<Response> {
  const url = new URL(req.url);
  const [payload, sig] = (url.searchParams.get("state") ?? "").split(".");
  if (!payload || !sig || !same(sig, await hmac(env.AUTH_SECRET, `google:${payload}`))) {
    return page("That sign-in didn't finish", "Start again from the Lab's login page.", 400);
  }
  let state: { o: string; n: string; r: AccountRole | null; c: string; nonce: string; exp: number };
  try {
    state = JSON.parse(unb64url(payload));
  } catch {
    return page("That sign-in didn't finish", "Start again from the Lab's login page.", 400);
  }
  const origin = allowedOrigin(env, state.o);
  if (!origin) return page("That sign-in didn't finish", "Start again from the Lab's login page.", 400);
  const fail = (error: string) => back(origin, { error }, true);

  const cookie = readCookie(req, NONCE_COOKIE);
  if (state.exp < Date.now() || !cookie || !same(cookie, state.nonce)) return fail("google-failed");
  const code = url.searchParams.get("code");
  if (!code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail("google-failed");

  // The ID token comes straight from Google over TLS, so its claims can be
  // read without checking its signature (OpenID Connect Core 3.1.3.7).
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL("/auth/google/callback", req.url).toString(),
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await res.json().catch(() => ({}))) as { id_token?: string };
  if (!res.ok || !tokens.id_token) return fail("google-failed");
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(unb64url(tokens.id_token.split(".")[1]));
  } catch {
    return fail("google-failed");
  }
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255 ||
      typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) return fail("google-failed");
  if (!issuerOk || claims.aud !== env.GOOGLE_CLIENT_ID || claims.email_verified !== true || typeof claims.email !== "string") {
    return fail("google-failed");
  }

  const email = normalizeEmail(claims.email);
  const subject = claims.sub;
  const linked = await env.DB.prepare("SELECT id, email, status FROM users WHERE google_subject = ?")
    .bind(subject).first<Pick<UserRow, "id" | "email" | "status">>();
  if (linked) {
    if (linked.status === "removed") return fail("removed");
    if (linked.email !== email) return fail("google-failed");
    return back(origin, { token: await issueSession(env, linked.id), next: state.n, nonce: state.c }, true);
  }

  const existing = await env.DB.prepare("SELECT id, status, google_subject FROM users WHERE email = ?")
    .bind(email).first<{ id: string; status: string; google_subject: string | null }>();
  if (existing?.status === "removed") return fail("removed");
  if (existing?.google_subject) return fail("google-failed");
  if (!existing && state.r && roleForEmail(email) !== state.r) return back(origin, { error: "wrong-email", role: state.r }, true);

  const rate = await env.LOGIN_LIMITER.limit({ key: `google-link:${email}` });
  if (!rate.success) return page("Try again later", "Too many verification requests.", 429);
  const proof = randomToken().slice(0, 22);
  const browserHash = await sha256(cookie);
  const proofHash = await sha256(proof);
  const context: LinkContext = {
    email, subject, userId: existing?.id ?? null, name: cleanPersonName(claims.name) || email.split("@")[0],
    picture: typeof claims.picture === "string" ? claims.picture : null, origin, next: state.n, nonce: state.c,
  };
  await env.DB.batch([
    env.DB.prepare("DELETE FROM google_link_challenges WHERE expires_at <= ?").bind(Date.now()),
    env.DB.prepare("INSERT OR REPLACE INTO google_link_challenges (browser_hash, proof_hash, expires_at, context) VALUES (?, ?, ?, ?)")
      .bind(browserHash, proofHash, state.exp, JSON.stringify(context)),
  ]);
  const sent = await sendEmail(env, email, "Confirm Google sign-in for the Applied AI Lab",
    `Enter this code in the browser where you started linking Google: ${proof}\n\nIf you did not start this request, ignore it.`
  ).catch(() => false);
  if (!sent) {
    await env.DB.prepare("DELETE FROM google_link_challenges WHERE browser_hash = ? AND proof_hash = ?")
      .bind(browserHash, proofHash).run();
    return fail("email-unavailable");
  }
  return page("Confirm your email", `Enter the code we emailed you to link this Google account.</p>
    <form method="post" action="/auth/google/confirm"><label>Confirmation code <input name="proof" required autocomplete="one-time-code"></label>
    <button type="submit">Confirm</button></form><p>`);
}

interface LinkContext {
  email: string;
  subject: string;
  userId: string | null;
  name: string;
  picture: string | null;
  origin: string;
  next: string;
  nonce: string;
}

async function confirmGoogle(req: Request, env: GoogleEnv): Promise<Response> {
  const denied = () => page("Confirmation failed", "Check the code or start Google sign-in again.", 400);
  const cookie = readCookie(req, NONCE_COOKIE);
  if (!cookie || req.headers.get("origin") !== new URL(req.url).origin) return denied();
  const form = await req.formData().catch(() => null);
  const proof = form?.get("proof");
  if (typeof proof !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(proof)) return denied();
  const row = await env.DB.prepare(
    "DELETE FROM google_link_challenges WHERE browser_hash = ? AND proof_hash = ? AND expires_at > ? RETURNING context",
  ).bind(await sha256(cookie), await sha256(proof), Date.now()).first<{ context: string }>();
  if (!row) return denied();
  const link: LinkContext = JSON.parse(row.context);
  if (!allowedOrigin(env, link.origin)) return denied();

  let id = link.userId;
  if (id) {
    const result = await env.DB.prepare(
      "UPDATE users SET google_subject = ? WHERE id = ? AND email = ? AND status <> 'removed' AND google_subject IS NULL",
    ).bind(link.subject, id, link.email).run();
    if (!result.meta.changes) return denied();
  } else {
    // A unique email and subject prevent attaching this challenge to an account created in the meantime.
    const user = await createUser(env, req, link.email, link.name, await googlePicture(link.picture), link.subject);
    id = user.id;
  }
  return back(link.origin, { token: await issueSession(env, id), next: link.next, nonce: link.nonce }, true);
}

// The two Google routes, opened by the browser itself rather than called by
// the site, so they come before the origin check. Null for any other path.
export async function handleGoogle(req: Request, env: GoogleEnv): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname === "/auth/google/confirm" && req.method === "POST") return confirmGoogle(req, env);
  if (req.method !== "GET") return null;
  if (pathname === "/auth/google/start") return googleStart(req, env);
  if (pathname === "/auth/google/callback") return googleCallback(req, env);
  return null;
}
