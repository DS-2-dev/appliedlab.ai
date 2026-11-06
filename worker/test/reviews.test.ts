import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";

type Env = ReturnType<typeof makeEnv>;
const AT = "2026-09-01T00:00:00.000Z";

type Person = { id: string; name: string };
type QueueRow = {
  id: string;
  gate: string;
  subjectId: string;
  round: number;
  status: string;
  assignedTo: Person | null;
  title: string;
  who: string;
  posting: { id: string; title: string };
  project: { id: string; status: string; lead: Person; team: Person[] } | null;
  waitingSince: string;
  href: string;
};
type Detail = {
  review: { id: string; gate: string; round: number; status: string };
  history: Array<{ round: number; status: string }>;
  subject: { id: string; status: string; transitions: string[]; plan?: { approach: string } };
  snapshot: { approach?: string; reportName?: string; reportSize?: number; title?: string };
  board: { id: string; stage: string } | null;
};

const PLAN = {
  approach: "Regression on five years of contract costs",
  milestones: [
    { title: "Clean data", criterion: "No gaps in five years" },
    { title: "Fit model", criterion: "Error under five percent" },
  ],
  finishBy: "2026-12-01",
};

const READY = {
  title: "Plow routing",
  summary: "A routing model for plow trucks across the county",
  details: "We route by hand today.",
  disciplines: ["finance"],
  tags: [],
  effort: "medium",
  deliverable: "A spreadsheet model",
  deadline: "2026-12-01",
};

async function reset(db: D1Database) {
  const tables = [
    "notifications", "events", "reviews", "milestone_baselines", "selections", "meetings", "submissions", "boards", "project_members",
    "projects", "postings", "org_requests", "sessions", "login_codes", "users", "orgs",
  ];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

async function seed() {
  const env = makeEnv();
  await applyMigrations(env.DB);
  await reset(env.DB);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES
        ('u_dana', 'dana@kestrel.example', 'Dana Reyes', 'partner', '["partner"]', 'active', ?)`,
    ).bind(AT),
    env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at) VALUES
        ('o_kestrel', 'kestrel-example', 'Kestrel', 'company', 'kestrel.example', 'u_dana', ?)`,
    ).bind(AT),
    env.DB.prepare("UPDATE users SET org_id = 'o_kestrel' WHERE id = 'u_dana'"),
    env.DB.prepare(
      `INSERT INTO postings (id, org_id, author_id, title, summary, details, disciplines, status, kind, published_at, created_at, updated_at)
       VALUES ('P1', 'o_kestrel', 'u_dana', 'Snow removal pricing', 'An annual price model for snow removal', 'We bid by the push today.',
         '["finance"]', 'live', 'partner', ?, ?, ?)`,
    ).bind(AT, AT, AT),
  ]);
  const dana = await signIn(env, "dana@kestrel.example");
  const rep = await signIn(env, "prof@weber.edu", "Pat Prof");
  const rep2 = await signIn(env, "ann@weber.edu", "Ann Rook");
  const maya = await signIn(env, "maya@mail.weber.edu", "Maya Lin");
  const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  return { env, dana, rep, rep2, maya, admin };
}

// A plan review (maya's project on P1), then a posting review (dana's new
// posting), then a pending submission on maya's board.
async function fill(env: Env, dana: string, maya: string) {
  const claim = await call(env, maya, "POST", "/postings/P1/claim", {});
  const { id: projectId } = (await claim.json()) as { id: string };
  expect((await call(env, maya, "PUT", `/projects/${projectId}/plan`, PLAN)).status).toBe(200);
  expect((await call(env, maya, "POST", `/projects/${projectId}/transition`, { name: "submitPlan" })).status).toBe(200);
  const sent = await call(env, dana, "POST", "/postings", { ...READY, send: true });
  expect(sent.status).toBe(201);
  const { id: postingId } = (await sent.json()) as { id: string };
  const board = await env.DB.prepare("SELECT id FROM boards WHERE project_id = ?").bind(projectId).first<{ id: string }>();
  const lead = await env.DB.prepare("SELECT lead_id FROM projects WHERE id = ?").bind(projectId).first<{ lead_id: string }>();
  await env.DB.prepare(
    "INSERT INTO submissions (id, project_id, board_id, submitted_by, report_name, report_size, status, created_at) VALUES ('S1', ?, ?, ?, 'report.pdf', 2048, 'pending', ?)",
  )
    .bind(projectId, board!.id, lead!.lead_id, new Date().toISOString())
    .run();
  return { projectId, postingId };
}

