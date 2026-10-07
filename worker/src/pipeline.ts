// The pipeline on the Worker: problems, claims and the approval queue
// (src/lib/problems.ts holds the rules, shared with the forms).
//
// Who sees and does what:
// - Partners post problems and see only their own, with the approved teams
//   on each.
// - Members see every open problem and every claim, and claim a problem with
//   an action plan, as a team of up to seven.
// - Approvers (reps and the Lab's approver, isApprover) see the queue,
//   approve or deny claims, and approve new partners. Reps can also post and
//   edit any problem.
// - Members can also propose their own project: a problem of their own with
//   a plan, kept off the Notice Board, that the approver approves like any
//   claim.
// An approved claim opens its team's board, a project (src/lib/projects.ts)
// that starts in Solidifying with the approved plan. The team works on it;
// approvers can too; everyone else can read it, and partners only for their
// own problems.
// - A team submits from its board: the board moves to its last stage with
//   links and credits, and a final report (a PDF, kept in the REPORTS KV
//   namespace). The approver accepts it, which shows it to the partner, or
//   returns it with a note, which sends the board back to Prototype.
// - Once a submission is accepted, the partner can ask to meet the team
//   (the approver gets both sides' contacts, introduces them and marks it
//   arranged) and select the team for an internship. That starts phase 2:
//   implementation milestones the team ticks off, until the partner or the
//   approver marks the project complete.
// The approver hears about each new claim, submission and meeting request by
// email, and the team hears each decision.

import { type AccountEnv, type Json, type UserRow, isApprover, sendEmail, sessionUser } from "./accounts";
import type { AccountRole } from "@/lib/email-rules";
import { cleanDescription, cleanName, cleanProjects, type Project } from "@/lib/projects";
import {
  type ClaimDraft,
  type ClaimStatus,
  type Field,
  type ProblemStatus,
  claimIssues,
  cleanClaim,
  cleanLine,
  cleanProblem,
  LIMITS,
  problemIssues,
  PROBLEM_STATUSES,
  cleanPhaseMilestones,
} from "@/lib/problems";

interface ProblemRow {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  summary: string;
  details: string;
  fields: string;
  deliverable: string;
  deadline: string;
  status: ProblemStatus;
  origin: "partner" | "member";
  created_at: string;
  approved: number;
  pending: number;
}

interface ClaimRow {
  id: string;
  problem_id: string;
  owner_id: string;
  plan: string;
  status: ClaimStatus;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  project_id: string | null;
}

type Person = { id: string; name: string };

const now = () => new Date().toISOString();

function parseFields(text: string): Field[] {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function problemOut(row: ProblemRow) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    details: row.details,
    fields: parseFields(row.fields),
    deliverable: row.deliverable,
    deadline: row.deadline,
    status: row.status,
    origin: row.origin,
    createdAt: row.created_at,
    owner: { id: row.owner_id, name: row.owner_name },
    counts: { approved: row.approved, pending: row.pending },
  };
}

const PROBLEM_SELECT =
  "SELECT p.id, p.owner_id, u.name AS owner_name, p.title, p.summary, p.details, p.fields, p.deliverable, p.deadline, " +
  "p.status, p.origin, p.created_at, " +
  "(SELECT COUNT(*) FROM claims c WHERE c.problem_id = p.id AND c.status = 'approved') AS approved, " +
  "(SELECT COUNT(*) FROM claims c WHERE c.problem_id = p.id AND c.status = 'pending') AS pending " +
  "FROM problems p JOIN users u ON u.id = p.owner_id";

async function getProblem(env: AccountEnv, id: string): Promise<ProblemRow | null> {
  return env.DB.prepare(`${PROBLEM_SELECT} WHERE p.id = ?`).bind(id).first<ProblemRow>();
}

// Partners see their own problems; everyone else sees them all.
const canSee = (user: UserRow, row: { owner_id: string }) => user.role !== "partner" || row.owner_id === user.id;
const canEdit = (user: UserRow, row: { owner_id: string }) => row.owner_id === user.id || user.role === "rep";

// Rows for a list of claim ids. D1 binds at most 100 values a query, so the
// ids go in batches; each claim's rows stay in one batch, in order.
async function byClaims<T>(env: AccountEnv, sql: (marks: string) => string, claimIds: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < claimIds.length; i += 90) {
    const chunk = claimIds.slice(i, i + 90);
    const { results } = await env.DB.prepare(sql(chunk.map(() => "?").join(",")))
      .bind(...chunk)
      .all<T>();
    out.push(...results);
  }
  return out;
}

async function teams(env: AccountEnv, claimIds: string[]): Promise<Map<string, Person[]>> {
  const map = new Map<string, Person[]>();
  const results = await byClaims<{ claim_id: string; id: string; name: string }>(
    env,
    (marks) =>
      `SELECT m.claim_id, u.id, u.name FROM claim_members m JOIN users u ON u.id = m.user_id WHERE m.claim_id IN (${marks}) ORDER BY u.name COLLATE NOCASE`,
    claimIds,
  );
  for (const r of results) map.set(r.claim_id, [...(map.get(r.claim_id) ?? []), { id: r.id, name: r.name }]);
  return map;
}

interface SubmissionRow {
  id: string;
  claim_id: string;
  project_id: string;
  report_name: string;
  report_size: number;
  status: "pending" | "accepted" | "returned";
  review_note: string;
  created_at: string;
}

function submissionOut(row: SubmissionRow) {
  return {
    id: row.id,
    status: row.status,
    reviewNote: row.review_note,
    reportName: row.report_name,
    reportSize: row.report_size,
    createdAt: row.created_at,
  };
}

// Each claim's latest submission. Partners only ever see accepted ones.
async function latestSubmissions(
  env: AccountEnv,
  claimIds: string[],
  acceptedOnly = false,
): Promise<Map<string, ReturnType<typeof submissionOut>>> {
  const map = new Map<string, ReturnType<typeof submissionOut>>();
  const results = await byClaims<SubmissionRow>(
    env,
    (marks) =>
      `SELECT id, claim_id, project_id, report_name, report_size, status, review_note, created_at FROM submissions WHERE claim_id IN (${marks})${
        acceptedOnly ? " AND status = 'accepted'" : ""
      } ORDER BY created_at`,
    claimIds,
  );
  // A partner gets the work, not the Lab's notes to the team.
  for (const r of results) map.set(r.claim_id, acceptedOnly ? { ...submissionOut(r), reviewNote: "" } : submissionOut(r));
  return map;
}

