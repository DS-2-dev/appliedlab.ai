import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations } from "./helpers";
import { transition, type Hooks } from "../src/transition";
import type { UserRow } from "../src/accounts";

const AT = "2026-10-01T00:00:00.000Z";

// A partner's organization with one draft posting, its partner, two members
// and two reps, seeded with SQL. transition() is called directly.
async function seed() {
  const env = makeEnv();
  await applyMigrations(env.DB);
  // Tests in one file share the database.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notifications"),
    env.DB.prepare("DELETE FROM events"),
    env.DB.prepare("DELETE FROM postings"),
    env.DB.prepare("UPDATE orgs SET primary_user_id = NULL"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM orgs"),
  ]);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, role, status, roles, created_at) VALUES
        ('u_dana', 'dana@kestrel.example', 'Dana', 'partner', 'active', '["partner"]', ?),
        ('u_maya', 'maya@mail.weber.edu', 'Maya', 'member', 'active', '["member"]', ?),
        ('u_prof', 'prof@weber.edu', 'Pat', 'rep', 'active', '["rep"]', ?),
        ('u_prof2', 'prof2@weber.edu', 'Sam', 'rep', 'active', '["rep"]', ?)`,
    ).bind(AT, AT, AT, AT),
    env.DB.prepare(
      "INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at) VALUES ('o1', 'kestrel', 'Kestrel', 'company', 'kestrel.example', 'u_dana', ?)",
    ).bind(AT),
    env.DB.prepare("UPDATE users SET org_id = 'o1' WHERE id = 'u_dana'"),
    env.DB.prepare(
      "INSERT INTO postings (id, org_id, author_id, title, summary, status, kind, created_at, updated_at) VALUES ('P1', 'o1', 'u_dana', 'Forecast', 'Forecast demand', 'draft', 'partner', ?, ?)",
    ).bind(AT, AT),
  ]);
  const user = async (id: string) => (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>())!;
  const status = async () => (await env.DB.prepare("SELECT status FROM postings WHERE id = 'P1'").first<{ status: string }>())!.status;
  const setStatus = (s: string) => env.DB.prepare("UPDATE postings SET status = ? WHERE id = 'P1'").bind(s).run();
  const events = async () => (await env.DB.prepare("SELECT * FROM events").all<Record<string, string>>()).results;
  return { env, user, status, setStatus, events };
}

// A minimal hooks map: no extra statements, no notifications.
const empty: Hooks = { effects: async () => ({ stmts: [], notify: [] }) };
const hooks: Record<string, Hooks> = { submit: empty, approve: empty, return: empty };

describe("transition", () => {
  it("moves a draft posting to in_review when its partner submits, with one event", async () => {
    const { env, user, status, events } = await seed();
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, hooks);
    expect(r).toEqual({ ok: true, status: "in_review" });
    expect(await status()).toBe("in_review");
    const ev = await events();
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      type: "posting.submitted",
      actor_id: "u_dana",
      subject_kind: "posting",
      subject_id: "P1",
      posting_id: "P1",
      org_id: "o1",
    });
    const row = await env.DB.prepare("SELECT updated_at FROM postings WHERE id = 'P1'").first<{ updated_at: string }>();
    expect(row!.updated_at).not.toBe(AT);
  });

  it("refuses submit by a member", async () => {
    const { env, user, status, events } = await seed();
    const r = await transition(env, await user("u_maya"), { kind: "posting", id: "P1", name: "submit" }, hooks);
    expect(r).toEqual({ ok: false, error: "forbidden" });
    expect(await status()).toBe("draft");
    expect(await events()).toHaveLength(0);
  });

  it("refuses approve by a member", async () => {
    const { env, user, setStatus } = await seed();
    await setStatus("in_review");
    const r = await transition(env, await user("u_maya"), { kind: "posting", id: "P1", name: "approve" }, hooks);
    expect(r).toEqual({ ok: false, error: "forbidden" });
  });

  it("refuses a return without feedback", async () => {
    const { env, user, setStatus, status } = await seed();
    await setStatus("in_review");
    const rep = await user("u_prof");
    const bare = await transition(env, rep, { kind: "posting", id: "P1", name: "return", feedback: "  " }, hooks);
    expect(bare).toEqual({ ok: false, error: "feedback" });
    expect(await status()).toBe("in_review");
    const noted = await transition(env, rep, { kind: "posting", id: "P1", name: "return", feedback: "Narrow it" }, hooks);
    expect(noted).toEqual({ ok: true, status: "returned" });
  });

  it("lets exactly one of two concurrent approvals win", async () => {
    const { env, user, setStatus, status, events } = await seed();
    await setStatus("in_review");
    const [a, b] = [await user("u_prof"), await user("u_prof2")];
    const results = await Promise.all([
      transition(env, a, { kind: "posting", id: "P1", name: "approve" }, hooks),
      transition(env, b, { kind: "posting", id: "P1", name: "approve" }, hooks),
    ]);
    expect(results.filter((r) => r.ok)).toEqual([{ ok: true, status: "live" }]);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "state" }]);
    expect(await status()).toBe("live");
    expect(await events()).toHaveLength(1);
  });

  it("refuses a rep approving a posting from their own organization", async () => {
    const { env, user, setStatus, status } = await seed();
    await setStatus("in_review");
    await env.DB.prepare("UPDATE users SET org_id = 'o1' WHERE id = 'u_prof'").run();
    const r = await transition(env, await user("u_prof"), { kind: "posting", id: "P1", name: "approve" }, hooks);
    expect(r).toEqual({ ok: false, error: "own-project" });
    expect(await status()).toBe("in_review");
  });

  it("lets an admin by the APPROVERS list approve", async () => {
    const { env, user, setStatus } = await seed();
    await setStatus("in_review");
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, role, status, roles, created_at) VALUES ('u_dante', 'dantesmith@mail.weber.edu', 'Dante', 'member', 'active', '[\"member\"]', ?)",
    )
      .bind(AT)
      .run();
    const r = await transition(env, await user("u_dante"), { kind: "posting", id: "P1", name: "approve" }, hooks);
    expect(r).toEqual({ ok: true, status: "live" });
  });

  it("refuses a partner from another organization", async () => {
    const { env, user, status } = await seed();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO orgs (id, slug, name, kind, domain, created_at) VALUES ('o2', 'cinder', 'Cinder', 'company', 'cinder.example', ?)",
      ).bind(AT),
      env.DB.prepare(
        "INSERT INTO users (id, email, name, role, status, roles, org_id, created_at) VALUES ('u_theo', 'theo@cinder.example', 'Theo', 'partner', 'active', '[\"partner\"]', 'o2', ?)",
      ).bind(AT),
    ]);
    const r = await transition(env, await user("u_theo"), { kind: "posting", id: "P1", name: "submit" }, hooks);
    expect(r).toEqual({ ok: false, error: "forbidden" });
    expect(await status()).toBe("draft");
  });

  it("refuses a partner on a self posting", async () => {
    const { env, user, status } = await seed();
    await env.DB.prepare("UPDATE postings SET kind = 'self' WHERE id = 'P1'").run();
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, hooks);
    expect(r).toEqual({ ok: false, error: "forbidden" });
    expect(await status()).toBe("draft");
  });

  it("refuses an inactive actor", async () => {
    const { env, user, status } = await seed();
    await env.DB.prepare("UPDATE users SET status = 'removed' WHERE id = 'u_dana'").run();
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, hooks);
    expect(r).toEqual({ ok: false, error: "forbidden" });
    expect(await status()).toBe("draft");
  });

  it("puts the status back and writes no event when the effects batch fails", async () => {
    const { env, user, status, events } = await seed();
    const broken: Record<string, Hooks> = {
      submit: {
        effects: async () => ({
          // reviews.gate is NOT NULL.
          stmts: [env.DB.prepare("INSERT INTO reviews (id, gate, subject_id, round, opened_at) VALUES ('r1', NULL, 'P1', 1, ?)").bind(AT)],
          notify: [],
        }),
      },
    };
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, broken);
    expect(r).toEqual({ ok: false, error: "effects" });
    expect(await status()).toBe("draft");
    expect(await events()).toHaveLength(0);
  });

  it("returns unknown-transition for a name the machine lacks", async () => {
    const { env, user } = await seed();
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "launch" }, hooks);
    expect(r).toEqual({ ok: false, error: "unknown-transition" });
  });

  it("returns not-found for a missing posting", async () => {
    const { env, user } = await seed();
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "nope", name: "submit" }, hooks);
    expect(r).toEqual({ ok: false, error: "not-found" });
  });

  it("keeps the status when a guard refuses with plan issues", async () => {
    const { env, user, status, events } = await seed();
    const guarded: Record<string, Hooks> = {
      submit: { guard: async () => ({ error: "plan", issues: ["title"] }), effects: empty.effects },
    };
    const r = await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, guarded);
    expect(r).toEqual({ ok: false, error: "plan", issues: ["title"] });
    expect(await status()).toBe("draft");
    expect(await events()).toHaveLength(0);
  });

  it("runs after only once the transition has succeeded, and swallows its errors", async () => {
    const { env, user, status, setStatus } = await seed();
    const ran: string[] = [];
    const tracked = (tag: string, extra: Partial<Awaited<ReturnType<Hooks["effects"]>>> = {}): Record<string, Hooks> => ({
      submit: { effects: async () => ({ stmts: [], notify: [], after: async () => void ran.push(tag), ...extra }) },
    });
    // Refused before effects: a member may not submit.
    expect(await transition(env, await user("u_maya"), { kind: "posting", id: "P1", name: "submit" }, tracked("forbidden"))).toMatchObject({ error: "forbidden" });
    // Lost the lock: someone moved the row after the effects were built.
    const raced: Record<string, Hooks> = {
      submit: {
        effects: async () => {
          await setStatus("in_review");
          return { stmts: [], notify: [], after: async () => void ran.push("state") };
        },
      },
    };
    expect(await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, raced)).toMatchObject({ error: "state" });
    await setStatus("draft");
    // The effects batch failed and was compensated.
    const broken = tracked("effects", {
      stmts: [env.DB.prepare("INSERT INTO reviews (id, gate, subject_id, round, opened_at) VALUES ('r1', NULL, 'P1', 1, ?)").bind(AT)],
    });
    expect(await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, broken)).toMatchObject({ error: "effects" });
    expect(ran).toEqual([]);

    expect(await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, tracked("ok"))).toEqual({ ok: true, status: "in_review" });
    expect(ran).toEqual(["ok"]);
    // A failing after does not undo the change.
    await setStatus("draft");
    const failing: Record<string, Hooks> = {
      submit: { effects: async () => ({ stmts: [], notify: [], after: async () => { throw new Error("mail down"); } }) },
    };
    expect(await transition(env, await user("u_dana"), { kind: "posting", id: "P1", name: "submit" }, failing)).toEqual({ ok: true, status: "in_review" });
    expect(await status()).toBe("in_review");
  });
});
