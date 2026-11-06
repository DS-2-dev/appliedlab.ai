// A whole pipeline in one go, for the court and shell tests: Kestrel (dana,
// primary) with postings in several states, members on projects in several
// statuses, open reviews, a meeting, pending partners and org requests.

import { makeEnv, applyMigrations, signIn } from "./helpers";

export const AT = "2026-09-01T00:00:00.000Z";
// Older than the seven days after which an org request goes to admins.
export const OLD = "2020-01-01T00:00:00.000Z";

async function reset(db: D1Database) {
  const tables = [
    "notifications", "events", "reviews", "milestone_baselines", "selections", "meetings", "submissions", "boards", "project_members",
    "projects", "postings", "org_requests", "sessions", "login_codes", "users", "orgs",
  ];
  await db.batch([db.prepare("PRAGMA defer_foreign_keys = true"), ...tables.map((t) => db.prepare(`DELETE FROM ${t}`))]);
}

export async function seedCourt() {
  const env = makeEnv();
  await applyMigrations(env.DB);
  await reset(env.DB);
  const fresh = new Date().toISOString();
  const user = (id: string, email: string, name: string, role: string, status = "active", at = AT) =>
    env.DB.prepare("INSERT INTO users (id, email, name, role, roles, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      id, email, name, role, JSON.stringify([role]), status, at,
    );
  const posting = (id: string, status: string, updated: string) =>
    env.DB.prepare(
      `INSERT INTO postings (id, org_id, author_id, title, summary, status, kind, created_at, updated_at)
       VALUES (?, 'o_kestrel', 'u_dana', ?, 's', ?, 'partner', ?, ?)`,
    ).bind(id, `Posting ${id}`, status, AT, updated);
  const project = (id: string, postingId: string, lead: string, status: string, col: string, at: string) =>
    env.DB.batch([
      env.DB.prepare(`INSERT INTO projects (id, posting_id, lead_id, status, claimed_at, ${col}, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
        id, postingId, lead, status, AT, at, at,
      ),
      env.DB.prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'lead', ?)").bind(id, lead, AT),
    ]);

  await env.DB.batch([
    user("u_dana", "dana@kestrel.example", "Dana Reyes", "partner"),
    user("u_joiner", "joe@kestrel.example", "Joe Joiner", "partner", "pending", "2026-09-02T00:00:00.000Z"),
    user("u_lost", "lee@orphan.example", "Lee Lost", "partner", "pending", "2026-09-03T00:00:00.000Z"),
    user("u_old", "old@kestrel.example", "Olive Old", "partner", "pending", OLD),
    user("u_maya", "maya@mail.weber.edu", "Maya Lin", "member"),
    user("u_eli", "eli@mail.weber.edu", "Eli Park", "member"),
    user("u_ben", "ben@mail.weber.edu", "Ben Cole", "member"),
    user("u_zoe", "zoe@mail.weber.edu", "Zoe Hart", "member"),
    user("u_ann", "ann@mail.weber.edu", "Ann Ito", "member"),
    user("u_done", "done@mail.weber.edu", "Dee One", "member"),
    user("u_newp", "newp@pending.example", "Pending Partner", "partner", "pending", "2026-09-04T00:00:00.000Z"),
    env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at) VALUES
        ('o_kestrel', 'kestrel', 'Kestrel', 'company', 'kestrel.example', 'u_dana', ?),
        ('o_orphan', 'orphan', 'Orphan Co', 'company', 'orphan.example', NULL, ?)`,
    ).bind(AT, AT),
    env.DB.prepare("UPDATE users SET org_id = 'o_kestrel' WHERE id = 'u_dana'"),
    posting("P_draft", "draft", "2026-09-05T00:00:00.000Z"),
    posting("P_ret", "returned", "2026-09-06T00:00:00.000Z"),
    posting("P_live", "live", AT),
    posting("P_1", "live", AT),
    posting("P_2", "live", AT),
    posting("P_3", "live", AT),
    posting("P_4", "live", AT),
    posting("P_5", "live", AT),
    posting("P_6", "live", AT),
    env.DB.prepare(
      "INSERT INTO reviews (id, gate, subject_id, round, status, decided_at, opened_at) VALUES ('R_ret', 'posting', 'P_ret', 1, 'returned', '2026-09-07T00:00:00.000Z', ?)",
    ).bind(AT),
    env.DB.prepare(
      `INSERT INTO org_requests (id, org_id, user_id, status, created_at) VALUES
        ('Q_fresh', 'o_kestrel', 'u_joiner', 'pending', ?),
        ('Q_orphan', 'o_orphan', 'u_lost', 'pending', ?),
        ('Q_old', 'o_kestrel', 'u_old', 'pending', ?)`,
    ).bind(fresh, fresh, OLD),
  ]);
  // maya: plan_returned (action). eli: active (work). ben: delivered, no
  // selection (action). zoe: delivered with a selection (nothing). ann:
  // plan_review (a rep's review). done: complete (nothing).
  await project("PR_ret", "P_1", "u_maya", "plan_returned", "plan_submitted_at", "2026-09-10T00:00:00.000Z");
  await project("PR_act", "P_2", "u_eli", "active", "activated_at", "2026-09-11T00:00:00.000Z");
  await project("PR_del", "P_3", "u_ben", "delivered", "delivered_at", "2026-09-12T00:00:00.000Z");
  await project("PR_sel", "P_4", "u_zoe", "delivered", "delivered_at", "2026-09-13T00:00:00.000Z");
  await project("PR_rev", "P_5", "u_ann", "plan_review", "plan_submitted_at", "2026-09-14T00:00:00.000Z");
  await project("PR_done", "P_6", "u_done", "complete", "completed_at", "2026-09-15T00:00:00.000Z");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO boards (id, project_id, owner_id, data, created_at, updated_at) VALUES ('B_ret', 'PR_ret', 'u_maya', '{}', ?, ?)").bind(AT, AT),
    env.DB.prepare("INSERT INTO selections (project_id, selected_by, created_at) VALUES ('PR_sel', 'u_dana', ?)").bind(AT),
    env.DB.prepare(
      "INSERT INTO reviews (id, gate, subject_id, round, status, opened_at) VALUES ('R_open', 'action_plan', 'PR_rev', 1, 'open', '2026-09-14T00:00:00.000Z')",
    ),
    env.DB.prepare(
      "INSERT INTO meetings (id, project_id, requested_by, message, status, created_at) VALUES ('M1', 'PR_sel', 'u_dana', '', 'requested', '2026-09-16T00:00:00.000Z')",
    ),
  ]);

  const dana = await signIn(env, "dana@kestrel.example");
  const rep = await signIn(env, "prof@weber.edu", "Pat Prof");
  const rep2 = await signIn(env, "rook@weber.edu", "Ann Rook");
  const maya = await signIn(env, "maya@mail.weber.edu");
  const eli = await signIn(env, "eli@mail.weber.edu");
  const done = await signIn(env, "done@mail.weber.edu");
  const admin = await signIn(env, "dantesmith@mail.weber.edu", "Dante");
  return { env, dana, rep, rep2, maya, eli, nobody: done, admin };
}