// Each claim's latest meeting request and its selection, if any.
async function phaseInfo(env: AccountEnv, claimIds: string[]) {
  const meetings = new Map<string, { id: string; status: "requested" | "arranged"; message: string; createdAt: string }>();
  const selections = new Map<
    string,
    { message: string; milestones: ReturnType<typeof cleanPhaseMilestones>; completedAt: string | null; createdAt: string }
  >();
  const m = await byClaims<{ id: string; claim_id: string; status: "requested" | "arranged"; message: string; created_at: string }>(
    env,
    (marks) => `SELECT id, claim_id, status, message, created_at FROM meetings WHERE claim_id IN (${marks}) ORDER BY created_at`,
    claimIds,
  );
  for (const r of m) meetings.set(r.claim_id, { id: r.id, status: r.status, message: r.message, createdAt: r.created_at });
  const sel = await byClaims<{ claim_id: string; message: string; milestones: string; completed_at: string | null; created_at: string }>(
    env,
    (marks) => `SELECT claim_id, message, milestones, completed_at, created_at FROM selections WHERE claim_id IN (${marks})`,
    claimIds,
  );
  for (const r of sel) {
    selections.set(r.claim_id, {
      message: r.message,
      milestones: cleanPhaseMilestones(JSON.parse(r.milestones)),
      completedAt: r.completed_at,
      createdAt: r.created_at,
    });
  }
  return { meetings, selections };
}

function claimOut(row: ClaimRow, team: Person[]) {
  const plan = cleanClaim(JSON.parse(row.plan));
  return {
    id: row.id,
    problemId: row.problem_id,
    ownerId: row.owner_id,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    plan: { approach: plan.approach, milestones: plan.milestones, finishBy: plan.finishBy },
    projectId: row.project_id,
    team,
  };
}

const CLAIM_SELECT =
  "SELECT c.id, c.problem_id, c.owner_id, c.plan, c.status, c.review_note, c.reviewed_at, c.created_at, " +
  "(SELECT pj.id FROM projects pj WHERE pj.claim_id = c.id) AS project_id FROM claims c";

async function onTeam(env: AccountEnv, claimId: string, userId: string): Promise<boolean> {
  return Boolean(await env.DB.prepare("SELECT 1 FROM claim_members WHERE claim_id = ? AND user_id = ?").bind(claimId, userId).first());
}

// --- Problems ------------------------------------------------------------------

async function listProblems(env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const { results } =
    user.role === "partner"
      ? await env.DB.prepare(`${PROBLEM_SELECT} WHERE p.owner_id = ? ORDER BY p.created_at DESC`).bind(user.id).all<ProblemRow>()
      : await env.DB.prepare(
          `${PROBLEM_SELECT} WHERE p.status = 'open' AND p.origin = 'partner' AND u.status = 'active' ORDER BY p.created_at DESC`,
        ).all<ProblemRow>();
  // The signed-in member's own claims, so the board can mark them.
  const mine = await env.DB.prepare(
    "SELECT c.problem_id, c.status FROM claims c JOIN claim_members m ON m.claim_id = c.id WHERE m.user_id = ? AND c.status IN ('pending', 'approved')",
  )
    .bind(user.id)
    .all<{ problem_id: string; status: ClaimStatus }>();
  const byProblem = new Map(mine.results.map((r) => [r.problem_id, r.status]));
  return json({ problems: results.map((r) => ({ ...problemOut(r), myClaim: byProblem.get(r.id) ?? null })) });
}

async function showProblem(env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const row = await getProblem(env, id);
  if (!row || !canSee(user, row)) return json({ error: "not-found" }, 404);
  // Partners see the teams Lab approved; everyone else sees every claim
  // still on the table and every past one, apart from withdrawn ones.
  const statuses = user.role === "partner" ? "('approved')" : "('pending', 'approved', 'denied')";
  const { results } = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.problem_id = ? AND c.status IN ${statuses} ORDER BY c.created_at`)
    .bind(id)
    .all<ClaimRow>();
  const team = await teams(env, results.map((c) => c.id));
  const subs = await latestSubmissions(env, results.map((c) => c.id), user.role === "partner");
  const phase = await phaseInfo(env, results.map((c) => c.id));
  return json({
    problem: problemOut(row),
    claims: results.map((c) => ({
      ...claimOut(c, team.get(c.id) ?? []),
      // The Lab's notes are for the team, not the partner.
      ...(user.role === "partner" ? { reviewNote: "" } : {}),
      submission: subs.get(c.id) ?? null,
      meeting: phase.meetings.get(c.id) ?? null,
      selection: phase.selections.get(c.id) ?? null,
    })),
    canEdit: canEdit(user, row),
  });
}

async function createProblem(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  if (user.status !== "active" || (user.role !== "partner" && user.role !== "rep")) return json({ error: "forbidden" }, 403);
  const draft = cleanProblem(await req.json().catch(() => null));
  const issues = problemIssues(draft);
  if (issues.length) return json({ error: "problem", issues }, 400);
  const id = crypto.randomUUID();
  const at = now();
  await env.DB.prepare(
    "INSERT INTO problems (id, owner_id, title, summary, details, fields, deliverable, deadline, status, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
  )
    .bind(id, user.id, draft.title, draft.summary, draft.details, JSON.stringify(draft.fields), draft.deliverable, draft.deadline, at, at)
    .run();
  return json({ id }, 201);
}

async function updateProblem(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const row = await getProblem(env, id);
  if (!row || !canSee(user, row)) return json({ error: "not-found" }, 404);
  if (!canEdit(user, row)) return json({ error: "forbidden" }, 403);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const draft = cleanProblem({ ...problemOut(row), ...body });
  const issues = problemIssues(draft);
  if (issues.length) return json({ error: "problem", issues }, 400);
  const status = PROBLEM_STATUSES.includes(body.status as ProblemStatus) ? (body.status as ProblemStatus) : row.status;
  await env.DB.prepare(
    "UPDATE problems SET title = ?, summary = ?, details = ?, fields = ?, deliverable = ?, deadline = ?, status = ?, updated_at = ? WHERE id = ?",
  )
    .bind(draft.title, draft.summary, draft.details, JSON.stringify(draft.fields), draft.deliverable, draft.deadline, status, now(), id)
    .run();
  return json({ ok: true });
}

// --- Claims --------------------------------------------------------------------

async function createClaim(req: Request, env: AccountEnv, user: UserRow, problemId: string, json: Json): Promise<Response> {
  if (user.status !== "active" || user.role !== "member") return json({ error: "forbidden" }, 403);
  const row = await getProblem(env, problemId);
  if (!row) return json({ error: "not-found" }, 404);
  if (row.status !== "open") return json({ error: "closed" }, 409);
  // A member's own project is theirs; only partners' problems are claimed.
  if (row.origin !== "partner") return json({ error: "forbidden" }, 403);

  const draft: ClaimDraft = cleanClaim(await req.json().catch(() => null));
  const issues = claimIssues(draft);
  if (issues.length) return json({ error: "plan", issues }, 400);

  const made = await insertClaim(env, user, problemId, draft, json);
  if (made instanceof Response) return made;
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `New claim on "${row.title}"`,
    `${user.name} claimed "${row.title}" (${row.owner_name}) with an action plan of ${draft.milestones.length} milestone${
      draft.milestones.length === 1 ? "" : "s"
    }.\n\nReview it in Approvals:\n${env.SITE_URL}/projectum?view=queue\n\nApplied AI Lab`,
  );
  return json({ id: made }, 201);
}

// The claim and its team, once the plan has been checked. The team is the
// claimant plus active members they named, and nobody on it may already
// have a claim in play on the problem. Returns the new claim's id.
async function insertClaim(
  env: AccountEnv,
  user: UserRow,
  problemId: string,
  draft: ClaimDraft,
  json: Json,
): Promise<string | Response> {
  const others = draft.teammates.filter((t) => t !== user.id);
  if (others.length) {
    const marks = others.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT id FROM users WHERE id IN (${marks}) AND role = 'member' AND status = 'active'`,
    )
      .bind(...others)
      .all<{ id: string }>();
    if (results.length !== others.length) return json({ error: "teammates" }, 400);
  }
  const team = [user.id, ...others];

  const marks = team.map(() => "?").join(",");
  const busy = await env.DB.prepare(
    `SELECT m.user_id FROM claims c JOIN claim_members m ON m.claim_id = c.id WHERE c.problem_id = ? AND c.status IN ('pending', 'approved') AND m.user_id IN (${marks}) LIMIT 1`,
  )
    .bind(problemId, ...team)
    .first<{ user_id: string }>();
  if (busy) return json({ error: "already-claimed" }, 409);

  const id = crypto.randomUUID();
  const made = await env.DB.batch([
    env.DB.prepare("INSERT INTO claims (id, problem_id, owner_id, plan, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)").bind(
      id,
      problemId,
      user.id,
      JSON.stringify({ approach: draft.approach, milestones: draft.milestones, finishBy: draft.finishBy }),
      now(),
    ),
    ...team.map((m) => env.DB.prepare("INSERT INTO claim_members (claim_id, user_id) VALUES (?, ?)").bind(id, m)),
  ]).catch((e: unknown) => e);
  // The database's one_active_claim trigger catches a claim sent at the same
  // moment as another; the batch rolls back whole.
  if (made instanceof Error) return json({ error: /already-claimed/.test(made.message) ? "already-claimed" : "error" }, 409);
  return id;
}

