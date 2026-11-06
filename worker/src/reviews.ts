// Review rows: one per round at a gate (a posting before the board, an
// action plan, a submission). The gates' transition hooks open and close
// them through these helpers; the queue and review pages read them.

import { isAdmin, isStaff, type AccountEnv, type Json, type UserRow } from "./accounts";
import { readBoard } from "./boards";
import { json as parse, uuid, type ProjectRow } from "./db";
import { emit } from "./events";
import { outOne, postingById } from "./postings";
import { outMany, projectById, viewerOf } from "./projects";

export type Gate = "posting" | "action_plan" | "submission" | "completion";

type Person = { id: string; name: string };

export type ReviewOut = {
  id: string;
  gate: Gate;
  subjectId: string;
  round: number;
  status: "open" | "approved" | "returned" | "withdrawn";
  assignedTo: Person | null;
  decidedBy: Person | null;
  decidedAt: string | null;
  feedback: string;
  score: number | null;
  openedAt: string;
};

// Opens the next round for a subject. The round is counted inside the
// INSERT, so it is right even if the hook's reads are stale by the time the
// batch runs. Returns the new review's id and the statement to batch.
export function openReview(
  env: AccountEnv,
  gate: Gate,
  subjectId: string,
  snapshot: unknown,
  at: string,
): { id: string; stmt: D1PreparedStatement } {
  const id = uuid();
  const stmt = env.DB.prepare(
    "INSERT INTO reviews (id, gate, subject_id, round, snapshot, status, opened_at) " +
      "SELECT ?, ?, ?, COALESCE(MAX(round), 0) + 1, ?, 'open', ? FROM reviews WHERE gate = ? AND subject_id = ?",
  ).bind(id, gate, subjectId, JSON.stringify(snapshot ?? {}), at, gate, subjectId);
  return { id, stmt };
}

// Closes the subject's open review at a gate with a decision.
export function closeOpenReview(
  env: AccountEnv,
  gate: Gate,
  subjectId: string,
  close: { status: "approved" | "returned" | "withdrawn"; by: string | null; at: string; feedback?: string; score?: number | null },
): D1PreparedStatement {
  return env.DB.prepare(
    "UPDATE reviews SET status = ?, decided_by = ?, decided_at = ?, feedback = ?, score = ? " +
      "WHERE gate = ? AND subject_id = ? AND status = 'open'",
  ).bind(close.status, close.by, close.at, close.feedback ?? "", close.score ?? null, gate, subjectId);
}

const REVIEW_SELECT =
  "SELECT r.id, r.gate, r.subject_id, r.round, r.status, r.assigned_to, a.name AS assigned_name, r.decided_by, d.name AS decided_name, " +
  "r.decided_at, r.feedback, r.score, r.opened_at FROM reviews r " +
  "LEFT JOIN users a ON a.id = r.assigned_to LEFT JOIN users d ON d.id = r.decided_by";

type ReviewRow = {
  id: string;
  gate: Gate;
  subject_id: string;
  round: number;
  status: ReviewOut["status"];
  assigned_to: string | null;
  assigned_name: string | null;
  decided_by: string | null;
  decided_name: string | null;
  decided_at: string | null;
  feedback: string;
  score: number | null;
  opened_at: string;
};

function reviewOut(r: ReviewRow): ReviewOut {
  return {
    id: r.id,
    gate: r.gate,
    subjectId: r.subject_id,
    round: r.round,
    status: r.status,
    assignedTo: r.assigned_to ? { id: r.assigned_to, name: r.assigned_name ?? "" } : null,
    decidedBy: r.decided_by ? { id: r.decided_by, name: r.decided_name ?? "" } : null,
    decidedAt: r.decided_at,
    feedback: r.feedback,
    score: r.score,
    openedAt: r.opened_at,
  };
}

