import { describe, it, expect, vi, afterEach } from "vitest";
import { makeEnv, applyMigrations, applyMigration, seedLegacy, signIn, call } from "./helpers";
import { ensureBoards } from "../src/projects";

type Env = ReturnType<typeof makeEnv>;
const AT = "2026-09-01T00:00:00.000Z";

type Review = { id: string; round: number; status: string; feedback: string };
type Plan = { approach: string; milestones: Array<{ title: string; criterion: string }>; finishBy: string };
type Project = {
  id: string;
  postingId: string;
  posting: { id: string; title: string; kind: string; org: { id: string; name: string } | null };
  status: string;
  plan: Plan;
  lead: { id: string; name: string };
  team: Array<{ id: string; name: string }>;
  boardId: string | null;
  transitions: string[];
  nextSteps: string | null;
  reviews: Review[];
  view: string;
};
type BoardData = { id: string; name: string; stage: string; plan: { thesis: string; reasoning: string; techStack: string; steps: Array<{ id: string; text: string; ownerId: string }> } | null };
type BoardEntry = {
  // Null for a colleague, who gets the brief.
  project: BoardData;
  brief: { id: string; name: string; description: string; thumbnail: string | null; stage: string; people: Array<{ id: string; name: string; role: string | null }> };
  submission: unknown;
  selection: unknown;
  owner: { id: string; name: string };
  onTeam: boolean;
  editable: boolean;
  projectId: string | null;
  status: string | null;
  postingId: string | null;
  postingTitle: string | null;
  view: string;
};

const PLAN: Plan = {
  approach: "Regression on five years of contract costs",
  milestones: [
    { title: "Clean data", criterion: "No gaps in five years" },
    { title: "Fit model", criterion: "Error under five percent" },
  ],
  finishBy: "2026-12-01",
};

async function reset(db: D1Database) {
  const tables = [
    "notifications", "events", "reviews", "milestone_baselines", "selections", "meetings", "submissions", "boards", "project_members",
    "projects", "postings", "org_requests", "sessions", "login_codes", "users", "orgs",
  ];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

// Kestrel (dana) with a live posting P1, a partner at Cinder, two reps, three
// members (sam is also a rep), and an admin.
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
  const rep2 = await signIn(env, "ann@weber.edu", "Ann Rook");
  const maya = await signIn(env, "maya@mail.weber.edu", "Maya Lin");
  const eli = await signIn(env, "eli@mail.weber.edu", "Eli Park");
  const sam = await signIn(env, "sam@mail.weber.edu", "Sam Ito");
  const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  await env.DB.prepare(`UPDATE users SET roles = '["member","rep"]' WHERE id = ?`).bind(sam.user.id).run();
  return { env, dana, theo, rep, rep2, maya, eli, sam, admin };
}

const claim = (env: Env, token: string, teammates?: string[]) =>
  call(env, token, "POST", "/postings/P1/claim", teammates ? { teammates } : {});
const getProject = (env: Env, token: string, id: string) => call(env, token, "GET", `/projects/${id}`);
const project = async (env: Env, token: string, id: string) => (await (await getProject(env, token, id)).json()) as Project;
const move = (env: Env, token: string, id: string, name: string, feedback?: string) =>
  call(env, token, "POST", `/projects/${id}/transition`, feedback === undefined ? { name } : { name, feedback });
const boards = async (env: Env, token: string) => ((await (await call(env, token, "GET", "/boards")).json()) as { projects: BoardEntry[] }).projects;
const notes = async (env: Env, userId: string, kind: string) =>
  (
    await env.DB.prepare("SELECT court, title, href FROM notifications WHERE user_id = ? AND kind = ? ORDER BY created_at")
      .bind(userId, kind)
      .all<{ court: number; title: string; href: string }>()
  ).results;
const boardStage = async (env: Env, projectId: string) =>
  (await env.DB.prepare("SELECT json_extract(data, '$.stage') AS stage FROM boards WHERE project_id = ?").bind(projectId).first<{ stage: string }>())
    ?.stage;