// A member's own project: a problem of their own, kept off the Notice Board,
// and the claim on it, both in one go. The approver approves it like any
// claim.
async function propose(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  if (user.status !== "active" || user.role !== "member") return json({ error: "forbidden" }, 403);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const problem = cleanProblem(body.problem);
  const plan = cleanClaim(body.plan);
  const issues = [...problemIssues(problem), ...claimIssues(plan)];
  if (issues.length) return json({ error: "proposal", issues }, 400);
  const problemId = crypto.randomUUID();
  const at = now();
  await env.DB.prepare(
    "INSERT INTO problems (id, owner_id, title, summary, details, fields, deliverable, deadline, status, origin, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'member', ?, ?)",
  )
    .bind(problemId, user.id, problem.title, problem.summary, problem.details, JSON.stringify(problem.fields), problem.deliverable, problem.deadline, at, at)
    .run();
  const made = await insertClaim(env, user, problemId, plan, json);
  if (made instanceof Response) {
    await env.DB.prepare("DELETE FROM problems WHERE id = ?").bind(problemId).run();
    return made;
  }
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `New project proposal: "${problem.title}"`,
    `${user.name} proposed their own project, "${problem.title}", with an action plan of ${plan.milestones.length} milestone${
      plan.milestones.length === 1 ? "" : "s"
    }.\n\nReview it in Approvals:\n${env.SITE_URL}/projectum?view=queue\n\nApplied AI Lab`,
  );
  return json({ id: made, problemId }, 201);
}

async function myClaims(env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const { results } = await env.DB.prepare(
    `${CLAIM_SELECT} JOIN claim_members m ON m.claim_id = c.id WHERE m.user_id = ? ORDER BY c.created_at DESC`,
  )
    .bind(user.id)
    .all<ClaimRow>();
  const team = await teams(env, results.map((c) => c.id));
  const problems = new Map<string, { id: string; title: string; owner: string }>();
  for (const c of results) {
    if (problems.has(c.problem_id)) continue;
    const p = await getProblem(env, c.problem_id);
    if (p) problems.set(p.id, { id: p.id, title: p.title, owner: p.owner_name });
  }
  const subs = await latestSubmissions(env, results.map((c) => c.id));
  const phase = await phaseInfo(env, results.map((c) => c.id));
  return json({
    claims: results.map((c) => ({
      ...claimOut(c, team.get(c.id) ?? []),
      problem: problems.get(c.problem_id) ?? null,
      submission: subs.get(c.id) ?? null,
      meeting: phase.meetings.get(c.id) ?? null,
      selection: phase.selections.get(c.id) ?? null,
    })),
  });
}

async function withdrawClaim(env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const claim = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).bind(id).first<ClaimRow>();
  if (!claim) return json({ error: "not-found" }, 404);
  const member = await env.DB.prepare("SELECT 1 FROM claim_members WHERE claim_id = ? AND user_id = ?").bind(id, user.id).first();
  if (!member) return json({ error: "forbidden" }, 403);
  if (claim.status !== "pending" && claim.status !== "approved") return json({ error: "state" }, 409);
  // Accepted work stays: a partner may already be meeting or hiring the team.
  const done = await env.DB.prepare(
    "SELECT 1 FROM submissions WHERE claim_id = ? AND status = 'accepted' UNION SELECT 1 FROM selections WHERE claim_id = ?",
  )
    .bind(id, id)
    .first();
  if (done) return json({ error: "accepted" }, 409);
  await env.DB.prepare("UPDATE claims SET status = 'withdrawn' WHERE id = ? AND status IN ('pending', 'approved')").bind(id).run();
  return json({ ok: true });
}

// --- The queue -----------------------------------------------------------------