// Every round for each of several subjects at a gate, newest first, keyed by
// subject id. The ids go in as one JSON array, so a long list stays within
// D1's limit on bound parameters.
export async function reviewsForMany(env: AccountEnv, gate: Gate, subjectIds: string[]): Promise<Map<string, ReviewOut[]>> {
  const out = new Map<string, ReviewOut[]>();
  if (subjectIds.length === 0) return out;
  const { results } = await env.DB.prepare(
    `${REVIEW_SELECT} WHERE r.gate = ? AND r.subject_id IN (SELECT value FROM json_each(?)) ORDER BY r.subject_id, r.round DESC`,
  )
    .bind(gate, JSON.stringify(subjectIds))
    .all<ReviewRow>();
  for (const r of results) {
    const list = out.get(r.subject_id) ?? [];
    list.push(reviewOut(r));
    out.set(r.subject_id, list);
  }
  return out;
}

// Every round for a subject at a gate, newest first.
export async function reviewsFor(env: AccountEnv, gate: Gate, subjectId: string): Promise<ReviewOut[]> {
  return (await reviewsForMany(env, gate, [subjectId])).get(subjectId) ?? [];
}

// ---------------------------------------------------------------- the queue and the pages
//
//   GET  /reviews              open reviews at every gate, plus pending legacy submissions
//   GET  /reviews/:id          the review, its rounds, its subject, the frozen snapshot and the board
//   POST /reviews/:id/take     a rep or admin claims it (409 taken)
//   POST /reviews/:id/assign   { userId } an admin hands it to a rep or admin
//
// Deciding is not here: it goes through the posting's and the project's
// transition routes. "sub:<id>" ids stand for pending submissions made
// before submitWork opened a review for each (migrated rows).

type Context = {
  title: string;
  who: string;
  posting: { id: string; title: string };
  project: { id: string; status: string; lead: Person; team: Person[] } | null;
};

export type QueueEntry = ReviewOut & Context & { waitingSince: string; href: string };

const SUB = "sub:";
const href = (id: string) => `/projectum?view=review&id=${id}`;

type ProjectCtx = { id: string; status: string; posting_id: string; posting_title: string; lead: Person; team: Person[] };

// The posting and project facts the queue shows, for many subjects in a few queries.
async function contexts(env: AccountEnv, postingIds: string[], projectIds: string[]) {
  const [postings, projects, team] = await Promise.all([
    env.DB.prepare(
      "SELECT g.id, g.title, COALESCE(o.name, u.name, '') AS who FROM postings g LEFT JOIN orgs o ON o.id = g.org_id " +
        "LEFT JOIN users u ON u.id = g.author_id WHERE g.id IN (SELECT value FROM json_each(?))",
    )
      .bind(JSON.stringify(postingIds))
      .all<{ id: string; title: string; who: string }>(),
    env.DB.prepare(
      "SELECT p.id, p.status, p.lead_id, p.posting_id, g.title AS posting_title FROM projects p JOIN postings g ON g.id = p.posting_id " +
        "WHERE p.id IN (SELECT value FROM json_each(?))",
    )
      .bind(JSON.stringify(projectIds))
      .all<{ id: string; status: string; lead_id: string; posting_id: string; posting_title: string }>(),
    env.DB.prepare(
      "SELECT m.project_id, u.id, u.name FROM project_members m JOIN users u ON u.id = m.user_id " +
        "WHERE m.project_id IN (SELECT value FROM json_each(?)) ORDER BY m.role = 'member', m.joined_at, u.name COLLATE NOCASE",
    )
      .bind(JSON.stringify(projectIds))
      .all<{ project_id: string; id: string; name: string }>(),
  ]);
  const teams = new Map<string, Person[]>();
  for (const t of team.results) teams.set(t.project_id, [...(teams.get(t.project_id) ?? []), { id: t.id, name: t.name }]);
  const project = new Map<string, ProjectCtx>();
  for (const p of projects.results) {
    const members = teams.get(p.id) ?? [];
    const lead = members.find((m) => m.id === p.lead_id) ?? { id: p.lead_id, name: "" };
    project.set(p.id, { id: p.id, status: p.status, posting_id: p.posting_id, posting_title: p.posting_title, lead, team: members });
  }
  return { posting: new Map(postings.results.map((p) => [p.id, p])), project };
}

