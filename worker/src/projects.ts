// Projects: a team's work on a posting, from the claim through gate 2, the
// representative's review of the action plan. Every status change goes
// through transition() (transition.ts) with the hooks below; this file adds
// the claim, the member's own proposal, the plan and the reads. The board
// each project opens with lives in boards.ts.
//
//   POST /postings/:id/claim          { teammates? } a member claims a live posting
//   POST /proposals                   { posting, plan?, teammates? } a member's own project
//   GET  /projects/mine               the viewer's projects, newest first
//   GET  /projects?posting=<id>       the projects on a posting the viewer may see
//   GET  /projects/:id
//   PUT  /projects/:id/plan           PlanDraft, by the team while the plan is being written
//   POST /projects/:id/transition     { name, feedback?, score?, memberIds?, message? }
//
// Submitting is POST /boards/:id/submissions (submissions.ts); phase 2's
// other routes are in phase2.ts.

import { cleanLine, cleanPlan, cleanPosting, cleanTeammates, cleanText, LIMITS, planIssues, postingIssues, type PlanDraft } from "@/lib/problems";
import { transitionsFrom } from "@/lib/pipeline/machines";
import { NEXT_STEPS } from "@/lib/pipeline/handoffs";
import type { ProjectStatus, Role } from "@/lib/pipeline/domain";
import { type AccountEnv, type Json, type UserRow, isAdmin, isStaff, rolesOf, sendEmail } from "./accounts";
import { json as parse, now, uuid, type PostingRow, type ProjectRow } from "./db";
import { emit, orgUserIds, repIds } from "./events";
import { canSeePosting } from "./postings";
import { closeOpenReview, openReview, reviewsForMany, type ReviewOut } from "./reviews";
import { activeDisciplineSlugs } from "./taxonomy";
import { TRANSITION_STATUS, transition, type Hooks, type TransitionResult } from "./transition";
import { mirrorPlanToBoard, openBoard, type BoardPosting } from "./boards";
import { submissionHooks } from "./submissions";
import { memberIdsFrom, phase2Hooks } from "./phase2";

export { ensureBoards } from "./boards";

type Env = AccountEnv;

export type Viewer = { user: UserRow; roles: Role[]; staff: boolean; admin: boolean };

export function viewerOf(env: Env, user: UserRow): Viewer {
  const admin = isAdmin(env, user);
  const roles = rolesOf(user);
  if (admin) roles.push("admin");
  return { user, roles, staff: isStaff(env, user), admin };
}

type Person = { id: string; name: string };

export type View = "full" | "partner" | "colleague" | "none";

// Statuses a partner does not see a project in: before its plan is
// approved, and once withdrawn.
export const PRE_APPROVAL: readonly ProjectStatus[] = ["claimed", "plan_review", "plan_returned", "withdrawn"];

// Gantry's projectView: everything for the team and staff, the partner's
// view for the posting's organization once the plan is approved, an outline
// for any other member.
export function projectView(status: ProjectStatus, posting: { kind: string; org_id: string | null }, onTeam: boolean, v: Viewer): View {
  if (onTeam || v.staff) return "full";
  const inOrg = posting.kind !== "self" && !!posting.org_id && v.user.org_id === posting.org_id;
  if (inOrg && !PRE_APPROVAL.includes(status)) return "partner";
  return v.roles.includes("member") ? "colleague" : "none";
}

const EMPTY_PLAN: PlanDraft = { approach: "", milestones: [], finishBy: "" };

// Gate decisions no one on the team may take (transition.ts refuses them).
const GATES = ["approvePlan", "returnPlan", "approveWork", "returnWork"];

type PostingInfo = { id: string; title: string; kind: "partner" | "self"; org_id: string | null; org_name: string | null };

function allowedTransitions(row: ProjectRow, posting: PostingInfo, onTeam: boolean, v: Viewer): string[] {
  const inOrg = posting.kind !== "self" && !!posting.org_id && v.user.org_id === posting.org_id;
  return transitionsFrom("project", row.status, v.roles)
    .filter((t) => t.by.some((r) => v.roles.includes(r) && (r === "admin" || r === "rep" || (r === "member" && onTeam) || (r === "partner" && inOrg))))
    .filter((t) => !(GATES.includes(t.name) && onTeam))
    .map((t) => t.name);
}

type Extras = {
  postings: Map<string, PostingInfo>;
  teams: Map<string, Person[]>;
  boards: Map<string, string>;
  reviews: Map<string, ReviewOut[]>;
};

