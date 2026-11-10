import { describe, it, expect, vi, afterEach } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";

type Env = ReturnType<typeof makeEnv>;
const AT = "2026-09-01T00:00:00.000Z";

type Review = { id: string; round: number; status: string; feedback: string };
type Posting = {
  id: string;
  orgId: string | null;
  org: { id: string; name: string; slug: string } | null;
  author: { id: string; name: string };
  title: string;
  why: string;
  status: string;
  disciplines: string[];
  publishedAt: string | null;
  closedAt: string | null;
  counts: { open: number; delivered: number };
  myProject: { id: string; status: string; boardId: string | null } | null;
  transitions: string[];
  nextSteps: string | null;
  reviews: Review[];
};

// Tests in a file share one database, so each starts from no rows.
async function reset(db: D1Database) {
  const tables = [
    "notifications", "events", "reviews", "milestone_baselines", "boards", "project_members", "projects", "postings",
    "org_requests", "sessions", "login_codes", "users", "orgs",
  ];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

// Kestrel with dana as its primary, the Lab org, a rep, two members who
// follow different disciplines, an admin, and a partner at another org.
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
        ('o_cinder', 'cinder-example', 'Cinder', 'company', 'cinder.example', 'u_theo', ?),
        ('org_lab', 'applied-ai-lab', 'Applied AI Lab', 'lab', 'weber.edu', NULL, ?)`,
    ).bind(AT, AT, AT),
    env.DB.prepare("UPDATE users SET org_id = 'o_kestrel' WHERE id = 'u_dana'"),
    env.DB.prepare("UPDATE users SET org_id = 'o_cinder' WHERE id = 'u_theo'"),
  ]);
  const dana = await signIn(env, "dana@kestrel.example");
  const theo = await signIn(env, "theo@cinder.example");
  const rep = await signIn(env, "prof@weber.edu", "Pat Prof");
  const maya = await signIn(env, "maya@mail.weber.edu", "Maya Lin");
  const eli = await signIn(env, "eli@mail.weber.edu", "Eli Park");
  const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET interests = '["finance"]' WHERE email = 'maya@mail.weber.edu'`),
    env.DB.prepare(`UPDATE users SET interests = '["design"]' WHERE email = 'eli@mail.weber.edu'`),
  ]);
  return { env, dana, theo, rep, maya, eli, admin };
}

const READY = {
  title: "Snow removal pricing",
  summary: "An annual price model for snow removal contracts",
  details: "We bid by the push today.",
  disciplines: ["finance", "astrology"],
  tags: ["Pricing"],
  effort: "medium",
  deliverable: "A spreadsheet model",
  deadline: "2026-12-01",
};

const get = async (env: Env, token: string, id: string) => (await (await call(env, token, "GET", `/postings/${id}`)).json()) as Posting;
const move = (env: Env, token: string, id: string, name: string, feedback?: string) =>
  call(env, token, "POST", `/postings/${id}/transition`, feedback === undefined ? { name } : { name, feedback });
const notes = async (env: Env, userId: string, kind: string) =>
  (
    await env.DB.prepare("SELECT court, title, href FROM notifications WHERE user_id = ? AND kind = ? ORDER BY created_at")
      .bind(userId, kind)
      .all<{ court: number; title: string; href: string }>()
  ).results;

