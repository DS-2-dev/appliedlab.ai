import { describe, it, expect } from "vitest";
import { call } from "./helpers";
import { seedCourt } from "./court-seed";
import type { CourtItem } from "@/lib/pipeline/court";

const court = async (env: Parameters<typeof call>[0], token: string) => {
  const res = await call(env, token, "GET", "/court");
  expect(res.status).toBe(200);
  return ((await res.json()) as { items: CourtItem[] }).items;
};
const find = (items: CourtItem[], kind: string, id: string) => items.find((i) => i.kind === kind && i.id === id);

describe("court", () => {
  it("needs a signed-in account", async () => {
    const { env } = await seedCourt();
    expect((await call(env, null, "GET", "/court")).status).toBe(401);
    expect((await call(env, null, "GET", "/shell")).status).toBe(401);
  });

  it("a member with a returned plan has an action item that opens the board", async () => {
    const { env, maya } = await seedCourt();
    const items = await court(env, maya.token);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      role: "member",
      kind: "project",
      id: "PR_ret",
      title: "Posting P_1",
      status: "plan_returned",
      urgency: "action",
      since: "2026-09-10T00:00:00.000Z",
      href: "/projectum?project=B_ret",
    });
    expect(items[0].subtitle).toContain("Maya Lin");
  });

  it("a returned plan counts from the latest review decision", async () => {
    const { env, maya } = await seedCourt();
    await env.DB.prepare(
      "INSERT INTO reviews (id, gate, subject_id, round, status, decided_at, opened_at) VALUES ('R_pl', 'action_plan', 'PR_ret', 1, 'returned', '2026-09-20T00:00:00.000Z', '2026-09-10T00:00:00.000Z')",
    ).run();
    expect((await court(env, maya.token))[0].since).toBe("2026-09-20T00:00:00.000Z");
  });

  it("a member with an active project has a work item, linked to my projects without a board", async () => {
    const { env, eli } = await seedCourt();
    const items = await court(env, eli.token);
    expect(items).toEqual([
      expect.objectContaining({ kind: "project", id: "PR_act", urgency: "work", status: "active", since: "2026-09-11T00:00:00.000Z", href: "/projectum?view=myprojects" }),
    ]);
  });

  it("claimed and submission_returned are actions; integrated is work; others do not appear", async () => {
    const { env, eli } = await seedCourt();
    const set = async (status: string) => {
      await env.DB.prepare("UPDATE projects SET status = ? WHERE id = 'PR_act'").bind(status).run();
      return (await court(env, eli.token)).map((i) => i.urgency);
    };
    expect(await set("claimed")).toEqual(["action"]);
    expect(await set("submission_returned")).toEqual(["action"]);
    expect(await set("integrated")).toEqual(["work"]);
    expect(await set("plan_review")).toEqual([]);
    expect(await set("complete")).toEqual([]);
    expect(await set("withdrawn")).toEqual([]);
  });

  it("a partner primary has pending org requests, delivered work with no selection, and postings", async () => {
    const { env, dana } = await seedCourt();
    const items = await court(env, dana.token);
    expect(find(items, "org_request", "Q_fresh")).toMatchObject({
      role: "partner", urgency: "action", title: "Joe Joiner", subtitle: "Kestrel", href: "/projectum?view=org",
    });
    expect(find(items, "org_request", "Q_orphan")).toBeUndefined();
    expect(find(items, "org_request", "Q_old")).toBeDefined();
    expect(find(items, "project", "PR_del")).toMatchObject({ role: "partner", urgency: "action", status: "delivered", title: "Posting P_3" });
    expect(find(items, "project", "PR_sel")).toBeUndefined();
    expect(find(items, "posting", "P_draft")).toMatchObject({ urgency: "work", status: "draft", href: "/projectum?view=posting&id=P_draft", since: "2026-09-05T00:00:00.000Z" });
    expect(find(items, "posting", "P_ret")).toMatchObject({ urgency: "action", status: "returned", since: "2026-09-07T00:00:00.000Z" });
    expect(find(items, "posting", "P_live")).toBeUndefined();
    const first = items.findIndex((i) => i.urgency === "work");
    expect(items.slice(first).every((i) => i.urgency === "work")).toBe(true);
  });

  it("a completion sign-off waits on the partner", async () => {
    const { env, dana } = await seedCourt();
    await env.DB.prepare("UPDATE projects SET status = 'completion_review' WHERE id = 'PR_sel'").run();
    expect(find(await court(env, dana.token), "project", "PR_sel")).toMatchObject({ urgency: "action", status: "completion_review" });
  });

  it("a partner who is not the primary does not get the requests", async () => {
    const { env, dana } = await seedCourt();
    await env.DB.prepare("UPDATE orgs SET primary_user_id = NULL WHERE id = 'o_kestrel'").run();
    expect((await court(env, dana.token)).some((i) => i.kind === "org_request")).toBe(false);
  });

  it("a rep has the open review and the requested meeting, not the pending partner", async () => {
    const { env, rep } = await seedCourt();
    const items = await court(env, rep.token);
    expect(find(items, "review", "R_open")).toMatchObject({
      role: "rep", urgency: "action", since: "2026-09-14T00:00:00.000Z", href: "/projectum?view=review&id=R_open", title: "Action plan: Posting P_5",
    });
    expect(find(items, "meeting", "M1")).toMatchObject({ role: "rep", urgency: "action", title: "Posting P_4", subtitle: "Dana Reyes", href: "/projectum?view=project&id=PR_sel" });
    expect(items.some((i) => i.kind === "partner" || i.kind === "org_request")).toBe(false);
  });

  it("a review assigned to another rep is not on this rep's list", async () => {
    const { env, rep, rep2 } = await seedCourt();
    await env.DB.prepare("UPDATE reviews SET assigned_to = ? WHERE id = 'R_open'").bind(rep2.user.id).run();
    expect(find(await court(env, rep.token), "review", "R_open")).toBeUndefined();
    expect(find(await court(env, rep2.token), "review", "R_open")).toBeDefined();
  });

  it("a rep on the project's own team does not get its review", async () => {
    const { env, rep } = await seedCourt();
    await env.DB.prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES ('PR_rev', ?, 'member', '2026-09-01T00:00:00.000Z')")
      .bind(rep.user.id)
      .run();
    expect(find(await court(env, rep.token), "review", "R_open")).toBeUndefined();
  });

  it("an admin has the pending partners and the stale org requests", async () => {
    const { env, admin } = await seedCourt();
    const items = await court(env, admin.token);
    expect(find(items, "partner", "u_newp")).toMatchObject({
      role: "admin", urgency: "action", title: "Pending Partner", subtitle: "newp@pending.example", href: "/projectum?view=overview",
    });
    expect(find(items, "org_request", "Q_old")).toMatchObject({ role: "admin", urgency: "action" });
    // An organization with no primary is stale at once; a fresh request to one with a primary is not.
    expect(find(items, "org_request", "Q_orphan")).toBeDefined();
    expect(find(items, "org_request", "Q_fresh")).toBeUndefined();
    expect(find(items, "review", "R_open")).toBeDefined();
  });

  it("a user with nothing waiting gets an empty list", async () => {
    const { env, nobody } = await seedCourt();
    expect(await court(env, nobody.token)).toEqual([]);
  });
});