// Everything projectOut needs beyond the row, for many rows in a few queries.
async function extrasFor(env: Env, rows: ProjectRow[]): Promise<Extras> {
  const ids = rows.map((r) => r.id);
  const idList = JSON.stringify(ids);
  const [postings, team, boards, plans, work] = await Promise.all([
    env.DB.prepare(
      "SELECT p.id, p.title, p.kind, p.org_id, o.name AS org_name FROM postings p LEFT JOIN orgs o ON o.id = p.org_id " +
        "WHERE p.id IN (SELECT value FROM json_each(?))",
    )
      .bind(JSON.stringify([...new Set(rows.map((r) => r.posting_id))]))
      .all<PostingInfo>(),
    env.DB.prepare(
      "SELECT m.project_id, u.id, u.name FROM project_members m JOIN users u ON u.id = m.user_id " +
        "WHERE m.project_id IN (SELECT value FROM json_each(?)) ORDER BY m.role = 'member', m.joined_at, u.name COLLATE NOCASE",
    )
      .bind(idList)
      .all<{ project_id: string; id: string; name: string }>(),
    env.DB.prepare("SELECT id, project_id FROM boards WHERE project_id IN (SELECT value FROM json_each(?))").bind(idList).all<{ id: string; project_id: string }>(),
    reviewsForMany(env, "action_plan", ids),
    reviewsForMany(env, "submission", ids),
  ]);
  const teams = new Map<string, Person[]>();
  for (const r of team.results) teams.set(r.project_id, [...(teams.get(r.project_id) ?? []), { id: r.id, name: r.name }]);
  const reviews = new Map<string, ReviewOut[]>();
  for (const id of ids) {
    const all = [...(plans.get(id) ?? []), ...(work.get(id) ?? [])].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    if (all.length) reviews.set(id, all);
  }
  return {
    postings: new Map(postings.results.map((p) => [p.id, p])),
    teams,
    boards: new Map(boards.results.map((b) => [b.project_id, b.id])),
    reviews,
  };
}

function viewIn(row: ProjectRow, v: Viewer, x: Extras): View {
  const posting = x.postings.get(row.posting_id);
  if (!posting) return "none";
  return projectView(row.status, posting, (x.teams.get(row.id) ?? []).some((p) => p.id === v.user.id), v);
}

// The project as the viewer may see it. A colleague gets the outline: the
// posting, the status and the team, without the plan, the board or reviews.
export function projectOut(row: ProjectRow, v: Viewer, x: Extras) {
  const posting = x.postings.get(row.posting_id)!;
  const team = x.teams.get(row.id) ?? [];
  const onTeam = team.some((p) => p.id === v.user.id);
  const view = projectView(row.status, posting, onTeam, v);
  const outline = view === "colleague";
  const steps = onTeam ? `project.${row.status}.member` : view === "partner" ? `project.${row.status}.partner` : "";
  return {
    id: row.id,
    postingId: row.posting_id,
    posting: { id: posting.id, title: posting.title, kind: posting.kind, org: posting.org_id ? { id: posting.org_id, name: posting.org_name ?? "" } : null },
    status: row.status,
    phase: row.phase,
    plan: outline ? EMPTY_PLAN : cleanPlan(parse<unknown>(row.plan, {})),
    lead: team.find((p) => p.id === row.lead_id) ?? { id: row.lead_id, name: "" },
    team,
    boardId: outline ? null : (x.boards.get(row.id) ?? null),
    plannedTerms: row.planned_terms,
    claimedAt: row.claimed_at,
    activatedAt: row.activated_at,
    submittedAt: row.submitted_at,
    deliveredAt: row.delivered_at,
    transitions: outline ? [] : allowedTransitions(row, posting, onTeam, v),
    nextSteps: steps && Object.hasOwn(NEXT_STEPS, steps) ? steps : null,
    reviews: view === "full" ? (x.reviews.get(row.id) ?? []) : [],
    view,
  };
}

export type ProjectOut = ReturnType<typeof projectOut>;

// The rows the viewer may see, as ProjectOut.
export async function outMany(env: Env, rows: ProjectRow[], v: Viewer): Promise<ProjectOut[]> {
  if (rows.length === 0) return [];
  const x = await extrasFor(env, rows);
  return rows.filter((r) => viewIn(r, v, x) !== "none").map((r) => projectOut(r, v, x));
}

export async function projectById(env: Env, id: string): Promise<ProjectRow | null> {
  return env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<ProjectRow>();
}