const queue = async (env: Env, token: string) => ((await (await call(env, token, "GET", "/reviews")).json()) as { reviews: QueueRow[] }).reviews;

describe("reviews", () => {
  it("the queue lists the plan and posting reviews oldest first, then the pending submission", async () => {
    const { env, dana, rep, maya } = await seed();
    const { projectId, postingId } = await fill(env, dana.token, maya.token);
    const rows = await queue(env, rep.token);
    expect(rows.map((r) => r.gate)).toEqual(["action_plan", "posting", "submission"]);
    const [plan, posting, sub] = rows;
    expect(plan).toMatchObject({
      subjectId: projectId,
      round: 1,
      status: "open",
      assignedTo: null,
      title: "Snow removal pricing",
      who: "Maya Lin",
      posting: { id: "P1", title: "Snow removal pricing" },
      project: { id: projectId, status: "plan_review", lead: { name: "Maya Lin" }, team: [{ name: "Maya Lin" }] },
      href: `/projectum?view=review&id=${plan.id}`,
    });
    expect(posting).toMatchObject({ subjectId: postingId, title: "Plow routing", who: "Kestrel", project: null, posting: { id: postingId, title: "Plow routing" } });
    expect(posting.waitingSince >= plan.waitingSince).toBe(true);
    expect(sub).toMatchObject({
      id: "sub:S1",
      gate: "submission",
      round: 1,
      status: "open",
      assignedTo: null,
      who: "Maya Lin",
      project: { id: projectId },
      href: "/projectum?view=review&id=sub:S1",
    });
  });

  it("members and partners cannot read the queue; admins can", async () => {
    const { env, dana, maya, admin } = await seed();
    expect((await call(env, maya.token, "GET", "/reviews")).status).toBe(403);
    expect((await call(env, dana.token, "GET", "/reviews")).status).toBe(403);
    expect((await call(env, admin.token, "GET", "/reviews")).status).toBe(200);
    expect((await call(env, null, "GET", "/reviews")).status).toBe(401);
  });

  it("take: the same rep twice is fine, a second rep gets 409 taken", async () => {
    const { env, dana, rep, rep2, maya } = await seed();
    await fill(env, dana.token, maya.token);
    const [plan] = await queue(env, rep.token);
    expect((await call(env, rep.token, "POST", `/reviews/${plan.id}/take`)).status).toBe(200);
    expect((await call(env, rep.token, "POST", `/reviews/${plan.id}/take`)).status).toBe(200);
    const second = await call(env, rep2.token, "POST", `/reviews/${plan.id}/take`);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "taken" });
    const [after] = await queue(env, rep2.token);
    expect(after.assignedTo).toEqual({ id: rep.user.id, name: "Pat Prof" });
    expect((await call(env, maya.token, "POST", `/reviews/${plan.id}/take`)).status).toBe(403);
  });

  it("assign: admin only, to an active rep or admin, and the assignee is told", async () => {
    const { env, dana, rep, rep2, maya, admin } = await seed();
    await fill(env, dana.token, maya.token);
    const [plan] = await queue(env, rep.token);
    const bad = await call(env, admin.token, "POST", `/reviews/${plan.id}/assign`, { userId: maya.user.id });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "assignee" });
    expect((await call(env, rep.token, "POST", `/reviews/${plan.id}/assign`, { userId: rep2.user.id })).status).toBe(403);
    expect((await call(env, admin.token, "POST", `/reviews/${plan.id}/assign`, { userId: rep2.user.id })).status).toBe(200);
    const [after] = await queue(env, rep.token);
    expect(after.assignedTo?.id).toBe(rep2.user.id);
    const notes = (await env.DB.prepare("SELECT court, href FROM notifications WHERE user_id = ? AND kind = 'review.assigned'").bind(rep2.user.id).all()).results;
    expect(notes).toEqual([{ court: 1, href: `/projectum?view=review&id=${plan.id}` }]);
  });

  it("detail returns the frozen snapshot after the plan changes, the board and the history", async () => {
    const { env, dana, rep, maya } = await seed();
    const { projectId } = await fill(env, dana.token, maya.token);
    const [plan] = await queue(env, rep.token);
    await env.DB.prepare("UPDATE projects SET plan = ? WHERE id = ?")
      .bind(JSON.stringify({ ...PLAN, approach: "Edited afterwards" }), projectId)
      .run();
    const res = await call(env, rep.token, "GET", `/reviews/${plan.id}`);
    expect(res.status).toBe(200);
    const d = (await res.json()) as Detail;
    expect(d.review).toMatchObject({ id: plan.id, gate: "action_plan", round: 1, status: "open" });
    expect(d.history).toEqual([expect.objectContaining({ round: 1, status: "open" })]);
    expect(d.snapshot.approach).toBe(PLAN.approach);
    expect(d.subject).toMatchObject({ id: projectId, status: "plan_review" });
    expect(d.subject.plan?.approach).toBe("Edited afterwards");
    expect(d.subject.transitions.sort()).toEqual(["approvePlan", "returnPlan"].sort());
    expect(d.board).toMatchObject({ stage: "solidifying" });
  });

  it("detail of a posting review has the posting and no board", async () => {
    const { env, dana, rep, maya } = await seed();
    const { postingId } = await fill(env, dana.token, maya.token);
    const row = (await queue(env, rep.token)).find((r) => r.gate === "posting")!;
    const d = (await (await call(env, rep.token, "GET", `/reviews/${row.id}`)).json()) as Detail;
    expect(d.subject).toMatchObject({ id: postingId, status: "in_review" });
    expect(d.subject.transitions.sort()).toEqual(["approve", "return"]);
    expect(d.board).toBeNull();
    expect(d.snapshot).toMatchObject({ title: "Plow routing" });
  });

  it("detail of a legacy submission, and take or assign on it is 409 legacy", async () => {
    const { env, dana, rep, maya, admin } = await seed();
    const { projectId } = await fill(env, dana.token, maya.token);
    const res = await call(env, rep.token, "GET", "/reviews/sub:S1");
    expect(res.status).toBe(200);
    const d = (await res.json()) as Detail;
    expect(d.review).toMatchObject({ id: "sub:S1", gate: "submission", round: 1, status: "open" });
    expect(d.history).toEqual([]);
    expect(d.subject).toMatchObject({ id: projectId });
    expect(d.snapshot).toMatchObject({ reportName: "report.pdf", reportSize: 2048 });
    expect(d.board).toMatchObject({ stage: expect.any(String) });
    const take = await call(env, rep.token, "POST", "/reviews/sub:S1/take");
    expect(take.status).toBe(409);
    expect(await take.json()).toEqual({ error: "legacy" });
    expect((await call(env, admin.token, "POST", "/reviews/sub:S1/assign", { userId: rep.user.id })).status).toBe(409);
  });

  it("an encoded legacy id, as the site sends it, resolves like the literal one", async () => {
    const { env, dana, rep, maya, admin } = await seed();
    await fill(env, dana.token, maya.token);
    const res = await call(env, rep.token, "GET", "/reviews/sub%3AS1");
    expect(res.status).toBe(200);
    expect(((await res.json()) as Detail).review).toMatchObject({ id: "sub:S1", gate: "submission" });
    const take = await call(env, rep.token, "POST", "/reviews/sub%3AS1/take");
    expect(take.status).toBe(409);
    expect(await take.json()).toEqual({ error: "legacy" });
    expect((await call(env, admin.token, "POST", "/reviews/sub%3AS1/assign", { userId: rep.user.id })).status).toBe(409);
    expect((await call(env, rep.token, "GET", "/reviews/sub%3Anope")).status).toBe(404);
    expect((await call(env, rep.token, "GET", "/reviews/%E0%A4%A")).status).toBe(404);
  });

  it("unknown ids are 404", async () => {
    const { env, rep } = await seed();
    expect((await call(env, rep.token, "GET", "/reviews/nope")).status).toBe(404);
    expect((await call(env, rep.token, "GET", "/reviews/sub:nope")).status).toBe(404);
    expect((await call(env, rep.token, "POST", "/reviews/nope/take")).status).toBe(404);
  });
});
