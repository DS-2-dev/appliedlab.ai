import { describe, it, expect, vi, afterEach } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";

type Env = ReturnType<typeof makeEnv>;
type Session = Awaited<ReturnType<typeof signIn>>;
const AT = "2026-09-01T00:00:00.000Z";

const PLAN = {
  approach: "Regression on five years of contract costs",
  milestones: [
    { title: "Clean data", criterion: "No gaps in five years" },
    { title: "Fit model", criterion: "Error under five percent" },
  ],
  finishBy: "2026-12-01",
};

type Board = { id: string; stage: string; people: Array<{ id: string }>; launch: unknown; [k: string]: unknown };
type BoardEntry = { project: Board | null; projectId: string | null; submission: { id: string; status: string } | null; view: string };

async function reset(db: D1Database) {
  const tables = [
    "reminders_sent", "notifications", "events", "reviews", "milestone_baselines", "selections", "meetings", "submissions", "boards",
    "project_members", "projects", "postings", "org_requests", "sessions", "login_codes", "users", "orgs",
  ];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

// Kestrel (dana) with a live posting P1, Cinder (theo), a rep, two members
// and an admin.
async function seed() {
  const env = makeEnv();
  await applyMigrations(env.DB);
  await reset(env.DB);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES
        ('u_dana', 'dana@kestrel.example', 'Dana Reyes', 'partner', '["partner"]', 'active', ?),
        ('u_theo', 'theo@cinder.example', 'Theo Grant', 'partner', '["partner"]', 'active', ?)`,
    ).bind(AT, AT),
    env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at) VALUES
        ('o_kestrel', 'kestrel-example', 'Kestrel', 'company', 'kestrel.example', 'u_dana', ?),
        ('o_cinder', 'cinder-example', 'Cinder', 'company', 'cinder.example', 'u_theo', ?)`,
    ).bind(AT, AT),
    env.DB.prepare("UPDATE users SET org_id = 'o_kestrel' WHERE id = 'u_dana'"),
    env.DB.prepare("UPDATE users SET org_id = 'o_cinder' WHERE id = 'u_theo'"),
    env.DB.prepare(
      `INSERT INTO postings (id, org_id, author_id, title, summary, details, disciplines, status, kind, published_at, created_at, updated_at)
       VALUES ('P1', 'o_kestrel', 'u_dana', 'Snow removal pricing', 'An annual price model for snow removal', 'We bid by the push today.',
         '["finance"]', 'live', 'partner', ?, ?, ?)`,
    ).bind(AT, AT, AT),
  ]);
  const dana = await signIn(env, "dana@kestrel.example");
  const theo = await signIn(env, "theo@cinder.example");
  const rep = await signIn(env, "prof@weber.edu", "Pat Prof");
  const maya = await signIn(env, "maya@mail.weber.edu", "Maya Lin");
  const eli = await signIn(env, "eli@mail.weber.edu", "Eli Park");
  const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  return { env, dana, theo, rep, maya, eli, admin };
}

const move = (env: Env, token: string, id: string, name: string, extra: Record<string, unknown> = {}) =>
  call(env, token, "POST", `/projects/${id}/transition`, { name, ...extra });
const status = async (env: Env, id: string) =>
  (await env.DB.prepare("SELECT status FROM projects WHERE id = ?").bind(id).first<{ status: string }>())?.status;
const boardRow = async (env: Env, projectId: string) => {
  const r = await env.DB.prepare("SELECT id, data FROM boards WHERE project_id = ?").bind(projectId).first<{ id: string; data: string }>();
  return { id: r!.id, data: JSON.parse(r!.data) as Board };
};
const boards = async (env: Env, token: string) => ((await (await call(env, token, "GET", "/boards")).json()) as { projects: BoardEntry[] }).projects;

// A project on `postingPath` taken to active: claimed (or proposed), plan
// written and submitted, approved by the rep.
async function active(env: Env, maya: Session, rep: Session, teammates: string[] = []): Promise<string> {
  const res = await call(env, maya.token, "POST", "/postings/P1/claim", { teammates });
  expect(res.status).toBe(201);
  const { id } = (await res.json()) as { id: string };
  expect((await call(env, maya.token, "PUT", `/projects/${id}/plan`, PLAN)).status).toBe(200);
  expect((await move(env, maya.token, id, "submitPlan")).status).toBe(200);
  expect((await move(env, rep.token, id, "approvePlan")).status).toBe(200);
  expect(await status(env, id)).toBe("active");
  return id;
}

