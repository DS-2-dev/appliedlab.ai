// Phase 2: after delivery the partner may meet the team and bring it on to
// implement the work inside the organization (integrate), the team keeps
// implementation milestones, and the project ends when the partner (or an
// admin) confirms it complete. Status changes go through transition() with
// the hooks below; meetings are plain rows until phase 4.
//
//   POST /projects/:id/transition  { name: integrate, memberIds?, message? } and the completion moves (projects.ts)
//   PUT  /projects/:id/phase       { milestones } the team or an admin, while integrated
//   POST /projects/:id/complete    the partner or an admin: requestCompletion, then confirmCompletion
//   POST /projects/:id/meeting     { message } the partner asks to meet the team
//   POST /meetings/:id/arranged    staff mark it arranged

import { cleanLine, cleanPhaseMilestones, cleanText, LIMITS } from "@/lib/problems";
import { isAdmin, isStaff, rolesOf, sendEmail, type AccountEnv, type Json, type UserRow } from "./accounts";
import { now, uuid, type PostingRow, type ProjectRow } from "./db";
import { emit, orgUserIds, projectMemberIds, repIds } from "./events";
import { nameOf, projectById, teamEmails } from "./projects";
import { TRANSITION_STATUS, transition, type Hooks, type TransitionResult } from "./transition";

type Env = AccountEnv;

const SIGN_OFF = "\n\nApplied AI Lab";
const href = (projectId: string) => `/projectum?view=project&id=${projectId}`;

export function phase2Hooks(env: Env, actor: UserRow): Record<string, Hooks> {
  return {
    integrate: {
      guard: async (ctx, input) => {
        if (ctx.self || ctx.posting.kind !== "partner") return "forbidden";
        if (input.memberIds && (input.memberIds.length === 0 || input.memberIds.some((id) => !ctx.memberIds.includes(id)))) {
          return { error: "plan", issues: ["members"] };
        }
        return null;
      },
      effects: async (ctx, input, at) => {
        const p = ctx.project!;
        const chosen = input.memberIds ?? ctx.memberIds;
        const rest = ctx.memberIds.filter((id) => !chosen.includes(id));
        const message = input.message ?? "";
        const stmts = [
          env.DB.prepare(
            "INSERT INTO selections (project_id, selected_by, message, milestones, created_at) VALUES (?, ?, ?, '[]', ?) " +
              "ON CONFLICT(project_id) DO UPDATE SET selected_by = excluded.selected_by, message = excluded.message, completed_at = NULL",
          ).bind(p.id, actor.id, message, at),
          env.DB.prepare("UPDATE projects SET phase = 'integrated', integrated_at = ? WHERE id = ?").bind(at, p.id),
          env.DB.prepare("INSERT INTO milestone_baselines (id, project_id, reason, snapshot, taken_at) VALUES (?, ?, 'integrated', '[]', ?)").bind(uuid(), p.id, at),
        ];
        const org = await env.DB.prepare("SELECT name FROM orgs WHERE id = ?").bind(ctx.orgId).first<{ name: string }>();
        const who = org?.name || actor.name;
        const title = ctx.posting.title;
        return {
          stmts,
          notify: [
            { userIds: chosen, court: true, title: `${who} brought you on to implement “${title}”`, href: href(p.id) },
            // A rep who is also a chosen member hears once, from the court notice above.
            { userIds: [...rest, ...(await repIds(env))].filter((id) => !chosen.includes(id)), title: `${who} brought ${await nameOf(env, p.lead_id)}'s team on to implement “${title}”`, href: href(p.id) },
          ],
          payload: { memberIds: chosen, ...(message ? { message } : {}) },
          after: async () => {
            const note = message ? `\n\nTheir message: ${message}` : "";
            const team = await teamEmails(env, chosen);
            for (const m of team) {
              await sendEmail(
                env,
                m.email,
                `You're brought on to implement “${title}”`,
                `Hi ${m.name},\n\n${who} brought your team on to put “${title}” to work. Phase 2 starts now: add your implementation milestones and tick them off as you go.${note}\n\n${env.SITE_URL}${href(p.id)}${SIGN_OFF}`,
              );
            }
            await sendEmail(
              env,
              env.APPROVER_EMAIL,
              `Integrated: “${title}”`,
              `${who} brought ${team.map((t) => t.name).join(", ")} on to implement “${title}”.\n\n${env.SITE_URL}${href(p.id)}${SIGN_OFF}`,
            );
          },
        };
      },
    },
    requestCompletion: {
      effects: async (ctx) => {
        const p = ctx.project!;
        // The sign-off is now the partner's: their organization hears in
        // court (the partner or admin taking it themselves does not hear).
        return {
          stmts: [],
          notify:
            ctx.self || !ctx.orgId
              ? []
              : [{ userIds: await orgUserIds(env, ctx.orgId), court: true, title: `${await nameOf(env, p.lead_id)}'s team asks you to sign off “${ctx.posting.title}”`, href: href(p.id) }],
        };
      },
    },
    confirmCompletion: {
      effects: async (ctx, input, at) => {
        const p = ctx.project!;
        const feedback = input.feedback ?? "";
        const title = ctx.posting.title;
        return {
          stmts: [
            env.DB.prepare("UPDATE selections SET completed_at = ? WHERE project_id = ? AND completed_at IS NULL").bind(at, p.id),
            env.DB.prepare("UPDATE projects SET completed_at = ? WHERE id = ?").bind(at, p.id),
          ],
          notify: [
            { userIds: ctx.memberIds, title: `“${title}” is complete. Nice work.`, href: href(p.id) },
            { userIds: await repIds(env), title: `“${title}” is complete`, href: href(p.id) },
          ],
          payload: feedback ? { feedback } : undefined,
          after: async () => {
            for (const m of await teamEmails(env, ctx.memberIds)) {
              await sendEmail(
                env,
                m.email,
                `Complete: “${title}”`,
                `Hi ${m.name},\n\n“${title}” is marked complete. Shipped work, an industry relationship and a line on the résumé.${SIGN_OFF}`,
              );
            }
          },
        };
      },
    },
    returnCompletion: {
      effects: async (ctx, input) => {
        const p = ctx.project!;
        return {
          stmts: [],
          notify: [{ userIds: ctx.memberIds, court: true, title: `“${ctx.posting.title}” is not signed off yet`, href: href(p.id) }],
          payload: { feedback: input.feedback ?? "" },
        };
      },
    },
  };
}

