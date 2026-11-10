// The admin's views and switches, and the public member profile.
//
//   GET  /overview                every posting, project and account, the organizations and pending join requests (admin)
//   POST /accounts/:id/status     { status: active|removed } (admin)
//   POST /accounts/:id/claude     { granted } a member's funded Claude account (admin)
//   POST /accounts/:id/level      { level: affiliate|sponsored|builder } a member's level, set only here (admin)
//   POST /accounts/:id/approve    a pending partner or faculty account, in the app (admin)
//   POST /partners/:id/approve    the same, kept as an alias
//   GET  /profiles/:handle        public, no account needed
//
// /overview keeps the shape the site's overview reads (problems, claims,
// people), now built from postings and projects, with each project's own
// status beside the older claim status.

import type { AccountRole } from "@/lib/email-rules";
import type { ProjectStatus } from "@/lib/pipeline/domain";
import { cleanProjects } from "@/lib/projects";
import { approvedEmail, approvedTitle, isAdmin, isStaff, sendEmail, type AccountEnv, type Json, type UserRow } from "./accounts";
import { json as parse } from "./db";
import { emit } from "./events";
import { ensureOrgFor } from "./orgs";

type Env = AccountEnv;
type Person = { id: string; name: string };

const PRE_APPROVAL: readonly ProjectStatus[] = ["claimed", "plan_review", "plan_returned"];
// Work the Lab approved: what a profile shows.
const DELIVERED: readonly ProjectStatus[] = ["delivered", "integrated", "completion_review", "complete"];

// The older claim status a project reads as.
function claimStatus(s: ProjectStatus): "pending" | "approved" | "withdrawn" {
  if (s === "withdrawn") return "withdrawn";
  return PRE_APPROVAL.includes(s) ? "pending" : "approved";
}

type PostingRowOut = {
  id: string;
  author_id: string;
  owner_name: string;
  title: string;
  summary: string;
  details: string;
  disciplines: string;
  deliverable: string;
  deadline: string;
  status: string;
  kind: "partner" | "self";
  created_at: string;
  approved: number;
  pending: number;
};