async function queue(env: AccountEnv, json: Json): Promise<Response> {
  const { results } = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.status = 'pending' ORDER BY c.created_at`).all<ClaimRow>();
  const team = await teams(env, results.map((c) => c.id));
  const claims = [];
  for (const c of results) {
    const p = await getProblem(env, c.problem_id);
    claims.push({ ...claimOut(c, team.get(c.id) ?? []), problem: p ? problemOut(p) : null });
  }
  const partners = await env.DB.prepare(
    "SELECT id, email, name, created_at FROM users WHERE role = 'partner' AND status = 'pending' ORDER BY created_at",
  ).all<{ id: string; email: string; name: string; created_at: string }>();
  const pending = await env.DB.prepare(
    "SELECT s.id, s.claim_id, s.project_id, s.report_name, s.report_size, s.status, s.review_note, s.created_at, pj.data " +
      "FROM submissions s JOIN projects pj ON pj.id = s.project_id WHERE s.status = 'pending' ORDER BY s.created_at",
  ).all<SubmissionRow & { data: string }>();
  const submissions = [];
  for (const sub of pending.results) {
    const claim = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).bind(sub.claim_id).first<ClaimRow>();
    const p = claim ? await getProblem(env, claim.problem_id) : null;
    const [project] = cleanProjects([JSON.parse(sub.data)]);
    submissions.push({
      ...submissionOut(sub),
      problem: p ? problemOut(p) : null,
      project: project ?? null,
    });
  }
  const asked = await env.DB.prepare(
    "SELECT m.id, m.claim_id, m.message, m.created_at, c.problem_id FROM meetings m JOIN claims c ON c.id = m.claim_id WHERE m.status = 'requested' ORDER BY m.created_at",
  ).all<{ id: string; claim_id: string; message: string; created_at: string; problem_id: string }>();
  const meetings = [];
  for (const mt of asked.results) {
    const p = await getProblem(env, mt.problem_id);
    const owner = p ? await env.DB.prepare("SELECT name, email FROM users WHERE id = ?").bind(p.owner_id).first<{ name: string; email: string }>() : null;
    const people = await env.DB.prepare(
      "SELECT u.id, u.name, u.email FROM claim_members cm JOIN users u ON u.id = cm.user_id WHERE cm.claim_id = ? ORDER BY u.name",
    )
      .bind(mt.claim_id)
      .all<{ id: string; name: string; email: string }>();
    meetings.push({
      id: mt.id,
      message: mt.message,
      createdAt: mt.created_at,
      problem: p ? problemOut(p) : null,
      partner: owner,
      team: people.results,
    });
  }
  return json({
    meetings,
    submissions,
    claims,
    partners: partners.results.map((p) => ({ id: p.id, email: p.email, name: p.name, createdAt: p.created_at })),
  });
}

async function reviewClaim(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const decision = body.decision === "approve" ? "approved" : body.decision === "deny" ? "denied" : null;
  if (!decision) return json({ error: "decision" }, 400);
  const note = cleanLine(body.note, LIMITS.note);
  const claim = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).bind(id).first<ClaimRow>();
  if (!claim) return json({ error: "not-found" }, 404);
  if (claim.status !== "pending") return json({ error: "state" }, 409);
  if (await onTeam(env, id, user.id)) return json({ error: "own-claim" }, 403);
  // Only the first decision lands, however many are sent at once.
  const r = await env.DB.prepare(
    "UPDATE claims SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'",
  )
    .bind(decision, note, user.id, now(), id)
    .run();
  if (!r.meta.changes) return json({ error: "state" }, 409);

  const problem = await getProblem(env, claim.problem_id);
  if (decision === "approved" && problem) await openBoard(env, claim, problem);
  const { results } = await env.DB.prepare(
    "SELECT u.email, u.name FROM claim_members m JOIN users u ON u.id = m.user_id WHERE m.claim_id = ?",
  )
    .bind(id)
    .all<{ email: string; name: string }>();
  const title = problem?.title ?? "your problem";
  const subject = decision === "approved" ? `Approved: your claim on "${title}"` : `Your claim on "${title}"`;
  const text =
    decision === "approved"
      ? `Your action plan for "${title}" is approved. Start on your first milestone.`
      : `Your claim on "${title}" wasn't approved this time.`;
  for (const m of results) {
    await sendEmail(
      env,
      m.email,
      subject,
      `Hi ${m.name},\n\n${text}${note ? `\n\nNote from the Lab: ${note}` : ""}\n\n${env.SITE_URL}/projectum?view=claims\n\nApplied AI Lab`,
    );
  }
  return json({ ok: true });
}

async function approvePartnerInApp(env: AccountEnv, id: string, json: Json): Promise<Response> {
  const p = await env.DB.prepare("SELECT email, name, status FROM users WHERE id = ? AND role = 'partner'")
    .bind(id)
    .first<{ email: string; name: string; status: string }>();
  if (!p) return json({ error: "not-found" }, 404);
  if (p.status === "pending") {
    await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(id).run();
    await sendEmail(
      env,
      p.email,
      "You're approved on Projectum",
      `Hi ${p.name},\n\nThe Applied AI Lab approved your account. Log in to post problems for our students:\n${env.SITE_URL}/login\n\nApplied AI Lab, Weber State University`,
    );
  }
  return json({ ok: true });
}

// --- Boards --------------------------------------------------------------------