function refusal(r: Extract<TransitionResult, { ok: false }>, json: Json): Response {
  return json({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) }, TRANSITION_STATUS[r.error]);
}

async function context(env: Env, projectId: string) {
  const row = await projectById(env, projectId);
  const posting = row && (await env.DB.prepare("SELECT * FROM postings WHERE id = ?").bind(row.posting_id).first<PostingRow>());
  return row && posting ? { row, posting } : null;
}

const isOrgPartner = (user: UserRow, posting: PostingRow) =>
  posting.kind === "partner" && !!posting.org_id && user.org_id === posting.org_id && rolesOf(user).includes("partner");

// The team (or an admin) updates its implementation milestones.
async function savePhase(req: Request, env: Env, user: UserRow, row: ProjectRow, json: Json): Promise<Response> {
  const onTeam = (await projectMemberIds(env, row.id)).includes(user.id);
  if (!onTeam && !isAdmin(env, user)) return json({ error: "forbidden" }, 403);
  if (row.status !== "integrated") return json({ error: "state" }, 409);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const milestones = cleanPhaseMilestones(body.milestones);
  const [, saved] = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO selections (project_id, selected_by, message, milestones, created_at) SELECT ?, NULL, '', '[]', ? " +
        "WHERE NOT EXISTS (SELECT 1 FROM selections WHERE project_id = ?)",
    ).bind(row.id, now(), row.id),
    env.DB.prepare(
      "UPDATE selections SET milestones = ? WHERE project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'integrated')",
    ).bind(JSON.stringify(milestones), row.id, row.id),
  ]);
  if (!saved.meta.changes) return json({ error: "state" }, 409);
  return json({ milestones });
}

// The partner (or an admin) signs the project off. From integrated it takes
// the team's requestCompletion step on their behalf first; if that lands and
// the confirmation does not, the project waits in completion_review.
async function complete(req: Request, env: Env, user: UserRow, row: ProjectRow, posting: PostingRow, json: Json): Promise<Response> {
  if (!isOrgPartner(user, posting) && !isAdmin(env, user)) return json({ error: "forbidden" }, 403);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const feedback = cleanText(body.feedback, LIMITS.feedback);
  const hooks = phase2Hooks(env, user);
  let asked = false;
  if (row.status === "integrated") {
    const r = await transition(env, user, { kind: "project", id: row.id, name: "requestCompletion" }, hooks);
    if (!r.ok) return refusal(r, json);
    asked = true;
  }
  const done = await transition(env, user, { kind: "project", id: row.id, name: "confirmCompletion", feedback: feedback || undefined }, hooks);
  if (done.ok) return json({ ok: true, status: done.status });
  // The request landed and the confirmation did not: the project waits in
  // completion_review, which the page can explain.
  if (asked) return json({ error: done.error, stage: "completion_review", ...(done.issues ? { issues: done.issues } : {}) }, TRANSITION_STATUS[done.error]);
  return refusal(done, json);
}

const MEETING_STATUSES = ["delivered", "integrated", "completion_review", "complete"];