async function overview(env: Env, json: Json): Promise<Response> {
  const postings = await env.DB.prepare(
    "SELECT g.id, g.author_id, COALESCE(o.name, u.name) AS owner_name, g.title, g.summary, g.details, g.disciplines, g.deliverable, g.deadline, " +
      "g.status, g.kind, g.created_at, " +
      "(SELECT COUNT(*) FROM projects p WHERE p.posting_id = g.id AND p.status NOT IN ('claimed', 'plan_review', 'plan_returned', 'withdrawn')) AS approved, " +
      "(SELECT COUNT(*) FROM projects p WHERE p.posting_id = g.id AND p.status IN ('claimed', 'plan_review', 'plan_returned')) AS pending " +
      "FROM postings g JOIN users u ON u.id = g.author_id LEFT JOIN orgs o ON o.id = g.org_id ORDER BY g.created_at DESC",
  ).all<PostingRowOut>();
  const projects = await env.DB.prepare(
    "SELECT p.id, p.posting_id, p.status, p.claimed_at, p.activated_at, g.title, g.kind, COALESCE(o.name, u.name) AS owner_name, " +
      "(SELECT s.status FROM submissions s WHERE s.project_id = p.id ORDER BY s.created_at DESC LIMIT 1) AS submission, " +
      "(SELECT m.status FROM meetings m WHERE m.project_id = p.id ORDER BY m.created_at DESC LIMIT 1) AS meeting, " +
      "(SELECT CASE WHEN sel.completed_at IS NULL THEN 'hired' ELSE 'complete' END FROM selections sel WHERE sel.project_id = p.id) AS selection, " +
      "(SELECT b.id FROM boards b WHERE b.project_id = p.id) AS board_id " +
      "FROM projects p JOIN postings g ON g.id = p.posting_id JOIN users u ON u.id = g.author_id LEFT JOIN orgs o ON o.id = g.org_id " +
      "ORDER BY p.claimed_at DESC",
  ).all<{
    id: string;
    posting_id: string;
    status: ProjectStatus;
    claimed_at: string;
    activated_at: string | null;
    title: string;
    kind: "partner" | "self";
    owner_name: string;
    submission: "pending" | "accepted" | "returned" | null;
    meeting: string | null;
    selection: "hired" | "complete" | null;
    board_id: string | null;
  }>();
  const members = await env.DB.prepare(
    "SELECT m.project_id, u.id, u.name FROM project_members m JOIN users u ON u.id = m.user_id ORDER BY u.name COLLATE NOCASE",
  ).all<{ project_id: string; id: string; name: string }>();
  const team = new Map<string, Person[]>();
  for (const r of members.results) team.set(r.project_id, [...(team.get(r.project_id) ?? []), { id: r.id, name: r.name }]);
  const people = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, u.role, u.roles, u.status, u.created_at, u.claude_access, u.profile_public, u.level, " +
      "(SELECT COUNT(*) FROM project_members m JOIN projects p ON p.id = m.project_id WHERE m.user_id = u.id " +
      "AND p.status NOT IN ('claimed', 'plan_review', 'plan_returned', 'withdrawn', 'complete')) AS active_claims, " +
      "(SELECT COUNT(*) FROM postings g WHERE g.author_id = u.id AND g.kind = 'partner') AS problems " +
      "FROM users u ORDER BY u.created_at DESC",
  ).all<{
    id: string;
    email: string;
    name: string;
    role: AccountRole;
    roles: string;
    status: string;
    created_at: string;
    claude_access: number;
    profile_public: number;
    level: string;
    active_claims: number;
    problems: number;
  }>();
  const orgs = await env.DB.prepare(
    "SELECT o.id, o.name, o.primary_user_id, pu.name AS primary_name, " +
      "(SELECT COUNT(*) FROM users u WHERE u.org_id = o.id AND u.status = 'active') AS people " +
      "FROM orgs o LEFT JOIN users pu ON pu.id = o.primary_user_id ORDER BY o.name COLLATE NOCASE",
  ).all<{ id: string; name: string; primary_user_id: string | null; primary_name: string | null; people: number }>();
  const requests = await env.DB.prepare(
    "SELECT r.id, r.message, r.created_at, u.id AS user_id, u.name AS user_name, u.email AS user_email, o.id AS org_id, o.name AS org_name " +
      "FROM org_requests r JOIN users u ON u.id = r.user_id JOIN orgs o ON o.id = r.org_id WHERE r.status = 'pending' ORDER BY r.created_at",
  ).all<{ id: string; message: string; created_at: string; user_id: string; user_name: string; user_email: string; org_id: string; org_name: string }>();

  return json({
    problems: postings.results.map((g) => ({
      id: g.id,
      title: g.title,
      summary: g.summary,
      details: g.details,
      fields: parse<string[]>(g.disciplines, []),
      deliverable: g.deliverable,
      deadline: g.deadline,
      // The older open/closed, and the posting's own status.
      status: g.status === "live" ? "open" : "closed",
      postingStatus: g.status,
      origin: g.kind === "self" ? "member" : "partner",
      createdAt: g.created_at,
      owner: { id: g.author_id, name: g.owner_name },
      counts: { approved: g.approved, pending: g.pending },
    })),
    claims: projects.results.map((p) => ({
      id: p.id,
      problemId: p.posting_id,
      title: p.title,
      origin: p.kind === "self" ? "member" : "partner",
      owner: p.owner_name,
      status: claimStatus(p.status),
      projectStatus: p.status,
      createdAt: p.claimed_at,
      reviewedAt: p.activated_at,
      submission: p.submission,
      meeting: p.meeting === null ? null : p.meeting === "requested" ? "requested" : "arranged",
      selection: p.selection,
      // The board, as before.
      projectId: p.board_id,
      team: team.get(p.id) ?? [],
    })),
    people: people.results.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      // Reps and admins, who cannot be turned off from here.
      staff: isStaff(env, u),
      admin: isAdmin(env, u),
      activeClaims: u.active_claims,
      problems: u.problems,
      // Levels are members' only.
      level: u.role === "member" ? u.level : null,
      claudeAccess: Boolean(u.claude_access),
      profilePublic: Boolean(u.profile_public),
    })),
    orgs: orgs.results.map((o) => ({
      id: o.id,
      name: o.name,
      people: o.people,
      primary: o.primary_user_id ? { id: o.primary_user_id, name: o.primary_name ?? "" } : null,
    })),
    requests: requests.results.map((r) => ({
      id: r.id,
      message: r.message,
      createdAt: r.created_at,
      user: { id: r.user_id, name: r.user_name, email: r.user_email },
      org: { id: r.org_id, name: r.org_name },
    })),
  });
}

