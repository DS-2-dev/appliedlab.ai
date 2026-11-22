// Projectum accounts and their saved projects, for the static site.
//
// Sign-in is a 6-digit code sent to the address, so the address is proven
// and the role taken from its domain (src/lib/email-rules.ts) can be
// trusted: @weber.edu is a rep, @mail.weber.edu a member, anything else a
// partner. A first sign-in also asks for a name and a password and makes the
// account; after that the password signs in on its own (src/passwords.ts),
// and a code still works, which is also how a forgotten password is reset.
// Partners start pending; the Lab's approver gets an email with a link that
// approves them.
//
// The browser keeps the session token and sends it as a bearer token, since
// the site (GitHub Pages) and this Worker are on different domains. Only the
// token's hash is stored.
//
// Postings, projects, boards and submissions are in postings.ts, projects.ts, boards.ts and submissions.ts.

import { looksLikeEmail, normalizeEmail, roleForEmail, type AccountRole } from "@/lib/email-rules";
import { askApproval } from "./account-approval";
export { approvalLink, approvedTitle, approvedEmail, approvePartner, page } from "./account-approval";
import { activeDisciplineSlugs } from "./taxonomy";
import { notifyAdminsOfPending, onPartnerSignUp } from "./orgs";
import { isThumbnail } from "@/lib/projects";
import { MAX_PASSWORD, checkPassword, hashPassword, passwordProblem } from "./passwords";

import {
  type AccountEnv,
  type Status,
  USER_COLS,
  type UserRow,
  isAdmin,
  accountOut,
  handleFor,
  sha256,
  same,
  randomCode,
  randomToken,
  cleanPersonName,
  sendEmail,
  type Json,
} from "./account-helpers";

export { USER_COLS, rolesOf, isAdmin, hasRole, isStaff, handleFor, escapeHtml, sendEmail } from "./account-helpers";
export type { AccountEnv, UserRow, Json, Level } from "./account-helpers";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_EMAIL = 254;

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
  const codeHash = await sha256(`${env.AUTH_SECRET}:${email}:${code}`);
  const expiresAt = Date.now() + CODE_TTL_MS;
  await env.DB.prepare(
    "INSERT INTO login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0) " +
      "ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, " +
      // Wrong guesses carry over to a fresh code until the last one would
      // have expired, so asking again doesn't buy more guesses.
      "attempts = CASE WHEN login_codes.expires_at > ? THEN login_codes.attempts ELSE 0 END",
  )
    .bind(email, codeHash, expiresAt, Date.now())
    .run();

  if (env.DEV_CODES === "1" && !env.RESEND_API_KEY) {
    return json({ sent: true, devCode: code });
  }
  const sent = await sendEmail(
    env,
    email,
    "Your Applied AI Lab sign-in code",
    `Your sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.\n\nApplied AI Lab, Weber State University`,
  ).catch(() => false);
  if (!sent) {
    await env.DB.prepare("DELETE FROM login_codes WHERE email = ? AND code_hash = ? AND expires_at = ?")
      .bind(email, codeHash, expiresAt).run();
    return json({ error: "email-unavailable" }, 503);
  }
  return json({ sent: true, existing: Boolean(existing) });
}

