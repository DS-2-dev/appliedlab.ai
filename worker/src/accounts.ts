// Projectum accounts and their saved projects, for the static site.
//
// Sign-in is a 6-digit code sent to the address, so the address is proven
// and the role taken from its domain (src/lib/email-rules.ts) can be
// trusted: @weber.edu is a rep, @mail.weber.edu a member, anything else a
// partner. A first sign-in also asks for a name and makes the account.
// Partners start pending; the Lab's approver gets an email with a link that
// approves them.
//
// The browser keeps the session token and sends it as a bearer token, since
// the site (GitHub Pages) and this Worker are on different domains. Only the
// token's hash is stored.
//
// Problems, claims and project boards are in pipeline.ts.

import { looksLikeEmail, normalizeEmail, roleForEmail, type AccountRole } from "@/lib/email-rules";
import { isThumbnail } from "@/lib/projects";

export interface AccountEnv {
  DB: D1Database;
  // Submitted final reports (pipeline.ts).
  REPORTS: KVNamespace;
  LOGIN_LIMITER: RateLimit;
  LOGIN_IP_LIMITER: RateLimit;
  // Hashes codes and signs approval links. A wrangler secret.
  AUTH_SECRET: string;
  // Resend (resend.com) sends the emails. Without a key, codes cannot be
  // sent, except locally, where DEV_CODES=1 returns them in the response.
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  DEV_CODES?: string;
  // Who approves new partners.
  APPROVER_EMAIL: string;
  // The site, for links in emails.
  SITE_URL: string;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_EMAIL = 254;
const MAX_PERSON_NAME = 80;

type Status = "active" | "pending" | "removed";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  status: Status;
  avatar: string | null;
}

// Who approves claims and new partners: reps, and the Lab's approver
// (APPROVER_EMAIL), whatever their own role.
export function isApprover(env: AccountEnv, u: { email: string; role: AccountRole; status: string }): boolean {
  return u.status === "active" && (u.role === "rep" || u.email === normalizeEmail(env.APPROVER_EMAIL));
}

// What the browser gets about the signed-in person.
function publicUser(u: UserRow, env: AccountEnv) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    avatar: u.avatar,
    approver: isApprover(env, u),
  };
}

const enc = new TextEncoder();

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Equal-time comparison of two hex strings.
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cleanPersonName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_PERSON_NAME) : "";
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function sendEmail(env: AccountEnv, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Applied AI Lab <login@appliedlab.ai>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) console.error("email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

export type Json = (body: unknown, status?: number) => Response;

// --- Sign in --------------------------------------------------------------

async function startLogin(req: Request, env: AccountEnv, ip: string, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!email || email.length > MAX_EMAIL || !looksLikeEmail(email)) return json({ error: "email" }, 400);

  const byIp = await env.LOGIN_IP_LIMITER.limit({ key: `start:${ip}` });
  const byEmail = await env.LOGIN_LIMITER.limit({ key: `email:${email}` });
  if (!byIp.success || !byEmail.success) return json({ error: "limited" }, 429);

  const existing = await env.DB.prepare("SELECT status FROM users WHERE email = ?").bind(email).first<{ status: Status }>();
  if (existing?.status === "removed") return json({ error: "removed" }, 403);

  const code = randomCode();
  await env.DB.prepare(
    "INSERT INTO login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0) " +
      "ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0",
  )
    .bind(email, await sha256(`${env.AUTH_SECRET}:${email}:${code}`), Date.now() + CODE_TTL_MS)
    .run();

  if (env.DEV_CODES === "1" && !env.RESEND_API_KEY) {
    console.log(`Sign-in code for ${email}: ${code}`);
    return json({ sent: true, devCode: code });
  }
  const sent = await sendEmail(
    env,
    email,
    `${code} is your Applied AI Lab code`,
    `Your sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.\n\nApplied AI Lab, Weber State University`,
  );
  if (!sent) return json({ error: "email-unavailable" }, 503);
  return json({ sent: true, existing: Boolean(existing) });
}

