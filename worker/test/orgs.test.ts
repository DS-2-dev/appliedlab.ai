import { describe, it, expect } from "vitest";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";
import { approvalLink } from "../src/accounts";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";

type Env = ReturnType<typeof makeEnv>;
const idOf = async (env: Env, email: string) =>
  (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>())!.id;

// Kestrel is an org with dana as its primary; admin (dantesmith) exists.
async function seed(opts: { primary?: boolean } = {}) {
  const env = makeEnv();
  await applyMigrations(env.DB);
  await reset(env.DB);
  const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES ('u_dana', 'dana@kestrel.example', 'Dana Reyes', 'partner', '[\"partner\"]', 'active', '2026-09-01T00:00:00.000Z')"),
    env.DB.prepare("INSERT INTO orgs (id, slug, name, domain, primary_user_id, created_at) VALUES ('o_kestrel', 'kestrel-example', 'Kestrel', 'kestrel.example', ?, '2026-09-01T00:00:00.000Z')").bind(
      opts.primary === false ? null : "u_dana",
    ),
    env.DB.prepare("UPDATE users SET org_id = 'o_kestrel' WHERE id = 'u_dana'"),
  ]);
  const dana = await signIn(env, "dana@kestrel.example");
  return { env, admin, dana };
}

// Tests in a file share one database, so each starts from no rows.
async function reset(db: D1Database) {
  const tables = ["notifications", "events", "org_requests", "sessions", "login_codes", "users", "orgs"];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

const notes = async (env: Env, userId: string, kind: string) =>
  (await env.DB.prepare("SELECT court, title FROM notifications WHERE user_id = ? AND kind = ?").bind(userId, kind).all<{ court: number; title: string }>()).results;

describe("join requests", () => {
  it("a second partner at a known domain asks the primary, who approves", async () => {
    const { env, dana } = await seed();
    await signIn(env, "sam@kestrel.example", "Sam Lee");
    const sam = await env.DB.prepare("SELECT id, status, org_id FROM users WHERE email = 'sam@kestrel.example'").first<{ id: string; status: string; org_id: string | null }>();
    expect(sam).toMatchObject({ status: "pending", org_id: null });
    const reqs = (await env.DB.prepare("SELECT id, org_id, status FROM org_requests WHERE user_id = ?").bind(sam!.id).all<{ id: string; org_id: string; status: string }>()).results;
    expect(reqs).toEqual([{ id: expect.any(String), org_id: "o_kestrel", status: "pending" }]);
    expect(await notes(env, "u_dana", "org.join_requested")).toEqual([{ court: 1, title: expect.stringContaining("Sam Lee") }]);
    // The admin is not bothered.
    expect(await notes(env, await idOf(env, "dantesmith@mail.weber.edu"), "account.pending")).toEqual([]);

    const mine = (await (await call(env, dana.token, "GET", "/orgs/mine")).json()) as {
      org: { name: string }; people: { id: string; primary: boolean }[]; requests: { id: string; user: { email: string } }[];
    };
    expect(mine.org.name).toBe("Kestrel");
    expect(mine.people).toEqual([expect.objectContaining({ id: "u_dana", primary: true })]);
    expect(mine.requests).toEqual([expect.objectContaining({ id: reqs[0].id, user: expect.objectContaining({ email: "sam@kestrel.example" }) })]);

    const ok = await call(env, dana.token, "POST", `/orgs/requests/${reqs[0].id}/approve`, {});
    expect(ok.status).toBe(200);
    expect(await env.DB.prepare("SELECT status, org_id FROM users WHERE id = ?").bind(sam!.id).first()).toEqual({ status: "active", org_id: "o_kestrel" });
    expect(await notes(env, sam!.id, "org.join_approved")).toHaveLength(1);
    // A second decision loses.
    expect((await call(env, dana.token, "POST", `/orgs/requests/${reqs[0].id}/decline`, {})).status).toBe(409);
  });

  it("declining keeps the account pending and tells them", async () => {
    const { env, dana } = await seed();
    await signIn(env, "sam@kestrel.example", "Sam Lee");
    const r = (await env.DB.prepare("SELECT id, user_id FROM org_requests").first<{ id: string; user_id: string }>())!;
    expect((await call(env, dana.token, "POST", `/orgs/requests/${r.id}/decline`, { note: "Not on our team" })).status).toBe(200);
    expect(await env.DB.prepare("SELECT status, note FROM org_requests WHERE id = ?").bind(r.id).first()).toEqual({ status: "declined", note: "Not on our team" });
    expect(await env.DB.prepare("SELECT status, org_id FROM users WHERE id = ?").bind(r.user_id).first()).toEqual({ status: "pending", org_id: null });
    expect(await notes(env, r.user_id, "org.join_declined")).toHaveLength(1);
  });

  it("only the primary or an admin decides", async () => {
    const { env, admin } = await seed();
    await signIn(env, "sam@kestrel.example", "Sam Lee");
    const r = (await env.DB.prepare("SELECT id FROM org_requests").first<{ id: string }>())!;
    const other = await signIn(env, "kim@mail.weber.edu", "Kim");
    expect((await call(env, other.token, "POST", `/orgs/requests/${r.id}/approve`, {})).status).toBe(403);
    expect((await call(env, admin.token, "POST", `/orgs/requests/${r.id}/approve`, {})).status).toBe(200);
  });

  it("a domain whose org has no primary goes to the admins", async () => {
    const { env } = await seed({ primary: false });
    await signIn(env, "sam@kestrel.example", "Sam Lee");
    expect((await env.DB.prepare("SELECT 1 FROM org_requests").first())).toBeNull();
    const adminId = await idOf(env, "dantesmith@mail.weber.edu");
    expect(await notes(env, adminId, "account.pending")).toEqual([{ court: 1, title: expect.stringContaining("Sam Lee") }]);
  });

  it("a removed member can ask again, once at a time", async () => {
    const { env, dana } = await seed();
    const sam = await signIn(env, "sam@kestrel.example", "Sam Lee");
    const first = (await env.DB.prepare("SELECT id FROM org_requests").first<{ id: string }>())!;
    await call(env, dana.token, "POST", `/orgs/requests/${first.id}/approve`, {});
    const samId = await idOf(env, "sam@kestrel.example");

    expect((await call(env, sam.token, "POST", "/orgs/mine/remove", { userId: samId })).status).toBe(403);
    const gone = await call(env, dana.token, "POST", "/orgs/mine/remove", { userId: samId });
    expect(gone.status).toBe(200);
    expect(await env.DB.prepare("SELECT org_id FROM users WHERE id = ?").bind(samId).first()).toEqual({ org_id: null });
    expect(await notes(env, samId, "org.member_removed")).toHaveLength(1);
    expect((await call(env, dana.token, "POST", "/orgs/mine/remove", { userId: "u_dana" })).status).toBe(400);

    expect((await call(env, sam.token, "GET", "/orgs/mine")).status).toBe(404);
    const again = await call(env, sam.token, "POST", "/orgs/requests", { message: "Back again" });
    expect(again.status).toBe(201);
    expect((await call(env, sam.token, "POST", "/orgs/requests", {})).status).toBe(409);
    const open = (await env.DB.prepare("SELECT id FROM org_requests WHERE status = 'pending'").first<{ id: string }>())!;
    expect((await call(env, dana.token, "POST", `/orgs/requests/${open.id}/approve`, {})).status).toBe(200);
    expect(await env.DB.prepare("SELECT org_id FROM users WHERE id = ?").bind(samId).first()).toEqual({ org_id: "o_kestrel" });
  });
});

describe("approval by the Lab", () => {
  it("gives a gmail partner their own org as primary", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    await reset(env.DB);
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    await signIn(env, "pat.jones@gmail.com", "Pat Jones");
    const pat = await idOf(env, "pat.jones@gmail.com");
    expect(await env.DB.prepare("SELECT 1 FROM org_requests").first()).toBeNull();
    expect(await notes(env, await idOf(env, "dantesmith@mail.weber.edu"), "account.pending")).toHaveLength(1);

    expect((await call(env, admin.token, "POST", `/partners/${pat}/approve`)).status).toBe(200);
    const org = await env.DB.prepare("SELECT o.slug, o.domain, o.primary_user_id FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = ?")
      .bind(pat)
      .first<{ slug: string; domain: string; primary_user_id: string }>();
    expect(org).toMatchObject({ domain: "", primary_user_id: pat });
    expect(org!.slug).toMatch(/^pat-jones-[a-z2-9]{4}$/);
  });

  it("makes a domain org named from the domain, and attaches later partners to it", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    await reset(env.DB);
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    await signIn(env, "ana@cinder.example", "Ana");
    await signIn(env, "bo@cinder.example", "Bo");
    // Bo found no org at sign-up, so both wait for the Lab.
    const ana = await idOf(env, "ana@cinder.example");
    const bo = await idOf(env, "bo@cinder.example");
    await call(env, admin.token, "POST", `/partners/${ana}/approve`);
    await call(env, admin.token, "POST", `/partners/${bo}/approve`);
    const orgs = (await env.DB.prepare("SELECT slug, name, primary_user_id FROM orgs").all()).results;
    expect(orgs).toEqual([{ slug: "cinder-example", name: "Cinder", primary_user_id: ana }]);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE org_id IS NOT NULL").first<{ n: number }>())!.n).toBe(2);
  });
});

