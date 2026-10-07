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
// The approver hears about each new claim by email, and the team hears the
// decision.

import { type AccountEnv, type Json, type UserRow, isApprover, sendEmail, sessionUser } from "./accounts";
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

async function teams(env: AccountEnv, claimIds: string[]): Promise<Map<string, Person[]>> {
  const map = new Map<string, Person[]>();
  if (!claimIds.length) return map;
  const marks = claimIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT m.claim_id, u.id, u.name FROM claim_members m JOIN users u ON u.id = m.user_id WHERE m.claim_id IN (${marks}) ORDER BY u.name COLLATE NOCASE`,
  )
    .bind(...claimIds)
    .all<{ claim_id: string; id: string; name: string }>();
  for (const r of results) map.set(r.claim_id, [...(map.get(r.claim_id) ?? []), { id: r.id, name: r.name }]);
  return map;
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
  return json({
    problem: problemOut(row),
    claims: results.map((c) => claimOut(c, team.get(c.id) ?? [])),
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
  await env.DB.batch([
    env.DB.prepare("INSERT INTO claims (id, problem_id, owner_id, plan, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)").bind(
      id,
      problemId,
      user.id,
      JSON.stringify({ approach: draft.approach, milestones: draft.milestones, finishBy: draft.finishBy }),
      now(),
    ),
    ...team.map((m) => env.DB.prepare("INSERT INTO claim_members (claim_id, user_id) VALUES (?, ?)").bind(id, m)),
  ]);
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
  return json({
    claims: results.map((c) => ({ ...claimOut(c, team.get(c.id) ?? []), problem: problems.get(c.problem_id) ?? null })),
  });
}

async function withdrawClaim(env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const claim = await env.DB.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).bind(id).first<ClaimRow>();
  if (!claim) return json({ error: "not-found" }, 404);
  const member = await env.DB.prepare("SELECT 1 FROM claim_members WHERE claim_id = ? AND user_id = ?").bind(id, user.id).first();
  if (!member) return json({ error: "forbidden" }, 403);
  if (claim.status !== "pending" && claim.status !== "approved") return json({ error: "state" }, 409);
  await env.DB.prepare("UPDATE claims SET status = 'withdrawn' WHERE id = ?").bind(id).run();
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
  return json({
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
  await env.DB.prepare("UPDATE claims SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?")
    .bind(decision, note, user.id, now(), id)
    .run();

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
  owner_email: string;
  owner_role: string;
  data: string;
  problem_id: string;
  on_team: number | null;
}

// Every board the account can see: partners those on their own problems,
// everyone else all of them. `onTeam` marks its own team's, and `editable`
// the ones it can change: its team's, or any for an approver.
async function listBoards(env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const select =
    "SELECT pj.id, pj.owner_id, u.name AS owner_name, u.email AS owner_email, u.role AS owner_role, pj.data, c.problem_id, " +
    "(SELECT 1 FROM claim_members m WHERE m.claim_id = c.id AND m.user_id = ?) AS on_team " +
    "FROM projects pj JOIN claims c ON c.id = pj.claim_id JOIN problems pr ON pr.id = c.problem_id JOIN users u ON u.id = pj.owner_id " +
    "WHERE c.status = 'approved'";
  const { results } =
    user.role === "partner"
      ? await env.DB.prepare(`${select} AND pr.owner_id = ? ORDER BY pj.created_at`).bind(user.id, user.id).all<BoardRow>()
      : await env.DB.prepare(`${select} ORDER BY pj.created_at`).bind(user.id).all<BoardRow>();
  const approver = isApprover(env, user);
  return json({
    projects: results.flatMap((r) => {
      const [project] = cleanProjects([JSON.parse(r.data)]);
      return project
        ? [
            {
              project,
              owner: { id: r.owner_id, name: r.owner_name, email: r.owner_email, role: r.owner_role },
              problemId: r.problem_id,
              onTeam: Boolean(r.on_team),
              editable: Boolean(r.on_team) || approver,
            },
          ]
        : [];
    }),
  });
}

async function boardAccess(env: AccountEnv, user: UserRow, id: string): Promise<"edit" | "none" | "missing"> {
  const row = await env.DB.prepare(
    "SELECT pj.claim_id, (SELECT 1 FROM claim_members m WHERE m.claim_id = pj.claim_id AND m.user_id = ?) AS on_team FROM projects pj WHERE pj.id = ?",
  )
    .bind(user.id, id)
    .first<{ claim_id: string; on_team: number | null }>();
  if (!row) return "missing";
  return row.on_team || isApprover(env, user) ? "edit" : "none";
}

async function saveBoard(req: Request, env: AccountEnv, user: UserRow, id: string, json: Json): Promise<Response> {
  const access = await boardAccess(env, user, id);
  if (access === "missing") return json({ error: "not-found" }, 404);
  if (access === "none") return json({ error: "forbidden" }, 403);
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
  await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// --- Routes --------------------------------------------------------------------

// /problems, /claims, /queue, /partners, /proposals and /projects. Null for
// any other path.
export async function handlePipeline(
  req: Request,
  env: AccountEnv,
  headers: Record<string, string>,
): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!/^\/(problems|claims|queue|partners|proposals|projects)(\/|$)/.test(pathname)) return null;
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

  if (pathname === "/claims/mine" && m === "GET") return myClaims(env, user, json);
  match = pathname.match(/^\/claims\/([\w-]{1,64})\/withdraw$/);
  if (match && m === "POST") return withdrawClaim(env, user, match[1], json);

  if (!approver && /^\/(queue|partners)|^\/claims\/[\w-]+\/review$/.test(pathname)) return json({ error: "forbidden" }, 403);
  if (pathname === "/queue" && m === "GET") return queue(env, json);
  match = pathname.match(/^\/claims\/([\w-]{1,64})\/review$/);
  if (match && m === "POST") return reviewClaim(req, env, user, match[1], json);
  match = pathname.match(/^\/partners\/([\w-]{1,64})\/approve$/);
  if (match && m === "POST") return approvePartnerInApp(env, match[1], json);

  return json({ error: "not-found" }, 404);
}