// An admin turns an account off, which also signs it out everywhere, or
// back on. Nobody turns off their own account or a staff one.
async function setPersonStatus(req: Request, env: Env, user: UserRow, id: string, json: Json): Promise<Response> {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const status = body.status === "removed" ? "removed" : body.status === "active" ? "active" : null;
  if (!status) return json({ error: "status" }, 400);
  if (id === user.id) return json({ error: "self" }, 403);
  const target = await env.DB.prepare("SELECT email, role, roles, status FROM users WHERE id = ?")
    .bind(id)
    .first<{ email: string; role: AccountRole; roles: string; status: string }>();
  if (!target) return json({ error: "not-found" }, 404);
  if (isStaff(env, { ...target, status: "active" })) return json({ error: "approver" }, 403);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, id),
    ...(status === "removed" ? [env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id)] : []),
  ]);
  return json({ ok: true });
}

// An admin marks a member's funded Claude account as given, or not.
async function setClaudeAccess(req: Request, env: Env, id: string, json: Json): Promise<Response> {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (typeof body.granted !== "boolean") return json({ error: "granted" }, 400);
  const r = await env.DB.prepare("UPDATE users SET claude_access = ? WHERE id = ? AND role = 'member'")
    .bind(body.granted ? 1 : 0, id)
    .run();
  return r.meta.changes ? json({ ok: true }) : json({ error: "not-found" }, 404);
}

const LEVEL_TITLES: Record<string, string> = {
  affiliate: "You are now an Affiliate",
  sponsored: "You are now a Sponsored member",
  builder: "You are now a Builder",
};

// An admin sets a member's level. Nothing else moves it, and the member hears
// when it changes. Setting the level they already hold is a quiet no-op.
async function setLevel(req: Request, env: Env, actor: UserRow, id: string, json: Json): Promise<Response> {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const level = typeof body.level === "string" && Object.hasOwn(LEVEL_TITLES, body.level) ? body.level : null;
  if (!level) return json({ error: "level" }, 400);
  const target = await env.DB.prepare("SELECT role, level FROM users WHERE id = ?").bind(id).first<{ role: AccountRole; level: string | null }>();
  if (!target) return json({ error: "not-found" }, 404);
  if (target.role !== "member") return json({ error: "level" }, 400);
  if (target.level === level) return json({ ok: true, level });
  const stmts = [env.DB.prepare("UPDATE users SET level = ? WHERE id = ? AND role = 'member'").bind(level, id)];
  emit(env, stmts, {
    type: "member.level_changed",
    actor,
    subject: { kind: "user", id },
    payload: { level },
    notify: [{ userIds: [id], title: LEVEL_TITLES[level], href: "/projectum" }],
  });
  await env.DB.batch(stmts);
  return json({ ok: true, level });
}

async function approveAccountInApp(env: Env, actor: UserRow, id: string, json: Json): Promise<Response> {
  const p = await env.DB.prepare("SELECT id, email, name, role, status, org_id FROM users WHERE id = ? AND role IN ('partner', 'rep')")
    .bind(id)
    .first<{ id: string; email: string; name: string; role: string; status: string; org_id: string | null }>();
  if (!p) return json({ error: "not-found" }, 404);
  if (p.status === "pending") {
    const r = await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ? AND status = 'pending'").bind(id).run();
    if (!r.meta.changes) return json({ error: "state" }, 409);
    const org = p.role === "partner" ? await ensureOrgFor(env, p) : null;
    const stmts: D1PreparedStatement[] = [];
    emit(env, stmts, {
      type: "account.approved",
      actor,
      subject: { kind: "user", id },
      orgId: org?.id,
      notify: [{ userIds: [id], title: approvedTitle(p.role), href: "/projectum" }],
    });
    await env.DB.batch(stmts);
    await sendEmail(
      env,
      p.email,
      "You're approved on Projectum",
      approvedEmail(p, env.SITE_URL),
    );
    return json({ ok: true });
  }
  return json({ error: "state" }, 409);
}

