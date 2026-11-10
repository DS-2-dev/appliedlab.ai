import { describe, it, expect, vi } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";
import { isAdmin, isStaff, rolesOf, type UserRow } from "../src/accounts";

const me = async (env: ReturnType<typeof makeEnv>, token: string) =>
  ((await (await call(env, token, "GET", "/me")).json()) as { user: Record<string, unknown> }).user;

describe("accounts", () => {
  it("an APPROVERS address is an admin, a plain rep is not", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const d = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    const p = await signIn(env, "prof@weber.edu", "Prof");
    expect(await me(env, d.token)).toMatchObject({ admin: true, roles: ["member", "admin"] });
    expect(await me(env, p.token)).toMatchObject({ admin: false, roles: ["rep"], level: null });
  });

  it("a new faculty account is pending until the Lab approves it, with no organization", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    const prof = await signIn(env, "new-prof@weber.edu", "New Prof", true);
    const asked = log.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith("Approve faculty new-prof@weber.edu"));
    log.mockRestore();
    expect(asked).toContain("/approve?u=" + prof.user.id);
    expect(await me(env, prof.token)).toMatchObject({ status: "pending", pendingOrgName: null });
    const bell = await env.DB.prepare("SELECT title FROM notifications WHERE kind = 'account.pending' AND title LIKE '%New Prof%'").all<{ title: string }>();
    expect(bell.results).toEqual([{ title: "New Prof signed up as faculty and is waiting for approval" }]);

    const post = (token: string, path: string) => call(env, token, "POST", path);
    expect((await post(prof.token, `/accounts/${prof.user.id}/approve`)).status).toBe(403);
    expect((await post(admin.token, `/accounts/${prof.user.id}/approve`)).status).toBe(200);
    expect(await me(env, prof.token)).toMatchObject({ status: "active", org: null, orgId: null });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM orgs WHERE primary_user_id = ?").bind(prof.user.id).first()).toEqual({ n: 0 });
    const events = await env.DB.prepare("SELECT type FROM events WHERE subject_id = ? AND type = 'account.approved'").bind(prof.user.id).all();
    expect(events.results).toHaveLength(1);
    expect((await post(admin.token, `/accounts/${prof.user.id}/approve`)).status).toBe(409);
    expect(await (await post(admin.token, `/accounts/${prof.user.id}/approve`)).json()).toEqual({ error: "state" });
  });

  it("the server refuses a held faculty account until it is approved", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    const prof = await signIn(env, "held-prof@weber.edu", "Held Prof", true);
    const held = await call(env, prof.token, "GET", "/reviews");
    expect(held.status).toBe(403);
    expect(await held.json()).toEqual({ error: "pending" });
    expect((await call(env, admin.token, "POST", `/accounts/${prof.user.id}/approve`)).status).toBe(200);
    expect((await call(env, prof.token, "GET", "/reviews")).status).toBe(200);
  });

  it("keeps /partners/:id/approve working for a pending faculty account", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    const prof = await signIn(env, "alias-prof@weber.edu", "Alias Prof", true);
    expect((await call(env, admin.token, "POST", `/partners/${prof.user.id}/approve`)).status).toBe(200);
    expect(await me(env, prof.token)).toMatchObject({ status: "active" });
  });

  it("an address listed in APPROVERS signs up active even at a faculty domain", async () => {
    const env = { ...makeEnv(), APPROVERS: "boss@weber.edu" };
    await applyMigrations(env.DB);
    const boss = await signIn(env, "boss@weber.edu", "Boss", true);
    expect(await me(env, boss.token)).toMatchObject({ status: "active", admin: true });
  });

  it("signing in again leaves an active faculty row untouched", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    await env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES ('u_old_prof', 'old-prof@weber.edu', 'Old Prof', 'rep', '[\"rep\"]', 'active', '2026-01-01')").run();
    const prof = await signIn(env, "old-prof@weber.edu", "Old Prof", true);
    expect(await me(env, prof.token)).toMatchObject({ id: "u_old_prof", status: "active" });
  });

  it("a member's level comes from the row", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    expect(await me(env, s.token)).toMatchObject({ level: "affiliate", org: null, orgId: null });
    await env.DB.prepare("UPDATE users SET level = 'sponsored' WHERE email = 'sam@mail.weber.edu'").run();
    expect(await me(env, s.token)).toMatchObject({ level: "sponsored" });
  });

  it("an admin sets a member's level", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    const sam = await signIn(env, "level-sam@mail.weber.edu", "Sam");
    const prof = await signIn(env, "level-prof@weber.edu", "Prof");
    const post = (token: string, id: string, level: string) => call(env, token, "POST", `/accounts/${id}/level`, { level });
    const res = await post(admin.token, sam.user.id, "builder");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, level: "builder" });
    expect(await me(env, sam.token)).toMatchObject({ level: "builder" });
    const notes = await env.DB.prepare("SELECT title, href FROM notifications WHERE user_id = ? AND kind = 'member.level_changed'")
      .bind(sam.user.id)
      .all();
    expect(notes.results).toEqual([{ title: "You are now a Builder", href: "/projectum" }]);
    // Setting the level they already hold changes nothing and tells nobody.
    const again = await post(admin.token, sam.user.id, "builder");
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, level: "builder" });
    const events = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'member.level_changed' AND subject_id = ?")
      .bind(sam.user.id)
      .first<{ n: number }>();
    expect(events!.n).toBe(1);
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'member.level_changed'").bind(sam.user.id).first<{ n: number }>())!.n,
    ).toBe(1);
    expect((await post(sam.token, sam.user.id, "affiliate")).status).toBe(403);
    expect((await post(admin.token, sam.user.id, "senior")).status).toBe(400);
    expect((await post(admin.token, prof.user.id, "builder")).status).toBe(400);
    expect((await post(admin.token, "u_nobody", "builder")).status).toBe(404);
  });

  it("the account carries its organization", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    const u = await env.DB.prepare("SELECT id FROM users WHERE email = 'sam@mail.weber.edu'").first<{ id: string }>();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at) VALUES ('o1', 'acme', 'Acme', 'company', 'acme.com', ?, '2026-01-01')",
      ).bind(u!.id),
      env.DB.prepare("UPDATE users SET org_id = 'o1' WHERE id = ?").bind(u!.id),
    ]);
    expect(await me(env, s.token)).toMatchObject({ orgId: "o1", org: { id: "o1", slug: "acme", name: "Acme", primary: true } });
  });
});

