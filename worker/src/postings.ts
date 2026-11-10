// Postings: a partner's problem on the notice board, and gate 1, the
// representative's review before it goes there. Every status change goes
// through transition() (transition.ts) with the hooks below; this file adds
// the reads, the create and the edit.
//
//   GET   /postings?scope=board|mine|all   the board, the viewer's org's, every partner posting (staff)
//   POST  /postings                        { ...PostingDraft, send } a draft, sent for review when send
//   GET   /postings/:id
//   PATCH /postings/:id                    PostingDraft fields, by the org or an admin
//   POST  /postings/:id/transition         { name, feedback? }

import { cleanPosting, cleanText, LIMITS, postingIssues, type PostingDraft } from "@/lib/problems";
import { transitionsFrom } from "@/lib/pipeline/machines";
import { NEXT_STEPS } from "@/lib/pipeline/handoffs";
import type { Role } from "@/lib/pipeline/domain";
import { type AccountEnv, type Json, type UserRow, isAdmin, isStaff, rolesOf, sendEmail } from "./accounts";
import { json as parse, marks, now, uuid, type PostingRow } from "./db";
import { orgUserIds, repIds } from "./events";
import { closeOpenReview, openReview, reviewsForMany, type ReviewOut } from "./reviews";
import { activeDisciplineSlugs } from "./taxonomy";
import { TRANSITION_STATUS, transition, type Hooks, type TransitionResult } from "./transition";

type Env = AccountEnv;

type Viewer = { user: UserRow; roles: Role[]; staff: boolean; admin: boolean };

function viewerOf(env: Env, user: UserRow): Viewer {
  const admin = isAdmin(env, user);
  const roles = rolesOf(user);
  if (admin) roles.push("admin");
  return { user, roles, staff: isStaff(env, user), admin };
}

// The viewer belongs to the organization that owns the posting.
const inOrg = (row: PostingRow, v: Viewer) => row.kind !== "self" && !!row.org_id && v.user.org_id === row.org_id;

const SEEN_BY_MEMBERS: readonly string[] = ["live", "paused", "closed"];

// Staff see every posting, an organization its own, members a partner
// posting once it has been on the board. A member's own (self) posting is
// reached through their project.
export function canSeePosting(row: PostingRow, v: Viewer): boolean {
  if (v.staff || inOrg(row, v)) return true;
  return v.roles.includes("member") && row.kind === "partner" && SEEN_BY_MEMBERS.includes(row.status);
}

const GATE_DECISIONS = ["approve", "return"];

// The moves this viewer may make, by the same rules transition() applies:
// partners only on their organization's postings, staff anywhere, and never a
// gate decision on their own work.
function allowedTransitions(row: PostingRow, v: Viewer): string[] {
  const mine = inOrg(row, v);
  const own = mine || row.author_id === v.user.id;
  return transitionsFrom("posting", row.status, v.roles)
    .filter((t) => t.by.some((r) => v.roles.includes(r) && (r === "admin" || r === "rep" || (r === "partner" && mine))))
    .filter((t) => !(GATE_DECISIONS.includes(t.name) && own))
    .map((t) => t.name);
}

// The posting's editable fields, as the shared draft.
function draftOf(row: PostingRow): PostingDraft {
  return {
    title: row.title,
    summary: row.summary,
    details: row.details,
    disciplines: parse<string[]>(row.disciplines, []),
    tags: parse<string[]>(row.tags, []),
    effort: row.effort,
    deliverable: row.deliverable,
    deadline: row.deadline,
    businessModel: row.business_model,
    why: row.why,
    dependencies: row.dependencies,
    achieves: row.achieves,
    goal: row.goal,
    keyMilestones: row.key_milestones,
    driveUrl: row.drive_url,
  };
}

type Extras = {
  orgs: Map<string, { id: string; name: string; slug: string }>;
  authors: Map<string, { id: string; name: string }>;
  counts: Map<string, { open: number; delivered: number }>;
  mine: Map<string, { id: string; status: string; boardId: string | null }>;
  reviews: Map<string, ReviewOut[]>;
};

// Projects still working toward a submission: counts.open, and the members a
// closed posting affects.
const WORKING = ["claimed", "plan_review", "plan_returned", "active", "submission_review", "submission_returned"];
const DELIVERED = ["delivered", "integrated", "completion_review", "complete"];