// The partner asks to meet the team. The Lab gets both sides' contacts to
// introduce them; the team hears it is coming.
async function requestMeeting(req: Request, env: Env, user: UserRow, row: ProjectRow, posting: PostingRow, json: Json): Promise<Response> {
  if (!isOrgPartner(user, posting)) return json({ error: "forbidden" }, 403);
  if (!MEETING_STATUSES.includes(row.status)) return json({ error: "state" }, 409);
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const message = cleanLine(body.message, LIMITS.note);
  const id = uuid();
  const at = now();
  const team = await projectMemberIds(env, row.id);
  const title = `${user.name} wants to meet the team on “${posting.title}”`;
  const stmts = [
    env.DB.prepare("INSERT INTO meetings (id, project_id, requested_by, message, status, created_at) VALUES (?, ?, ?, ?, 'requested', ?)").bind(
      id,
      row.id,
      user.id,
      message,
      at,
    ),
  ];
  emit(env, stmts, {
    type: "meeting.requested",
    actor: user,
    subject: { kind: "project", id: row.id },
    postingId: posting.id,
    projectId: row.id,
    orgId: posting.org_id ?? undefined,
    payload: { meetingId: id, ...(message ? { message } : {}) },
    notify: [
      { userIds: team, court: true, title, href: href(row.id) },
      { userIds: await repIds(env), court: true, title, href: href(row.id) },
    ],
  });
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    // meetings_open: one request waits at a time.
    if (/UNIQUE/i.test(String(err))) return json({ error: "pending" }, 409);
    throw err;
  }
  const people = await teamEmails(env, team);
  const note = message ? `\n\nTheir message: ${message}` : "";
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `Meeting request: “${posting.title}”`,
    `${user.name} (${user.email}) wants to meet the team on “${posting.title}”.${note}\n\nThe team:\n${people
      .map((t) => `- ${t.name}, ${t.email}`)
      .join("\n")}\n\nIntroduce them, then mark it arranged in Projectum.${SIGN_OFF}`,
  );
  for (const t of people) {
    await sendEmail(
      env,
      t.email,
      `${user.name} wants to meet about “${posting.title}”`,
      `Hi ${t.name},\n\n${user.name} read your work on “${posting.title}” and asked to meet your team. The Lab will introduce you by email.${note}${SIGN_OFF}`,
    );
  }
  return json({ id }, 201);
}

async function arrangeMeeting(env: Env, user: UserRow, id: string, json: Json): Promise<Response> {
  if (!isStaff(env, user)) return json({ error: "forbidden" }, 403);
  const m = await env.DB.prepare("SELECT project_id, requested_by, status FROM meetings WHERE id = ?").bind(id).first<{ project_id: string; requested_by: string | null; status: string }>();
  if (!m) return json({ error: "not-found" }, 404);
  if (m.status !== "requested") return json({ error: "state" }, 409);
  const ctx = await context(env, m.project_id);
  const at = now();
  const stmts = [env.DB.prepare("UPDATE meetings SET status = 'scheduled', arranged_at = ? WHERE id = ? AND status = 'requested'").bind(at, id)];
  const title = `The Lab is arranging your meeting on “${ctx?.posting.title ?? "your project"}”`;
  emit(env, stmts, {
    type: "meeting.scheduled",
    actor: user,
    subject: { kind: "project", id: m.project_id },
    postingId: ctx?.posting.id,
    projectId: m.project_id,
    orgId: ctx?.posting.org_id ?? undefined,
    payload: { meetingId: id },
    notify: [{ userIds: [...(await projectMemberIds(env, m.project_id)), ...(m.requested_by ? [m.requested_by] : [])], title, href: href(m.project_id) }],
  });
  // The change and its event in one batch. emit()'s inserts cannot re-check
  // the UPDATE, so a request racing another past the read above could log a
  // second event; the UPDATE itself lands once, and the loser gets a 409.
  const [moved] = await env.DB.batch(stmts);
  if (!moved.meta.changes) return json({ error: "state" }, 409);
  return json({ ok: true });
}

export async function handlePhase2(req: Request, env: Env, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  const m = req.method;
  const meeting = pathname.match(/^\/meetings\/([\w-]{1,64})\/arranged$/);
  if (meeting) return m === "POST" ? arrangeMeeting(env, user, meeting[1], json) : json({ error: "method" }, 405);
  if (pathname.startsWith("/meetings")) return json({ error: "not-found" }, 404);
  const match = pathname.match(/^\/projects\/([\w-]{1,64})\/(phase|complete|meeting)$/);
  if (!match) return null;
  const c = await context(env, match[1]);
  if (!c) return json({ error: "not-found" }, 404);
  if (match[2] === "phase") return m === "PUT" ? savePhase(req, env, user, c.row, json) : json({ error: "method" }, 405);
  if (m !== "POST") return json({ error: "method" }, 405);
  if (match[2] === "complete") return complete(req, env, user, c.row, c.posting, json);
  return requestMeeting(req, env, user, c.row, c.posting, json);
}

// Parsed for the transition route (projects.ts): who integrate brings on.
export function memberIdsFrom(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.filter((t): t is string => typeof t === "string" && /^[\w-]{1,64}$/.test(t)))].slice(0, 20);
}