// The board an approved claim opens: a project in Solidifying, named after
// the problem, with the team on it and the approved plan as its plan, each
// milestone a step the claimant owns until the team hands them out.
async function openBoard(env: AccountEnv, claim: ClaimRow, problem: ProblemRow): Promise<void> {
  const exists = await env.DB.prepare("SELECT 1 FROM projects WHERE claim_id = ?").bind(claim.id).first();
  if (exists) return;
  const plan = cleanClaim(JSON.parse(claim.plan));
  const team = (await teams(env, [claim.id])).get(claim.id) ?? [];
  const id = crypto.randomUUID();
  const draft: Project = {
    id,
    name: cleanName(problem.title),
    description: cleanDescription(problem.summary),
    thumbnail: null,
    notesUrl: "",
    color: null,
    people: team.map((p) => ({ id: p.id, name: p.name, role: null })),
    stage: "solidifying",
    plan: {
      thesis: plan.approach,
      reasoning: problem.details || problem.summary,
      techStack: "",
      steps: plan.milestones.map((m, i) => ({ id: `m${i + 1}`, text: `${m.title}. ${m.criterion}`, ownerId: claim.owner_id })),
    },
    prototype: null,
    builds: [],
    history: {},
    launch: null,
    roleMeanings: {},
  };
  const [project] = cleanProjects([draft]);
  if (!project) return;
  const at = now();
  await env.DB.prepare("INSERT INTO projects (id, owner_id, claim_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, claim.owner_id, claim.id, JSON.stringify(project), at, at)
    .run();
}

interface BoardRow {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_role: string;
  data: string;
  problem_id: string;
  claim_id: string;
  on_team: number | null;
}

// Every board the account can see: partners those on their own problems
// whose work the Lab accepted, everyone else all of them. No emails. `onTeam` marks its own team's, and `editable`
// the ones it can change: its team's, or any for an approver.
async function listBoards(env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const select =
    "SELECT pj.id, pj.owner_id, u.name AS owner_name, u.role AS owner_role, pj.data, c.problem_id, c.id AS claim_id, " +
    "(SELECT 1 FROM claim_members m WHERE m.claim_id = c.id AND m.user_id = ?) AS on_team " +
    "FROM projects pj JOIN claims c ON c.id = pj.claim_id JOIN problems pr ON pr.id = c.problem_id JOIN users u ON u.id = pj.owner_id " +
    "WHERE c.status = 'approved'";
  const { results } =
    user.role === "partner"
      ? await env.DB.prepare(
          `${select} AND pr.owner_id = ? AND EXISTS (SELECT 1 FROM submissions s WHERE s.claim_id = c.id AND s.status = 'accepted') ORDER BY pj.created_at`,
        )
          .bind(user.id, user.id)
          .all<BoardRow>()
      : await env.DB.prepare(`${select} ORDER BY pj.created_at`).bind(user.id).all<BoardRow>();
  const approver = isApprover(env, user);
  const subs = await latestSubmissions(env, results.map((r) => r.claim_id), user.role === "partner");
  const phase = await phaseInfo(env, results.map((r) => r.claim_id));
  return json({
    projects: results.flatMap((r) => {
      const [project] = cleanProjects([JSON.parse(r.data)]);
      return project
        ? [
            {
              project,
              owner: { id: r.owner_id, name: r.owner_name, role: r.owner_role },
              problemId: r.problem_id,
              onTeam: Boolean(r.on_team),
              editable: Boolean(r.on_team) || approver,
              submission: subs.get(r.claim_id) ?? null,
              claimId: r.claim_id,
              selection: phase.selections.get(r.claim_id) ?? null,
            },
          ]
        : [];
    }),
  });
}

// Who may change a board: its team, or an approver, and only while its
// claim is approved. Once the team submits, the board holds still for
// everyone but approvers until the submission is sent back, so the Lab and
// the partner review what was submitted.
async function boardAccess(env: AccountEnv, user: UserRow, id: string): Promise<"edit" | "none" | "locked" | "missing"> {
  const row = await env.DB.prepare(
    "SELECT pj.claim_id, c.status, " +
      "(SELECT 1 FROM claim_members m WHERE m.claim_id = pj.claim_id AND m.user_id = ?) AS on_team, " +
      "(SELECT 1 FROM submissions s WHERE s.claim_id = pj.claim_id AND s.status IN ('pending', 'accepted')) AS submitted " +
      "FROM projects pj JOIN claims c ON c.id = pj.claim_id WHERE pj.id = ?",
  )
    .bind(user.id, id)
    .first<{ claim_id: string; status: ClaimStatus; on_team: number | null; submitted: number | null }>();
  if (!row) return "missing";
  if (isApprover(env, user)) return "edit";
  if (!row.on_team || row.status !== "approved") return "none";
  return row.submitted ? "locked" : "edit";
}

async function saveBoard(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const access = await boardAccess(env, user, id);
  if (access === "missing") return json({ error: "not-found" }, 404);
  if (access === "none") return json({ error: "forbidden" }, 403);
  if (access === "locked") return json({ error: "submitted" }, 409);
  const body = (await req.json().catch(() => null)) as { project?: unknown } | null;
  const [project] = cleanProjects([body?.project]);
  if (!project || project.id !== id) return json({ error: "project" }, 400);
  await env.DB.prepare("UPDATE projects SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(project), now(), id).run();
  return json({ project });
}

// Only an approver removes a board; a team leaves one by withdrawing its
// claim.
async function deleteBoard(env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  if (!isApprover(env, user)) return json({ error: "forbidden" }, 403);
  const { results } = await env.DB.prepare("SELECT id FROM submissions WHERE project_id = ?").bind(id).all<{ id: string }>();
  await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
  for (const r of results) await env.REPORTS.delete(r.id);
  return json({ ok: true });
}

// --- Submissions ---------------------------------------------------------------

const MAX_REPORT = 10 * 1024 * 1024;

// A file is a PDF when it starts with "%PDF-", whatever it is called.
function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

// The team submits: the board moved to its last stage, sent as JSON, and
// the final report as a file, in one form. One submission waits at a time.
async function submit(req: Request, env: AccountEnv, user: UserRow, projectId: string, json: Json): Promise<Response> {
  const access = await boardAccess(env, user, projectId);
  if (access === "missing") return json({ error: "not-found" }, 404);
  if (access === "none") return json({ error: "forbidden" }, 403);
  const tooBig = Number(req.headers.get("content-length") ?? 0) > MAX_REPORT + 1024 * 1024;
  if (tooBig) return json({ error: "report-size" }, 413);
  const row = await env.DB.prepare(`${CLAIM_SELECT} JOIN projects pj ON pj.claim_id = c.id WHERE pj.id = ?`)
    .bind(projectId)
    .first<ClaimRow>();
  if (!row || row.status !== "approved") return json({ error: "state" }, 409);
  const open = await env.DB.prepare("SELECT status FROM submissions WHERE claim_id = ? AND status IN ('pending', 'accepted') LIMIT 1")
    .bind(row.id)
    .first<{ status: string }>();
  if (open) return json({ error: open.status === "pending" ? "pending" : "accepted" }, 409);

  const form = await req.formData().catch(() => null);
  const file = form?.get("report");
  if (!form || !file || typeof file === "string") return json({ error: "report" }, 400);
  if (file.size > MAX_REPORT) return json({ error: "report-size" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return json({ error: "report-type" }, 415);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(form.get("project") ?? ""));
  } catch {
    parsed = null;
  }
  const [project] = cleanProjects([parsed]);
  if (!project || project.id !== projectId || project.stage !== "live" || !project.launch) return json({ error: "project" }, 400);

  const id = crypto.randomUUID();
  const name = cleanLine(file.name, 120).replace(/[^\w .()-]/g, "_") || "report.pdf";
  await env.REPORTS.put(id, bytes, { metadata: { name } });
  const saved = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO submissions (id, claim_id, project_id, submitted_by, report_name, report_size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
    ).bind(id, row.id, projectId, user.id, name, bytes.length, now()),
    env.DB.prepare("UPDATE projects SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(project), now(), projectId),
  ]).catch((e: unknown) => e);
  // Another submission landed first (submissions_open): drop this report.
  if (saved instanceof Error) {
    await env.REPORTS.delete(id);
    return json({ error: "pending" }, 409);
  }

  const problem = await getProblem(env, row.problem_id);
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `Submitted: "${problem?.title ?? project.name}"`,
    `${user.name}'s team submitted its work on "${problem?.title ?? project.name}".\n\nReview it in Approvals:\n${env.SITE_URL}/projectum?view=queue\n\nApplied AI Lab`,
  );
  return json({ id, project }, 201);
}