// ---------------------------------------------------------------- claim, propose

// The team: the lead, then the active members they named. Null when any
// named account is not an active member.
async function teamFor(env: Env, lead: UserRow, teammates: string[]): Promise<Person[] | null> {
  const others = teammates.filter((t) => t !== lead.id);
  if (others.length === 0) return [{ id: lead.id, name: lead.name }];
  const { results } = await env.DB.prepare(
    "SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?)) AND status = 'active' " +
      "AND (role = 'member' OR EXISTS (SELECT 1 FROM json_each(users.roles) r WHERE r.value = 'member'))",
  )
    .bind(JSON.stringify(others))
    .all<Person>();
  if (results.length !== others.length) return null;
  const byId = new Map(results.map((p) => [p.id, p]));
  return [{ id: lead.id, name: lead.name }, ...others.map((id) => byId.get(id)!)];
}

// Inserts a claimed project, its team and its board in one batch, after the
// caller's own statements (a self posting). The one_active_project trigger
// refuses a team member already in play on the posting, and the batch rolls
// back whole.
async function createProject(
  env: Env,
  actor: UserRow,
  posting: BoardPosting & { id: string; kind: "partner" | "self"; org_id: string | null },
  team: Person[],
  plan: PlanDraft,
  at: string,
  before: D1PreparedStatement[] = [],
): Promise<string | "already-claimed"> {
  const id = uuid();
  const stmts = [
    ...before,
    env.DB.prepare(
      "INSERT INTO projects (id, posting_id, lead_id, status, plan, claimed_at, updated_at) VALUES (?, ?, ?, 'claimed', ?, ?, ?)",
    ).bind(id, posting.id, actor.id, JSON.stringify(plan), at, at),
    ...team.map((p, i) =>
      env.DB.prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)").bind(id, p.id, i === 0 ? "lead" : "member", at),
    ),
    openBoard(env, { id, leadId: actor.id }, posting, team, plan, at).stmt,
  ];
  const self = posting.kind === "self";
  emit(env, stmts, {
    type: "project.claimed",
    actor,
    subject: { kind: "project", id },
    postingId: posting.id,
    projectId: id,
    orgId: self ? undefined : (posting.org_id ?? undefined),
    notify:
      self || !posting.org_id
        ? []
        : [{ userIds: await orgUserIds(env, posting.org_id), title: `${actor.name} claimed “${posting.title}”`, href: `/projectum?view=posting&id=${posting.id}` }],
  });
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    if (/already-claimed/.test(String(err))) return "already-claimed";
    throw err;
  }
  return id;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  const b: unknown = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

// A member claims a live partner posting. Claiming again returns the
// project they already hold there.
async function claimPosting(req: Request, env: Env, v: Viewer, postingId: string, json: Json): Promise<Response> {
  if (!v.roles.includes("member")) return json({ error: "forbidden" }, 403);
  const posting = await env.DB.prepare("SELECT * FROM postings WHERE id = ?").bind(postingId).first<PostingRow>();
  if (!posting || !canSeePosting(posting, v)) return json({ error: "not-found" }, 404);
  if (posting.kind !== "partner") return json({ error: "forbidden" }, 403);
  const held = await env.DB.prepare(
    "SELECT p.id FROM projects p JOIN project_members m ON m.project_id = p.id " +
      "WHERE m.user_id = ? AND p.posting_id = ? AND p.status NOT IN ('withdrawn', 'complete') ORDER BY p.claimed_at DESC LIMIT 1",
  )
    .bind(v.user.id, posting.id)
    .first<{ id: string }>();
  if (held) return json({ id: held.id });
  if (posting.status !== "live") return json({ error: "state" }, 409);
  const team = await teamFor(env, v.user, cleanTeammates((await body(req)).teammates));
  if (!team) return json({ error: "teammates" }, 400);
  const made = await createProject(env, v.user, posting, team, EMPTY_PLAN, now());
  if (made === "already-claimed") return json({ error: "already-claimed" }, 409);
  return json({ id: made }, 201);
}