// The board moved to Live with a launch, and a PDF report, as the site sends them.
async function submit(env: Env, token: string, projectId: string, report = "%PDF-1.7 final report"): Promise<Response> {
  const { id, data } = await boardRow(env, projectId);
  const contributions = Object.fromEntries(data.people.map((p) => [p.id, "Built the model"]));
  const live = {
    ...data,
    stage: "live",
    prototype: { githubUrl: "https://github.com/lab/snow", supabase: false },
    launch: { siteUrl: "https://snow.example.com", slidesUrl: "", demoUrl: "", contributions, at: AT },
  };
  const form = new FormData();
  form.set("project", JSON.stringify(live));
  form.set("report", new File([report], "Final report.pdf", { type: "application/pdf" }));
  return call(env, token, "POST", `/boards/${id}/submissions`, form);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submissions", () => {
  it("a member submits from an active project: submission_review, board live, a submission review for reps", async () => {
    const { env, rep, maya } = await seed();
    const id = await active(env, maya, rep);
    const res = await submit(env, maya.token, id);
    expect(res.status).toBe(201);
    const { id: subId } = (await res.json()) as { id: string };
    expect(await status(env, id)).toBe("submission_review");
    expect((await boardRow(env, id)).data.stage).toBe("live");
    expect(await env.DB.prepare("SELECT status, report_name FROM submissions WHERE id = ?").bind(subId).first()).toEqual({
      status: "pending",
      report_name: "Final report.pdf",
    });
    const review = await env.DB.prepare("SELECT id, round, status, snapshot FROM reviews WHERE gate = 'submission' AND subject_id = ?")
      .bind(id)
      .first<{ id: string; round: number; status: string; snapshot: string }>();
    expect(review).toMatchObject({ round: 1, status: "open" });
    expect(JSON.parse(review!.snapshot)).toMatchObject({ reportName: "Final report.pdf" });
    expect(await env.REPORTS.get(subId)).not.toBeNull();
    const note = await env.DB.prepare("SELECT court, href FROM notifications WHERE user_id = ? AND kind = 'project.work_submitted'")
      .bind(rep.user.id)
      .first<{ court: number; href: string }>();
    expect(note).toEqual({ court: 1, href: `/projectum?view=review&id=${review!.id}` });
    // The queue lists the real review once, with no synthetic twin.
    const queue = (await (await call(env, rep.token, "GET", "/reviews")).json()) as { reviews: Array<{ id: string; gate: string }> };
    expect(queue.reviews.filter((r) => r.gate === "submission").map((r) => r.id)).toEqual([review!.id]);

    // A second submission while one waits is refused.
    expect((await submit(env, maya.token, id)).status).toBe(409);
  });

  it("a refused submission leaves no report in KV", async () => {
    const { env, rep, maya } = await seed();
    const id = await active(env, maya, rep);
    const keys = async () => (await env.REPORTS.list()).keys.map((k) => k.name).sort();
    const before = await keys();
    // The project moves on between the route's check and the engine's lock:
    // the report is already in KV when the move is refused.
    const real = env.REPORTS;
    let stored = "";
    env.REPORTS = {
      ...real,
      get: real.get.bind(real),
      list: real.list.bind(real),
      delete: real.delete.bind(real),
      getWithMetadata: real.getWithMetadata.bind(real),
      put: async (key: string, value: Parameters<KVNamespace["put"]>[1], opts?: KVNamespacePutOptions) => {
        stored = key;
        await real.put(key, value, opts);
        await env.DB.prepare("UPDATE projects SET status = 'withdrawn' WHERE id = ?").bind(id).run();
      },
    } as KVNamespace;
    const res = await submit(env, maya.token, id);
    env.REPORTS = real;
    expect(res.status).toBe(409);
    expect(stored).not.toBe("");
    expect(await real.get(stored)).toBeNull();
    expect(await keys()).toEqual(before);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE project_id = ?").bind(id).first()).toEqual({ n: 0 });
  });

  it("refuses a report that is not a PDF", async () => {
    const { env, rep, maya } = await seed();
    const id = await active(env, maya, rep);
    expect((await submit(env, maya.token, id, "hello")).status).toBe(415);
    expect(await status(env, id)).toBe("active");
  });

  it("refuses a submission on a project whose plan is not approved", async () => {
    const { env, maya } = await seed();
    const res = await call(env, maya.token, "POST", "/postings/P1/claim", {});
    const { id } = (await res.json()) as { id: string };
    expect((await submit(env, maya.token, id)).status).toBe(409);
    expect(await status(env, id)).toBe("claimed");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions").first()).toEqual({ n: 0 });
  });

  it("an admin may submit a team's board at Live", async () => {
    const { env, rep, maya, admin } = await seed();
    const id = await active(env, maya, rep);
    expect((await submit(env, admin.token, id)).status).toBe(201);
    expect(await status(env, id)).toBe("submission_review");
  });

  it("returnWork sends it back: submission_returned, board in Prototype with no launch", async () => {
    const { env, rep, maya } = await seed();
    const id = await active(env, maya, rep);
    const { id: subId } = (await (await submit(env, maya.token, id)).json()) as { id: string };
    expect((await move(env, rep.token, id, "returnWork")).status).toBe(400);
    expect((await move(env, rep.token, id, "returnWork", { feedback: "Add sources" })).status).toBe(200);
    expect(await status(env, id)).toBe("submission_returned");
    const board = (await boardRow(env, id)).data;
    expect(board.stage).toBe("prototype");
    expect(board.launch).toBeNull();
    expect(await env.DB.prepare("SELECT status, review_note FROM submissions WHERE id = ?").bind(subId).first()).toEqual({
      status: "returned",
      review_note: "Add sources",
    });
    expect(
      await env.DB.prepare("SELECT status, feedback FROM reviews WHERE gate = 'submission' AND subject_id = ?").bind(id).first(),
    ).toEqual({ status: "returned", feedback: "Add sources" });
    // The team can submit again; it opens round 2.
    expect((await submit(env, maya.token, id)).status).toBe(201);
    expect(
      (await env.DB.prepare("SELECT MAX(round) AS n FROM reviews WHERE gate = 'submission' AND subject_id = ?").bind(id).first<{ n: number }>())
        ?.n,
    ).toBe(2);
  });

  it("approveWork delivers: the partner lists the board and downloads the report; another org cannot", async () => {
    const { env, rep, maya, dana, theo, eli } = await seed();
    const id = await active(env, maya, rep);
    const { id: subId } = (await (await submit(env, maya.token, id)).json()) as { id: string };
    // Not before it is accepted.
    expect((await call(env, dana.token, "GET", `/submissions/${subId}/report`)).status).toBe(404);
    const res = await move(env, rep.token, id, "approveWork", { feedback: "Strong", score: 4 });
    expect(res.status).toBe(200);
    expect(await status(env, id)).toBe("delivered");
    expect(await env.DB.prepare("SELECT status FROM submissions WHERE id = ?").bind(subId).first()).toEqual({ status: "accepted" });
    expect(await env.DB.prepare("SELECT status, score FROM reviews WHERE gate = 'submission' AND subject_id = ?").bind(id).first()).toEqual({
      status: "approved",
      score: 4,
    });
    const listed = (await boards(env, dana.token)).find((b) => b.projectId === id);
    expect(listed).toMatchObject({ view: "partner", submission: { id: subId, status: "accepted" } });
    const report = await call(env, dana.token, "GET", `/submissions/${subId}/report`);
    expect(report.status).toBe(200);
    expect(report.headers.get("content-type")).toBe("application/pdf");
    expect(await report.text()).toBe("%PDF-1.7 final report");
    expect((await call(env, theo.token, "GET", `/submissions/${subId}/report`)).status).toBe(404);
    expect((await call(env, eli.token, "GET", `/submissions/${subId}/report`)).status).toBe(404);
    expect((await call(env, maya.token, "GET", `/submissions/${subId}/report`)).status).toBe(200);
    expect((await call(env, rep.token, "GET", `/submissions/${subId}/report`)).status).toBe(200);
    const partnerNote = await env.DB.prepare("SELECT court FROM notifications WHERE user_id = 'u_dana' AND kind = 'project.work_approved'").first();
    expect(partnerNote).toEqual({ court: 1 });
  });

  it("only a rep can approve a submission", async () => {
    const { env, rep, maya } = await seed();
    const id = await active(env, maya, rep);
    expect((await submit(env, maya.token, id)).status).toBe(201);
    expect((await move(env, maya.token, id, "approveWork")).status).toBe(403);
    expect((await move(env, rep.token, id, "approveWork")).status).toBe(200);
    expect(await status(env, id)).toBe("delivered");
  });

  it("a member's own project goes straight to complete when its work is approved", async () => {
    const { env, rep, maya } = await seed();
    const res = await call(env, maya.token, "POST", "/proposals", {
      posting: { title: "Campus parking model", summary: "Predict where parking runs out each morning", disciplines: ["mathematics"] },
      plan: PLAN,
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect((await move(env, maya.token, id, "submitPlan")).status).toBe(200);
    expect((await move(env, rep.token, id, "approvePlan")).status).toBe(200);
    expect((await submit(env, maya.token, id)).status).toBe(201);
    const ok = await move(env, rep.token, id, "approveWork");
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { status: string }).status).toBe("complete");
    const row = await env.DB.prepare("SELECT status, delivered_at IS NOT NULL AS d, completed_at IS NOT NULL AS c FROM projects WHERE id = ?")
      .bind(id)
      .first();
    expect(row).toEqual({ status: "complete", d: 1, c: 1 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE project_id = ? AND type = 'project.completed'").bind(id).first()).toEqual({ n: 1 });
  });
});

describe("phase 2", () => {
  async function delivered() {
    const s = await seed();
    const id = await active(s.env, s.maya, s.rep, [s.eli.user.id]);
    expect((await submit(s.env, s.maya.token, id)).status).toBe(201);
    expect((await move(s.env, s.rep.token, id, "approveWork")).status).toBe(200);
    return { ...s, id };
  }

  it("the partner integrates the team: integrated, a selection, everyone a Builder", async () => {
    const { env, id, dana, theo, maya, eli } = await delivered();
    // Another organization cannot see the project at all.
    expect((await move(env, theo.token, id, "integrate")).status).toBe(404);
    expect((await move(env, maya.token, id, "integrate")).status).toBe(403);
    const res = await move(env, dana.token, id, "integrate", { message: "Come build it with us" });
    expect(res.status).toBe(200);
    expect(await status(env, id)).toBe("integrated");
    expect(await env.DB.prepare("SELECT phase, integrated_at IS NOT NULL AS i FROM projects WHERE id = ?").bind(id).first()).toEqual({
      phase: "integrated",
      i: 1,
    });
    expect(await env.DB.prepare("SELECT selected_by, message, milestones FROM selections WHERE project_id = ?").bind(id).first()).toEqual({
      selected_by: "u_dana",
      message: "Come build it with us",
      milestones: "[]",
    });
    const levels = await env.DB.prepare("SELECT level FROM users WHERE id IN (?, ?)").bind(maya.user.id, eli.user.id).all<{ level: string }>();
    expect(levels.results.map((r) => r.level)).toEqual(["builder", "builder"]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM milestone_baselines WHERE project_id = ? AND reason = 'integrated'").bind(id).first()).toEqual({
      n: 1,
    });
  });

  it("the team keeps phase milestones while integrated, and the partner completes it", async () => {
    const { env, id, dana, maya, theo } = await delivered();
    const milestones = [{ title: "Pilot in one depot", done: false }];
    expect((await call(env, maya.token, "PUT", `/projects/${id}/phase`, { milestones })).status).toBe(409);
    expect((await move(env, dana.token, id, "integrate")).status).toBe(200);
    const saved = await call(env, maya.token, "PUT", `/projects/${id}/phase`, { milestones });
    expect(saved.status).toBe(200);
    expect((await call(env, dana.token, "PUT", `/projects/${id}/phase`, { milestones })).status).toBe(403);
    expect((await call(env, theo.token, "POST", `/projects/${id}/complete`)).status).toBe(403);
    const done = await call(env, dana.token, "POST", `/projects/${id}/complete`);
    expect(done.status).toBe(200);
    expect(await status(env, id)).toBe("complete");
    expect(
      await env.DB.prepare("SELECT completed_at IS NOT NULL AS c FROM selections WHERE project_id = ?").bind(id).first(),
    ).toEqual({ c: 1 });
    expect((await call(env, dana.token, "POST", `/projects/${id}/complete`)).status).toBe(409);
  });

  it("integrate with a subset: only the chosen are promoted and hear in court; a locked level stays; a second integrate is refused", async () => {
    const s = await seed();
    const { env, rep, maya, eli, dana } = s;
    const sam = await signIn(env, "sam@mail.weber.edu", "Sam Ito");
    const id = await active(env, maya, rep, [eli.user.id, sam.user.id]);
    expect((await submit(env, maya.token, id)).status).toBe(201);
    expect((await move(env, rep.token, id, "approveWork")).status).toBe(200);
    await env.DB.prepare("UPDATE users SET level_locked = 1 WHERE id = ?").bind(sam.user.id).run();
    expect((await move(env, dana.token, id, "integrate", { memberIds: ["u_nobody"] })).status).toBe(400);
    expect((await move(env, dana.token, id, "integrate", { memberIds: [maya.user.id, sam.user.id] })).status).toBe(200);
    const level = async (uid: string) => (await env.DB.prepare("SELECT level FROM users WHERE id = ?").bind(uid).first<{ level: string }>())?.level;
    expect(await level(maya.user.id)).toBe("builder");
    expect(await level(sam.user.id)).toBe("sponsored");
    expect(await level(eli.user.id)).toBe("sponsored");
    const court = async (uid: string) =>
      (await env.DB.prepare("SELECT court FROM notifications WHERE user_id = ? AND kind = 'project.integrated'").bind(uid).all<{ court: number }>()).results;
    expect(await court(maya.user.id)).toEqual([{ court: 1 }]);
    expect(await court(sam.user.id)).toEqual([{ court: 1 }]);
    expect(await court(eli.user.id)).toEqual([{ court: 0 }]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'member.level_changed' AND payload LIKE '%builder%'").first()).toEqual({ n: 1 });
    expect((await move(env, dana.token, id, "integrate")).status).toBe(409);
  });

  it("a rep who is also a chosen member hears about integrate once, in court", async () => {
    const { env, id, dana, eli } = await delivered();
    await env.DB.prepare(`UPDATE users SET roles = '["member","rep"]' WHERE id = ?`).bind(eli.user.id).run();
    expect((await move(env, dana.token, id, "integrate")).status).toBe(200);
    expect(
      (await env.DB.prepare("SELECT court FROM notifications WHERE user_id = ? AND kind = 'project.integrated'").bind(eli.user.id).all()).results,
    ).toEqual([{ court: 1 }]);
  });

  it("an admin may integrate", async () => {
    const { env, id, admin } = await delivered();
    expect((await move(env, admin.token, id, "integrate")).status).toBe(200);
    expect(await status(env, id)).toBe("integrated");
  });

  it("the team asks for sign-off and the partner says not yet", async () => {
    const { env, id, dana, maya } = await delivered();
    expect((await move(env, dana.token, id, "integrate")).status).toBe(200);
    expect((await call(env, maya.token, "POST", `/projects/${id}/complete`)).status).toBe(403);
    expect((await move(env, maya.token, id, "requestCompletion")).status).toBe(200);
    expect(await status(env, id)).toBe("completion_review");
    expect(
      await env.DB.prepare("SELECT court FROM notifications WHERE user_id = 'u_dana' AND kind = 'project.completion_requested'").first(),
    ).toEqual({ court: 1 });
    expect((await move(env, dana.token, id, "returnCompletion")).status).toBe(400);
    expect((await move(env, dana.token, id, "returnCompletion", { feedback: "Pilot one more depot" })).status).toBe(200);
    expect(await status(env, id)).toBe("integrated");
    expect(
      await env.DB.prepare("SELECT court FROM notifications WHERE user_id = ? AND kind = 'project.completion_returned'").bind(maya.user.id).first(),
    ).toEqual({ court: 1 });
  });

  it("the partner asks to meet; staff mark it arranged; a second open request is refused", async () => {
    const { env, id, dana, rep, maya } = await delivered();
    expect((await call(env, maya.token, "POST", `/projects/${id}/meeting`, { message: "hi" })).status).toBe(403);
    const res = await call(env, dana.token, "POST", `/projects/${id}/meeting`, { message: "Coffee?" });
    expect(res.status).toBe(201);
    const { id: meetingId } = (await res.json()) as { id: string };
    expect((await call(env, dana.token, "POST", `/projects/${id}/meeting`, { message: "Again" })).status).toBe(409);
    // The board carries the request, for the partner and for staff, and the
    // posting's organization, so the page can show each their buttons.
    type Entry = { projectId: string; meeting: { id: string; status: string; message: string } | null; postingOrgId: string | null };
    const entry = async (token: string) =>
      ((await (await call(env, token, "GET", "/boards")).json()) as { projects: Entry[] }).projects.find((e) => e.projectId === id)!;
    const orgId = (await env.DB.prepare("SELECT org_id FROM users WHERE id = ?").bind(dana.user.id).first<{ org_id: string }>())!.org_id;
    expect(await entry(dana.token)).toMatchObject({ meeting: { id: meetingId, status: "requested", message: "Coffee?" }, postingOrgId: orgId });
    expect((await entry(rep.token)).meeting).toMatchObject({ id: meetingId, status: "requested" });
    expect((await call(env, maya.token, "POST", `/meetings/${meetingId}/arranged`)).status).toBe(403);
    expect((await call(env, rep.token, "POST", `/meetings/${meetingId}/arranged`)).status).toBe(200);
    expect(await env.DB.prepare("SELECT status FROM meetings WHERE id = ?").bind(meetingId).first()).toEqual({ status: "scheduled" });
    expect((await entry(dana.token)).meeting).toMatchObject({ id: meetingId, status: "scheduled" });
    // Once it is arranged the partner can ask again, and the board shows the new one.
    const again = await call(env, dana.token, "POST", `/projects/${id}/meeting`, { message: "Follow-up" });
    expect(again.status).toBe(201);
    const { id: secondId } = (await again.json()) as { id: string };
    expect((await entry(dana.token)).meeting).toMatchObject({ id: secondId, status: "requested", message: "Follow-up" });
  });
});

describe("routes", () => {
  it("the Ask endpoint still answers at the root", async () => {
    const env = makeEnv();
    const res = await call(env, null, "POST", "/", { messages: [{ role: "user", content: "What is the Lab?" }] });
    expect(res.status).not.toBe(404);
    await res.body?.cancel();
  });

  it("only an admin approves a partner in the app", async () => {
    const { env, rep, admin } = await seed();
    await env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES ('u_new', 'new@acme.example', 'New', 'partner', '[\"partner\"]', 'pending', ?)")
      .bind(AT)
      .run();
    expect((await call(env, rep.token, "POST", "/partners/u_new/approve")).status).toBe(403);
    expect((await call(env, admin.token, "POST", "/partners/u_new/approve")).status).toBe(200);
    expect(await env.DB.prepare("SELECT status FROM users WHERE id = 'u_new'").first()).toEqual({ status: "active" });
  });

  it("/queue and /problems are gone", async () => {
    const { env, rep, maya } = await seed();
    expect((await call(env, rep.token, "GET", "/queue")).status).toBe(404);
    expect((await call(env, maya.token, "GET", "/problems")).status).toBe(404);
    expect((await call(env, maya.token, "GET", "/claims/mine")).status).toBe(404);
  });

  it("/overview is the admin's: a rep is refused, the admin sees orgs and requests", async () => {
    const { env, rep, admin, maya } = await seed();
    await active(env, maya, rep);
    expect((await call(env, rep.token, "GET", "/overview")).status).toBe(403);
    const res = await call(env, admin.token, "GET", "/overview");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      problems: Array<{ id: string }>;
      claims: Array<{ id: string; status: string }>;
      people: Array<{ id: string; level: string | null }>;
      orgs: Array<{ id: string; name: string; people: number; primary: { id: string; name: string } | null }>;
      requests: unknown[];
    };
    expect(body.problems.map((p) => p.id)).toContain("P1");
    expect(body.claims).toEqual([expect.objectContaining({ status: "approved", projectStatus: "active" })]);
    expect(body.orgs).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "o_kestrel", name: "Kestrel", people: 1, primary: { id: "u_dana", name: "Dana Reyes" } })]),
    );
    expect(body.requests).toEqual([]);
    expect(body.people.find((p) => p.id === maya.user.id)?.level).toBe("sponsored");
    // The account routes are the admin's too.
    expect((await call(env, rep.token, "POST", `/accounts/${maya.user.id}/claude`, { granted: true })).status).toBe(403);
    expect((await call(env, admin.token, "POST", `/accounts/${maya.user.id}/claude`, { granted: true })).status).toBe(200);
  });

  it("a public profile reads the member's level and delivered work", async () => {
    const { env, rep, maya, dana } = await seed();
    await env.DB.prepare("UPDATE users SET handle = 'maya-lin', profile_public = 1 WHERE id = ?").bind(maya.user.id).run();
    const id = await active(env, maya, rep);
    let res = await call(env, null, "GET", "/profiles/maya-lin");
    expect(res.status).toBe(200);
    let body = (await res.json()) as { profile: { level: string; projects: Array<{ title: string; partner: string | null }> } };
    expect(body.profile.level).toBe("sponsored");
    expect(body.profile.projects).toEqual([]);
    await submit(env, maya.token, id);
    await move(env, rep.token, id, "approveWork");
    await move(env, dana.token, id, "integrate");
    res = await call(env, null, "GET", "/profiles/maya-lin");
    body = (await res.json()) as typeof body;
    expect(body.profile.level).toBe("builder");
    expect(body.profile.projects).toEqual([expect.objectContaining({ title: "Snow removal pricing", partner: "Kestrel" })]);
  });
});