function projectContext(p: ProjectCtx): Context {
  return {
    title: p.posting_title,
    who: p.lead.name,
    posting: { id: p.posting_id, title: p.posting_title },
    project: { id: p.id, status: p.status, lead: p.lead, team: p.team },
  };
}

function syntheticReview(id: string, projectId: string, createdAt: string): ReviewOut {
  return {
    id: SUB + id,
    gate: "submission",
    subjectId: projectId,
    round: 1,
    status: "open",
    assignedTo: null,
    decidedBy: null,
    decidedAt: null,
    feedback: "",
    score: null,
    openedAt: createdAt,
  };
}

async function queue(env: AccountEnv, json: Json): Promise<Response> {
  const { results } = await env.DB.prepare(
    `${REVIEW_SELECT} WHERE r.status = 'open' AND r.gate IN ('posting', 'action_plan', 'submission') ORDER BY r.opened_at, r.rowid`,
  ).all<ReviewRow>();
  // Pending submissions from before submissions had reviews of their own.
  const { results: subs } = await env.DB.prepare(
    "SELECT s.id, s.project_id, s.created_at FROM submissions s WHERE s.status = 'pending' " +
      "AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.gate = 'submission' AND r.subject_id = s.project_id AND r.status = 'open') " +
      "ORDER BY s.created_at, s.rowid",
  ).all<{ id: string; project_id: string; created_at: string }>();
  const ctx = await contexts(
    env,
    results.filter((r) => r.gate === "posting").map((r) => r.subject_id),
    [...results.filter((r) => r.gate !== "posting").map((r) => r.subject_id), ...subs.map((s) => s.project_id)],
  );
  const out: QueueEntry[] = [];
  for (const r of results) {
    let c: Context | null = null;
    if (r.gate === "posting") {
      const p = ctx.posting.get(r.subject_id);
      if (p) c = { title: p.title, who: p.who, posting: { id: p.id, title: p.title }, project: null };
    } else {
      const p = ctx.project.get(r.subject_id);
      if (p) c = projectContext(p);
    }
    if (c) out.push({ ...reviewOut(r), ...c, waitingSince: r.opened_at, href: href(r.id) });
  }
  for (const s of subs) {
    const p = ctx.project.get(s.project_id);
    if (!p) continue;
    out.push({ ...syntheticReview(s.id, s.project_id, s.created_at), ...projectContext(p), waitingSince: s.created_at, href: href(SUB + s.id) });
  }
  out.sort((a, b) => a.waitingSince.localeCompare(b.waitingSince));
  return json({ reviews: out });
}

async function boardOf(env: AccountEnv, project: ProjectRow) {
  const b = await env.DB.prepare("SELECT data FROM boards WHERE project_id = ?").bind(project.id).first<{ data: string }>();
  return b ? readBoard(b.data, project.status) : null;
}

async function detail(env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const v = viewerOf(env, user);
  if (id.startsWith(SUB)) {
    const s = await env.DB.prepare(
      "SELECT id, project_id, submitted_by, report_name, report_size, created_at FROM submissions WHERE id = ? AND status = 'pending'",
    )
      .bind(id.slice(SUB.length))
      .first<{ id: string; project_id: string; submitted_by: string | null; report_name: string; report_size: number; created_at: string }>();
    const project = s && (await projectById(env, s.project_id));
    const [subject] = project ? await outMany(env, [project], v) : [];
    if (!s || !project || !subject) return json({ error: "not-found" }, 404);
    return json({
      review: syntheticReview(s.id, s.project_id, s.created_at),
      history: [],
      subject,
      snapshot: { reportName: s.report_name, reportSize: s.report_size, submittedBy: s.submitted_by, createdAt: s.created_at },
      board: await boardOf(env, project),
    });
  }
  const row = await env.DB.prepare(`${REVIEW_SELECT} WHERE r.id = ?`).bind(id).first<ReviewRow>();
  const snap = row && (await env.DB.prepare("SELECT snapshot FROM reviews WHERE id = ?").bind(id).first<{ snapshot: string }>());
  if (!row) return json({ error: "not-found" }, 404);
  const history = (await reviewsFor(env, row.gate, row.subject_id)).reverse();
  const snapshot = parse<unknown>(snap?.snapshot, {});
  if (row.gate === "posting") {
    const posting = await postingById(env, row.subject_id);
    if (!posting) return json({ error: "not-found" }, 404);
    return json({ review: reviewOut(row), history, subject: await outOne(env, posting, v), snapshot, board: null });
  }
  const project = await projectById(env, row.subject_id);
  const [subject] = project ? await outMany(env, [project], v) : [];
  if (!project || !subject) return json({ error: "not-found" }, 404);
  return json({ review: reviewOut(row), history, subject, snapshot, board: await boardOf(env, project) });
}