// /overview, /accounts/:id/(status|claude|level|approve) and /partners/:id/approve, all
// the admin's.
export async function handleAdmin(req: Request, env: Env, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!/^\/(overview|accounts|partners)(\/|$)/.test(pathname)) return null;
  if (!isAdmin(env, user)) return json({ error: "forbidden" }, 403);
  const m = req.method;
  if (pathname === "/overview") return m === "GET" ? overview(env, json) : json({ error: "method" }, 405);
  let match = pathname.match(/^\/accounts\/([\w-]{1,64})\/(status|claude|level|approve)$/);
  if (match) {
    if (m !== "POST") return json({ error: "method" }, 405);
    if (match[2] === "level") return setLevel(req, env, user, match[1], json);
    if (match[2] === "approve") return approveAccountInApp(env, user, match[1], json);
    return match[2] === "status" ? setPersonStatus(req, env, user, match[1], json) : setClaudeAccess(req, env, match[1], json);
  }
  match = pathname.match(/^\/partners\/([\w-]{1,64})\/approve$/);
  if (match) return m === "POST" ? approveAccountInApp(env, user, match[1], json) : json({ error: "method" }, 405);
  return json({ error: "not-found" }, 404);
}

// --- Profiles -------------------------------------------------------------------

// A member's public profile, for anyone with the link, when they've made it
// public: name, picture, level, the disciplines they've worked in, and the
// work the Lab approved. A partner's name shows unless its author asked to
// stay off profiles. No emails, plans or notes.
async function profile(env: Env, handle: string, json: Json): Promise<Response> {
  const u = await env.DB.prepare(
    "SELECT id, name, avatar, level FROM users WHERE handle = ? AND profile_public = 1 AND role = 'member' AND status = 'active'",
  )
    .bind(handle)
    .first<{ id: string; name: string; avatar: string | null; level: string }>();
  if (!u) return json({ error: "not-found" }, 404);
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.status, p.phase, p.claimed_at, p.completed_at, g.title, g.disciplines, g.kind, " +
      "COALESCE(o.name, a.name) AS partner, a.hide_name, (SELECT b.data FROM boards b WHERE b.project_id = p.id) AS data " +
      "FROM project_members m JOIN projects p ON p.id = m.project_id JOIN postings g ON g.id = p.posting_id " +
      "JOIN users a ON a.id = g.author_id LEFT JOIN orgs o ON o.id = g.org_id " +
      `WHERE m.user_id = ? AND p.status IN (${DELIVERED.map(() => "?").join(", ")}) ORDER BY p.claimed_at DESC`,
  )
    .bind(u.id, ...DELIVERED)
    .all<{
      id: string;
      status: ProjectStatus;
      phase: string;
      claimed_at: string;
      completed_at: string | null;
      title: string;
      disciplines: string;
      kind: "partner" | "self";
      partner: string;
      hide_name: number;
      data: string | null;
    }>();
  const names = await env.DB.prepare(
    "SELECT m.project_id, u.name FROM project_members m JOIN users u ON u.id = m.user_id " +
      "WHERE m.project_id IN (SELECT value FROM json_each(?)) ORDER BY u.name COLLATE NOCASE",
  )
    .bind(JSON.stringify(results.map((r) => r.id)))
    .all<{ project_id: string; name: string }>();
  const team = new Map<string, string[]>();
  for (const r of names.results) team.set(r.project_id, [...(team.get(r.project_id) ?? []), r.name]);
  const fields = new Set<string>();
  const projects = results.map((r) => {
    for (const f of parse<unknown[]>(r.disciplines, [])) if (typeof f === "string") fields.add(f);
    const [board] = r.data ? cleanProjects([parse<unknown>(r.data, null)]) : [];
    return {
      title: r.title,
      partner: r.kind === "partner" && !r.hide_name ? r.partner : null,
      own: r.kind === "self",
      team: team.get(r.id) ?? [],
      accepted: true,
      hired: r.phase === "integrated",
      completedAt: r.completed_at,
      contribution: board?.launch?.contributions[u.id] ?? "",
      startedAt: r.claimed_at,
    };
  });
  return json({ profile: { name: u.name, avatar: u.avatar, level: u.level, fields: [...fields], projects } });
}

// GET /profiles/:handle, before any session lookup. Null for any other path.
export async function handleProfiles(req: Request, env: Env, headers: Record<string, string>): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!pathname.startsWith("/profiles/")) return null;
  const json: Json = (body, status = 200) => Response.json(body, { status, headers: { ...headers, "cache-control": "no-store" } });
  const match = pathname.match(/^\/profiles\/([a-z0-9-]{1,60})$/);
  if (!match) return json({ error: "not-found" }, 404);
  return req.method === "GET" ? profile(env, match[1], json) : json({ error: "method" }, 405);
}
