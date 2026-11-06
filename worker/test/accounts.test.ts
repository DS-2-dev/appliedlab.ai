import { describe, it, expect } from "vitest";
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

  it("a member's level comes from the row", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    const s = await signIn(env, "sam@mail.weber.edu", "Sam");
    expect(await me(env, s.token)).toMatchObject({ level: "affiliate", org: null, orgId: null });
    await env.DB.prepare("UPDATE users SET level = 'sponsored' WHERE email = 'sam@mail.weber.edu'").run();
    expect(await me(env, s.token)).toMatchObject({ level: "sponsored" });
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