// Everything postingOut needs beyond the row, for many rows in a few queries.
async function extrasFor(env: Env, rows: PostingRow[], v: Viewer): Promise<Extras> {
  const ids = JSON.stringify(rows.map((r) => r.id));
  const orgIds = JSON.stringify([...new Set(rows.map((r) => r.org_id).filter(Boolean))]);
  const authorIds = JSON.stringify([...new Set(rows.map((r) => r.author_id))]);
  const reviewable = rows.filter((r) => v.staff || inOrg(r, v)).map((r) => r.id);
  const [orgs, authors, counts, mine, reviews] = await Promise.all([
    env.DB.prepare("SELECT id, name, slug FROM orgs WHERE id IN (SELECT value FROM json_each(?))").bind(orgIds).all<{ id: string; name: string; slug: string }>(),
    env.DB.prepare("SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?))").bind(authorIds).all<{ id: string; name: string }>(),
    env.DB.prepare(
      `SELECT posting_id, SUM(status IN (${marks(WORKING.length)})) AS open, SUM(status IN (${marks(DELIVERED.length)})) AS delivered ` +
        "FROM projects WHERE posting_id IN (SELECT value FROM json_each(?)) GROUP BY posting_id",
    )
      .bind(...WORKING, ...DELIVERED, ids)
      .all<{ posting_id: string; open: number; delivered: number }>(),
    env.DB.prepare(
      "SELECT p.posting_id, p.id, p.status, b.id AS board_id FROM projects p JOIN project_members m ON m.project_id = p.id " +
        "LEFT JOIN boards b ON b.project_id = p.id WHERE m.user_id = ? AND p.status <> 'withdrawn' AND p.posting_id IN (SELECT value FROM json_each(?)) ORDER BY p.claimed_at",
    )
      .bind(v.user.id, ids)
      .all<{ posting_id: string; id: string; status: string; board_id: string | null }>(),
    reviewsForMany(env, "posting", reviewable),
  ]);
  return {
    orgs: new Map(orgs.results.map((o) => [o.id, o])),
    authors: new Map(authors.results.map((a) => [a.id, a])),
    counts: new Map(counts.results.map((c) => [c.posting_id, { open: c.open, delivered: c.delivered }])),
    // The newest wins.
    mine: new Map(mine.results.map((p) => [p.posting_id, { id: p.id, status: p.status, boardId: p.board_id }])),
    reviews,
  };
}

export function postingOut(row: PostingRow, v: Viewer, x: Extras) {
  const d = draftOf(row);
  const steps = `posting.${row.status}.partner`;
  return {
    id: row.id,
    orgId: row.org_id,
    org: (row.org_id && x.orgs.get(row.org_id)) || null,
    author: x.authors.get(row.author_id) ?? { id: row.author_id, name: "" },
    ...d,
    status: row.status,
    kind: row.kind,
    sealed: row.sealed === 1,
    showOnProfile: row.show_on_profile === 1,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    counts: x.counts.get(row.id) ?? { open: 0, delivered: 0 },
    myProject: x.mine.get(row.id) ?? null,
    transitions: allowedTransitions(row, v),
    nextSteps: inOrg(row, v) && Object.hasOwn(NEXT_STEPS, steps) ? steps : null,
    reviews: v.staff || inOrg(row, v) ? (x.reviews.get(row.id) ?? []) : [],
  };
}

export type PostingOut = ReturnType<typeof postingOut>;

export async function outOne(env: Env, row: PostingRow, v: Viewer): Promise<PostingOut> {
  return postingOut(row, v, await extrasFor(env, [row], v));
}

export async function postingById(env: Env, id: string): Promise<PostingRow | null> {
  return env.DB.prepare("SELECT * FROM postings WHERE id = ?").bind(id).first<PostingRow>();
}

// ---------------------------------------------------------------- the gate

const href = (id: string) => `/projectum?view=posting&id=${id}`;


// Who the posting is from, for titles: its organization, else its author.
async function fromName(env: Env, row: PostingRow): Promise<string> {
  const r = row.org_id
    ? await env.DB.prepare("SELECT name FROM orgs WHERE id = ?").bind(row.org_id).first<{ name: string }>()
    : await env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(row.author_id).first<{ name: string }>();
  return r?.name ?? "";
}

