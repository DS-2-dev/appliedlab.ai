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
// Who sees what: members and reps see every project, partners only their
// own. Only a project's owner, or a rep, can change or delete it.

import { looksLikeEmail, normalizeEmail, roleForEmail, type AccountRole } from "@/lib/email-rules";
import { cleanProjects, isThumbnail, type Project } from "@/lib/projects";

export interface AccountEnv {
  DB: D1Database;
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

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  status: Status;
  avatar: string | null;
}

// What the browser gets about the signed-in person.
function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, avatar: u.avatar };
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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function sendEmail(env: AccountEnv, to: string, subject: string, text: string): Promise<boolean> {
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

type Json = (body: unknown, status?: number) => Response;

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
    const role = roleForEmail(email);
    user = {
      id: crypto.randomUUID(),
      email,
      name,
      role,
      status: role === "partner" ? "pending" : "active",
      avatar: null,
    };
    await env.DB.prepare("INSERT INTO users (id, email, name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.id, email, name, role, user.status, new Date().toISOString())
      .run();
    if (role === "partner") await askApproval(env, req, user);
  }

  await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(
      await sha256(token),
      user.id,
      Date.now() + SESSION_TTL_MS,
    ),
  ]);
  return json({ token, user: publicUser(user) });
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

function page(title: string, body: string, status = 200): Response {
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

async function sessionUser(req: Request, env: AccountEnv): Promise<UserRow | null> {
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

interface ProjectRow {
  id: string;
  owner_id: string;
  data: string;
  owner_name: string;
  owner_email: string;
  owner_role: AccountRole;
}

function projectOut(row: ProjectRow) {
  const [project] = cleanProjects([JSON.parse(row.data)]);
  if (!project) return null;
  return {
    project,
    owner: { id: row.owner_id, name: row.owner_name, email: row.owner_email, role: row.owner_role },
  };
}

async function listProjects(env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const select =
    "SELECT p.id, p.owner_id, p.data, u.name AS owner_name, u.email AS owner_email, u.role AS owner_role " +
    "FROM projects p JOIN users u ON u.id = p.owner_id";
  const { results } =
    user.role === "partner"
      ? await env.DB.prepare(`${select} WHERE p.owner_id = ? ORDER BY p.created_at`).bind(user.id).all<ProjectRow>()
      : await env.DB.prepare(`${select} WHERE u.status = 'active' ORDER BY p.created_at`).all<ProjectRow>();
  return json({ projects: results.map(projectOut).filter(Boolean) });
}

async function saveProject(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  if (user.status !== "active") return json({ error: "pending" }, 403);
  const body = (await req.json().catch(() => null)) as { project?: unknown } | null;
  const [project] = cleanProjects([body?.project]) as Project[];
  if (!project || project.id !== id) return json({ error: "project" }, 400);

  const row = await env.DB.prepare("SELECT owner_id FROM projects WHERE id = ?").bind(id).first<{ owner_id: string }>();
  const now = new Date().toISOString();
  if (!row) {
    await env.DB.prepare("INSERT INTO projects (id, owner_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, user.id, JSON.stringify(project), now, now)
      .run();
  } else if (row.owner_id === user.id || user.role === "rep") {
    await env.DB.prepare("UPDATE projects SET data = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(project), now, id)
      .run();
  } else {
    return json({ error: "forbidden" }, 403);
  }
  return json({ project });
}

async function deleteProject(env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const row = await env.DB.prepare("SELECT owner_id FROM projects WHERE id = ?").bind(id).first<{ owner_id: string }>();
  if (!row) return json({ ok: true });
  if (row.owner_id !== user.id && user.role !== "rep") return json({ error: "forbidden" }, 403);
  await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
  return json({ ok: true });
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
  return json({ user: publicUser(next) });
}

// Everything under /auth/ and /me and /projects. Returns null for any other
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

  const isAccountPath = pathname === "/me" || pathname === "/auth/logout" || pathname.startsWith("/projects");
  if (!isAccountPath) return null;

  const user = await sessionUser(req, env);
  if (!user) return json({ error: "signed-out" }, 401);

  if (pathname === "/auth/logout" && req.method === "POST") {
    const token = (req.headers.get("authorization") ?? "").slice(7).trim();
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true });
  }
  if (pathname === "/me" && req.method === "GET") return json({ user: publicUser(user) });
  if (pathname === "/me" && req.method === "PATCH") return updateMe(req, env, user, json);
  if (pathname === "/projects" && req.method === "GET") {
    if (user.status !== "active") return json({ projects: [] });
    return listProjects(env, user, json);
  }
  const match = pathname.match(/^\/projects\/([\w-]{1,64})$/);
  if (match && req.method === "PUT") return saveProject(req, env, user, match[1], json);
  if (match && req.method === "DELETE") return deleteProject(env, user, match[1], json);
  return json({ error: "not-found" }, 404);
}