async function verifyLogin(req: Request, env: AccountEnv, ip: string, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { email?: unknown; code?: unknown; name?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || code.length !== 6) return json({ error: "code" }, 400);

  const byIp = await env.LOGIN_IP_LIMITER.limit({ key: `verify:${ip}` });
  const byEmail = await env.LOGIN_LIMITER.limit({ key: `verify:${email}` });
  if (!byIp.success || !byEmail.success) return json({ error: "limited" }, 429);

  const row = await env.DB.prepare("SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?")
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at < Date.now() || row.attempts >= MAX_ATTEMPTS) {
    if (row) await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
    return json({ error: "expired" }, 400);
  }
  if (!same(row.code_hash, await sha256(`${env.AUTH_SECRET}:${email}:${code}`))) {
    await env.DB.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    return json({ error: "code" }, 400);
  }

  let user = await env.DB.prepare("SELECT id, email, name, role, status, avatar FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (user?.status === "removed") return json({ error: "removed" }, 403);

  if (!user) {
    // A new account needs a name. The code stays good, so the form can ask
    // and send it again.
    const name = cleanPersonName(body?.name);
    if (!name) return json({ needsName: true });
    user = await createUser(env, req, email, name, null);
  }

  await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
  return json({ token: await issueSession(env, user.id), user: publicUser(user, env) });
}

// A new account, with the role its address gives it. Partners start pending
// and the approver is asked.
async function createUser(
  env: AccountEnv,
  req: Request,
  email: string,
  name: string,
  avatar: string | null,
): Promise<UserRow> {
  const role = roleForEmail(email);
  const user: UserRow = {
    id: crypto.randomUUID(),
    email,
    name,
    role,
    status: role === "partner" ? "pending" : "active",
    avatar,
  };
  await env.DB.prepare("INSERT INTO users (id, email, name, role, status, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(user.id, email, name, role, user.status, avatar, new Date().toISOString())
    .run();
  if (role === "partner") await askApproval(env, req, user);
  return user;
}

// A session for the account; the token goes to the browser, its hash here.
async function issueSession(env: AccountEnv, userId: string): Promise<string> {
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(
      await sha256(token),
      userId,
      Date.now() + SESSION_TTL_MS,
    ),
  ]);
  return token;
}

// --- Partner approval ------------------------------------------------------

async function approvalLink(env: AccountEnv, req: Request, userId: string): Promise<string> {
  const url = new URL("/approve", req.url);
  url.searchParams.set("u", userId);
  url.searchParams.set("t", await hmac(env.AUTH_SECRET, `approve:${userId}`));
  return url.toString();
}

async function askApproval(env: AccountEnv, req: Request, user: UserRow): Promise<void> {
  const link = await approvalLink(env, req, user.id);
  if (!env.RESEND_API_KEY) {
    console.log(`Approve partner ${user.email}: ${link}`);
    return;
  }
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `New partner on Projectum: ${user.name}`,
    `${user.name} (${user.email}) signed up as a partner organization.\n\nApprove them, so they can post problems:\n${link}\n\nIf you don't recognize them, ignore this email and they stay pending.`,
  );
}

