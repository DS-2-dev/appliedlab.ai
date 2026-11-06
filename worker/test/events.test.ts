import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";
import { emit, adminIds, repIds, staffIds, orgUserIds, projectMemberIds, orgPrimaryOrAdmins } from "../src/events";
import type { UserRow } from "../src/accounts";

type Env = ReturnType<typeof makeEnv>;
const idOf = async (env: Env, email: string) =>
  (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>())!.id;

async function seed() {
  const env = makeEnv();
  await applyMigrations(env.DB);
  const tokens: Record<string, string> = {};
  const emails = {
    admin: "dantesmith@mail.weber.edu",
    rep: "prof@weber.edu",
    maya: "maya@mail.weber.edu",
    eli: "eli@mail.weber.edu",
    ben: "ben@mail.weber.edu",
  };
  for (const [k, email] of Object.entries(emails)) tokens[k] = (await signIn(env, email, k)).token;
  const id = {
    admin: await idOf(env, emails.admin),
    rep: await idOf(env, emails.rep),
    maya: await idOf(env, emails.maya),
    eli: await idOf(env, emails.eli),
    ben: await idOf(env, emails.ben),
  };
  return { env, tokens, id };
}

describe("emit", () => {
  it("writes one event and a notification per recipient, minus the actor", async () => {
    const { env, tokens, id } = await seed();
    const actor = (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id.maya).first<UserRow>())!;
    const stmts: D1PreparedStatement[] = [];
    emit(env, stmts, {
      type: "plan_submitted",
      actor,
      subject: { kind: "project", id: "p1" },
      projectId: "p1",
      payload: { round: 1 },
      notify: [
        { userIds: [id.rep, id.admin, id.rep], title: "Plan ready", href: "/projectum/reviews", court: true },
        { userIds: [id.maya, id.eli], title: "Plan sent", href: "/projectum/p1" },
      ],
    });
    await env.DB.batch(stmts);
    const ev = (await env.DB.prepare("SELECT * FROM events").all<Record<string, string>>()).results;
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: "plan_submitted", actor_id: id.maya, subject_kind: "project", subject_id: "p1", project_id: "p1" });
    expect(JSON.parse(ev[0].payload)).toEqual({ round: 1 });
    const ns = (
      await env.DB.prepare("SELECT user_id, kind, title, court, event_id, created_at FROM notifications").all<Record<string, unknown>>()
    ).results;
    expect(ns).toHaveLength(3);
    expect(ns.filter((n) => n.court === 1).map((n) => n.user_id).sort()).toEqual([id.rep, id.admin].sort());
    expect(ns.find((n) => n.user_id === id.eli)).toMatchObject({ court: 0, title: "Plan sent", kind: "plan_submitted" });
    expect(ns.some((n) => n.user_id === id.maya)).toBe(false);
    expect(new Set(ns.map((n) => n.event_id))).toEqual(new Set([ev[0].id]));
    expect(new Set([...ns.map((n) => n.created_at), ev[0].created_at]).size).toBe(1);

    type Body = { notifications: { title: string; court: boolean }[] };
    const rep = (await (await call(env, tokens.rep, "GET", "/notifications")).json()) as Body;
    expect(rep.notifications).toMatchObject([{ title: "Plan ready", court: true }]);
    const eli = (await (await call(env, tokens.eli, "GET", "/notifications")).json()) as Body;
    expect(eli.notifications[0].court).toBe(false);
  });

  it("a user in two groups gets one notification per group", async () => {
    const { env, id } = await seed();
    const stmts: D1PreparedStatement[] = [];
    emit(env, stmts, {
      type: "x",
      actor: null,
      subject: { kind: "org", id: "o1" },
      notify: [
        { userIds: [id.rep], title: "A", href: "/a" },
        { userIds: [id.rep], title: "B", href: "/b", court: true },
      ],
    });
    await env.DB.batch(stmts);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'x'").first<{ n: number }>();
    expect(n!.n).toBe(2);
  });
});

describe("recipient helpers", () => {
  it("find admins, reps, staff, org users, project members, org primary", async () => {
    const { env, id } = await seed();
    await env.DB.prepare("UPDATE users SET roles = '[\"member\",\"rep\"]' WHERE id = ?").bind(id.eli).run();
    await env.DB.prepare("UPDATE users SET roles = '[\"member\",\"admin\"]' WHERE id = ?").bind(id.ben).run();
    await env.DB.prepare("UPDATE users SET status = 'removed', roles = '[\"rep\"]' WHERE id = ?").bind(id.maya).run();
    expect((await adminIds(env)).sort()).toEqual([id.admin, id.ben].sort());
    expect((await repIds(env)).sort()).toEqual([id.rep, id.eli].sort());
    expect((await staffIds(env)).sort()).toEqual([id.admin, id.ben, id.rep, id.eli].sort());

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at) VALUES ('o1', 'acme', 'Acme', 'company', 'acme.com', ?, '2026-01-01')",
      ).bind(id.eli),
      env.DB.prepare("UPDATE users SET org_id = 'o1' WHERE id IN (?, ?)").bind(id.eli, id.ben),
    ]);
    expect((await orgUserIds(env, "o1")).sort()).toEqual([id.eli, id.ben].sort());
    expect(await orgPrimaryOrAdmins(env, "o1")).toEqual([id.eli]);
    await env.DB.prepare("UPDATE orgs SET primary_user_id = NULL WHERE id = 'o1'").run();
    expect((await orgPrimaryOrAdmins(env, "o1")).sort()).toEqual([id.admin, id.ben].sort());
    expect(await projectMemberIds(env, "nope")).toEqual([]);
  });
});
