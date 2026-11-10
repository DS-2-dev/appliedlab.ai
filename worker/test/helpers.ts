import { env as poolEnv, applyD1Migrations, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker, { type Env } from "../src/index";
import type { UserRow } from "../src/accounts";

const ORIGIN = "https://test.local";

type Migration = { name: string; queries: string[] };
const migrations = () => (poolEnv as unknown as { TEST_MIGRATIONS: Migration[] }).TEST_MIGRATIONS;

// Every file in migrations/, in order. Safe to call twice.
export async function applyMigrations(db: D1Database): Promise<void> {
  await applyD1Migrations(db, migrations());
}

// One file by name, e.g. "0009_reminders.sql" or "0009_reminders". For tests
// that need the old schema before a later migration runs.
export async function applyMigration(db: D1Database, name: string): Promise<void> {
  const base = name.replace(/\.sql$/, "");
  const one = migrations().filter((m) => m.name.replace(/\.sql$/, "") === base);
  if (one.length === 0) throw new Error(`No migration named ${name}`);
  await applyD1Migrations(db, one);
}

// The pool's bindings plus the vars and stubs the Worker needs. Miniflare has
// no rate limiters or Workers AI, so those allow everything or throw.
export function makeEnv(): Env {
  const limiter: RateLimit = { limit: async () => ({ success: true }) };
  const ai = {
    run: async () => {
      throw new Error("AI not available in tests");
    },
  } as unknown as Ai;
  const bindings = poolEnv as unknown as Pick<Env, "DB" | "REPORTS">;
  return {
    DB: bindings.DB,
    REPORTS: bindings.REPORTS,
    AUTH_SECRET: "test",
    APPROVER_EMAIL: "kylarvierra@mail.weber.edu",
    APPROVERS: "dantesmith@mail.weber.edu",
    SITE_URL: ORIGIN,
    ALLOWED_ORIGINS: ORIGIN,
    DEV_CODES: "1",
    ASK_LIMITER: limiter,
    LOGIN_LIMITER: limiter,
    LOGIN_IP_LIMITER: limiter,
    AI: ai,
  };
}

// One request through the Worker's fetch handler. A FormData body is sent as
// is; anything else is JSON.
export async function call(
  env: Env,
  token: string | null,
  method: string,
  path: string,
  body?: unknown | FormData,
): Promise<Response> {
  const headers: Record<string, string> = { origin: ORIGIN };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, { method, headers, body: payload }), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export const TEST_PASSWORD = "correct horse battery";

// Signs in through the real endpoints using the dev code.
export async function signIn(env: Env, email: string, name?: string): Promise<{ token: string; user: UserRow }> {
  const start = await call(env, null, "POST", "/auth/start", { email });
  if (start.status !== 200) throw new Error(`/auth/start ${start.status}: ${await start.text()}`);
  const { devCode } = (await start.json()) as { devCode: string };
  let verify = await call(env, null, "POST", "/auth/verify", { email, code: devCode, name });
  if (verify.status !== 200) throw new Error(`/auth/verify ${verify.status}: ${await verify.text()}`);
  let out = (await verify.json()) as { token: string; user: UserRow; needsPassword?: boolean };
  // A first sign-in also sets a password.
  if (out.needsPassword) {
    verify = await call(env, null, "POST", "/auth/verify", { email, code: devCode, name, password: TEST_PASSWORD });
    if (verify.status !== 200) throw new Error(`/auth/verify ${verify.status}: ${await verify.text()}`);
    out = (await verify.json()) as typeof out;
  }
  return out;
}

// Migrations 0001 to 0009 only: the schema the Worker's SQL still expects
// until it moves to the 0010 tables (Tasks 10 and 12).
export async function applyLegacyMigrations(db: D1Database): Promise<void> {
  await applyD1Migrations(db, migrations().filter((m) => m.name < "0010"));
}

// The schema as it stood before 0010 (migrations 0001 to 0009), with a small
// pipeline in it: every claim status, a pending claim with no board, a
// denied claim, a problem a rep posted and one a member proposed. The
// migration test runs 0010 over this.
export async function seedLegacy(db: D1Database): Promise<void> {
  // Tests in one file share the database, so start from an empty one:
  // triggers, then tables newest first so children go before parents.
  const objects = (
    await db
      .prepare(
        "SELECT type, name FROM sqlite_master WHERE type IN ('table', 'trigger') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' " +
          "ORDER BY type = 'table', rowid DESC",
      )
      .all<{ type: string; name: string }>()
  ).results;
  if (objects.length > 0) {
    await db.batch([
      db.prepare("PRAGMA defer_foreign_keys = true"),
      ...objects.map((o) => db.prepare(`DROP ${o.type === "trigger" ? "TRIGGER" : "TABLE"} "${o.name}"`)),
    ]);
  }
  await applyLegacyMigrations(db);
  const plan = (approach: string) =>
    JSON.stringify({ approach, milestones: [{ title: `${approach} first step`, due: "2026-11-01" }], finishBy: "2026-12-01" });
  const board = (name: string) => JSON.stringify({ name, stage: "solidifying" });
  const sql = [
    // Users: one rep, four members, three partners.
    `INSERT INTO users (id, email, name, role, status, created_at) VALUES
      ('u_prof', 'prof@weber.edu', 'Pat Prof', 'rep', 'active', '2026-09-01T00:00:00.000Z'),
      ('u_maya', 'maya@mail.weber.edu', 'Maya Lin', 'member', 'active', '2026-09-02T00:00:00.000Z'),
      ('u_eli', 'eli@mail.weber.edu', 'Eli Park', 'member', 'active', '2026-09-03T00:00:00.000Z'),
      ('u_ben', 'ben@mail.weber.edu', 'Ben Cole', 'member', 'active', '2026-09-04T00:00:00.000Z'),
      ('u_zoe', 'zoe@mail.weber.edu', 'Zoe Hart', 'member', 'active', '2026-09-04T12:00:00.000Z'),
      ('u_dana', 'dana@kestrel.example', 'Dana Reyes', 'partner', 'active', '2026-09-05T00:00:00.000Z'),
      ('u_owen', 'owen@gmail.com', 'Owen O''Neil', 'partner', 'active', '2026-09-06T00:00:00.000Z'),
      ('u_theo', 'theo@cinder.example', 'Theo Grant', 'partner', 'pending', '2026-09-07T00:00:00.000Z')`,
    "UPDATE users SET handle = 'maya-abcd', profile_public = 1 WHERE id = 'u_maya'",
    `INSERT INTO problems (id, owner_id, title, summary, fields, status, origin, created_at, updated_at) VALUES
      ('P1', 'u_dana', 'P1', 'Forecast demand', '["finance"]', 'open', 'partner', '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z'),
      ('P2', 'u_prof', 'P2', 'Grade faster', '["computer-science"]', 'open', 'partner', '2026-09-11T00:00:00.000Z', '2026-09-11T00:00:00.000Z'),
      ('P3', 'u_maya', 'P3', 'My own idea', '["design"]', 'open', 'member', '2026-09-12T00:00:00.000Z', '2026-09-12T00:00:00.000Z'),
      ('P4', 'u_dana', 'P4', 'Old question', '[]', 'closed', 'partner', '2026-09-13T00:00:00.000Z', '2026-09-20T00:00:00.000Z')`,
    // One claim per old status, and one approved claim per mapped status:
    // C6 active, C7 delivered, C8 submission_returned, C9 complete.
    `INSERT INTO claims (id, problem_id, owner_id, plan, status, review_note, reviewed_by, reviewed_at, created_at) VALUES
      ('C1', 'P1', 'u_maya', '${plan("C1")}', 'approved', '', 'u_prof', '2026-09-15T00:00:00.000Z', '2026-09-14T00:00:00.000Z'),
      ('C2', 'P1', 'u_eli', '${plan("C2")}', 'pending', '', NULL, NULL, '2026-09-16T00:00:00.000Z'),
      ('C3', 'P2', 'u_ben', '${plan("C3")}', 'denied', 'Too broad', 'u_prof', '2026-09-18T00:00:00.000Z', '2026-09-17T00:00:00.000Z'),
      ('C4', 'P3', 'u_maya', '${plan("C4")}', 'approved', '', 'u_prof', '2026-09-19T00:00:00.000Z', '2026-09-18T00:00:00.000Z'),
      ('C5', 'P4', 'u_ben', '${plan("C5")}', 'withdrawn', '', NULL, '2026-09-21T00:00:00.000Z', '2026-09-14T00:00:00.000Z'),
      ('C6', 'P2', 'u_zoe', '${plan("C6")}', 'approved', '', 'u_prof', '2026-09-23T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
      ('C7', 'P4', 'u_zoe', '${plan("C7")}', 'approved', '', 'u_prof', '2026-09-23T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
      ('C8', 'P1', 'u_ben', '${plan("C8")}', 'approved', '', 'u_prof', '2026-09-23T00:00:00.000Z', '2026-09-22T00:00:00.000Z'),
      ('C9', 'P3', 'u_zoe', '${plan("C9")}', 'approved', '', 'u_prof', '2026-09-23T00:00:00.000Z', '2026-09-22T00:00:00.000Z')`,
    `INSERT INTO claim_members (claim_id, user_id) VALUES
      ('C1', 'u_maya'), ('C2', 'u_eli'), ('C3', 'u_ben'), ('C4', 'u_maya'), ('C4', 'u_ben'), ('C5', 'u_ben'),
      ('C6', 'u_zoe'), ('C7', 'u_zoe'), ('C8', 'u_ben'), ('C9', 'u_zoe')`,
    // Boards for the approved claims; C2 has none, and B0 belongs to no claim.
    `INSERT INTO projects (id, owner_id, claim_id, data, created_at, updated_at) VALUES
      ('B1', 'u_maya', 'C1', '${board("C1")}', '2026-09-15T00:00:00.000Z', '2026-09-25T00:00:00.000Z'),
      ('B4', 'u_maya', 'C4', '${board("C4")}', '2026-09-19T00:00:00.000Z', '2026-09-26T00:00:00.000Z'),
      ('B7', 'u_zoe', 'C7', '${board("C7")}', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z'),
      ('B8', 'u_ben', 'C8', '${board("C8")}', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z'),
      ('B9', 'u_zoe', 'C9', '${board("C9")}', '2026-09-23T00:00:00.000Z', '2026-09-23T00:00:00.000Z'),
      ('B0', 'u_maya', NULL, '${board("Sketch")}', '2026-09-08T00:00:00.000Z', '2026-09-08T00:00:00.000Z')`,
    `INSERT INTO submissions (id, claim_id, project_id, submitted_by, report_name, report_size, status, review_note, reviewed_by, reviewed_at, created_at) VALUES
      ('S1', 'C1', 'B1', 'u_maya', 'c1.pdf', 1000, 'accepted', 'Good', 'u_prof', '2026-09-28T00:00:00.000Z', '2026-09-27T00:00:00.000Z'),
      ('S4', 'C4', 'B4', 'u_maya', 'c4.pdf', 2000, 'pending', '', NULL, NULL, '2026-09-29T00:00:00.000Z'),
      ('S7', 'C7', 'B7', 'u_zoe', 'c7.pdf', 700, 'accepted', '', 'u_prof', '2026-09-28T00:00:00.000Z', '2026-09-27T00:00:00.000Z'),
      ('S8', 'C8', 'B8', 'u_ben', 'c8.pdf', 800, 'returned', 'Add sources', 'u_prof', '2026-09-28T00:00:00.000Z', '2026-09-27T00:00:00.000Z'),
      ('S9', 'C9', 'B9', 'u_zoe', 'c9.pdf', 900, 'accepted', '', 'u_prof', '2026-09-28T00:00:00.000Z', '2026-09-27T00:00:00.000Z')`,
    `INSERT INTO selections (claim_id, selected_by, message, milestones, completed_at, created_at) VALUES
      ('C1', 'u_dana', 'Join us', '[]', NULL, '2026-10-01T00:00:00.000Z'),
      ('C9', 'u_prof', 'Built it', '[]', '2026-10-10T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`,
    `INSERT INTO meetings (id, claim_id, requested_by, message, status, created_at, arranged_at) VALUES
      ('M1', 'C1', 'u_dana', 'Coffee?', 'arranged', '2026-09-30T00:00:00.000Z', '2026-09-30T12:00:00.000Z')`,
    `INSERT INTO notifications (id, user_id, kind, title, href, created_at) VALUES
      ('N1', 'u_maya', 'claim-approved', 'Your claim was approved', '/projectum/', '2026-09-15T00:00:00.000Z')`,
  ];
  await db.batch(sql.map((q) => db.prepare(q)));
}