// The organization's people, and the author (a Lab posting may have no one
// else to tell).
async function orgPeople(env: Env, row: PostingRow): Promise<string[]> {
  return [...new Set([...(row.org_id ? await orgUserIds(env, row.org_id) : []), row.author_id])];
}

// The organization's primary contact's email, else the author's.
async function orgEmail(env: Env, row: PostingRow): Promise<{ email: string; name: string } | null> {
  if (row.org_id) {
    const p = await env.DB.prepare(
      "SELECT u.email, u.name FROM orgs o JOIN users u ON u.id = o.primary_user_id WHERE o.id = ? AND u.status = 'active'",
    )
      .bind(row.org_id)
      .first<{ email: string; name: string }>();
    if (p) return p;
  }
  return env.DB.prepare("SELECT email, name FROM users WHERE id = ? AND status = 'active'").bind(row.author_id).first<{ email: string; name: string }>();
}

const SIGN_OFF = "\n\nApplied AI Lab";

// The hooks for one request. Emails go in `after`, which transition() runs
// only once the change has succeeded. pause, resume, reopen and archive have
// no hook: the engine's default (the event alone) is all they need.
function hooksFor(env: Env, actor: UserRow): Record<string, Hooks> {
  return {
    submit: {
      guard: async (ctx) => {
        const issues = postingIssues(draftOf(ctx.posting), { forSubmit: true });
        return issues.length ? { error: "plan", issues } : null;
      },
      effects: async (ctx, _input, at) => {
        const p = ctx.posting;
        const review = openReview(env, "posting", p.id, draftOf(p), at);
        const title = `${await fromName(env, p)} sent “${p.title}” for review`;
        const link = `/projectum?view=review&id=${review.id}`;
        return {
          stmts: [env.DB.prepare("UPDATE postings SET submitted_at = ? WHERE id = ?").bind(at, p.id), review.stmt],
          notify: [{ userIds: await repIds(env), court: true, title, href: link }],
          payload: { reviewId: review.id },
          after: async () => {
            await sendEmail(env, env.APPROVER_EMAIL, title, `${title}.\n\nReview it in Projectum:\n${env.SITE_URL}${link}${SIGN_OFF}`);
          },
        };
      },
    },
    withdraw: {
      effects: async (ctx, _input, at) => ({
        stmts: [closeOpenReview(env, "posting", ctx.posting.id, { status: "withdrawn", by: actor.id, at })],
        notify: [],
      }),
    },
    approve: {
      effects: async (ctx, input, at) => {
        const p = ctx.posting;
        const feedback = input.feedback ?? "";
        const followers = await env.DB.prepare(
          "SELECT u.id FROM users u WHERE u.status = 'active' " +
            "AND (u.role = 'member' OR EXISTS (SELECT 1 FROM json_each(u.roles) r WHERE r.value = 'member')) " +
            "AND EXISTS (SELECT 1 FROM json_each(u.interests) i WHERE i.value IN (SELECT value FROM json_each(?)))",
        )
          .bind(p.disciplines)
          .all<{ id: string }>();
        const title = `“${p.title}” is live on the notice board`;
        return {
          after: async () => {
            const to = await orgEmail(env, p);
            if (!to) return;
            const note = feedback ? `\n\nNote from the Lab: ${feedback}` : "";
            await sendEmail(env, to.email, title, `Hi ${to.name},\n\n${title}. Members can claim it now.${note}\n\n${env.SITE_URL}${href(p.id)}${SIGN_OFF}`);
          },
          stmts: [
            env.DB.prepare("UPDATE postings SET published_at = ? WHERE id = ?").bind(at, p.id),
            closeOpenReview(env, "posting", p.id, { status: "approved", by: actor.id, at, feedback }),
          ],
          notify: [
            { userIds: await orgPeople(env, p), title, href: href(p.id) },
            { userIds: followers.results.map((r) => r.id), title: `New on the board: ${p.title}`, href: href(p.id) },
          ],
          payload: feedback ? { feedback } : undefined,
        };
      },
    },
    return: {
      effects: async (ctx, input, at) => {
        const p = ctx.posting;
        const feedback = input.feedback ?? "";
        const title = `“${p.title}” came back with notes`;
        return {
          after: async () => {
            const to = await orgEmail(env, p);
            if (!to) return;
            await sendEmail(
              env,
              to.email,
              title,
              `Hi ${to.name},\n\nA representative sent “${p.title}” back with notes:\n\n${feedback}\n\nEdit it and send it for review again:\n${env.SITE_URL}${href(p.id)}${SIGN_OFF}`,
            );
          },
          stmts: [closeOpenReview(env, "posting", p.id, { status: "returned", by: actor.id, at, feedback })],
          notify: [{ userIds: await orgPeople(env, p), court: true, title, href: href(p.id) }],
          payload: { feedback },
        };
      },
    },
    close: {
      effects: async (ctx, _input, at) => {
        const p = ctx.posting;
        const { results } = await env.DB.prepare(
          "SELECT DISTINCT m.user_id FROM project_members m JOIN projects pr ON pr.id = m.project_id " +
            `WHERE pr.posting_id = ? AND pr.status IN (${marks(WORKING.length)})`,
        )
          .bind(p.id, ...WORKING)
          .all<{ user_id: string }>();
        return {
          stmts: [env.DB.prepare("UPDATE postings SET closed_at = ? WHERE id = ?").bind(at, p.id)],
          notify: [
            {
              userIds: results.map((r) => r.user_id),
              title: `“${p.title}” is closed to new claims. Your project continues.`,
              href: "/projectum?view=myprojects",
            },
          ],
        };
      },
    },
  };
}