// A member's own project: a closed self posting kept off their profile, the
// project with the plan so far, the team and the board.
async function propose(req: Request, env: Env, v: Viewer, json: Json): Promise<Response> {
  if (!v.roles.includes("member")) return json({ error: "forbidden" }, 403);
  const b = await body(req);
  const draft = cleanPosting(b.posting, await activeDisciplineSlugs(env));
  const issues = postingIssues(draft, { forSubmit: true });
  if (issues.length) return json({ error: "posting", issues }, 400);
  const team = await teamFor(env, v.user, cleanTeammates(b.teammates));
  if (!team) return json({ error: "teammates" }, 400);
  const postingId = uuid();
  const at = now();
  const insert = env.DB.prepare(
    "INSERT INTO postings (id, org_id, author_id, title, summary, details, disciplines, tags, effort, deliverable, deadline, status, kind, " +
      "show_on_profile, closed_at, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed', 'self', 0, ?, ?, ?)",
  ).bind(
    postingId, v.user.id, draft.title, draft.summary, draft.details, JSON.stringify(draft.disciplines), JSON.stringify(draft.tags), draft.effort,
    draft.deliverable, draft.deadline, at, at, at,
  );
  const posting = { id: postingId, kind: "self" as const, org_id: null, title: draft.title, summary: draft.summary, details: draft.details };
  const made = await createProject(env, v.user, posting, team, cleanPlan(b.plan), at, [insert]);
  if (made === "already-claimed") return json({ error: "already-claimed" }, 409);
  return json({ id: made, postingId }, 201);
}

// ---------------------------------------------------------------- the plan

// The team saves its plan while writing it; the board's Solidifying fields
// follow in the same batch.
async function savePlan(req: Request, env: Env, v: Viewer, row: ProjectRow, json: Json): Promise<Response> {
  const team = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?").bind(row.id, v.user.id).first();
  if (!team) return json({ error: "forbidden" }, 403);
  if (row.status !== "claimed" && row.status !== "plan_returned") return json({ error: "state" }, 409);
  const plan = cleanPlan(await body(req));
  const posting = (await env.DB.prepare("SELECT title, summary, details FROM postings WHERE id = ?").bind(row.posting_id).first<BoardPosting>())!;
  const stmts = [
    env.DB.prepare("UPDATE projects SET plan = ?, updated_at = ? WHERE id = ? AND status IN ('claimed', 'plan_returned')").bind(
      JSON.stringify(plan),
      now(),
      row.id,
    ),
  ];
  const mirror = await mirrorPlanToBoard(env, row.id, row.lead_id, posting, plan);
  if (mirror) stmts.push(mirror);
  const [saved] = await env.DB.batch(stmts);
  if (saved.meta.changes === 0) return json({ error: "state" }, 409);
  return json((await outMany(env, [(await projectById(env, row.id))!], v))[0]);
}

// ---------------------------------------------------------------- the gate

const SIGN_OFF = "\n\nApplied AI Lab";

export async function nameOf(env: Env, id: string): Promise<string> {
  return (await env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(id).first<{ name: string }>())?.name ?? "";
}

export async function teamEmails(env: Env, ids: string[]): Promise<Array<{ email: string; name: string }>> {
  const { results } = await env.DB.prepare("SELECT email, name FROM users WHERE id IN (SELECT value FROM json_each(?)) AND status = 'active'")
    .bind(JSON.stringify(ids))
    .all<{ email: string; name: string }>();
  return results;
}

const baseline = (env: Env, projectId: string, reason: "plan_submitted" | "plan_approved", plan: PlanDraft, at: string) =>
  env.DB.prepare("INSERT INTO milestone_baselines (id, project_id, reason, snapshot, taken_at) VALUES (?, ?, ?, ?, ?)").bind(
    uuid(),
    projectId,
    reason,
    JSON.stringify(plan.milestones),
    at,
  );

const planOf = (row: ProjectRow): PlanDraft => cleanPlan(parse<unknown>(row.plan, {}));