export function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#111">` +
      `<h1 style="font-size:1.4rem">${escapeHtml(title)}</h1><p>${body}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function approvePartner(req: Request, env: AccountEnv): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!id || !same(token, await hmac(env.AUTH_SECRET, `approve:${id}`))) {
    return page("That link doesn't work", "It may have been copied incompletely.", 400);
  }
  const user = await env.DB.prepare("SELECT id, email, name, role, status, avatar FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();
  if (!user) return page("No such account", "It may have been deleted.", 404);
  if (user.status === "pending") {
    await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(id).run();
    await sendEmail(
      env,
      user.email,
      "You're approved on Projectum",
      `Hi ${user.name},\n\nThe Applied AI Lab approved your account. Log in to post problems for our students:\n${env.SITE_URL}/login\n\nApplied AI Lab, Weber State University`,
    );
  }
  return page("Approved", `${escapeHtml(user.name)} (${escapeHtml(user.email)}) can now post problems.`);
}

// --- Signed-in requests ----------------------------------------------------

export async function sessionUser(req: Request, env: AccountEnv): Promise<UserRow | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 100) return null;
  const user = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, u.role, u.status, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id " +
      "WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(await sha256(token), Date.now())
    .first<UserRow>();
  return user && user.status !== "removed" ? user : null;
}

async function updateMe(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { name?: unknown; avatar?: unknown } | null;
  if (!body) return json({ error: "body" }, 400);
  const next = { ...user };
  if ("name" in body) {
    const name = cleanPersonName(body.name);
    if (!name) return json({ error: "name" }, 400);
    next.name = name;
  }
  if ("avatar" in body) {
    if (body.avatar !== null && !isThumbnail(body.avatar)) return json({ error: "avatar" }, 400);
    next.avatar = body.avatar as string | null;
  }
  await env.DB.prepare("UPDATE users SET name = ?, avatar = ? WHERE id = ?").bind(next.name, next.avatar, user.id).run();
  return json({ user: publicUser(next, env) });
}

// The Lab's people, for adding teammates: active members and reps, by name.
// Partners get none, since they add no teammates.
async function listPeople(env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  if (user.role === "partner" || user.status !== "active") return json({ people: [] });
  const { results } = await env.DB.prepare(
    "SELECT id, name, role FROM users WHERE status = 'active' AND role IN ('member', 'rep') ORDER BY name COLLATE NOCASE",
  ).all<{ id: string; name: string; role: AccountRole }>();
  return json({ people: results });
}

// Everything under /auth/, /me and /people. Returns null for any other
// path, so the caller can route it elsewhere.
export async function handleAccounts(
  req: Request,
  env: AccountEnv,
  ip: string,
  headers: Record<string, string>,
): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  const json: Json = (body, status = 200) =>
    Response.json(body, { status, headers: { ...headers, "cache-control": "no-store" } });

  if (pathname === "/auth/start" && req.method === "POST") return startLogin(req, env, ip, json);
  if (pathname === "/auth/verify" && req.method === "POST") return verifyLogin(req, env, ip, json);

  const isAccountPath = pathname === "/me" || pathname === "/people" || pathname === "/auth/logout";
  if (!isAccountPath) return null;

  const user = await sessionUser(req, env);
  if (!user) return json({ error: "signed-out" }, 401);

  if (pathname === "/auth/logout" && req.method === "POST") {
    const token = (req.headers.get("authorization") ?? "").slice(7).trim();
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true });
  }
  if (pathname === "/me" && req.method === "GET") return json({ user: publicUser(user, env) });
  if (pathname === "/me" && req.method === "PATCH") return updateMe(req, env, user, json);
  if (pathname === "/people" && req.method === "GET") return listPeople(env, user, json);
  return json({ error: "not-found" }, 404);
}

// --- Google ---------------------------------------------------------------
//
// "Continue with Google" is a plain link to /auth/google/start, which sends
// the browser to Google and back to /auth/google/callback here. Google has
// proven the address, so the role comes from it just as with a code, and a
// first sign-in takes the name (and picture) from the Google account. The
// session token goes back to the site in the URL fragment, which never
// reaches a server, and the login page keeps it.
//
// The state Google carries is signed and tied to a cookie on this Worker,
// so a callback can only finish a sign-in this browser started.

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
  const headers = new Headers({ location: `${origin}/login/#${new URLSearchParams(fragment)}` });
  if (clearCookie) headers.append("set-cookie", `${NONCE_COOKIE}=; Path=/auth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
}

// Only the Lab's own sites, and only a same-site path to go on to.
function allowedOrigin(env: GoogleEnv, origin: string | null): string | null {
  const list = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return origin && list.includes(origin) ? origin : null;
}

function cleanNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next.slice(0, 300) : "/projectum";
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
  const payload = b64url(
    JSON.stringify({ o: origin, n: cleanNext(url.searchParams.get("next")), r: role, nonce, exp: Date.now() + STATE_TTL_MS }),
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
  let state: { o: string; n: string; r: AccountRole | null; nonce: string; exp: number };
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
  if (!issuerOk || claims.aud !== env.GOOGLE_CLIENT_ID || claims.email_verified !== true || typeof claims.email !== "string") {
    return fail("google-failed");
  }

  const email = normalizeEmail(claims.email);
  let user = await env.DB.prepare("SELECT id, email, name, role, status, avatar FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (user?.status === "removed") return fail("removed");
  if (!user && state.r && roleForEmail(email) !== state.r) return back(origin, { error: "wrong-email", role: state.r }, true);
  if (!user) {
    const name = cleanPersonName(claims.name) || email.split("@")[0];
    user = await createUser(env, req, email, name, await googlePicture(claims.picture));
  } else if (!user.avatar) {
    const avatar = await googlePicture(claims.picture);
    if (avatar) await env.DB.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(avatar, user.id).run();
  }
  return back(origin, { token: await issueSession(env, user.id), next: state.n }, true);
}

// The two Google routes, opened by the browser itself rather than called by
// the site, so they come before the origin check. Null for any other path.
export async function handleGoogle(req: Request, env: GoogleEnv): Promise<Response | null> {
  if (req.method !== "GET") return null;
  const { pathname } = new URL(req.url);
  if (pathname === "/auth/google/start") return googleStart(req, env);
  if (pathname === "/auth/google/callback") return googleCallback(req, env);
  return null;
}