async function verifyLogin(req: Request, env: AccountEnv, ip: string, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    code?: unknown;
    name?: unknown;
    password?: unknown;
    reset?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || code.length !== 6) return json({ error: "code" }, 400);

  const byIp = await env.LOGIN_IP_LIMITER.limit({ key: `verify:${ip}` });
  const byEmail = await env.LOGIN_LIMITER.limit({ key: `verify:${email}` });
  if (!byIp.success || !byEmail.success) return json({ error: "limited" }, 429);

  // Each guess is counted before it's checked, in one step, so guesses sent
  // at once can't share an attempt.
  const row = await env.DB.prepare(
    "UPDATE login_codes SET attempts = attempts + 1 WHERE email = ? AND expires_at > ? AND attempts < ? RETURNING code_hash, expires_at",
  )
    .bind(email, Date.now(), MAX_ATTEMPTS)
    .first<{ code_hash: string; expires_at: number }>();
  if (!row) return json({ error: "expired" }, 400);
  if (!same(row.code_hash, await sha256(`${env.AUTH_SECRET}:${email}:${code}`))) return json({ error: "code" }, 400);

  let user = await env.DB.prepare(`SELECT ${USER_COLS}, password_hash FROM users WHERE email = ?`)
    .bind(email)
    .first<UserRow & { password_hash: string | null }>();
  if (user?.status === "removed") return json({ error: "removed" }, 403);

  // A new account needs a name, and every account needs a password: a new
  // one, one from before passwords, or one being reset. The code stays good,
  // so the form can ask and send it again.
  const name = cleanPersonName(body?.name);
  const password = typeof body?.password === "string" ? body.password : "";
  const needsName = !user && !name;
  const needsPassword = (!user?.password_hash || body?.reset === true) && !password;
  const weak = password ? passwordProblem(password) : null;
  if (needsName || needsPassword || weak) {
    // A right code that only lacked these doesn't count as a guess.
    await env.DB.prepare("UPDATE login_codes SET attempts = attempts - 1 WHERE email = ? AND code_hash = ? AND expires_at = ?")
      .bind(email, row.code_hash, row.expires_at).run();
    if (weak) return json({ error: weak }, 400);
    return json({ ...(needsName && { needsName: true }), ...(needsPassword && { needsPassword: true }) });
  }

  const consumed = await env.DB.prepare(
    "DELETE FROM login_codes WHERE email = ? AND code_hash = ? AND expires_at = ? AND expires_at > ?",
  ).bind(email, row.code_hash, row.expires_at, Date.now()).run();
  if (!consumed.meta.changes) return json({ error: "expired" }, 400);

  const replacing = Boolean(user?.password_hash);
  if (!user) user = { ...(await createUser(env, req, email, name, null)), password_hash: null };
  const stmts: D1PreparedStatement[] = [];
  if (password) {
    stmts.push(env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(password), user.id));
    // A new password signs out everywhere else, in case the old one leaked.
    if (replacing) stmts.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ token: await issueSession(env, user.id), user: await accountOut(user, env) });
}

// Whether the address signs in with a password, so the form knows whether to
// ask for one or send a code.
async function checkLogin(req: Request, env: AccountEnv, ip: string, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!email || email.length > MAX_EMAIL || !looksLikeEmail(email)) return json({ error: "email" }, 400);
  const byIp = await env.LOGIN_IP_LIMITER.limit({ key: `check:${ip}` });
  if (!byIp.success) return json({ error: "limited" }, 429);
  const row = await env.DB.prepare("SELECT status, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ status: Status; password_hash: string | null }>();
  if (row?.status === "removed") return json({ error: "removed" }, 403);
  return json({ password: Boolean(row?.password_hash) });
}

async function passwordLogin(req: Request, env: AccountEnv, ip: string, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || password.length > MAX_PASSWORD) return json({ error: "password" }, 400);

  const byIp = await env.LOGIN_IP_LIMITER.limit({ key: `password:${ip}` });
  const byEmail = await env.LOGIN_LIMITER.limit({ key: `password:${email}` });
  if (!byIp.success || !byEmail.success) return json({ error: "limited" }, 429);

  const user = await env.DB.prepare(`SELECT ${USER_COLS}, password_hash FROM users WHERE email = ?`)
    .bind(email)
    .first<UserRow & { password_hash: string | null }>();
  if (!user?.password_hash || !(await checkPassword(password, user.password_hash))) return json({ error: "password" }, 400);
  if (user.status === "removed") return json({ error: "removed" }, 403);
  return json({ token: await issueSession(env, user.id), user: await accountOut(user, env) });
}

// A new account, with the role its address gives it. Partners and faculty
// start pending and the approver is asked, unless the address is itself an
// approver's.
export async function createUser(
  env: AccountEnv,
  req: Request,
  email: string,
  name: string,
  avatar: string | null,
  googleSubject: string | null = null,
): Promise<UserRow> {
  const role = roleForEmail(email);
  const user: UserRow = {
    id: crypto.randomUUID(),
    email,
    name,
    role,
    status: "active",
    avatar,
    roles: JSON.stringify([role]),
    org_id: null,
    level: "affiliate",
    level_locked: 0,
    interests: "[]",
  };
  // isAdmin needs status "active", so the row starts active before this check.
  if ((role === "partner" || role === "rep") && !isAdmin(env, user)) user.status = "pending";
  await env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, avatar, created_at, google_subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(user.id, email, name, role, user.roles, user.status, avatar, new Date().toISOString(), googleSubject)
    .run();
  if (user.status === "pending") {
    const stmts: D1PreparedStatement[] = [];
    const asked = await onPartnerSignUp(env, stmts, user);
    if (asked) {
      // The org's primary decides, so the admin isn't asked.
      await env.DB.batch(stmts);
      await asked.after();
    } else {
      await askApproval(env, req, user);
      await notifyAdminsOfPending(env, stmts, user);
      await env.DB.batch(stmts);
    }
  }
  return user;
}