// The hooks for one request. Emails go in `after`, which transition() runs
// only once the change has succeeded. The submission gate's hooks are in
// submissions.ts and phase 2's in phase2.ts.
function hooksFor(env: Env, actor: UserRow): Record<string, Hooks> {
  return {
    submitPlan: {
      guard: async (ctx) => {
        const issues = planIssues(planOf(ctx.project!));
        return issues.length ? { error: "plan", issues } : null;
      },
      effects: async (ctx, _input, at) => {
        const p = ctx.project!;
        const plan = planOf(p);
        const review = openReview(env, "action_plan", p.id, plan, at);
        const title = `${await nameOf(env, p.lead_id)} submitted an action plan for “${ctx.posting.title}”`;
        const link = `/projectum?view=review&id=${review.id}`;
        return {
          stmts: [
            env.DB.prepare("UPDATE projects SET plan_submitted_at = ? WHERE id = ?").bind(at, p.id),
            baseline(env, p.id, "plan_submitted", plan, at),
            review.stmt,
            // The board holds the plan under review in Solidifying.
            env.DB.prepare("UPDATE boards SET data = json_set(data, '$.stage', 'solidifying'), updated_at = ? WHERE project_id = ? AND json_valid(data)").bind(
              at,
              p.id,
            ),
          ],
          // A rep on the team cannot review it, so does not hear as a rep.
          notify: [{ userIds: (await repIds(env)).filter((id) => !ctx.memberIds.includes(id)), court: true, title, href: link }],
          payload: { reviewId: review.id },
          after: async () => {
            await sendEmail(env, env.APPROVER_EMAIL, title, `${title}.\n\nReview it in Projectum:\n${env.SITE_URL}${link}${SIGN_OFF}`);
          },
        };
      },
    },
    approvePlan: {
      effects: async (ctx, input, at) => {
        const p = ctx.project!;
        const feedback = input.feedback ?? "";
        const team = JSON.stringify(ctx.memberIds);
        // Who moves up to Sponsored. The UPDATE re-checks, so a level that
        // changed in the meantime is left alone, but its notice is still sent:
        // a level changed or locked between this read and the batch gets a
        // stale "now Sponsored" notification.
        const { results: promoted } = await env.DB.prepare(
          "SELECT id FROM users WHERE id IN (SELECT value FROM json_each(?)) AND level = 'affiliate' AND level_locked = 0",
        )
          .bind(team)
          .all<{ id: string }>();
        const board = await env.DB.prepare("SELECT id FROM boards WHERE project_id = ?").bind(p.id).first<{ id: string }>();
        const stmts = [
          env.DB.prepare("UPDATE projects SET activated_at = ? WHERE id = ?").bind(at, p.id),
          closeOpenReview(env, "action_plan", p.id, { status: "approved", by: actor.id, at, feedback }),
          baseline(env, p.id, "plan_approved", planOf(p), at),
          env.DB.prepare(
            "UPDATE users SET level = 'sponsored' WHERE id IN (SELECT value FROM json_each(?)) AND level = 'affiliate' AND level_locked = 0",
          ).bind(team),
        ];
        for (const { id } of promoted) {
          emit(env, stmts, {
            type: "member.level_changed",
            actor,
            subject: { kind: "user", id },
            projectId: p.id,
            payload: { level: "sponsored" },
            notify: [{ userIds: [id], title: "You are now a Sponsored member", href: "/projectum" }],
          });
        }
        const subject = `Your plan for “${ctx.posting.title}” was approved`;
        const title = `${subject}. Your board is open.`;
        const href = board ? `/projectum?project=${board.id}` : "/projectum?view=myprojects";
        const lead = await nameOf(env, p.lead_id);
        return {
          stmts,
          notify: [
            { userIds: ctx.memberIds, court: true, title, href },
            ...(ctx.self || !ctx.orgId
              ? []
              : [{ userIds: await orgUserIds(env, ctx.orgId), title: `${lead}'s team is now working on “${ctx.posting.title}”`, href: `/projectum?view=project&id=${p.id}` }]),
          ],
          payload: feedback ? { feedback } : undefined,
          after: async () => {
            const note = feedback ? `\n\nNote from the Lab: ${feedback}` : "";
            for (const m of await teamEmails(env, ctx.memberIds)) {
              await sendEmail(
                env,
                m.email,
                subject,
                `Hi ${m.name},\n\nYour action plan for “${ctx.posting.title}” is approved. Your board is open; start on your first milestone.${note}\n\n${env.SITE_URL}${href}${SIGN_OFF}`,
              );
            }
          },
        };
      },
    },
    returnPlan: {
      effects: async (ctx, input, at) => {
        const p = ctx.project!;
        const feedback = input.feedback ?? "";
        const title = `Your plan for “${ctx.posting.title}” came back with notes`;
        const href = "/projectum?view=myprojects";
        return {
          stmts: [closeOpenReview(env, "action_plan", p.id, { status: "returned", by: actor.id, at, feedback })],
          notify: [{ userIds: ctx.memberIds, court: true, title, href }],
          payload: { feedback },
          after: async () => {
            for (const m of await teamEmails(env, ctx.memberIds)) {
              await sendEmail(
                env,
                m.email,
                title,
                `Hi ${m.name},\n\nA representative sent your action plan for “${ctx.posting.title}” back with notes:\n\n${feedback}\n\nRevise it and submit it again:\n${env.SITE_URL}${href}${SIGN_OFF}`,
              );
            }
          },
        };
      },
    },
    withdraw: {
      effects: async (ctx, _input, at) => {
        const p = ctx.project!;
        const lead = await nameOf(env, p.lead_id);
        return {
          stmts: [
            env.DB.prepare("UPDATE projects SET withdrawn_at = ? WHERE id = ?").bind(at, p.id),
            closeOpenReview(env, "action_plan", p.id, { status: "withdrawn", by: actor.id, at }),
            closeOpenReview(env, "submission", p.id, { status: "withdrawn", by: actor.id, at }),
          ],
          notify:
            ctx.self || !ctx.orgId
              ? []
              : [{ userIds: await orgUserIds(env, ctx.orgId), title: `${lead}'s team released its claim on “${ctx.posting.title}”`, href: `/projectum?view=posting&id=${ctx.posting.id}` }],
        };
      },
    },
  };
}