// Claims P1 as maya (with teammates), writes PLAN and submits it.
async function inReview(env: Env, token: string, teammates?: string[]): Promise<string> {
  const res = await claim(env, token, teammates);
  expect(res.status).toBe(201);
  const { id } = (await res.json()) as { id: string };
  expect((await call(env, token, "PUT", `/projects/${id}/plan`, PLAN)).status).toBe(200);
  expect((await move(env, token, id, "submitPlan")).status).toBe(200);
  return id;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("projects", () => {
  it("a member claims a live posting: a claimed project with a board in Solidifying", async () => {
    const { env, dana, theo, maya, eli } = await seed();
    const res = await claim(env, maya.token);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };

    const p = await project(env, maya.token, id);
    expect(p).toMatchObject({
      postingId: "P1",
      posting: { id: "P1", title: "Snow removal pricing", kind: "partner", org: { id: "o_kestrel", name: "Kestrel" } },
      status: "claimed",
      plan: { approach: "", milestones: [], finishBy: "" },
      lead: { id: maya.user.id, name: "Maya Lin" },
      team: [{ id: maya.user.id, name: "Maya Lin" }],
      nextSteps: "project.claimed.member",
      reviews: [],
      view: "full",
    });
    expect(p.boardId).toEqual(expect.any(String));
    expect(p.transitions.sort()).toEqual(["submitPlan", "withdraw"]);
    expect(await boardStage(env, id)).toBe("solidifying");

    const outline = await project(env, eli.token, id);
    expect(outline).toMatchObject({ view: "colleague", status: "claimed", reviews: [], transitions: [], boardId: null });
    expect((await getProject(env, dana.token, id)).status).toBe(404);
    expect((await getProject(env, theo.token, id)).status).toBe(404);

    // The organization hears about it, outside its court.
    expect(await notes(env, "u_dana", "project.claimed")).toEqual([expect.objectContaining({ court: 0 })]);

    // Claiming again returns the same project.
    const again = await claim(env, maya.token);
    expect(again.status).toBe(200);
    expect(((await again.json()) as { id: string }).id).toBe(id);

    // No one holds two projects on one posting.
    const twice = await claim(env, eli.token, [maya.user.id]);
    expect(twice.status).toBe(409);
    expect(await twice.json()).toEqual({ error: "already-claimed" });
    expect((await claim(env, eli.token, ["nobody"])).status).toBe(400);
    expect((await claim(env, dana.token)).status).toBe(403);

    const mine = await boards(env, maya.token);
    expect(mine).toEqual([
      expect.objectContaining({ projectId: id, status: "claimed", postingId: "P1", postingTitle: "Snow removal pricing", view: "full", onTeam: true, editable: true }),
    ]);
    expect(mine[0].project.stage).toBe("solidifying");
    expect(mine[0].project.id).toBe(p.boardId);
    // Colleagues and the partner see no board before the plan is approved.
    expect(await boards(env, eli.token)).toEqual([]);
    expect(await boards(env, dana.token)).toEqual([]);

    const listed = (await (await call(env, maya.token, "GET", "/projects/mine")).json()) as { projects: Project[] };
    expect(listed.projects.map((x) => x.id)).toEqual([id]);
  });

  it("the plan saves to the project and the board, and an empty plan cannot be submitted", async () => {
    const { env, maya, eli } = await seed();
    const { id } = (await (await claim(env, maya.token)).json()) as { id: string };
    const empty = await move(env, maya.token, id, "submitPlan");
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: "plan", issues: ["approach", "milestones"] });

    expect((await call(env, eli.token, "PUT", `/projects/${id}/plan`, PLAN)).status).toBe(403);
    const saved = await call(env, maya.token, "PUT", `/projects/${id}/plan`, PLAN);
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as Project).plan).toEqual(PLAN);
    const [b] = await boards(env, maya.token);
    expect(b.project.plan).toMatchObject({
      thesis: PLAN.approach,
      steps: [
        { id: "m1", text: "Clean data. No gaps in five years", ownerId: maya.user.id },
        { id: "m2", text: "Fit model. Error under five percent", ownerId: maya.user.id },
      ],
    });

    // Editing the board while claimed carries the plan back, criteria kept.
    const board = b.project;
    board.plan!.thesis = "Gradient boosting on five years of costs";
    board.plan!.steps = [board.plan!.steps[0], { id: "m3", text: "Ship it. Dana signs off", ownerId: maya.user.id }];
    const put = await call(env, maya.token, "PUT", `/boards/${board.id}`, { project: board });
    expect(put.status).toBe(200);
    expect((await project(env, maya.token, id)).plan).toEqual({
      approach: "Gradient boosting on five years of costs",
      milestones: [
        { title: "Clean data", criterion: "No gaps in five years" },
        { title: "Ship it", criterion: "Dana signs off" },
      ],
      finishBy: PLAN.finishBy,
    });
    expect((await call(env, eli.token, "PUT", `/boards/${board.id}`, { project: board })).status).toBe(403);
  });

  it("the action-plan gate: submit, own-project refusal, return with notes, round 2, approve", async () => {
    const { env, dana, rep, rep2, maya, sam, eli } = await seed();
    const sent: Array<{ to: string[]; subject: string; text: string }> = [];
    env.RESEND_API_KEY = "test";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sent.push(JSON.parse(String((init as RequestInit).body)));
      return new Response("{}", { status: 200 });
    });
    const id = await inReview(env, maya.token, [sam.user.id]);

    expect((await project(env, maya.token, id)).status).toBe("plan_review");
    const rounds = async () =>
      (await env.DB.prepare("SELECT round, status, feedback FROM reviews WHERE gate = 'action_plan' AND subject_id = ? ORDER BY round").bind(id).all())
        .results;
    expect(await rounds()).toEqual([{ round: 1, status: "open", feedback: "" }]);
    const base = await env.DB.prepare("SELECT reason, snapshot FROM milestone_baselines WHERE project_id = ?").bind(id).all<{ reason: string; snapshot: string }>();
    expect(base.results.map((r) => [r.reason, JSON.parse(r.snapshot)])).toEqual([["plan_submitted", PLAN.milestones]]);
    const review = await env.DB.prepare("SELECT id FROM reviews WHERE subject_id = ? AND status = 'open'").bind(id).first<{ id: string }>();
    expect(await notes(env, rep.user.id, "project.plan_submitted")).toEqual([
      { court: 1, title: "Maya Lin submitted an action plan for “Snow removal pricing”", href: `/projectum?view=review&id=${review!.id}` },
    ]);
    expect(sent.map((m) => m.to[0])).toEqual([env.APPROVER_EMAIL]);
    // A rep on the team is not asked to review it.
    expect(await notes(env, sam.user.id, "project.plan_submitted")).toEqual([]);
    expect(await boardStage(env, id)).toBe("solidifying");

    // The team's board holds still while the plan is in review.
    const [b] = await boards(env, maya.token);
    expect(b.editable).toBe(false);
    expect((await call(env, maya.token, "PUT", `/boards/${b.project.id}`, { project: b.project })).status).toBe(409);
    expect((await call(env, maya.token, "PUT", `/projects/${id}/plan`, PLAN)).status).toBe(409);

    // A rep on the team cannot decide on it (Review Focus 4).
    const own = await move(env, sam.token, id, "approvePlan");
    expect(own.status).toBe(403);
    expect(await own.json()).toEqual({ error: "own-project" });

    expect((await move(env, rep2.token, id, "returnPlan")).status).toBe(400);
    expect((await move(env, rep2.token, id, "returnPlan", "Say how you will test the model.")).status).toBe(200);
    // Returned: editable again, notes visible to the lead (Review Focus 3).
    const back = await project(env, maya.token, id);
    expect(back.status).toBe("plan_returned");
    expect(back.nextSteps).toBe("project.plan_returned.member");
    expect(back.reviews[0]).toMatchObject({ round: 1, status: "returned", feedback: "Say how you will test the model." });
    expect((await boards(env, maya.token))[0].editable).toBe(true);
    expect((await call(env, maya.token, "PUT", `/boards/${b.project.id}`, { project: b.project })).status).toBe(200);
    expect(await notes(env, maya.user.id, "project.plan_returned")).toEqual([
      { court: 1, title: "Your plan for “Snow removal pricing” came back with notes", href: "/projectum?view=myprojects" },
    ]);
    expect(sent.at(-1)!.text).toContain("Say how you will test the model.");

    expect((await move(env, maya.token, id, "submitPlan")).status).toBe(200);
    expect(await rounds()).toEqual([
      { round: 1, status: "returned", feedback: "Say how you will test the model." },
      { round: 2, status: "open", feedback: "" },
    ]);
    // Partners see nothing of a plan in review.
    expect((await (await call(env, dana.token, "GET", "/projects?posting=P1")).json()) as { projects: Project[] }).toEqual({ projects: [] });

    expect((await move(env, rep.token, id, "approvePlan", "Good plan")).status).toBe(200);
    const live = await project(env, maya.token, id);
    expect(live.status).toBe("active");
    expect(live.reviews[0]).toMatchObject({ round: 2, status: "approved", feedback: "Good plan" });
    const levels = await env.DB.prepare("SELECT id, level FROM users WHERE id IN (?, ?)").bind(maya.user.id, sam.user.id).all<{ level: string }>();
    expect(levels.results.map((r) => r.level)).toEqual(["sponsored", "sponsored"]);
    expect(await notes(env, maya.user.id, "member.level_changed")).toHaveLength(1);
    expect(await notes(env, maya.user.id, "project.plan_approved")).toEqual([
      { court: 1, title: "Your plan for “Snow removal pricing” was approved. Your board is open.", href: `/projectum?project=${live.boardId}` },
    ]);
    expect(await notes(env, "u_dana", "project.plan_approved")).toEqual([expect.objectContaining({ court: 0 })]);
    expect(sent.filter((m) => m.to[0] === "maya@mail.weber.edu").at(-1)!.subject).toContain("approved");

    const partner = await project(env, dana.token, id);
    expect(partner).toMatchObject({ view: "partner", status: "active", reviews: [] });
    expect(partner.plan).toEqual(PLAN);
    const onPosting = (await (await call(env, dana.token, "GET", "/projects?posting=P1")).json()) as { projects: Project[] };
    expect(onPosting.projects.map((x) => x.id)).toEqual([id]);
    expect((await boards(env, dana.token)).map((x) => x.view)).toEqual(["partner"]);
    // A colleague gets the card, never the board or the Lab's notes.
    await env.DB.prepare(
      "INSERT INTO submissions (id, project_id, board_id, submitted_by, report_name, report_size, status, review_note, created_at) " +
        "VALUES ('s_1', ?, ?, ?, 'r.pdf', 10, 'returned', 'Secret notes for the team', ?)",
    )
      .bind(id, live.boardId, maya.user.id, AT)
      .run();
    const seen = await boards(env, eli.token);
    expect(seen).toEqual([
      expect.objectContaining({ view: "colleague", project: null, submission: null, selection: null, editable: false, onTeam: false }),
    ]);
    expect(seen[0].brief).toMatchObject({ id: live.boardId, name: "Snow removal pricing", stage: "solidifying" });
    expect(seen[0].brief.people.map((p) => p.id).sort()).toEqual([maya.user.id, sam.user.id].sort());
    const text = JSON.stringify(seen[0]);
    expect(text).not.toContain("reviewNote");
    expect(text).not.toContain("Secret notes");
    expect(text).not.toContain(PLAN.approach);
    // The team still gets the board and the notes.
    expect((await boards(env, maya.token))[0].submission).toMatchObject({ reviewNote: "Secret notes for the team" });
    const base2 = await env.DB.prepare("SELECT reason FROM milestone_baselines WHERE project_id = ? ORDER BY taken_at, reason").bind(id).all<{ reason: string }>();
    expect(base2.results.map((r) => r.reason).sort()).toEqual(["plan_approved", "plan_submitted", "plan_submitted"]);
  });

  it("two reps approve at once: one wins, the team hears once (Review Focus 1)", async () => {
    const { env, rep, rep2, maya, eli } = await seed();
    const id = await inReview(env, maya.token, [eli.user.id]);
    const results = await Promise.all([move(env, rep.token, id, "approvePlan"), move(env, rep2.token, id, "approvePlan")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const lost = results.find((r) => r.status === 409)!;
    expect(await lost.json()).toEqual({ error: "state" });
    expect(await notes(env, maya.user.id, "project.plan_approved")).toHaveLength(1);
    expect(await notes(env, eli.user.id, "project.plan_approved")).toHaveLength(1);
    expect(await notes(env, eli.user.id, "member.level_changed")).toHaveLength(1);
  });

  it("approval leaves locked and already sponsored members alone, and tells only those promoted", async () => {
    const { env, rep, maya, eli, sam } = await seed();
    const id = await inReview(env, maya.token, [eli.user.id, sam.user.id]);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET level_locked = 1 WHERE id = ?").bind(eli.user.id),
      env.DB.prepare("UPDATE users SET level = 'sponsored' WHERE id = ?").bind(sam.user.id),
    ]);
    expect((await move(env, rep.token, id, "approvePlan")).status).toBe(200);
    const level = async (uid: string) => (await env.DB.prepare("SELECT level FROM users WHERE id = ?").bind(uid).first<{ level: string }>())!.level;
    expect([await level(maya.user.id), await level(eli.user.id), await level(sam.user.id)]).toEqual(["sponsored", "affiliate", "sponsored"]);
    expect(await notes(env, maya.user.id, "member.level_changed")).toHaveLength(1);
    expect(await notes(env, eli.user.id, "member.level_changed")).toEqual([]);
    expect(await notes(env, sam.user.id, "member.level_changed")).toEqual([]);
  });

  it("withdraw from active closes open reviews and the board", async () => {
    const { env, rep, maya } = await seed();
    const id = await inReview(env, maya.token);
    expect((await move(env, rep.token, id, "approvePlan")).status).toBe(200);
    await env.DB.prepare("INSERT INTO reviews (id, gate, subject_id, round, status, opened_at) VALUES ('r_sub', 'submission', ?, 1, 'open', ?)")
      .bind(id, AT)
      .run();
    const [b] = await boards(env, maya.token);
    expect((await move(env, maya.token, id, "withdraw")).status).toBe(200);
    const row = await env.DB.prepare("SELECT status, withdrawn_at FROM projects WHERE id = ?").bind(id).first<{ status: string; withdrawn_at: string }>();
    expect(row).toMatchObject({ status: "withdrawn", withdrawn_at: expect.any(String) });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM reviews WHERE subject_id = ? AND status = 'open'").bind(id).first<{ n: number }>())!.n).toBe(0);
    expect(await env.DB.prepare("SELECT status FROM reviews WHERE id = 'r_sub'").first()).toEqual({ status: "withdrawn" });
    expect(await notes(env, "u_dana", "project.withdrawn")).toEqual([expect.objectContaining({ court: 0 })]);
    expect((await call(env, maya.token, "PUT", `/boards/${b.project.id}`, { project: b.project })).status).toBe(403);
    // A withdrawn project frees the posting for a new claim, a new project.
    const again = await claim(env, maya.token);
    expect(again.status).toBe(201);
    expect(((await again.json()) as { id: string }).id).not.toBe(id);
  });

  it("a member proposes their own project: a closed self posting, the project and a board", async () => {
    const { env, maya, eli, dana } = await seed();
    const res = await call(env, maya.token, "POST", "/proposals", {
      posting: { title: "Campus parking model", summary: "Predict where parking runs out each morning", disciplines: ["mathematics"] },
      plan: PLAN,
      teammates: [eli.user.id],
    });
    expect(res.status).toBe(201);
    const { id, postingId } = (await res.json()) as { id: string; postingId: string };
    expect(
      await env.DB.prepare("SELECT kind, status, show_on_profile, org_id, author_id, closed_at IS NOT NULL AS closed FROM postings WHERE id = ?")
        .bind(postingId)
        .first(),
    ).toEqual({ kind: "self", status: "closed", show_on_profile: 0, org_id: null, author_id: maya.user.id, closed: 1 });
    const p = await project(env, maya.token, id);
    expect(p).toMatchObject({ status: "claimed", plan: PLAN, posting: { kind: "self", org: null }, view: "full" });
    expect(p.team.map((t) => t.id).sort()).toEqual([maya.user.id, eli.user.id].sort());
    expect((await project(env, eli.token, id)).view).toBe("full");
    expect((await getProject(env, dana.token, id)).status).toBe(404);
    expect(await boardStage(env, id)).toBe("solidifying");
    const bad = await call(env, maya.token, "POST", "/proposals", { posting: { title: "x" } });
    expect(bad.status).toBe(400);
    expect((await call(env, dana.token, "POST", "/proposals", { posting: { title: "Partner idea" } })).status).toBe(403);
  });

  it("boards with no project are listed to their owner and admins", async () => {
    const { env, maya, eli, admin } = await seed();
    const data = JSON.stringify({ id: "B0", name: "Sketch", stage: "brainstorming" });
    await env.DB.prepare("INSERT INTO boards (id, project_id, owner_id, data, created_at, updated_at) VALUES ('B0', NULL, ?, ?, ?, ?)")
      .bind(maya.user.id, data, AT, AT)
      .run();
    expect(await boards(env, maya.token)).toEqual([
      expect.objectContaining({ projectId: null, status: null, postingId: null, view: "full", editable: true, onTeam: true }),
    ]);
    expect(await boards(env, eli.token)).toEqual([]);
    expect((await boards(env, admin.token)).map((b) => b.project.id)).toEqual(["B0"]);
    const [b] = await boards(env, maya.token);
    expect((await call(env, maya.token, "PUT", "/boards/B0", { project: { ...b.project, name: "Sketch two" } })).status).toBe(200);
    expect((await call(env, eli.token, "PUT", "/boards/B0", { project: b.project })).status).toBe(403);
    expect((await call(env, maya.token, "DELETE", "/boards/B0")).status).toBe(403);
    expect((await call(env, admin.token, "DELETE", "/boards/B0")).status).toBe(200);
    expect(await boards(env, maya.token)).toEqual([]);
    expect((await call(env, admin.token, "DELETE", "/boards/B0")).status).toBe(404);

    // A project's board stays: ensureBoards would only make it again.
    const { id } = (await (await claim(env, maya.token)).json()) as { id: string };
    const [owned] = await boards(env, maya.token);
    const refused = await call(env, admin.token, "DELETE", `/boards/${owned.project.id}`);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "has-project" });
    expect(await boardStage(env, id)).toBe("solidifying");
  });
});

describe("ensureBoards", () => {
  it("makes the boards migrated projects in play are missing, C2 among them, and none for a withdrawn one", async () => {
    const env = makeEnv();
    await seedLegacy(env.DB);
    await applyMigration(env.DB, "0010_gates_and_orgs.sql");
    expect(await env.DB.prepare("SELECT 1 FROM boards WHERE project_id = 'C2'").first()).toBeNull();
    expect(await ensureBoards(env)).toBe(3); // C2, C3 and C6; C5 is withdrawn
    const board = await env.DB.prepare("SELECT owner_id, data FROM boards WHERE project_id = 'C2'").first<{ owner_id: string; data: string }>();
    expect(board!.owner_id).toBe("u_eli");
    expect(JSON.parse(board!.data)).toMatchObject({ name: "P1", stage: "solidifying", plan: { thesis: "C2" } });
    expect(await ensureBoards(env)).toBe(0);
    expect(await env.DB.prepare("SELECT 1 FROM boards WHERE project_id = 'C5'").first()).toBeNull();
    const missing = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM projects p WHERE p.status NOT IN ('withdrawn', 'complete') AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.project_id = p.id)",
    ).first<{ n: number }>();
    expect(missing!.n).toBe(0);
  });
});