// What the notice to an assignee names.
async function titleOf(env: AccountEnv, r: ReviewRow): Promise<string> {
  const t =
    r.gate === "posting"
      ? await env.DB.prepare("SELECT title FROM postings WHERE id = ?").bind(r.subject_id).first<{ title: string }>()
      : await env.DB.prepare("SELECT g.title FROM projects p JOIN postings g ON g.id = p.posting_id WHERE p.id = ?")
          .bind(r.subject_id)
          .first<{ title: string }>();
  return t?.title ?? "a review";
}

// Sets the assignee of an open review. Taking (force off) only succeeds when
// the review is unassigned or already theirs; an admin's assignment (force
// on) replaces whoever had it.
async function assign(env: AccountEnv, actor: UserRow, r: ReviewRow, to: string, force: boolean, json: Json): Promise<Response> {
  const res = await env.DB.prepare(
    "UPDATE reviews SET assigned_to = ? WHERE id = ? AND status = 'open' AND (? = 1 OR assigned_to IS NULL OR assigned_to = ?)",
  )
    .bind(to, r.id, force ? 1 : 0, to)
    .run();
  if (res.meta.changes === 0) return json({ error: "taken" }, 409);
  if (to !== actor.id) {
    const stmts: D1PreparedStatement[] = [];
    emit(env, stmts, {
      type: "review.assigned",
      actor,
      subject: { kind: "review", id: r.id },
      payload: { gate: r.gate, subjectId: r.subject_id },
      notify: [{ userIds: [to], court: true, title: `${actor.name} assigned you a review: ${await titleOf(env, r)}`, href: href(r.id) }],
    });
    await env.DB.batch(stmts);
  }
  return json({ ok: true, assignedTo: to });
}

export async function handleReviews(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  const raw = new URL(req.url).pathname;
  if (raw !== "/reviews" && !raw.startsWith("/reviews/")) return null;
  // The site encodes the id segment, so "sub:S1" arrives as "sub%3AS1".
  let pathname: string;
  try {
    pathname = decodeURIComponent(raw);
  } catch {
    return json({ error: "not-found" }, 404);
  }
  if (!isStaff(env, user)) return json({ error: "forbidden" }, 403);
  const m = req.method;
  if (pathname === "/reviews") return m === "GET" ? queue(env, json) : json({ error: "method" }, 405);
  const match = pathname.match(/^\/reviews\/((?:sub:)?[\w-]{1,64})(\/take|\/assign)?$/);
  if (!match) return json({ error: "not-found" }, 404);
  const [, id, action] = match;
  if (!action) return m === "GET" ? detail(env, user, id, json) : json({ error: "method" }, 405);
  if (m !== "POST") return json({ error: "method" }, 405);
  if (action === "/assign" && !isAdmin(env, user)) return json({ error: "forbidden" }, 403);
  if (id.startsWith(SUB)) return json({ error: "legacy" }, 409);
  const row = await env.DB.prepare(`${REVIEW_SELECT} WHERE r.id = ?`).bind(id).first<ReviewRow>();
  if (!row) return json({ error: "not-found" }, 404);
  if (row.status !== "open") return json({ error: "state" }, 409);
  if (action === "/take") return assign(env, user, row, user.id, false, json);
  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const target = userId ? await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>() : null;
  if (!target || !isStaff(env, target)) return json({ error: "assignee" }, 400);
  return assign(env, user, row, target.id, true, json);
}
