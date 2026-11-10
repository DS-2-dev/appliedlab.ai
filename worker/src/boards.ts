// Boards: the JSON workspace a team works in (src/lib/projects.ts calls it a
// Project). Every project has one, opened at claim in Solidifying; a member
// may also keep boards of their own with no project (Brainstorming, before
// proposing one). While a plan is being written the board and the project's
// plan mirror each other, so the Solidifying dialog and the plan editor show
// the same plan.
//
//   GET    /boards       every board the viewer may see, as the board list
//   PUT    /boards/:id   { project } the board, by whoever may edit it
//   DELETE /boards/:id   by an admin
//
// POST /boards/:id/submissions and GET /submissions/:id/report are in
// submissions.ts.

import { atStage, cleanDescription, cleanName, cleanProjects, splitStep, stepText as milestoneText, type Project, type Step } from "@/lib/projects";
import { cleanPhaseMilestones, cleanPlan, type Milestone, type PlanDraft } from "@/lib/problems";
import { boardStageFor } from "@/lib/pipeline/machines";
import type { ProjectStatus } from "@/lib/pipeline/domain";
import { isAdmin, type AccountEnv, type Json, type UserRow } from "./accounts";
import { json as parse, marks, now, uuid } from "./db";
import { projectView, viewerOf } from "./projects";

type Env = AccountEnv;

type Person = { id: string; name: string };

// What a board's posting gives it: its name, description and the reasoning
// behind the plan.
export type BoardPosting = { title: string; summary: string; details: string };

// One step per milestone, "<title>. <criterion>", ids m1..mN. A step keeps
// the owner it had (same id, still on the team); new ones go to the lead.
function stepsFrom(plan: PlanDraft, leadId: string, before: Step[], memberIds: string[]): Step[] {
  return plan.milestones.map((m, i) => {
    const id = `m${i + 1}`;
    const kept = before.find((s) => s.id === id && memberIds.includes(s.ownerId));
    return { id, text: stepText(m), ownerId: kept?.ownerId ?? leadId };
  });
}

const stepText = (m: Milestone): string => milestoneText(m.title, m.criterion);

// The plan a board's Solidifying fields describe. A step that reads exactly
// as an existing milestone keeps it; any other splits at its first ". " into
// title and criterion. The finish date is the plan's own.
export function planFromBoard(board: Project, current: PlanDraft): PlanDraft {
  const known = new Map(current.milestones.map((m) => [stepText(m), m]));
  const milestones = (board.plan?.steps ?? []).map((s) => {
    const same = known.get(s.text);
    if (same) return same;
    return splitStep(s.text);
  });
  return cleanPlan({ approach: board.plan?.thesis ?? "", milestones, finishBy: current.finishBy });
}

// The board as cleanProjects reads it, held in Solidifying while the
// project's status keeps it there.
export function readBoard(data: string, status: ProjectStatus | null): Project | null {
  const [board] = cleanProjects([parse<unknown>(data, null)]);
  if (!board) return null;
  return status && boardStageFor(status) === "solidifying" ? atStage(board, "solidifying") : board;
}

// The board a project opens with: in Solidifying, named after the posting,
// with the team on it and the plan so far as its plan.
function boardFor(id: string, posting: BoardPosting, team: Person[], plan: PlanDraft, leadId: string): Project {
  const draft: Project = {
    id,
    name: cleanName(posting.title) || "Project",
    description: cleanDescription(posting.summary),
    thumbnail: null,
    notesUrl: "",
    color: null,
    people: team.map((p) => ({ id: p.id, name: p.name || "Member", role: null })),
    stage: "solidifying",
    plan: {
      thesis: plan.approach,
      reasoning: posting.details || posting.summary,
      techStack: "",
      steps: stepsFrom(plan, leadId, [], team.map((p) => p.id)),
    },
    prototype: null,
    builds: [],
    history: {},
    launch: null,
    roleMeanings: {},
  };
  const [clean] = cleanProjects([draft]);
  return atStage(clean ?? draft, "solidifying");
}