describe("managing the org", () => {
  it("lets the primary edit, and refuses bad values", async () => {
    const { env, dana } = await seed();
    const ok = await call(env, dana.token, "PATCH", "/orgs/mine", { name: "Kestrel Labs", website: "https://kestrel.example", isPublic: false });
    expect(ok.status).toBe(200);
    expect(await env.DB.prepare("SELECT name, website, is_public FROM orgs WHERE id = 'o_kestrel'").first()).toEqual({ name: "Kestrel Labs", website: "https://kestrel.example", is_public: 0 });
    for (const bad of [{ name: "" }, { name: "x".repeat(101) }, { website: "kestrel.example" }, { description: "d".repeat(2001) }, { isPublic: "yes" }]) {
      expect((await call(env, dana.token, "PATCH", "/orgs/mine", bad)).status).toBe(400);
    }
    expect(await env.DB.prepare("SELECT name FROM orgs WHERE id = 'o_kestrel'").first()).toEqual({ name: "Kestrel Labs" });
  });

  it("refuses other members, and hands over the primary", async () => {
    const { env, dana } = await seed();
    await env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, org_id, created_at) VALUES ('u_lee', 'lee@kestrel.example', 'Lee', 'partner', '[\"partner\"]', 'active', 'o_kestrel', '2026-09-02T00:00:00.000Z')").run();
    const lee = await signIn(env, "lee@kestrel.example");
    expect((await call(env, lee.token, "PATCH", "/orgs/mine", { name: "Mine" })).status).toBe(403);
    expect((await call(env, lee.token, "POST", "/orgs/mine/transfer", { userId: "u_lee" })).status).toBe(403);
    const leeView = (await (await call(env, lee.token, "GET", "/orgs/mine")).json()) as { requests: unknown[] };
    expect(leeView.requests).toEqual([]);

    expect((await call(env, dana.token, "POST", "/orgs/mine/transfer", { userId: "u_nobody" })).status).toBe(400);
    expect((await call(env, dana.token, "POST", "/orgs/mine/transfer", { userId: "u_lee" })).status).toBe(200);
    expect(await env.DB.prepare("SELECT primary_user_id FROM orgs WHERE id = 'o_kestrel'").first()).toEqual({ primary_user_id: "u_lee" });
    expect(await notes(env, "u_lee", "org.primary_transferred")).toHaveLength(1);
  });

  it("shows an org to staff only, and a partner without one gets no-org", async () => {
    const { env, admin, dana } = await seed();
    expect((await call(env, dana.token, "GET", "/orgs/o_kestrel")).status).toBe(403);
    expect((await call(env, admin.token, "GET", "/orgs/o_kestrel")).status).toBe(200);
    expect((await call(env, admin.token, "GET", "/orgs/nope")).status).toBe(404);
    const solo = await signIn(env, "pat@gmail.com", "Pat");
    await env.DB.prepare("UPDATE users SET status = 'active' WHERE email = 'pat@gmail.com'").run();
    const res = await call(env, solo.token, "GET", "/orgs/mine");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no-org" });
  });
});

