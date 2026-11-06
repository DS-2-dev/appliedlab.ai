import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations } from "./helpers";
import { sendReminders } from "../src/reminders";

const OLD = "2026-01-01T00:00:00.000Z";

async function reset(db: D1Database) {
  const tables = [
    "reminders_sent", "notifications", "events", "reviews", "milestone_baselines", "selections", "meetings", "submissions", "boards",
    "project_members", "projects", "postings", "org_requests", "sessions", "login_codes", "users", "orgs",
  ];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe("reminders", () => {
  it("reminds an active team of its deadline and a returned team of its quiet board, once each", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    await reset(env.DB);
    const now = new Date();
    const fresh = now.toISOString();
    const soon = ymd(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));
    const plan = (finishBy: string) => JSON.stringify({ approach: "x", milestones: [], finishBy });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES
          ('u_dana', 'dana@kestrel.example', 'Dana', 'partner', '["partner"]', 'active', ?),
          ('u_maya', 'maya@mail.weber.edu', 'Maya', 'member', '["member"]', 'active', ?),
          ('u_ben', 'ben@mail.weber.edu', 'Ben', 'member', '["member"]', 'active', ?)`,
      ).bind(OLD, OLD, OLD),
      env.DB.prepare(
        `INSERT INTO postings (id, author_id, title, summary, status, kind, created_at, updated_at) VALUES
          ('P1', 'u_dana', 'Snow pricing', 's', 'live', 'partner', ?, ?)`,
      ).bind(OLD, OLD),
      env.DB.prepare(
        `INSERT INTO projects (id, posting_id, lead_id, status, plan, claimed_at, activated_at, updated_at) VALUES
          ('A', 'P1', 'u_maya', 'active', ?, ?, ?, ?),
          ('R', 'P1', 'u_ben', 'submission_returned', ?, ?, ?, ?)`,
      ).bind(plan(soon), OLD, fresh, fresh, plan(""), OLD, OLD, OLD),
      env.DB.prepare(
        `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES ('A', 'u_maya', 'lead', ?), ('R', 'u_ben', 'lead', ?)`,
      ).bind(OLD, OLD),
      // A's board was just edited (not quiet); R's has been still since January.
      env.DB.prepare(
        `INSERT INTO boards (id, project_id, owner_id, data, created_at, updated_at) VALUES
          ('BA', 'A', 'u_maya', '{}', ?, ?), ('BR', 'R', 'u_ben', '{}', ?, ?)`,
      ).bind(OLD, fresh, OLD, OLD),
    ]);

    const sent = await sendReminders(env, now);
    expect(sent).toMatchObject({ deadline: 1, quiet: 1 });
    const notes = async (userId: string) =>
      (
        await env.DB.prepare("SELECT title, href FROM notifications WHERE user_id = ? AND kind = 'reminder'").bind(userId).all<{ title: string; href: string }>()
      ).results;
    expect(await notes("u_maya")).toEqual([expect.objectContaining({ href: "/projectum?project=BA" })]);
    expect(await notes("u_ben")).toEqual([expect.objectContaining({ href: "/projectum?project=BR" })]);
    const keys = (await env.DB.prepare("SELECT key FROM reminders_sent ORDER BY key").all<{ key: string }>()).results.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining([`deadline:A:${soon}`, `quiet:R:${OLD}`]));

    // A second run sends nothing new.
    expect(await sendReminders(env, now)).toMatchObject({ deadline: 0, quiet: 0 });
    expect(await notes("u_maya")).toHaveLength(1);
    expect(await notes("u_ben")).toHaveLength(1);
  });
});