describe("pending join request", () => {
  it("names the organization a pending partner is waiting on", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES ('u_dana', 'dana@kestrel.example', 'Dana', 'partner', '[\"partner\"]', 'active', '2026-09-01T00:00:00.000Z')"),
      env.DB.prepare("INSERT INTO orgs (id, slug, name, domain, primary_user_id, created_at) VALUES ('o_kestrel', 'kestrel-example', 'Kestrel', 'kestrel.example', 'u_dana', '2026-09-01T00:00:00.000Z')"),
      env.DB.prepare("UPDATE users SET org_id = 'o_kestrel' WHERE id = 'u_dana'"),
    ]);
    const sam = await signIn(env, "sam@kestrel.example", "Sam Lee");
    expect(await me(env, sam.token)).toMatchObject({ status: "pending", org: null, pendingOrgName: "Kestrel" });
    // A partner with no request, and one who has an org, have none.
    const other = await signIn(env, "pat@gmail.com", "Pat");
    expect(await me(env, other.token)).toMatchObject({ pendingOrgName: null });
    const dana = await signIn(env, "dana@kestrel.example");
    expect(await me(env, dana.token)).toMatchObject({ pendingOrgName: null });
  });
});

describe("role helpers", () => {
  const env = makeEnv();
  const row = (o: Partial<UserRow>): UserRow => ({
    id: "u", email: "x@weber.edu", name: "X", role: "rep", status: "active", avatar: null,
    roles: '["rep"]', org_id: null, level: "affiliate", level_locked: 0, interests: "[]", ...o,
  });

  it("a removed rep is neither staff nor admin", () => {
    const u = row({ status: "removed" });
    expect(isStaff(env, u)).toBe(false);
    expect(isAdmin(env, u)).toBe(false);
    expect(isStaff(env, row({}))).toBe(true);
  });

  it("rolesOf copes with malformed, non-array and duplicate lists", () => {
    expect(rolesOf(row({ role: "member", roles: "nope" }))).toEqual(["member"]);
    expect(rolesOf(row({ role: "member", roles: "{}" }))).toEqual(["member"]);
    expect(rolesOf(row({ role: "member", roles: '["member","member"]' }))).toEqual(["member"]);
    expect(rolesOf(row({ role: "member", roles: '["member","admin"]' }))).toEqual(["member"]);
  });

  it("a stored admin entry makes an admin; a pending admin-listed address is not", () => {
    expect(isAdmin(env, row({ roles: '["rep","admin"]' }))).toBe(true);
    expect(isAdmin(env, row({ email: "dantesmith@mail.weber.edu", role: "member", status: "pending" }))).toBe(false);
    expect(isAdmin(env, row({ email: "dantesmith@mail.weber.edu", role: "member" }))).toBe(true);
  });
});