describe("review fixes", () => {
  it("refuses a join request from a non-partner", async () => {
    const { env } = await seed();
    await env.DB.prepare("INSERT INTO orgs (id, slug, name, domain, created_at) VALUES ('o_weber', 'x', 'X', 'mail.weber.edu', '2026-09-01T00:00:00.000Z')").run();
    const kim = await signIn(env, "kim@mail.weber.edu", "Kim");
    expect((await call(env, kim.token, "POST", "/orgs/requests", {})).status).toBe(403);
  });

  it("refuses another org's primary on a decision", async () => {
    const { env } = await seed();
    await signIn(env, "sam@kestrel.example", "Sam Lee");
    const r = (await env.DB.prepare("SELECT id FROM org_requests").first<{ id: string }>())!;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES ('u_ola', 'ola@other.example', 'Ola', 'partner', '[\"partner\"]', 'active', '2026-09-01T00:00:00.000Z')"),
      env.DB.prepare("INSERT INTO orgs (id, slug, name, domain, primary_user_id, created_at) VALUES ('o_other', 'other-example', 'Other', 'other.example', 'u_ola', '2026-09-01T00:00:00.000Z')"),
      env.DB.prepare("UPDATE users SET org_id = 'o_other' WHERE id = 'u_ola'"),
    ]);
    const ola = await signIn(env, "ola@other.example");
    expect((await call(env, ola.token, "POST", `/orgs/requests/${r.id}/approve`, {})).status).toBe(403);
  });

  it("does not resurrect a removed user or move one who has another org", async () => {
    const { env, dana } = await seed();
    await signIn(env, "sam@kestrel.example", "Sam Lee");
    await signIn(env, "tia@kestrel.example", "Tia");
    const sam = await idOf(env, "sam@kestrel.example");
    const tia = await idOf(env, "tia@kestrel.example");
    const rid = async (u: string) => (await env.DB.prepare("SELECT id FROM org_requests WHERE user_id = ?").bind(u).first<{ id: string }>())!.id;
    await env.DB.prepare("UPDATE users SET status = 'removed' WHERE id = ?").bind(sam).run();
    expect((await call(env, dana.token, "POST", `/orgs/requests/${await rid(sam)}/approve`, {})).status).toBe(409);
    expect(await env.DB.prepare("SELECT status, org_id FROM users WHERE id = ?").bind(sam).first()).toEqual({ status: "removed", org_id: null });
    expect(await env.DB.prepare("SELECT status FROM org_requests WHERE user_id = ?").bind(sam).first()).toEqual({ status: "pending" });

    await env.DB.batch([
      env.DB.prepare("INSERT INTO orgs (id, slug, name, domain, created_at) VALUES ('o_x', 'x', 'X', 'x.example', '2026-09-01T00:00:00.000Z')"),
      env.DB.prepare("UPDATE users SET org_id = 'o_x' WHERE id = ?").bind(tia),
    ]);
    const res = await call(env, dana.token, "POST", `/orgs/requests/${await rid(tia)}/approve`, {});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "has-org" });
  });

  it("keeps a transfer to partners", async () => {
    const { env, dana } = await seed();
    await env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, org_id, created_at) VALUES ('u_st', 'st@mail.weber.edu', 'St', 'member', '[\"member\"]', 'active', 'o_kestrel', '2026-09-02T00:00:00.000Z')").run();
    expect((await call(env, dana.token, "POST", "/orgs/mine/transfer", { userId: "u_st" })).status).toBe(400);
  });

  it("lets an admin act on another org with ?org=, and ignores it for others", async () => {
    const { env, admin, dana } = await seed();
    const res = await call(env, admin.token, "PATCH", "/orgs/mine?org=o_kestrel", { name: "Renamed" });
    expect(res.status).toBe(200);
    expect(await env.DB.prepare("SELECT name FROM orgs WHERE id = 'o_kestrel'").first()).toEqual({ name: "Renamed" });
    await call(env, dana.token, "PATCH", "/orgs/mine?org=nope", { name: "Own" });
    expect(await env.DB.prepare("SELECT name FROM orgs WHERE id = 'o_kestrel'").first()).toEqual({ name: "Own" });
  });

  it("creates the org when the emailed approval link is used", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    await reset(env.DB);
    await signIn(env, "pat@gmail.com", "Pat Smith");
    const pat = await idOf(env, "pat@gmail.com");
    const link = await approvalLink(env, new Request("https://test.local/auth/verify"), pat);
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request(link, { method: "POST" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT status, org_id FROM users WHERE id = ?").bind(pat).first<{ status: string; org_id: string | null }>();
    expect(row!.status).toBe("active");
    expect(row!.org_id).toBeTruthy();
  });
});