function refusal(r: Extract<TransitionResult, { ok: false }>, json: Json): Response {
  return json({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) }, TRANSITION_STATUS[r.error]);
}

async function move(req: Request, env: Env, v: Viewer, row: ProjectRow, json: Json): Promise<Response> {
  const b = await body(req);
  if (typeof b.name !== "string") return json({ error: "unknown-transition" }, 400);
  const name = cleanLine(b.name, 64);
  // Submitting needs the report and the board: POST /boards/:id/submissions.
  if (name === "submitWork") return json({ error: "report" }, 400);
  const feedback = cleanText(b.feedback, LIMITS.feedback);
  const message = cleanLine(b.message, LIMITS.note);
  const score = typeof b.score === "number" && Number.isInteger(b.score) && b.score >= 0 && b.score <= 100 ? b.score : null;
  const hooks = { ...hooksFor(env, v.user), ...submissionHooks(env, v.user), ...phase2Hooks(env, v.user) };
  const r = await transition(
    env,
    v.user,
    { kind: "project", id: row.id, name, feedback: feedback || undefined, score, memberIds: memberIdsFrom(b.memberIds), message: message || undefined },
    hooks,
  );
  if (!r.ok) return refusal(r, json);
  // Read back: a hook may move the row on (approveWork on a self posting ends at complete).
  const fresh = (await projectById(env, row.id))!;
  return json({ ok: true, status: fresh.status, project: (await outMany(env, [fresh], v))[0] ?? null });
}

// ---------------------------------------------------------------- routes

export async function handleProjects(req: Request, env: Env, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname, searchParams } = new URL(req.url);
  const m = req.method;
  const claim = pathname.match(/^\/postings\/([\w-]{1,64})\/claim$/);
  if (claim) return m === "POST" ? claimPosting(req, env, viewerOf(env, user), claim[1], json) : json({ error: "method" }, 405);
  if (pathname === "/proposals") return m === "POST" ? propose(req, env, viewerOf(env, user), json) : json({ error: "method" }, 405);
  if (pathname !== "/projects" && !pathname.startsWith("/projects/")) return null;
  const v = viewerOf(env, user);

  if (pathname === "/projects") {
    if (m !== "GET") return json({ error: "method" }, 405);
    const posting = searchParams.get("posting");
    if (!posting) return json({ error: "posting" }, 400);
    const { results } = await env.DB.prepare("SELECT * FROM projects WHERE posting_id = ? ORDER BY claimed_at DESC").bind(posting).all<ProjectRow>();
    return json({ projects: await outMany(env, results, v) });
  }
  if (pathname === "/projects/mine") {
    if (m !== "GET") return json({ error: "method" }, 405);
    const { results } = await env.DB.prepare(
      "SELECT p.* FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = ? ORDER BY p.claimed_at DESC",
    )
      .bind(user.id)
      .all<ProjectRow>();
    return json({ projects: await outMany(env, results, v) });
  }
  const match = pathname.match(/^\/projects\/([\w-]{1,64})(\/plan|\/transition)?$/);
  if (!match) return json({ error: "not-found" }, 404);
  const row = await projectById(env, match[1]);
  const [out] = row ? await outMany(env, [row], v) : [];
  if (!row || !out) return json({ error: "not-found" }, 404);
  if (match[2] === "/plan") return m === "PUT" ? savePlan(req, env, v, row, json) : json({ error: "method" }, 405);
  if (match[2] === "/transition") return m === "POST" ? move(req, env, v, row, json) : json({ error: "method" }, 405);
  return m === "GET" ? json(out) : json({ error: "method" }, 405);
}
