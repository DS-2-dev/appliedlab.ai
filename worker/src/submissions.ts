// Submissions: gate 3, a team's finished work. The team submits from its
// board (the board in Live with its launch, and a final report as a PDF kept
// in the REPORTS KV namespace under the submission's id); a representative
// approves it, which delivers it to the partner, or returns it with notes,
// which sends the board back to Prototype. Every status change goes through
// transition() with the hooks below.
//
//   POST /boards/:id/submissions     multipart: project (the board, JSON) and report (PDF)
//   GET  /submissions/:id/report     the PDF: staff, the team, and the partner's org once accepted
//
// Deciding is POST /projects/:id/transition { name: approveWork | returnWork,
// feedback, score? } (projects.ts), with these hooks.

import { cleanProjects, type Project } from "@/lib/projects";
import { projectMachine } from "@/lib/pipeline/machines";
import type { ProjectStatus } from "@/lib/pipeline/domain";
import { cleanLine } from "@/lib/problems";
import { isStaff, sendEmail, type AccountEnv, type Json, type UserRow } from "./accounts";
import { json as parse, uuid } from "./db";
import { emit, orgPrimaryOrAdmins, orgUserIds, repIds } from "./events";
import { boardAccess, readBoard } from "./boards";
import { closeOpenReview, openReview } from "./reviews";
import { nameOf, teamEmails } from "./projects";
import { TRANSITION_STATUS, transition, type Hooks, type TransitionResult } from "./transition";

type Env = AccountEnv;

export const MAX_REPORT = 10 * 1024 * 1024;

// A file is a PDF when it starts with "%PDF-", whatever it is called.
function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

const SIGN_OFF = "\n\nApplied AI Lab";

// What a submission carries into submitWork's hook.
export type SubmitInput = { id: string; boardId: string; board: Project; reportName: string; bytes: Uint8Array };

const boardHref = async (env: Env, projectId: string) => {
  const b = await env.DB.prepare("SELECT id FROM boards WHERE project_id = ?").bind(projectId).first<{ id: string }>();
  return b ? `/projectum?project=${b.id}` : "/projectum?view=myprojects";
};