// Sends READY for review as dana; returns the posting id.
async function inReview(env: Env, token: string): Promise<string> {
  const res = await call(env, token, "POST", "/postings", { ...READY, send: true });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postings", () => {
  it("a partner saves a draft, and a draft needs only a title", async () => {
    const { env, dana } = await seed();
    expect((await call(env, dana.token, "POST", "/postings", { summary: "No title" })).status).toBe(400);
    const res = await call(env, dana.token, "POST", "/postings", { title: "Snow", send: false });
    expect(res.status).toBe(201);
    const { id, status } = (await res.json()) as { id: string; status: string };
    expect(status).toBe("draft");
    const p = await get(env, dana.token, id);
    expect(p).toMatchObject({
      orgId: "o_kestrel",
      org: { id: "o_kestrel", name: "Kestrel", slug: "kestrel-example" },
      author: { id: "u_dana", name: "Dana Reyes" },
      status: "draft",
      nextSteps: "posting.draft.partner",
      reviews: [],
      counts: { open: 0, delivered: 0 },
      myProject: null,
    });
    expect(p.transitions.sort()).toEqual(["archive", "submit"]);
  });

  it("the seven detail fields round-trip, and are empty when omitted", async () => {
    const { env, dana } = await seed();
    const detail = {
      businessModel: "Per-push contracts",
      why: "Margins swing with the weather",
      dependencies: "Two years of invoices",
      achieves: "A price we can defend",
      goal: "Quote annual contracts",
      keyMilestones: "Data pulled, model built, model tested",
      driveUrl: "https://drive.google.com/drive/folders/abc",
    };
    const res = await call(env, dana.token, "POST", "/postings", { title: "Snow", ...detail });
    const { id } = (await res.json()) as { id: string };
    expect(await get(env, dana.token, id)).toMatchObject(detail);
    const bare = (await (await call(env, dana.token, "POST", "/postings", { title: "Bare" })).json()) as { id: string };
    expect(await get(env, dana.token, bare.id)).toMatchObject({
      businessModel: "", why: "", dependencies: "", achieves: "", goal: "", keyMilestones: "", driveUrl: "",
    });
    // An edit that leaves them out keeps them, and one that sends them changes them.
    await call(env, dana.token, "PATCH", `/postings/${id}`, { title: "Snow 2" });
    expect(await get(env, dana.token, id)).toMatchObject(detail);
    await call(env, dana.token, "PATCH", `/postings/${id}`, { why: "New reason", driveUrl: "" });
    expect(await get(env, dana.token, id)).toMatchObject({ ...detail, why: "New reason", driveUrl: "" });
  });

  it("refuses a Drive link that is not https, and detail text over the limit", async () => {
    const { env, dana } = await seed();
    for (const driveUrl of ["javascript:alert(1)", "http://drive.google.com/x", "data:text/html,hi", "drive.google.com/x", "https://"]) {
      const res = await call(env, dana.token, "POST", "/postings", { title: "Snow", driveUrl });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "plan", issues: ["driveUrl"] });
    }
    const made = (await (await call(env, dana.token, "POST", "/postings", { title: "Snow" })).json()) as { id: string };
    expect((await call(env, dana.token, "PATCH", `/postings/${made.id}`, { driveUrl: "javascript:alert(1)" })).status).toBe(400);
    // Over-long text is cut to the limit rather than refused.
    await call(env, dana.token, "PATCH", `/postings/${made.id}`, { why: "x".repeat(2001) });
    expect((await get(env, dana.token, made.id)).why).toHaveLength(2000);
  });

  it("sending an incomplete draft refuses with the issues and keeps the draft", async () => {
    const { env, dana } = await seed();
    const res = await call(env, dana.token, "POST", "/postings", { title: "Snow", send: true });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: string[]; id: string };
    expect(body).toMatchObject({ error: "plan", issues: ["summary", "disciplines"] });
    const row = await env.DB.prepare("SELECT status FROM postings WHERE id = ?").bind(body.id).first<{ status: string }>();
    expect(row).toEqual({ status: "draft" });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM reviews").first()).toEqual({ n: 0 });
  });

  it("send: true puts it in review with a round-1 review a rep sees, and tells the reps", async () => {
    const { env, dana, rep } = await seed();
    const id = await inReview(env, dana.token);
    const reviews = (await env.DB.prepare("SELECT id, gate, round, status, snapshot FROM reviews WHERE subject_id = ?").bind(id).all<Record<string, string | number>>()).results;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ gate: "posting", round: 1, status: "open" });
    expect(JSON.parse(reviews[0].snapshot as string)).toMatchObject({ title: READY.title, disciplines: ["finance"], tags: ["pricing"] });

    const seen = await get(env, rep.token, id);
    expect(seen.status).toBe("in_review");
    expect(seen.reviews).toEqual([expect.objectContaining({ id: reviews[0].id, round: 1, status: "open" })]);
    expect(seen.transitions.sort()).toEqual(["approve", "return"]);
    expect((await get(env, dana.token, id)).transitions).toEqual(["withdraw"]);

    expect(await notes(env, rep.user.id, "posting.submitted")).toEqual([
      { court: 1, title: `Kestrel sent “${READY.title}” for review`, href: `/projectum?view=review&id=${reviews[0].id}` },
    ]);
  });

  it("the org cannot edit while in review; withdrawing closes the review", async () => {
    const { env, dana } = await seed();
    const id = await inReview(env, dana.token);
    const patch = await call(env, dana.token, "PATCH", `/postings/${id}`, { title: "Changed" });
    expect(patch.status).toBe(409);
    expect(await patch.json()).toEqual({ error: "state" });
    expect((await move(env, dana.token, id, "withdraw")).status).toBe(200);
    expect(await env.DB.prepare("SELECT status FROM reviews WHERE subject_id = ?").bind(id).first()).toEqual({ status: "withdrawn" });
    const ok = await call(env, dana.token, "PATCH", `/postings/${id}`, { title: "Changed" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as Posting).title).toBe("Changed");
  });

  it("a rep returns with notes, the partner sees them, resubmits for round 2, and the rep publishes", async () => {
    const { env, dana, rep, maya, eli } = await seed();
    const sent: Array<{ to: string[]; subject: string; text: string }> = [];
    env.RESEND_API_KEY = "test";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sent.push(JSON.parse(String((init as RequestInit).body)));
      return new Response("{}", { status: 200 });
    });
    const id = await inReview(env, dana.token);
    expect(sent.map((m) => m.to[0])).toEqual([env.APPROVER_EMAIL]);
    expect(sent[0].text).toContain(`${env.SITE_URL}/projectum?view=review&id=`);

    const bare = await move(env, rep.token, id, "return");
    expect(bare.status).toBe(400);
    expect(await bare.json()).toMatchObject({ error: "feedback" });

    expect((await move(env, rep.token, id, "return", "Say what the model is for.")).status).toBe(200);
    const back = await get(env, dana.token, id);
    expect(back.status).toBe("returned");
    expect(back.nextSteps).toBe("posting.returned.partner");
    expect(back.reviews[0]).toMatchObject({ round: 1, status: "returned", feedback: "Say what the model is for." });
    expect(await notes(env, "u_dana", "posting.returned")).toEqual([expect.objectContaining({ court: 1 })]);
    expect(sent.at(-1)!.to).toEqual(["dana@kestrel.example"]);

    expect((await move(env, dana.token, id, "submit")).status).toBe(200);
    const rounds = (await env.DB.prepare("SELECT round, status FROM reviews WHERE subject_id = ? ORDER BY round").bind(id).all()).results;
    expect(rounds).toEqual([{ round: 1, status: "returned" }, { round: 2, status: "open" }]);

    // A member sees nothing until it is live.
    expect((await call(env, maya.token, "GET", `/postings/${id}`)).status).toBe(404);
    expect((await move(env, rep.token, id, "approve", "Looks good")).status).toBe(200);
    const live = await get(env, maya.token, id);
    expect(live.status).toBe("live");
    expect(live.publishedAt).toEqual(expect.any(String));
    // Members do not see the reviews.
    expect(live.reviews).toEqual([]);
    const board = (await (await call(env, maya.token, "GET", "/postings?scope=board")).json()) as { postings: Posting[] };
    expect(board.postings.map((p) => p.id)).toEqual([id]);
    expect((await env.DB.prepare("SELECT status, feedback FROM reviews WHERE subject_id = ? AND round = 2").bind(id).first())).toEqual({
      status: "approved",
      feedback: "Looks good",
    });

    expect(await notes(env, "u_dana", "posting.published")).toEqual([
      expect.objectContaining({ court: 0, title: `“${READY.title}” is live on the notice board` }),
    ]);
    expect(await notes(env, maya.user.id, "posting.published")).toEqual([expect.objectContaining({ court: 0, title: `New on the board: ${READY.title}` })]);
    expect(await notes(env, eli.user.id, "posting.published")).toEqual([]);
    expect(sent.at(-1)!.to).toEqual(["dana@kestrel.example"]);
    expect(sent.every((m) => !m.text.includes("—"))).toBe(true);
  });

  it("only the org or an admin edits; members and other partners cannot", async () => {
    const { env, dana, rep, maya, theo, admin } = await seed();
    const id = await inReview(env, dana.token);
    await move(env, rep.token, id, "approve");
    expect((await call(env, maya.token, "PATCH", `/postings/${id}`, { title: "Mine now" })).status).toBe(403);
    expect((await call(env, theo.token, "PATCH", `/postings/${id}`, { title: "Mine now" })).status).toBe(404);
    expect((await call(env, theo.token, "GET", `/postings/${id}`)).status).toBe(404);
    expect((await call(env, admin.token, "PATCH", `/postings/${id}`, { summary: "An admin can fix a typo in the summary" })).status).toBe(200);
    expect((await call(env, maya.token, "POST", "/postings", READY)).status).toBe(403);
  });

  it("closing tells members on open projects; counts and myProject reflect them", async () => {
    const { env, dana, rep, maya, eli } = await seed();
    const id = await inReview(env, dana.token);
    await move(env, rep.token, id, "approve");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO projects (id, posting_id, lead_id, status, claimed_at, updated_at) VALUES ('J1', ?, ?, 'active', ?, ?)").bind(id, maya.user.id, AT, AT),
      env.DB.prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES ('J1', ?, 'lead', ?)").bind(maya.user.id, AT),
      env.DB.prepare("INSERT INTO boards (id, project_id, owner_id, data, created_at, updated_at) VALUES ('B1', 'J1', ?, '{}', ?, ?)").bind(maya.user.id, AT, AT),
      // Eli's work is already delivered: closing does not concern him.
      env.DB.prepare("INSERT INTO projects (id, posting_id, lead_id, status, claimed_at, updated_at) VALUES ('J2', ?, ?, 'delivered', ?, ?)").bind(id, eli.user.id, AT, AT),
      env.DB.prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES ('J2', ?, 'lead', ?)").bind(eli.user.id, AT),
    ]);
    const before = await get(env, maya.token, id);
    expect(before.counts).toEqual({ open: 1, delivered: 1 });
    // myProject carries the board, for the notice board's "You're on this" link.
    expect(before.myProject).toEqual({ id: "J1", status: "active", boardId: "B1" });
    expect((await get(env, eli.token, id)).myProject).toEqual({ id: "J2", status: "delivered", boardId: null });

    expect((await move(env, maya.token, id, "close")).status).toBe(403);
    expect((await move(env, dana.token, id, "close")).status).toBe(200);
    const closed = await get(env, dana.token, id);
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toEqual(expect.any(String));
    expect(await notes(env, maya.user.id, "posting.closed")).toEqual([expect.objectContaining({ title: expect.stringContaining("closed to new claims") })]);
    expect(await notes(env, eli.user.id, "posting.closed")).toEqual([]);
    // Closed postings leave the board but stay visible to members.
    expect(((await (await call(env, maya.token, "GET", "/postings?scope=board")).json()) as { postings: Posting[] }).postings).toEqual([]);
    expect((await call(env, maya.token, "GET", `/postings/${id}`)).status).toBe(200);
  });

  it("lists by scope: mine for the org, all for staff only", async () => {
    const { env, dana, theo, rep, maya } = await seed();
    const id = await inReview(env, dana.token);
    await call(env, theo.token, "POST", "/postings", { title: "Cinder draft" });
    const mine = (await (await call(env, dana.token, "GET", "/postings")).json()) as { postings: Posting[] };
    expect(mine.postings.map((p) => p.id)).toEqual([id]);
    expect((await call(env, maya.token, "GET", "/postings?scope=all")).status).toBe(403);
    expect((await call(env, dana.token, "GET", "/postings?scope=all")).status).toBe(403);
    expect((await call(env, dana.token, "GET", "/postings?scope=board")).status).toBe(403);
    const all = (await (await call(env, rep.token, "GET", "/postings?scope=all")).json()) as { postings: Posting[] };
    expect(all.postings).toHaveLength(2);
    // The rep's default is the board, empty until something is live.
    expect(((await (await call(env, rep.token, "GET", "/postings")).json()) as { postings: Posting[] }).postings).toEqual([]);
  });

  it("an admin posts for the Lab org and sends it; another rep publishes it", async () => {
    const { env, admin, dana, rep } = await seed();
    const res = await call(env, admin.token, "POST", "/postings", { ...READY, title: "Lab question", send: true });
    expect(res.status).toBe(201);
    const { id, status } = (await res.json()) as { id: string; status: string };
    expect(status).toBe("in_review");
    expect(await env.DB.prepare("SELECT org_id, author_id FROM postings WHERE id = ?").bind(id).first()).toEqual({
      org_id: "org_lab",
      author_id: admin.user.id,
    });
    const self = await move(env, admin.token, id, "approve");
    expect(self.status).toBe(403);
    expect(await self.json()).toMatchObject({ error: "own-project" });
    expect((await move(env, rep.token, id, "approve")).status).toBe(200);
    expect((await get(env, admin.token, id)).status).toBe("live");
    expect(await notes(env, admin.user.id, "posting.published")).toEqual([expect.objectContaining({ title: "“Lab question” is live on the notice board" })]);
    const draft = ((await (await call(env, admin.token, "POST", "/postings", { title: "Lab draft" })).json()) as { id: string }).id;
    // The partner cannot approve their own posting (not a rep), and cannot see the Lab's draft.
    const own = await inReview(env, dana.token);
    expect((await move(env, dana.token, own, "approve")).status).toBe(403);
    expect((await call(env, dana.token, "GET", `/postings/${draft}`)).status).toBe(404);
  });

  it("an edit changes only draft fields and keeps a retired discipline it does not touch", async () => {
    const { env, dana, rep } = await seed();
    const id = await inReview(env, dana.token);
    await move(env, rep.token, id, "approve");
    await env.DB.prepare("UPDATE taxonomy SET active = 0 WHERE kind = 'discipline' AND slug = 'finance'").run();
    try {
      const res = await call(env, dana.token, "PATCH", `/postings/${id}`, { title: "Live edit", status: "draft", org_id: "o_cinder", author_id: "u_theo" });
      expect(res.status).toBe(200);
      expect(await env.DB.prepare("SELECT title, status, org_id, author_id, disciplines FROM postings WHERE id = ?").bind(id).first()).toEqual({
        title: "Live edit",
        status: "live",
        org_id: "o_kestrel",
        author_id: "u_dana",
        disciplines: '["finance"]',
      });
      // Sending disciplines checks them against the live list.
      const res2 = await call(env, dana.token, "PATCH", `/postings/${id}`, { disciplines: ["finance", "design"] });
      expect(((await res2.json()) as Posting).disciplines).toEqual(["finance", "design"]);
    } finally {
      await env.DB.prepare("UPDATE taxonomy SET active = 1 WHERE kind = 'discipline' AND slug = 'finance'").run();
    }
  });

  it("an edit that sends a retired discipline already on the posting keeps it, but cannot add another", async () => {
    const { env, dana, rep } = await seed();
    const id = await inReview(env, dana.token);
    await move(env, rep.token, id, "approve");
    await env.DB.prepare("UPDATE taxonomy SET active = 0 WHERE kind = 'discipline' AND slug IN ('finance', 'marketing')").run();
    try {
      // The form sends the posting's disciplines back with a title fix.
      const res = await call(env, dana.token, "PATCH", `/postings/${id}`, { title: "Typo fixed", disciplines: ["finance"] });
      expect(res.status).toBe(200);
      expect(((await res.json()) as Posting).disciplines).toEqual(["finance"]);
      expect(await env.DB.prepare("SELECT title, disciplines FROM postings WHERE id = ?").bind(id).first()).toEqual({
        title: "Typo fixed",
        disciplines: '["finance"]',
      });
      const res2 = await call(env, dana.token, "PATCH", `/postings/${id}`, { disciplines: ["finance", "marketing"] });
      expect(((await res2.json()) as Posting).disciplines).toEqual(["finance"]);
    } finally {
      await env.DB.prepare("UPDATE taxonomy SET active = 1 WHERE kind = 'discipline' AND slug IN ('finance', 'marketing')").run();
    }
  });

  it("refuses unknown transitions and a wrong state", async () => {
    const { env, dana, rep } = await seed();
    const id = await inReview(env, dana.token);
    expect((await move(env, rep.token, id, "fly")).status).toBe(400);
    expect((await move(env, dana.token, id, "submit")).status).toBe(409);
  });
});