// A session for the account; the token goes to the browser, its hash here.
export async function issueSession(env: AccountEnv, userId: string): Promise<string> {
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

// --- Signed-in requests ----------------------------------------------------

export async function sessionUser(req: Request, env: AccountEnv): Promise<UserRow | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 100) return null;
  const user = await env.DB.prepare(
    `SELECT ${USER_COLS.split(", ").map((c) => `u.${c}`).join(", ")} FROM sessions s JOIN users u ON u.id = s.user_id ` +
      "WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(await sha256(token), Date.now())
    .first<UserRow>();
  return user && user.status !== "removed" ? user : null;
}

async function updateMe(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { name?: unknown; avatar?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "body" }, 400);
  const next = { ...user };
  if ("name" in body) {
    const name = cleanPersonName(body.name);
    if (!name) return json({ error: "name" }, 400);
    next.name = name;
  }
  if ("profilePublic" in body) {
    if (user.role !== "member") return json({ error: "profile" }, 400);
    next.profile_public = body.profilePublic === true ? 1 : 0;
    // The address is made the first time the profile goes public, and kept.
    if (next.profile_public && !next.handle) next.handle = handleFor(next.name);
  }
  if ("hideName" in body) {
    if (user.role !== "partner") return json({ error: "hide" }, 400);
    next.hide_name = body.hideName === true ? 1 : 0;
  }
  if ("interests" in body) {
    if (user.role !== "member" || !Array.isArray(body.interests)) return json({ error: "interests" }, 400);
    // Only the disciplines on offer now, each once.
    const offered = new Set(await activeDisciplineSlugs(env));
    const picked = [...new Set(body.interests.filter((t): t is string => typeof t === "string" && offered.has(t)))];
    next.interests = JSON.stringify(picked);
  }
  if ("digest" in body) {
    if (typeof body.digest !== "boolean") return json({ error: "digest" }, 400);
    next.digest = body.digest ? 1 : 0;
  }
  if ("avatar" in body) {
    if (body.avatar !== null && !isThumbnail(body.avatar)) return json({ error: "avatar" }, 400);
    next.avatar = body.avatar as string | null;
  }
  for (let tries = 0; ; tries++) {
    const r = await env.DB.prepare("UPDATE users SET name = ?, avatar = ?, profile_public = ?, handle = ?, hide_name = ?, interests = ?, digest = ? WHERE id = ?")
      .bind(next.name, next.avatar, next.profile_public ?? 0, next.handle ?? null, next.hide_name ?? 0, next.interests ?? "[]", next.digest ?? 0, user.id)
      .run()
      .catch((e: unknown) => e);
    if (!(r instanceof Error)) break;
    // A handle someone already has: make another.
    if (tries > 3 || !/UNIQUE/.test(r.message)) throw r;
    next.handle = handleFor(next.name);
  }
  return json({ user: await accountOut(next, env) });
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
  if (pathname === "/auth/check" && req.method === "POST") return checkLogin(req, env, ip, json);
  if (pathname === "/auth/password" && req.method === "POST") return passwordLogin(req, env, ip, json);

  const isAccountPath = pathname === "/me" || pathname === "/people" || pathname === "/auth/logout";
  if (!isAccountPath) return null;

  const user = await sessionUser(req, env);
  if (!user) return json({ error: "signed-out" }, 401);

  if (pathname === "/auth/logout" && req.method === "POST") {
    const token = (req.headers.get("authorization") ?? "").slice(7).trim();
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true });
  }
  if (pathname === "/me" && req.method === "GET") return json({ user: await accountOut(user, env) });
  if (pathname === "/me" && req.method === "PATCH") return updateMe(req, env, user, json);
  if (pathname === "/people" && req.method === "GET") return listPeople(env, user, json);
  return json({ error: "not-found" }, 404);
}