// The report itself. The approver, members and reps can read any; a
// partner only an accepted one on its own problem.
async function report(env: AccountEnv, user: UserRow, id: string, headers: Record<string, string>, json: Json): Promise<Response> {
  const sub = await env.DB.prepare(
    "SELECT s.status, s.report_name, pr.owner_id AS problem_owner FROM submissions s JOIN claims c ON c.id = s.claim_id JOIN problems pr ON pr.id = c.problem_id WHERE s.id = ?",
  )
    .bind(id)
    .first<{ status: string; report_name: string; problem_owner: string }>();
  if (!sub) return json({ error: "not-found" }, 404);
  if (user.role === "partner" && (sub.status !== "accepted" || sub.problem_owner !== user.id)) return json({ error: "not-found" }, 404);
  const body = await env.REPORTS.get(id, "arrayBuffer");
  if (!body) return json({ error: "not-found" }, 404);
  return new Response(body, {
    headers: {
      ...headers,
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${sub.report_name.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}

// The approver accepts a submission, which shows it to the partner, or
// returns it with a note, which sends the board back to Prototype so the
// team can work on and submit again.
async function reviewSubmission(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const decision = body.decision === "accept" ? "accepted" : body.decision === "return" ? "returned" : null;
  if (!decision) return json({ error: "decision" }, 400);
  const note = cleanLine(body.note, LIMITS.note);
  const sub = await env.DB.prepare("SELECT id, claim_id, project_id, status FROM submissions WHERE id = ?")
    .bind(id)
    .first<{ id: string; claim_id: string; project_id: string; status: string }>();
  if (!sub) return json({ error: "not-found" }, 404);
  if (sub.status !== "pending") return json({ error: "state" }, 409);
  if (await onTeam(env, sub.claim_id, user.id)) return json({ error: "own-claim" }, 403);
  // Only the first decision lands, however many are sent at once.
  const claimed = await env.DB.prepare(
    "UPDATE submissions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'",
  )
    .bind(decision, note, user.id, now(), id)
    .run();
  if (!claimed.meta.changes) return json({ error: "state" }, 409);
  const writes: D1PreparedStatement[] = [];
  if (decision === "returned") {
    const pj = await env.DB.prepare("SELECT data FROM projects WHERE id = ?").bind(sub.project_id).first<{ data: string }>();
    const [current] = pj ? cleanProjects([JSON.parse(pj.data)]) : [];
    if (current) {
      const history = { ...current.history };
      delete history.prototype;
      const [back] = cleanProjects([{ ...current, stage: "prototype", launch: null, history }]);
      if (back) writes.push(env.DB.prepare("UPDATE projects SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(back), now(), sub.project_id));
    }
  }
  if (writes.length) await env.DB.batch(writes);

  const claim = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).bind(sub.claim_id).first<ClaimRow>();
  const problem = claim ? await getProblem(env, claim.problem_id) : null;
  const title = problem?.title ?? "your project";
  const { results } = await env.DB.prepare(
    "SELECT u.email, u.name FROM claim_members m JOIN users u ON u.id = m.user_id WHERE m.claim_id = ?",
  )
    .bind(sub.claim_id)
    .all<{ email: string; name: string }>();
  const text =
    decision === "accepted"
      ? `The Lab accepted your submission on "${title}".${problem?.origin === "partner" ? ` ${problem.owner_name} can now review it.` : ""}`
      : `The Lab sent your submission on "${title}" back for more work. Your board is in Prototype again, so you can keep building and submit when it's ready.`;
  for (const m of results) {
    await sendEmail(
      env,
      m.email,
      decision === "accepted" ? `Accepted: "${title}"` : `Back to you: "${title}"`,
      `Hi ${m.name},\n\n${text}${note ? `\n\nNote from the Lab: ${note}` : ""}\n\n${env.SITE_URL}/projectum?view=claims\n\nApplied AI Lab`,
    );
  }
  if (decision === "accepted" && problem?.origin === "partner") {
    const owner = await env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(problem.owner_id).first<{ email: string; name: string }>();
    if (owner) {
      await sendEmail(
        env,
        owner.email,
        `A team finished "${title}"`,
        `Hi ${owner.name},\n\nA student team submitted its work on "${title}", and the Lab reviewed it. Read their report and links:\n${env.SITE_URL}/projectum?problem=${problem.id}\n\nApplied AI Lab, Weber State University`,
      );
    }
  }
  return json({ ok: true });
}

// --- Meetings and phase 2 -------------------------------------------------------

interface PhaseClaim {
  id: string;
  problem_id: string;
  title: string;
  problem_owner: string;
  partner_name: string;
  partner_email: string;
}

// An approved claim with an accepted submission, on a partner's problem that
// the given partner owns (or any, for an approver). A member's own project
// has no partner, so nobody meets or hires on it.
async function acceptedClaim(env: AccountEnv, user: UserRow, claimId: string): Promise<PhaseClaim | null> {
  const row = await env.DB.prepare(
    "SELECT c.id, c.problem_id, pr.title, pr.owner_id AS problem_owner, u.name AS partner_name, u.email AS partner_email " +
      "FROM claims c JOIN problems pr ON pr.id = c.problem_id JOIN users u ON u.id = pr.owner_id " +
      "WHERE c.id = ? AND c.status = 'approved' AND pr.origin = 'partner' " +
      "AND EXISTS (SELECT 1 FROM submissions s WHERE s.claim_id = c.id AND s.status = 'accepted')",
  )
    .bind(claimId)
    .first<PhaseClaim>();
  if (!row) return null;
  return row.problem_owner === user.id || isApprover(env, user) ? row : null;
}

async function teamContacts(env: AccountEnv, claimId: string) {
  const { results } = await env.DB.prepare(
    "SELECT u.name, u.email FROM claim_members m JOIN users u ON u.id = m.user_id WHERE m.claim_id = ? ORDER BY u.name",
  )
    .bind(claimId)
    .all<{ name: string; email: string }>();
  return results;
}

// The partner asks to meet the team. The approver gets both sides' contacts
// to introduce them; the team hears it's coming.
async function requestMeeting(req: Request, env: AccountEnv, user: UserRow, claimId: string, json: Json): Promise<Response> {
  const claim = await acceptedClaim(env, user, claimId);
  if (!claim || claim.problem_owner !== user.id) return json({ error: "not-found" }, 404);
  const open = await env.DB.prepare("SELECT 1 FROM meetings WHERE claim_id = ? AND status = 'requested'").bind(claimId).first();
  if (open) return json({ error: "requested" }, 409);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const message = cleanLine(body.message, LIMITS.note);
  const asked = await env.DB.prepare(
    "INSERT INTO meetings (id, claim_id, requested_by, message, status, created_at) VALUES (?, ?, ?, ?, 'requested', ?)",
  )
    .bind(crypto.randomUUID(), claimId, user.id, message, now())
    .run()
    .catch((e: unknown) => e);
  if (asked instanceof Error) return json({ error: "requested" }, 409);
  const team = await teamContacts(env, claimId);
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `Meeting request: "${claim.title}"`,
    `${claim.partner_name} (${claim.partner_email}) wants to meet the team that solved "${claim.title}".${
      message ? `\n\nTheir message: ${message}` : ""
    }\n\nThe team:\n${team.map((t) => `- ${t.name}, ${t.email}`).join("\n")}\n\nIntroduce them, then mark it arranged in Approvals:\n${env.SITE_URL}/projectum?view=queue\n\nApplied AI Lab`,
  );
  for (const t of team) {
    await sendEmail(
      env,
      t.email,
      `${claim.partner_name} wants to meet about "${claim.title}"`,
      `Hi ${t.name},\n\n${claim.partner_name} read your submission on "${claim.title}" and asked to meet your team. The Lab will introduce you by email.${
        message ? `\n\nTheir message: ${message}` : ""
      }\n\nApplied AI Lab`,
    );
  }
  return json({ ok: true }, 201);
}

async function arrangeMeeting(env: AccountEnv, id: string, json: Json): Promise<Response> {
  const r = await env.DB.prepare("UPDATE meetings SET status = 'arranged', arranged_at = ? WHERE id = ? AND status = 'requested'")
    .bind(now(), id)
    .run();
  return r.meta.changes ? json({ ok: true }) : json({ error: "not-found" }, 404);
}

// The partner hires the team as interns: phase 2 begins.
async function selectTeam(req: Request, env: AccountEnv, user: UserRow, claimId: string, json: Json): Promise<Response> {
  const claim = await acceptedClaim(env, user, claimId);
  if (!claim || claim.problem_owner !== user.id) return json({ error: "not-found" }, 404);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const message = cleanLine(body.message, LIMITS.note);
  const r = await env.DB.prepare(
    "INSERT INTO selections (claim_id, selected_by, message, milestones, created_at) VALUES (?, ?, ?, '[]', ?) ON CONFLICT(claim_id) DO NOTHING",
  )
    .bind(claimId, user.id, message, now())
    .run();
  if (!r.meta.changes) return json({ error: "selected" }, 409);
  const team = await teamContacts(env, claimId);
  for (const t of team) {
    await sendEmail(
      env,
      t.email,
      `You're selected for an internship: "${claim.title}"`,
      `Hi ${t.name},\n\n${claim.partner_name} selected your team as interns to put "${claim.title}" to work. Phase 2 starts now: add your implementation milestones on your board and tick them off as you go.${
        message ? `\n\nTheir message: ${message}` : ""
      }\n\n${env.SITE_URL}/projectum?view=claims\n\nApplied AI Lab`,
    );
  }
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `Internship: "${claim.title}"`,
    `${claim.partner_name} selected ${team.map((t) => t.name).join(", ")} as interns for "${claim.title}".\n\n${env.SITE_URL}/projectum?problem=${claim.problem_id}\n\nApplied AI Lab`,
  );
  return json({ ok: true }, 201);
}

async function selectionFor(env: AccountEnv, claimId: string) {
  return env.DB.prepare("SELECT completed_at FROM selections WHERE claim_id = ?").bind(claimId).first<{ completed_at: string | null }>();
}

// The team (or the approver) updates its implementation milestones.
async function savePhase(req: Request, env: AccountEnv, user: UserRow, claimId: string, json: Json): Promise<Response> {
  const claim = await env.DB.prepare("SELECT status FROM claims WHERE id = ?").bind(claimId).first<{ status: ClaimStatus }>();
  if (!claim || claim.status !== "approved") return json({ error: "not-found" }, 404);
  if (!(await onTeam(env, claimId, user.id)) && !isApprover(env, user)) return json({ error: "forbidden" }, 403);
  const sel = await selectionFor(env, claimId);
  if (!sel) return json({ error: "not-found" }, 404);
  if (sel.completed_at) return json({ error: "complete" }, 409);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const milestones = cleanPhaseMilestones(body.milestones);
  await env.DB.prepare("UPDATE selections SET milestones = ? WHERE claim_id = ?").bind(JSON.stringify(milestones), claimId).run();
  return json({ milestones });
}

// The partner (or the approver) marks the project complete.
async function completePhase(env: AccountEnv, user: UserRow, claimId: string, json: Json): Promise<Response> {
  const claim = await acceptedClaim(env, user, claimId);
  if (!claim) return json({ error: "not-found" }, 404);
  const r = await env.DB.prepare("UPDATE selections SET completed_at = ? WHERE claim_id = ? AND completed_at IS NULL")
    .bind(now(), claimId)
    .run();
  if (!r.meta.changes) return json({ error: "state" }, 409);
  for (const t of await teamContacts(env, claimId)) {
    await sendEmail(
      env,
      t.email,
      `Complete: "${claim.title}"`,
      `Hi ${t.name},\n\n"${claim.title}" with ${claim.partner_name} is marked complete. Shipped work, an industry relationship and a line on the résumé.\n\nApplied AI Lab`,
    );
  }
  return json({ ok: true });
}

// --- Overview --------------------------------------------------------------------

// Everything at once, for approvers: every problem, open or closed; every
// claim with where it stands; and every account. Built from a few joined
// queries rather than one per row.
async function overview(env: AccountEnv, json: Json): Promise<Response> {
  const problems = await env.DB.prepare(`${PROBLEM_SELECT} ORDER BY p.created_at DESC`).all<ProblemRow>();
  const claims = await env.DB.prepare(
    "SELECT c.id, c.problem_id, c.status, c.created_at, c.reviewed_at, pr.title, pr.origin, ou.name AS owner_name, " +
      "(SELECT s.status FROM submissions s WHERE s.claim_id = c.id ORDER BY s.created_at DESC LIMIT 1) AS submission, " +
      "(SELECT m.status FROM meetings m WHERE m.claim_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS meeting, " +
      "(SELECT CASE WHEN sel.completed_at IS NULL THEN 'hired' ELSE 'complete' END FROM selections sel WHERE sel.claim_id = c.id) AS selection, " +
      "(SELECT pj.id FROM projects pj WHERE pj.claim_id = c.id) AS project_id " +
      "FROM claims c JOIN problems pr ON pr.id = c.problem_id JOIN users ou ON ou.id = pr.owner_id ORDER BY c.created_at DESC",
  ).all<{
    id: string;
    problem_id: string;
    status: ClaimStatus;
    created_at: string;
    reviewed_at: string | null;
    title: string;
    origin: "partner" | "member";
    owner_name: string;
    submission: "pending" | "accepted" | "returned" | null;
    meeting: "requested" | "arranged" | null;
    selection: "hired" | "complete" | null;
    project_id: string | null;
  }>();
  const members = await env.DB.prepare(
    "SELECT m.claim_id, u.id, u.name FROM claim_members m JOIN users u ON u.id = m.user_id ORDER BY u.name COLLATE NOCASE",
  ).all<{ claim_id: string; id: string; name: string }>();
  const team = new Map<string, Person[]>();
  for (const r of members.results) team.set(r.claim_id, [...(team.get(r.claim_id) ?? []), { id: r.id, name: r.name }]);
  const people = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, u.role, u.status, u.created_at, " +
      "(SELECT COUNT(*) FROM claim_members m JOIN claims c ON c.id = m.claim_id WHERE m.user_id = u.id AND c.status = 'approved') AS active_claims, " +
      "(SELECT COUNT(*) FROM problems p WHERE p.owner_id = u.id) AS problems " +
      "FROM users u ORDER BY u.created_at DESC",
  ).all<{
    id: string;
    email: string;
    name: string;
    role: AccountRole;
    status: string;
    created_at: string;
    active_claims: number;
    problems: number;
  }>();
  return json({
    problems: problems.results.map(problemOut),
    claims: claims.results.map((c) => ({
      id: c.id,
      problemId: c.problem_id,
      title: c.title,
      origin: c.origin,
      owner: c.owner_name,
      status: c.status,
      createdAt: c.created_at,
      reviewedAt: c.reviewed_at,
      submission: c.submission,
      meeting: c.meeting,
      selection: c.selection,
      projectId: c.project_id,
      team: team.get(c.id) ?? [],
    })),
    people: people.results.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      approver: isApprover(env, { email: u.email, role: u.role, status: u.status }),
      activeClaims: u.active_claims,
      problems: u.problems,
    })),
  });
}