// The submission gate's hooks. submitWork needs the submission itself, so
// only the submit route passes one; without it the move is refused.
export function submissionHooks(env: Env, actor: UserRow, submit?: SubmitInput): Record<string, Hooks> {
  return {
    submitWork: {
      guard: async () => {
        if (!submit) return { error: "plan", issues: ["report"] };
        return submit.board.stage === "live" && submit.board.launch ? null : { error: "plan", issues: ["launch"] };
      },
      effects: async (ctx, _input, at) => {
        const p = ctx.project!;
        const s = submit!;
        const launch = s.board.launch;
        const review = openReview(env, "submission", p.id, { reportName: s.reportName, reportSize: s.bytes.length, launch }, at);
        const title = `${await nameOf(env, p.lead_id)}'s team submitted “${ctx.posting.title}”`;
        const link = `/projectum?view=review&id=${review.id}`;
        return {
          stmts: [
            env.DB.prepare("UPDATE boards SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(s.board), at, s.boardId),
            env.DB.prepare(
              "INSERT INTO submissions (id, project_id, board_id, submitted_by, report_name, report_size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
            ).bind(s.id, p.id, s.boardId, actor.id, s.reportName, s.bytes.length, at),
            env.DB.prepare("UPDATE projects SET submitted_at = ? WHERE id = ?").bind(at, p.id),
            review.stmt,
          ],
          // A rep on the team cannot review it, so does not hear as a rep.
          notify: [{ userIds: (await repIds(env)).filter((id) => !ctx.memberIds.includes(id)), court: true, title, href: link }],
          payload: { reviewId: review.id, submissionId: s.id },
          // The submit route stored the report in KV before the move.
          after: async () => {
            await sendEmail(env, env.APPROVER_EMAIL, title, `${title}.\n\nReview it in Projectum:\n${env.SITE_URL}${link}${SIGN_OFF}`);
          },
        };
      },
    },
    approveWork: {
      effects: async (ctx, input, at) => {
        const p = ctx.project!;
        const feedback = input.feedback ?? "";
        const stmts = [
          env.DB.prepare(
            "UPDATE submissions SET status = 'accepted', review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE project_id = ? AND status = 'pending'",
          ).bind(feedback, actor.id, at, p.id),
          closeOpenReview(env, "submission", p.id, { status: "approved", by: actor.id, at, feedback, score: input.score ?? null }),
          env.DB.prepare("UPDATE projects SET delivered_at = ? WHERE id = ?").bind(at, p.id),
          // boardStageFor("delivered") is Live, where a submitted board already is.
          env.DB.prepare(
            "UPDATE boards SET data = json_set(data, '$.stage', 'live'), updated_at = ? WHERE project_id = ? AND json_valid(data) AND json_extract(data, '$.launch') IS NOT NULL",
          ).bind(at, p.id),
        ];
        const href = await boardHref(env, p.id);
        const title = ctx.posting.title;
        if (ctx.self) {
          // A member's own project has no partner to deliver to: it is done.
          // This runs after the engine's own UPDATE to delivered.
          stmts.push(
            env.DB.prepare("UPDATE projects SET status = 'complete', completed_at = ?, updated_at = ? WHERE id = ? AND status = 'delivered'").bind(at, at, p.id),
          );
          emit(env, stmts, {
            type: "project.completed",
            actor,
            subject: { kind: "project", id: p.id },
            postingId: ctx.posting.id,
            projectId: p.id,
            payload: { self: true },
            notify: [{ userIds: ctx.memberIds, title: `“${title}” is complete. Nice work.`, href }],
          });
        }
        const lead = await nameOf(env, p.lead_id);
        return {
          stmts,
          notify: [
            ...(ctx.self ? [] : [{ userIds: ctx.memberIds, title: `The Lab approved your submission on “${title}”`, href }]),
            ...(ctx.self || !ctx.orgId
              ? []
              : [{ userIds: await orgUserIds(env, ctx.orgId), court: true, title: `${lead}'s team delivered “${title}”. Read their report.`, href: `/projectum?view=project&id=${p.id}` }]),
          ],
          payload: feedback || input.score != null ? { feedback, score: input.score ?? null } : undefined,
          after: async () => {
            const note = feedback ? `\n\nNote from the Lab: ${feedback}` : "";
            const text = ctx.self
              ? `The Lab approved your work on “${title}”, and the project is complete.`
              : `The Lab approved your submission on “${title}” and delivered it to the partner.`;
            for (const m of await teamEmails(env, ctx.memberIds)) {
              await sendEmail(env, m.email, `Approved: “${title}”`, `Hi ${m.name},\n\n${text}${note}\n\n${env.SITE_URL}${href}${SIGN_OFF}`);
            }
            if (ctx.self || !ctx.orgId) return;
            for (const m of await teamEmails(env, await orgPrimaryOrAdmins(env, ctx.orgId))) {
              await sendEmail(
                env,
                m.email,
                `A team delivered “${title}”`,
                `Hi ${m.name},\n\nA student team delivered its work on “${title}”, and the Lab reviewed it. Read their report and links:\n${env.SITE_URL}/projectum?view=project&id=${p.id}\n\nApplied AI Lab, Weber State University`,
              );
            }
          },
        };
      },
    },
    returnWork: {
      effects: async (ctx, input, at) => {
        const p = ctx.project!;
        const feedback = input.feedback ?? "";
        const stmts = [
          env.DB.prepare(
            "UPDATE submissions SET status = 'returned', review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE project_id = ? AND status = 'pending'",
          ).bind(feedback, actor.id, at, p.id),
          closeOpenReview(env, "submission", p.id, { status: "returned", by: actor.id, at, feedback }),
        ];
        // boardStageFor("submission_returned"): back to Prototype, launch cleared.
        const row = await env.DB.prepare("SELECT id, data FROM boards WHERE project_id = ?").bind(p.id).first<{ id: string; data: string }>();
        const current = row && readBoard(row.data, null);
        if (row && current) {
          const history = { ...current.history };
          delete history.prototype;
          const [back] = cleanProjects([{ ...current, stage: "prototype", launch: null, history }]);
          if (back) stmts.push(env.DB.prepare("UPDATE boards SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(back), at, row.id));
        }
        const href = row ? `/projectum?project=${row.id}` : "/projectum?view=myprojects";
        const title = `Your submission on “${ctx.posting.title}” came back with notes`;
        return {
          stmts,
          notify: [{ userIds: ctx.memberIds, court: true, title, href }],
          payload: { feedback },
          after: async () => {
            for (const m of await teamEmails(env, ctx.memberIds)) {
              await sendEmail(
                env,
                m.email,
                `Back to you: “${ctx.posting.title}”`,
                `Hi ${m.name},\n\nA representative sent your submission on “${ctx.posting.title}” back with notes:\n\n${feedback}\n\nYour board is in Prototype again, so you can keep building and submit when it's ready.\n${env.SITE_URL}${href}${SIGN_OFF}`,
              );
            }
          },
        };
      },
    },
  };
}

function refusal(r: Extract<TransitionResult, { ok: false }>, json: Json): Response {
  return json({ error: r.error, ...(r.issues ? { issues: r.issues } : {}) }, TRANSITION_STATUS[r.error]);
}

// The team submits from its board. The form is checked first; the move,
// the submission row, the board and the review then land together.
async function submit(req: Request, env: Env, user: UserRow, boardId: string, json: Json): Promise<Response> {
  const access = await boardAccess(env, user, boardId);
  if (access === "missing") return json({ error: "not-found" }, 404);
  if (access === "none") return json({ error: "forbidden" }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_REPORT + 1024 * 1024) return json({ error: "report-size" }, 413);
  const row = await env.DB.prepare("SELECT b.project_id, p.status FROM boards b JOIN projects p ON p.id = b.project_id WHERE b.id = ?")
    .bind(boardId)
    .first<{ project_id: string; status: string }>();
  if (!row) return json({ error: "state" }, 409);
  // A project that cannot submit now hears so before its form is read; the
  // engine checks again under its lock.
  if (!projectMachine.transitions.submitWork.from.includes(row.status as ProjectStatus)) {
    if (row.status === "submission_review") return json({ error: "pending" }, 409);
    if (["delivered", "integrated", "completion_review", "complete"].includes(row.status)) return json({ error: "accepted" }, 409);
    return json({ error: "state" }, 409);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("report");
  if (!form || !file || typeof file === "string") return json({ error: "report" }, 400);
  if (file.size > MAX_REPORT) return json({ error: "report-size" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return json({ error: "report-type" }, 415);
  const [board] = cleanProjects([parse<unknown>(String(form.get("project") ?? ""), null)]);
  if (!board || board.id !== boardId || board.stage !== "live" || !board.launch) return json({ error: "project" }, 400);

  const id = uuid();
  const reportName = cleanLine(file.name, 120).replace(/[^\w .()-]/g, "_") || "report.pdf";
  // KV is not part of the batch, so the report goes in first: a submission
  // row never points at a report that is not there. A refused move takes it
  // back out.
  try {
    await env.REPORTS.put(id, bytes, { metadata: { name: reportName } });
  } catch (err) {
    console.error("report upload failed", id, err);
    return json({ error: "report-store" }, 503);
  }
  const r = await transition(
    env,
    user,
    { kind: "project", id: row.project_id, name: "submitWork" },
    submissionHooks(env, user, { id, boardId, board, reportName, bytes }),
  ).catch(async (err: unknown) => {
    await env.REPORTS.delete(id).catch(() => {});
    throw err;
  });
  if (!r.ok) {
    await env.REPORTS.delete(id).catch((err: unknown) => console.error("report cleanup failed", id, err));
    // The older site reads "pending" and "accepted" for a submission already in.
    if (r.error === "state") {
      const current = (await env.DB.prepare("SELECT status FROM projects WHERE id = ?").bind(row.project_id).first<{ status: string }>())?.status;
      if (current === "submission_review") return json({ error: "pending" }, 409);
      if (current && ["delivered", "integrated", "completion_review", "complete"].includes(current)) return json({ error: "accepted" }, 409);
    }
    return refusal(r, json);
  }
  return json({ id, project: board, status: r.status }, 201);
}

// The report: any staff, the team, and the posting's organization once the
// submission is accepted. Anyone else gets a 404.
async function report(env: Env, user: UserRow, id: string, headers: Record<string, string>, json: Json): Promise<Response> {
  const sub = await env.DB.prepare(
    "SELECT s.status, s.report_name, s.project_id, po.kind, po.org_id FROM submissions s JOIN projects p ON p.id = s.project_id " +
      "JOIN postings po ON po.id = p.posting_id WHERE s.id = ?",
  )
    .bind(id)
    .first<{ status: string; report_name: string; project_id: string; kind: string; org_id: string | null }>();
  if (!sub) return json({ error: "not-found" }, 404);
  const onTeam = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?").bind(sub.project_id, user.id).first();
  const inOrg = sub.kind === "partner" && !!sub.org_id && user.org_id === sub.org_id && sub.status === "accepted";
  if (!isStaff(env, user) && !onTeam && !inOrg) return json({ error: "not-found" }, 404);
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

export function handleSubmissions(headers: Record<string, string>) {
  return async (req: Request, env: Env, user: UserRow, json: Json): Promise<Response | null> => {
    const { pathname } = new URL(req.url);
    const m = req.method;
    let match = pathname.match(/^\/boards\/([\w-]{1,64})\/submissions$/);
    if (match) return m === "POST" ? submit(req, env, user, match[1], json) : json({ error: "method" }, 405);
    if (!pathname.startsWith("/submissions/")) return null;
    match = pathname.match(/^\/submissions\/([\w-]{1,64})\/report$/);
    if (!match) return json({ error: "not-found" }, 404);
    return m === "GET" ? report(env, user, match[1], headers, json) : json({ error: "method" }, 405);
  };
}