// The statement that opens a project's board, for the caller's batch. A
// project already holding one keeps it (boards.project_id is unique).
export function openBoard(
  env: Env,
  project: { id: string; leadId: string },
  posting: BoardPosting,
  team: Person[],
  plan: PlanDraft,
  at: string,
): { id: string; stmt: D1PreparedStatement } {
  const id = uuid();
  const data = boardFor(id, posting, team, plan, project.leadId);
  const stmt = env.DB.prepare(
    "INSERT OR IGNORE INTO boards (id, project_id, owner_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(id, project.id, project.leadId, JSON.stringify(data), at, at);
  return { id, stmt };
}

// Writes a saved plan into the project's board: the approach as its thesis,
// the milestones as its steps. Applies only while the plan is still being
// written, so it can sit in the same batch as the plan's own UPDATE.
export async function mirrorPlanToBoard(
  env: Env,
  projectId: string,
  leadId: string,
  posting: BoardPosting,
  plan: PlanDraft,
): Promise<D1PreparedStatement | null> {
  const row = await env.DB.prepare("SELECT id, data FROM boards WHERE project_id = ?").bind(projectId).first<{ id: string; data: string }>();
  const board = row && readBoard(row.data, "claimed");
  if (!row || !board) return null;
  const next: Project = {
    ...board,
    plan: {
      thesis: plan.approach,
      reasoning: board.plan?.reasoning || posting.details || posting.summary,
      techStack: board.plan?.techStack ?? "",
      steps: stepsFrom(plan, leadId, board.plan?.steps ?? [], board.people.map((p) => p.id)),
    },
  };
  const [clean] = cleanProjects([next]);
  return env.DB.prepare(
    "UPDATE boards SET data = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND status IN ('claimed', 'plan_returned'))",
  ).bind(JSON.stringify(atStage(clean ?? next, "solidifying")), now(), row.id, projectId);
}

// Creates a board for every project in play that has none (plans the
// migration found still in review); withdrawn and complete ones are left
// alone. Returns how many it made.
export async function ensureBoards(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.lead_id, p.plan, po.title, po.summary, po.details FROM projects p JOIN postings po ON po.id = p.posting_id " +
      "WHERE p.status NOT IN ('withdrawn', 'complete') AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.project_id = p.id)",
  ).all<{ id: string; lead_id: string; plan: string; title: string; summary: string; details: string }>();
  if (results.length === 0) return 0;
  const team = await teamsOf(env, results.map((r) => r.id));
  const at = now();
  const stmts = results.map(
    (r) => openBoard(env, { id: r.id, leadId: r.lead_id }, r, team.get(r.id) ?? [], cleanPlan(parse<unknown>(r.plan, {})), at).stmt,
  );
  const done = await env.DB.batch(stmts);
  return done.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

// Each project's team, lead first.
async function teamsOf(env: Env, projectIds: string[]): Promise<Map<string, Person[]>> {
  const { results } = await env.DB.prepare(
    "SELECT m.project_id, u.id, u.name FROM project_members m JOIN users u ON u.id = m.user_id " +
      "WHERE m.project_id IN (SELECT value FROM json_each(?)) ORDER BY m.role = 'member', m.joined_at, u.name COLLATE NOCASE",
  )
    .bind(JSON.stringify(projectIds))
    .all<{ project_id: string; id: string; name: string }>();
  const out = new Map<string, Person[]>();
  for (const r of results) out.set(r.project_id, [...(out.get(r.project_id) ?? []), { id: r.id, name: r.name }]);
  return out;
}

// ---------------------------------------------------------------- access

const EDITABLE: readonly ProjectStatus[] = ["claimed", "plan_returned", "active", "submission_returned", "integrated"];
const LOCKED: readonly ProjectStatus[] = ["plan_review", "submission_review", "delivered", "completion_review"];

type Access = "edit" | "locked" | "none";

// Admins edit any board; the team edits its own while the project is in its
// court, and finds it locked while a gate decides; everyone else reads it
// from the list or not at all. A board with no project is its owner's.
function accessFor(b: { project_id: string | null; owner_id: string; status: ProjectStatus | null; on_team: number | null }, user: UserRow, admin: boolean): Access {
  if (admin) return "edit";
  if (!b.project_id) return b.owner_id === user.id ? "edit" : "none";
  if (!b.on_team || !b.status) return "none";
  if (EDITABLE.includes(b.status)) return "edit";
  return LOCKED.includes(b.status) ? "locked" : "none";
}

export async function boardAccess(env: Env, user: UserRow, boardId: string): Promise<Access | "missing"> {
  const row = await env.DB.prepare(
    "SELECT b.project_id, b.owner_id, p.status, (SELECT 1 FROM project_members m WHERE m.project_id = b.project_id AND m.user_id = ?) AS on_team " +
      "FROM boards b LEFT JOIN projects p ON p.id = b.project_id WHERE b.id = ?",
  )
    .bind(user.id, boardId)
    .first<{ project_id: string | null; owner_id: string; status: ProjectStatus | null; on_team: number | null }>();
  return row ? accessFor(row, user, isAdmin(env, user)) : "missing";
}

// ---------------------------------------------------------------- list

interface BoardRow {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_role: string;
  data: string;
  project_id: string | null;
  status: ProjectStatus | null;
  posting_id: string | null;
  posting_title: string | null;
  posting_kind: "partner" | "self" | null;
  posting_org: string | null;
  on_team: number | null;
}

type SubmissionOut = { id: string; status: "pending" | "accepted" | "returned"; reviewNote: string; reportName: string; reportSize: number; createdAt: string };

// Each project's latest submission, and its latest accepted one (all a
// partner sees, without the Lab's notes to the team).
async function latestSubmissions(env: Env, projectIds: string[]) {
  const { results } = await env.DB.prepare(
    "SELECT id, project_id, report_name, report_size, status, review_note, created_at FROM submissions " +
      "WHERE project_id IN (SELECT value FROM json_each(?)) ORDER BY created_at",
  )
    .bind(JSON.stringify(projectIds))
    .all<{ id: string; project_id: string; report_name: string; report_size: number; status: SubmissionOut["status"]; review_note: string; created_at: string }>();
  const latest = new Map<string, SubmissionOut>();
  const accepted = new Map<string, SubmissionOut>();
  for (const r of results) {
    const out = { id: r.id, status: r.status, reviewNote: r.review_note, reportName: r.report_name, reportSize: r.report_size, createdAt: r.created_at };
    latest.set(r.project_id, out);
    if (r.status === "accepted") accepted.set(r.project_id, { ...out, reviewNote: "" });
  }
  return { latest, accepted };
}

async function selections(env: Env, projectIds: string[]) {
  const { results } = await env.DB.prepare(
    "SELECT project_id, message, milestones, completed_at, created_at FROM selections WHERE project_id IN (SELECT value FROM json_each(?))",
  )
    .bind(JSON.stringify(projectIds))
    .all<{ project_id: string; message: string; milestones: string; completed_at: string | null; created_at: string }>();
  return new Map(
    results.map((r) => [
      r.project_id,
      { message: r.message, milestones: cleanPhaseMilestones(parse<unknown>(r.milestones, [])), completedAt: r.completed_at, createdAt: r.created_at },
    ]),
  );
}

type MeetingOut = { id: string; status: "requested" | "scheduled"; message: string; createdAt: string };

// Each project's latest meeting request: the partner sees where theirs
// stands, and staff mark it arranged from the board.
async function latestMeetings(env: Env, projectIds: string[]) {
  const { results } = await env.DB.prepare(
    "SELECT id, project_id, status, message, created_at FROM meetings WHERE project_id IN (SELECT value FROM json_each(?)) ORDER BY created_at",
  )
    .bind(JSON.stringify(projectIds))
    .all<{ id: string; project_id: string; status: MeetingOut["status"]; message: string; created_at: string }>();
  const latest = new Map<string, MeetingOut>();
  for (const r of results) latest.set(r.project_id, { id: r.id, status: r.status, message: r.message, createdAt: r.created_at });
  return latest;
}

// Boards made before the migration's projects had them come once per
// isolate, on the first list, as well as daily.
let ensured = false;

// Every board the viewer may see: their own and their team's, every one for
// staff, a partner's once the plan is approved. A board with no project shows only to its owner
// and admins.
async function listBoards(env: Env, user: UserRow, json: Json): Promise<Response> {
  if (!ensured) {
    ensured = true;
    await ensureBoards(env);
  }
  const v = viewerOf(env, user);
  const { results } = await env.DB.prepare(
    "SELECT b.id, b.owner_id, u.name AS owner_name, u.role AS owner_role, b.data, b.project_id, p.status, p.posting_id, " +
      "po.title AS posting_title, po.kind AS posting_kind, po.org_id AS posting_org, " +
      "(SELECT 1 FROM project_members m WHERE m.project_id = b.project_id AND m.user_id = ?) AS on_team " +
      "FROM boards b JOIN users u ON u.id = b.owner_id LEFT JOIN projects p ON p.id = b.project_id LEFT JOIN postings po ON po.id = p.posting_id " +
      "ORDER BY b.created_at",
  )
    .bind(user.id)
    .all<BoardRow>();
  const shown = results.flatMap((r) => {
    if (!r.project_id || !r.status) return r.owner_id === user.id || v.admin ? [{ r, view: "full" as const }] : [];
    const view = projectView(r.status, { kind: r.posting_kind ?? "partner", org_id: r.posting_org }, Boolean(r.on_team), v);
    if (view === "none" || (r.status === "withdrawn" && !v.admin)) return [];
    return [{ r, view }];
  });
  const ids = shown.flatMap(({ r }) => (r.project_id ? [r.project_id] : []));
  const [subs, picked, met] = await Promise.all([latestSubmissions(env, ids), selections(env, ids), latestMeetings(env, ids)]);
  return json({
    projects: shown.flatMap(({ r, view }) => {
      const project = readBoard(r.data, r.status);
      if (!project) return [];
      const pid = r.project_id;
      return [
        {
          project: project,
          brief: {
            id: project.id,
            name: project.name,
            description: project.description,
            thumbnail: project.thumbnail,
            stage: project.stage,
            people: project.people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
          },
          owner: { id: r.owner_id, name: r.owner_name, role: r.owner_role },
          onTeam: pid ? Boolean(r.on_team) : r.owner_id === user.id,
          editable: accessFor(r, user, v.admin) === "edit",
          submission: pid ? ((view === "partner" ? subs.accepted : subs.latest).get(pid) ?? null) : null,
          selection: pid ? (picked.get(pid) ?? null) : null,
          meeting: pid ? (met.get(pid) ?? null) : null,
          projectId: pid,
          status: r.status,
          postingId: r.posting_id,
          postingTitle: r.posting_title,
          // The posting's organization, so the page knows its partners.
          postingOrgId: r.posting_org,
          view,
        },
      ];
    }),
  });
}

// ---------------------------------------------------------------- save, delete

const PLANNING: readonly ProjectStatus[] = ["claimed", "plan_returned"];

// Saves a board. While the plan is being written the board's Solidifying
// fields carry back into the project's plan. The write re-checks the status,
// so a plan sent for review in the meantime is not changed under the rep.
async function saveBoard(req: Request, env: Env, user: UserRow, id: string, json: Json): Promise<Response> {
  const access = await boardAccess(env, user, id);
  if (access === "missing") return json({ error: "not-found" }, 404);
  if (access === "none") return json({ error: "forbidden" }, 403);
  if (access === "locked") return json({ error: "locked" }, 409);
  const body = (await req.json().catch(() => null)) as { project?: unknown } | null;
  let [board] = cleanProjects([body?.project]);
  if (!board || board.id !== id) return json({ error: "project" }, 400);
  const row = await env.DB.prepare("SELECT b.project_id, p.status, p.plan FROM boards b LEFT JOIN projects p ON p.id = b.project_id WHERE b.id = ?")
    .bind(id)
    .first<{ project_id: string | null; status: ProjectStatus | null; plan: string | null }>();
  if (!row) return json({ error: "not-found" }, 404);
  if (row.status && boardStageFor(row.status) === "solidifying") board = atStage(board, "solidifying");
  const admin = isAdmin(env, user);
  const at = now();
  const stmts = [
    env.DB.prepare(
      `UPDATE boards SET data = ?, updated_at = ? WHERE id = ? AND (? = 1 OR project_id IS NULL OR ` +
        `EXISTS (SELECT 1 FROM projects p WHERE p.id = boards.project_id AND p.status IN (${marks(EDITABLE.length)})))`,
    ).bind(JSON.stringify(board), at, id, admin ? 1 : 0, ...EDITABLE),
  ];
  if (row.project_id && row.status && PLANNING.includes(row.status)) {
    const plan = planFromBoard(board, cleanPlan(parse<unknown>(row.plan, {})));
    stmts.push(
      env.DB.prepare("UPDATE projects SET plan = ?, updated_at = ? WHERE id = ? AND status IN ('claimed', 'plan_returned')").bind(
        JSON.stringify(plan),
        at,
        row.project_id,
      ),
    );
  }
  const [saved] = await env.DB.batch(stmts);
  if (saved.meta.changes === 0) return json({ error: "locked" }, 409);
  return json({ project: board });
}

// Only an admin removes a board, and only one with no project (a project's
// board would come straight back from ensureBoards); a team leaves one by
// withdrawing.
async function deleteBoard(env: Env, user: UserRow, id: string, json: Json): Promise<Response> {
  if (!isAdmin(env, user)) return json({ error: "forbidden" }, 403);
  const board = await env.DB.prepare("SELECT project_id FROM boards WHERE id = ?").bind(id).first<{ project_id: string | null }>();
  if (!board) return json({ error: "not-found" }, 404);
  if (board.project_id) return json({ error: "has-project" }, 409);
  const { results } = await env.DB.prepare("SELECT id FROM submissions WHERE board_id = ?").bind(id).all<{ id: string }>();
  await env.DB.prepare("DELETE FROM boards WHERE id = ? AND project_id IS NULL").bind(id).run();
  for (const r of results) await env.REPORTS.delete(r.id);
  return json({ ok: true });
}

export async function handleBoards(req: Request, env: Env, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  const m = req.method;
  if (pathname === "/boards") return m === "GET" ? listBoards(env, user, json) : json({ error: "method" }, 405);
  const match = pathname.match(/^\/boards\/([\w-]{1,64})$/);
  // Anything deeper (submissions) is submissions.ts's.
  if (!match) return null;
  if (m === "PUT") return saveBoard(req, env, user, match[1], json);
  if (m === "DELETE") return deleteBoard(env, user, match[1], json);
  return json({ error: "method" }, 405);
}