// An approver turns an account off, which also signs it out everywhere, or
// back on. Nobody turns off their own account or another approver's.
async function setPersonStatus(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const status = body.status === "removed" ? "removed" : body.status === "active" ? "active" : null;
  if (!status) return json({ error: "status" }, 400);
  if (id === user.id) return json({ error: "self" }, 403);
  const target = await env.DB.prepare("SELECT email, role, status FROM users WHERE id = ?")
    .bind(id)
    .first<{ email: string; role: AccountRole; status: string }>();
  if (!target) return json({ error: "not-found" }, 404);
  if (isApprover(env, { ...target, status: "active" })) return json({ error: "approver" }, 403);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, id),
    ...(status === "removed" ? [env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id)] : []),
  ]);
  return json({ ok: true });
}

// --- Routes --------------------------------------------------------------------

// /problems, /claims, /queue, /partners, /proposals, /projects,
// /submissions, /meetings, /overview and /accounts. Null for any other
// path.
export async function handlePipeline(
  req: Request,
  env: AccountEnv,
  headers: Record<string, string>,
): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!/^\/(problems|claims|queue|partners|proposals|projects|submissions|meetings|overview|accounts)(\/|$)/.test(pathname)) return null;
  const json: Json = (body, status = 200) =>
    Response.json(body, { status, headers: { ...headers, "cache-control": "no-store" } });

  const user = await sessionUser(req, env);
  if (!user) return json({ error: "signed-out" }, 401);
  if (user.status !== "active") return json({ error: "pending" }, 403);
  const m = req.method;
  const approver = isApprover(env, user);

  if (pathname === "/problems" && m === "GET") return listProblems(env, user, json);
  if (pathname === "/problems" && m === "POST") return createProblem(req, env, user, json);
  let match = pathname.match(/^\/problems\/([\w-]{1,64})$/);
  if (match && m === "GET") return showProblem(env, user, match[1], json);
  if (match && m === "PATCH") return updateProblem(req, env, user, match[1], json);
  match = pathname.match(/^\/problems\/([\w-]{1,64})\/claims$/);
  if (match && m === "POST") return createClaim(req, env, user, match[1], json);

  if (pathname === "/proposals" && m === "POST") return propose(req, env, user, json);
  if (pathname === "/projects" && m === "GET") return listBoards(env, user, json);
  match = pathname.match(/^\/projects\/([\w-]{1,64})$/);
  if (match && m === "PUT") return saveBoard(req, env, user, match[1], json);
  if (match && m === "DELETE") return deleteBoard(env, user, match[1], json);
  match = pathname.match(/^\/projects\/([\w-]{1,64})\/submissions$/);
  if (match && m === "POST") return submit(req, env, user, match[1], json);
  match = pathname.match(/^\/submissions\/([\w-]{1,64})\/report$/);
  if (match && m === "GET") return report(env, user, match[1], headers, json);

  if (pathname === "/claims/mine" && m === "GET") return myClaims(env, user, json);
  match = pathname.match(/^\/claims\/([\w-]{1,64})\/(meeting|select|phase|complete)$/);
  if (match && m === "POST" && match[2] === "meeting") return requestMeeting(req, env, user, match[1], json);
  if (match && m === "POST" && match[2] === "select") return selectTeam(req, env, user, match[1], json);
  if (match && m === "PUT" && match[2] === "phase") return savePhase(req, env, user, match[1], json);
  if (match && m === "POST" && match[2] === "complete") return completePhase(env, user, match[1], json);
  match = pathname.match(/^\/claims\/([\w-]{1,64})\/withdraw$/);
  if (match && m === "POST") return withdrawClaim(env, user, match[1], json);

  if (!approver && /^\/(queue|partners|meetings|overview|accounts)|^\/(claims|submissions)\/[\w-]+\/review$/.test(pathname)) {
    return json({ error: "forbidden" }, 403);
  }
  if (pathname === "/queue" && m === "GET") return queue(env, json);
  if (pathname === "/overview" && m === "GET") return overview(env, json);
  match = pathname.match(/^\/accounts\/([\w-]{1,64})\/status$/);
  if (match && m === "POST") return setPersonStatus(req, env, user, match[1], json);
  match = pathname.match(/^\/claims\/([\w-]{1,64})\/review$/);
  if (match && m === "POST") return reviewClaim(req, env, user, match[1], json);
  match = pathname.match(/^\/submissions\/([\w-]{1,64})\/review$/);
  if (match && m === "POST") return reviewSubmission(req, env, user, match[1], json);
  match = pathname.match(/^\/meetings\/([\w-]{1,64})\/arranged$/);
  if (match && m === "POST") return arrangeMeeting(env, match[1], json);
  match = pathname.match(/^\/partners\/([\w-]{1,64})\/approve$/);
  if (match && m === "POST") return approvePartnerInApp(env, match[1], json);

  return json({ error: "not-found" }, 404);
}
