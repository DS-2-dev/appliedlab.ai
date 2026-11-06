import { describe, it, expect } from "vitest";
import { env as poolEnv } from "cloudflare:test";
import { PERSONAL_DOMAINS } from "@/lib/email-rules";
import { makeEnv, applyMigration, seedLegacy, signIn, call } from "./helpers";

describe("migration 0010", () => {
  it("carries every row forward with the mapped status", async () => {
    const env = makeEnv(); await seedLegacy(env.DB); await applyMigration(env.DB, "0010_gates_and_orgs.sql");
    const rows = async (sql: string) => (await env.DB.prepare(sql).all()).results;
    expect((await rows("SELECT status, kind, org_id FROM postings ORDER BY title")).map((r) => [r.status, r.kind])).toEqual([["live","partner"],["live","partner"],["closed","self"],["closed","partner"]]);
    expect((await rows("SELECT org_id FROM postings WHERE title='P2'"))[0].org_id).toBe("org_lab");
    const statuses = Object.fromEntries((await rows("SELECT id, status FROM projects")).map((r) => [r.id, r.status]));
    expect(statuses).toEqual({
      C1: "integrated", C2: "plan_review", C3: "plan_returned", C4: "submission_review", C5: "withdrawn",
      C6: "active", C7: "delivered", C8: "submission_returned", C9: "complete",
    });
    expect((await rows("SELECT status, feedback FROM reviews WHERE subject_id='C3'"))[0]).toMatchObject({ status: "returned", feedback: "Too broad" });
    expect((await rows("SELECT COUNT(*) AS n FROM reviews WHERE status='open'"))[0].n).toBe(1);
    expect((await rows("SELECT role FROM project_members WHERE project_id='C1' AND user_id=(SELECT id FROM users WHERE email='maya@mail.weber.edu')"))[0].role).toBe("lead");
    expect((await rows("SELECT level FROM users WHERE email='maya@mail.weber.edu'"))[0].level).toBe("builder");
    expect((await rows("SELECT level FROM users WHERE email='eli@mail.weber.edu'"))[0].level).toBe("affiliate");
    expect((await rows("SELECT slug, domain FROM orgs ORDER BY slug")).length).toBe(4); // lab, kestrel-example, cinder-example, owen's personal org
    expect((await rows("SELECT roles FROM users WHERE email='prof@weber.edu'"))[0].roles).toBe('["rep"]');
    expect((await rows("SELECT COUNT(*) AS n FROM boards"))[0].n).toBe(6); // every boards_old row, B0 with no project; C2's board comes from ensureBoards()
    expect((await rows("SELECT status FROM meetings"))[0].status).toBe("scheduled");
    expect((await rows("SELECT name FROM sqlite_master WHERE name IN ('problems','claims','claim_members','boards_old')")).length).toBe(0);
  });

  it("links orgs, teams, boards and submissions to the new rows", async () => {
    const env = makeEnv(); await seedLegacy(env.DB); await applyMigration(env.DB, "0010_gates_and_orgs.sql");
    const rows = async (sql: string) => (await env.DB.prepare(sql).all()).results;
    const one = async (sql: string) => (await rows(sql))[0];
    // Partners belong to their domain's org, or to an org of their own.
    expect(await one("SELECT o.slug, o.primary_user_id FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = 'u_dana'")).toEqual({
      slug: "kestrel-example",
      primary_user_id: "u_dana",
    });
    expect(await one("SELECT o.name, o.primary_user_id FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = 'u_theo'")).toEqual({
      name: "Cinder",
      primary_user_id: null,
    });
    const owen = await one("SELECT o.slug, o.domain, o.name, o.primary_user_id FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = 'u_owen'");
    expect(owen).toMatchObject({ domain: "", name: "Owen O'Neil", primary_user_id: "u_owen" });
    expect(owen.slug).toMatch(/^owen-oneil-[0-9a-f]{4}$/);
    expect((await one("SELECT org_id FROM postings WHERE id = 'P1'")).org_id).toBe((await one("SELECT org_id FROM users WHERE id = 'u_dana'")).org_id);
    // Teams: the lead plus everyone else.
    expect(await rows("SELECT user_id, role FROM project_members WHERE project_id = 'C4' ORDER BY user_id")).toEqual([
      { user_id: "u_ben", role: "member" },
      { user_id: "u_maya", role: "lead" },
    ]);
    expect((await one("SELECT COUNT(*) AS n FROM project_members")).n).toBe(10);
    expect((await one("SELECT level FROM users WHERE id = 'u_ben'")).level).toBe("sponsored");
    // Children point at the new rows.
    expect(await one("SELECT project_id, board_id, status FROM submissions WHERE id = 'S1'")).toEqual({ project_id: "C1", board_id: "B1", status: "accepted" });
    expect(await one("SELECT project_id FROM boards WHERE id = 'B4'")).toEqual({ project_id: "C4" });
    expect(await one("SELECT project_id, completed_at FROM selections WHERE project_id = 'C1'")).toEqual({ project_id: "C1", completed_at: null });
    // A board made before any project survives with no project.
    expect(await one("SELECT project_id, owner_id FROM boards WHERE id = 'B0'")).toEqual({ project_id: null, owner_id: "u_maya" });
    // Decided reviews carry who decided and when.
    expect(await one("SELECT status, decided_by, decided_at FROM reviews WHERE subject_id = 'C6'")).toEqual({
      status: "approved",
      decided_by: "u_prof",
      decided_at: "2026-09-23T00:00:00.000Z",
    });
    // A member's own proposal is closed from the start and belongs to no org.
    expect(await one("SELECT status, org_id, closed_at, created_at FROM postings WHERE id = 'P3'")).toEqual({
      status: "closed",
      org_id: null,
      closed_at: "2026-09-12T00:00:00.000Z",
      created_at: "2026-09-12T00:00:00.000Z",
    });
    expect(await one("SELECT phase, integrated_at, activated_at FROM projects WHERE id = 'C1'")).toEqual({
      phase: "integrated",
      integrated_at: "2026-10-01T00:00:00.000Z",
      activated_at: "2026-09-15T00:00:00.000Z",
    });
    expect(await one("SELECT court, event_id, title FROM notifications WHERE id = 'N1'")).toEqual({ court: 0, event_id: null, title: "Your claim was approved" });
    // Baselines: one per project, plus one per approved plan.
    expect((await one("SELECT COUNT(*) AS n FROM milestone_baselines WHERE reason = 'plan_submitted'")).n).toBe(9);
    expect((await one("SELECT COUNT(*) AS n FROM milestone_baselines WHERE reason = 'plan_approved'")).n).toBe(6);
    expect((await rows("SELECT name FROM taxonomy WHERE kind = 'discipline' ORDER BY position")).map((r) => r.name)).toEqual([
      "Finance", "Accounting", "Business", "Computer Science", "Design", "Mathematics", "Marketing", "Other",
    ]);
    // Foreign keys hold, and nothing still names a dropped table.
    expect(await rows("PRAGMA foreign_key_check")).toEqual([]);
    expect(
      await rows("SELECT name FROM sqlite_master WHERE sql LIKE '%claims%' OR sql LIKE '%problems%' OR sql LIKE '%boards_old%' OR sql LIKE '%claim_id%'"),
    ).toEqual([]);
    // The indexes and trigger the old children had are back under the new names.
    const names = (await rows("SELECT name FROM sqlite_master WHERE type IN ('index', 'trigger')")).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["submissions_open", "submissions_project", "meetings_open", "meetings_project", "one_active_project"]));
    expect(names).not.toContain("one_active_claim");
    // One open submission per project still holds.
    await expect(
      env.DB.prepare(
        "INSERT INTO submissions (id, project_id, board_id, report_name, report_size, status, created_at) VALUES ('S9', 'C4', 'B4', 'x.pdf', 1, 'pending', 'now')",
      ).run(),
    ).rejects.toThrow();
  });

  it("approving a pending partner the migration filed under their domain makes them its primary", async () => {
    const env = makeEnv(); await seedLegacy(env.DB); await applyMigration(env.DB, "0010_gates_and_orgs.sql");
    const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
    expect((await call(env, admin.token, "POST", "/partners/u_theo/approve")).status).toBe(200);
    const one = async (sql: string) => (await env.DB.prepare(sql).all()).results[0];
    expect(await one("SELECT u.status, o.name, o.primary_user_id FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = 'u_theo'")).toEqual({
      status: "active",
      name: "Cinder",
      primary_user_id: "u_theo",
    });
  });

  it("withdraws a denied claim its member superseded with a new claim on the same problem", async () => {
    const env = makeEnv(); await seedLegacy(env.DB);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO claims (id, problem_id, owner_id, plan, status, created_at) VALUES ('C10', 'P2', 'u_ben', '{"approach":"again","milestones":[],"finishBy":""}', 'pending', '2026-09-22T00:00:00.000Z')`,
      ),
      env.DB.prepare("INSERT INTO claim_members (claim_id, user_id) VALUES ('C10', 'u_ben')"),
    ]);
    await applyMigration(env.DB, "0010_gates_and_orgs.sql");
    const one = async (sql: string) => (await env.DB.prepare(sql).all()).results[0];
    expect(await one("SELECT status, withdrawn_at FROM projects WHERE id = 'C3'")).toEqual({ status: "withdrawn", withdrawn_at: "2026-09-18T00:00:00.000Z" });
    expect(await one("SELECT status FROM projects WHERE id = 'C10'")).toEqual({ status: "plan_review" });
    expect(await one("SELECT status, feedback FROM reviews WHERE subject_id = 'C3'")).toEqual({ status: "withdrawn", feedback: "Too broad" });
    // Ben has exactly one project in play on P2.
    expect(
      await one(
        "SELECT COUNT(*) AS n FROM project_members m JOIN projects p ON p.id = m.project_id " +
          "WHERE m.user_id = 'u_ben' AND p.posting_id = 'P2' AND p.status NOT IN ('withdrawn', 'complete')",
      ),
    ).toEqual({ n: 1 });
    // The new trigger guards inserts from here on.
    await expect(
      env.DB.prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES ('C2', 'u_maya', 'member', 'now')").run(),
    ).rejects.toThrow(/already-claimed/);
  });

  it("treats the same personal domains as the site and the Worker", () => {
    type Migration = { name: string; queries: string[] };
    const all = (poolEnv as unknown as { TEST_MIGRATIONS: Migration[] }).TEST_MIGRATIONS;
    const sql = all.find((m) => m.name.startsWith("0010_"))!.queries.join("\n");
    const lists = [...sql.matchAll(/\(\s*('gmail\.com'[^)]*)\)/g)].map((m) =>
      m[1].split(",").map((d) => d.trim().replace(/^'|'$/g, "")).sort(),
    );
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toEqual([...PERSONAL_DOMAINS].sort());
  });
});