function runTransition(env: Env, user: UserRow, id: string, name: string, feedback?: string): Promise<TransitionResult> {
  return transition(env, user, { kind: "posting", id, name, feedback }, hooksFor(env, user));
}

function refusal(r: Extract<TransitionResult, { ok: false }>, json: Json, extra: Record<string, unknown> = {}): Response {
  return json({ error: r.error, ...(r.issues ? { issues: r.issues } : {}), ...extra }, TRANSITION_STATUS[r.error]);
}

// ---------------------------------------------------------------- routes

async function body(req: Request): Promise<Record<string, unknown>> {
  const b: unknown = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

const DRAFT_KEYS = ["title", "summary", "details", "disciplines", "tags", "effort", "deliverable", "deadline",
  "businessModel", "why", "dependencies", "achieves", "goal", "keyMilestones", "driveUrl"] as const;

async function list(req: Request, env: Env, v: Viewer, json: Json): Promise<Response> {
  const partner = v.roles.includes("partner") && !v.staff;
  const scope = new URL(req.url).searchParams.get("scope") ?? (partner ? "mine" : "board");
  let rows: PostingRow[];
  if (scope === "board") {
    if (!v.staff && !v.roles.includes("member")) return json({ error: "forbidden" }, 403);
    rows = (
      await env.DB.prepare("SELECT * FROM postings WHERE status = 'live' AND kind = 'partner' ORDER BY published_at DESC").all<PostingRow>()
    ).results;
  } else if (scope === "mine") {
    rows = v.user.org_id
      ? (await env.DB.prepare("SELECT * FROM postings WHERE org_id = ? AND kind = 'partner' ORDER BY updated_at DESC").bind(v.user.org_id).all<PostingRow>())
          .results
      : [];
  } else if (scope === "all") {
    if (!v.staff) return json({ error: "forbidden" }, 403);
    rows = (await env.DB.prepare("SELECT * FROM postings WHERE kind = 'partner' ORDER BY updated_at DESC").all<PostingRow>()).results;
  } else {
    return json({ error: "scope" }, 400);
  }
  const x = await extrasFor(env, rows, v);
  return json({ postings: rows.map((r) => postingOut(r, v, x)) });
}

// A partner posts for their organization; an admin, for the Lab.
async function create(req: Request, env: Env, v: Viewer, json: Json): Promise<Response> {
  let orgId: string | null = null;
  if (v.roles.includes("partner") && v.user.org_id) orgId = v.user.org_id;
  else if (v.admin) {
    const lab = await env.DB.prepare("SELECT id FROM orgs WHERE kind = 'lab' ORDER BY created_at LIMIT 1").first<{ id: string }>();
    if (!lab) return json({ error: "no-lab-org" }, 409);
    orgId = lab.id;
  } else return json({ error: "forbidden" }, 403);

  const b = await body(req);
  const draft = cleanPosting(b, await activeDisciplineSlugs(env));
  const issues = postingIssues(draft, { forSubmit: false });
  if (issues.length) return json({ error: "plan", issues }, 400);
  const id = uuid();
  const at = now();
  await env.DB.prepare(
    "INSERT INTO postings (id, org_id, author_id, title, summary, details, disciplines, tags, effort, deliverable, deadline, " +
      "business_model, why, dependencies, achieves, goal, key_milestones, drive_url, status, kind, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'partner', ?, ?)",
  )
    .bind(
      id, orgId, v.user.id, draft.title, draft.summary, draft.details, JSON.stringify(draft.disciplines), JSON.stringify(draft.tags),
      draft.effort, draft.deliverable, draft.deadline, draft.businessModel, draft.why, draft.dependencies, draft.achieves, draft.goal,
      draft.keyMilestones, draft.driveUrl, at, at,
    )
    .run();
  if (b.send !== true) return json({ id, status: "draft" }, 201);
  const sent = await runTransition(env, v.user, id, "submit");
  if (!sent.ok) return refusal(sent, json, { id });
  return json({ id, status: sent.status }, 201);
}

async function patch(req: Request, env: Env, v: Viewer, row: PostingRow, json: Json): Promise<Response> {
  if (!inOrg(row, v) && !v.admin) return json({ error: "forbidden" }, 403);
  if (row.status === "in_review" || row.status === "archived") return json({ error: "state" }, 409);
  const b = await body(req);
  const current = draftOf(row);
  const next: Record<string, unknown> = { ...current };
  for (const k of DRAFT_KEYS) if (k in b) next[k] = b[k];
  // A discipline retired from the taxonomy since may stay on the posting it is
  // already on, but no edit can newly add one.
  const allowed = [...new Set([...(await activeDisciplineSlugs(env)), ...current.disciplines])];
  const draft = cleanPosting(next, allowed);
  const issues = postingIssues(draft, { forSubmit: false });
  if (issues.length) return json({ error: "plan", issues }, 400);
  const moved = await env.DB.prepare(
    "UPDATE postings SET title = ?, summary = ?, details = ?, disciplines = ?, tags = ?, effort = ?, deliverable = ?, deadline = ?, " +
      "business_model = ?, why = ?, dependencies = ?, achieves = ?, goal = ?, key_milestones = ?, drive_url = ?, updated_at = ? " +
      "WHERE id = ? AND status NOT IN ('in_review', 'archived')",
  )
    .bind(
      draft.title, draft.summary, draft.details, JSON.stringify(draft.disciplines), JSON.stringify(draft.tags), draft.effort,
      draft.deliverable, draft.deadline, draft.businessModel, draft.why, draft.dependencies, draft.achieves, draft.goal, draft.keyMilestones,
      draft.driveUrl, now(), row.id,
    )
    .run();
  if (moved.meta.changes === 0) return json({ error: "state" }, 409);
  return json(await outOne(env, (await postingById(env, row.id))!, v));
}

async function move(req: Request, env: Env, v: Viewer, row: PostingRow, json: Json): Promise<Response> {
  const b = await body(req);
  if (typeof b.name !== "string") return json({ error: "unknown-transition" }, 400);
  const feedback = cleanText(b.feedback, LIMITS.feedback);
  const r = await runTransition(env, v.user, row.id, b.name, feedback || undefined);
  if (!r.ok) return refusal(r, json);
  return json({ ok: true, status: r.status, posting: await outOne(env, (await postingById(env, row.id))!, v) });
}

export async function handlePostings(req: Request, env: Env, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname !== "/postings" && !pathname.startsWith("/postings/")) return null;
  const v = viewerOf(env, user);
  const m = req.method;
  if (pathname === "/postings") {
    if (m === "GET") return list(req, env, v, json);
    if (m === "POST") return create(req, env, v, json);
    return json({ error: "method" }, 405);
  }
  const match = pathname.match(/^\/postings\/([\w-]{1,64})(\/transition)?$/);
  if (!match) return json({ error: "not-found" }, 404);
  const row = await postingById(env, match[1]);
  if (!row || !canSeePosting(row, v)) return json({ error: "not-found" }, 404);
  if (match[2]) return m === "POST" ? move(req, env, v, row, json) : json({ error: "method" }, 405);
  if (m === "GET") return json(await outOne(env, row, v));
  if (m === "PATCH") return patch(req, env, v, row, json);
  return json({ error: "method" }, 405);
}
