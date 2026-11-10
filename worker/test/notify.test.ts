import { describe, it, expect } from "vitest";
import { makeEnv, applyMigrations, signIn, call } from "./helpers";
import { emit } from "../src/events";
import { sendDigests, sendPendingEmails } from "../src/notify";

type Env = ReturnType<typeof makeEnv>;
type Pref = { kind: string; inApp: boolean; email: boolean };

async function setup(email: string) {
  const env = makeEnv();
  await applyMigrations(env.DB);
  const { token, user } = await signIn(env, email, "Pat");
  return { env, token, userId: user.id };
}

const getPrefs = async (env: Env, token: string) =>
  ((await (await call(env, token, "GET", "/me/notification-prefs")).json()) as { prefs: Pref[] }).prefs;

function notifyOne(env: Env, userId: string, type: string, title: string, href: string, court = false) {
  const stmts: D1PreparedStatement[] = [];
  emit(env, stmts, { type, actor: null, subject: { kind: "lab", id: "x" }, notify: [{ userIds: [userId], title, href, court }] });
  return env.DB.batch(stmts);
}

describe("notification prefs routes", () => {
  it("GET returns every kind's defaults merged with saved prefs", async () => {
    const { env, token } = await setup("prefs-get@mail.weber.edu");
    const before = await getPrefs(env, token);
    expect(before.length).toBeGreaterThan(10);
    expect(before.every((p) => p.inApp && !p.email)).toBe(true);
    expect(before.find((p) => p.kind === "posting.closed")).toEqual({ kind: "posting.closed", inApp: true, email: false });

    const put = await call(env, token, "PUT", "/me/notification-prefs", { prefs: [{ kind: "posting.closed", inApp: true, email: true }] });
    expect(put.status).toBe(200);
    const after = await getPrefs(env, token);
    expect(after).toHaveLength(before.length);
    expect(after.find((p) => p.kind === "posting.closed")).toEqual({ kind: "posting.closed", inApp: true, email: true });
    expect(after.find((p) => p.kind === "project.reopened")).toEqual({ kind: "project.reopened", inApp: true, email: false });
  });

  it("PUT refuses an unknown kind or a malformed pref", async () => {
    const { env, token } = await setup("prefs-bad@mail.weber.edu");
    for (const body of [
      { prefs: [{ kind: "nope", inApp: true, email: false }] },
      { prefs: [{ kind: "posting.closed", inApp: "yes", email: false }] },
      { prefs: "all" },
      {},
    ]) {
      expect((await call(env, token, "PUT", "/me/notification-prefs", body)).status).toBe(400);
    }
    expect((await getPrefs(env, token)).every((p) => p.inApp && !p.email)).toBe(true);
  });

  it("keeps action-needed kinds on in the app, and email off where the app is off", async () => {
    const { env, token } = await setup("prefs-court@mail.weber.edu");
    await call(env, token, "PUT", "/me/notification-prefs", {
      prefs: [
        { kind: "project.plan_returned", inApp: false, email: true },
        { kind: "project.reopened", inApp: false, email: true },
      ],
    });
    const prefs = await getPrefs(env, token);
    expect(prefs.find((p) => p.kind === "project.plan_returned")).toEqual({ kind: "project.plan_returned", inApp: true, email: true });
    expect(prefs.find((p) => p.kind === "project.reopened")).toEqual({ kind: "project.reopened", inApp: false, email: false });
  });

  it("needs a signed-in account", async () => {
    const env = makeEnv();
    await applyMigrations(env.DB);
    expect((await call(env, null, "GET", "/me/notification-prefs")).status).toBe(401);
  });
});

describe("sendPendingEmails", () => {
  it("emails the marked notification with its link and clears the flag", async () => {
    const { env, token, userId } = await setup("prefs-mail@mail.weber.edu");
    await call(env, token, "PUT", "/me/notification-prefs", { prefs: [{ kind: "posting.closed", inApp: true, email: true }] });
    await notifyOne(env, userId, "posting.closed", "“Hydrant map” is closed to new claims", "/projectum?view=myprojects");
    await notifyOne(env, userId, "project.reopened", "Reopened", "/projectum");

    const outbox: { to: string; subject: string; text: string }[] = [];
    const sent = await sendPendingEmails(env, async (_env, to, subject, text) => {
      outbox.push({ to, subject, text });
      return true;
    });
    expect(sent).toBe(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("prefs-mail@mail.weber.edu");
    expect(outbox[0].subject).toBe("“Hydrant map” is closed to new claims");
    expect(outbox[0].text).toContain(`${env.SITE_URL}/projectum?view=myprojects`);
    expect(outbox[0].text).toContain("Applied AI Lab");
    const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND email_pending = 1").bind(userId).first<{ n: number }>();
    expect(pending!.n).toBe(0);
    expect(await sendPendingEmails(env, async () => true)).toBe(0);
  });

  it("keeps the flag when the send fails, and skips accounts no longer active", async () => {
    const { env, token, userId } = await setup("prefs-fail@mail.weber.edu");
    await call(env, token, "PUT", "/me/notification-prefs", { prefs: [{ kind: "posting.closed", inApp: true, email: true }] });
    await notifyOne(env, userId, "posting.closed", "Closed", "/projectum");
    expect(await sendPendingEmails(env, async () => false)).toBe(0);
    const flag = () => env.DB.prepare("SELECT email_pending AS p FROM notifications WHERE user_id = ?").bind(userId).first<{ p: number }>();
    expect((await flag())!.p).toBe(1);

    await env.DB.prepare("UPDATE users SET status = 'removed' WHERE id = ?").bind(userId).run();
    const outbox: string[] = [];
    await sendPendingEmails(env, async (_e, to) => (outbox.push(to), true));
    expect(outbox).not.toContain("prefs-fail@mail.weber.edu");
  });

  it("tries a failed send again, up to three times in all", async () => {
    const { env, token, userId } = await setup("prefs-retry@mail.weber.edu");
    await call(env, token, "PUT", "/me/notification-prefs", { prefs: [{ kind: "posting.closed", inApp: true, email: true }] });
    await env.DB.prepare("UPDATE notifications SET email_pending = 0").run();
    await notifyOne(env, userId, "posting.closed", "Comes through", "/projectum");
    await notifyOne(env, userId, "posting.closed", "Never lands", "/projectum");
    const tries: string[] = [];
    // "Comes through" fails once (a blip) and then works. "Never lands" always fails.
    const send = async (_e: unknown, _to: string, subject: string) => {
      tries.push(subject);
      return subject === "Comes through" && tries.filter((t) => t === subject).length > 1;
    };
    expect(await sendPendingEmails(env, send)).toBe(0);
    expect(await sendPendingEmails(env, send)).toBe(1);
    expect(await sendPendingEmails(env, send)).toBe(0);
    expect(await sendPendingEmails(env, send)).toBe(0);
    expect(tries.filter((t) => t === "Comes through")).toHaveLength(2);
    expect(tries.filter((t) => t === "Never lands")).toHaveLength(3);
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND email_pending = 1").bind(userId).first<{ n: number }>();
    expect(left!.n).toBe(0);
  });

  it("does not let 50 failing emails hold back a newer one for good", async () => {
    const { env, token, userId } = await setup("prefs-stuck@mail.weber.edu");
    await call(env, token, "PUT", "/me/notification-prefs", { prefs: [{ kind: "reminder", inApp: true, email: true }] });
    await env.DB.prepare("UPDATE notifications SET email_pending = 0").run();
    for (let i = 0; i < 50; i++) await notifyOne(env, userId, "reminder", `Stuck ${i}`, "/projectum");
    await notifyOne(env, userId, "reminder", "Newer", "/projectum");
    const delivered: string[] = [];
    const send = async (_e: unknown, _to: string, subject: string) => (subject.startsWith("Stuck") ? false : (delivered.push(subject), true));
    for (let run = 0; run < 4; run++) await sendPendingEmails(env, send);
    expect(delivered).toEqual(["Newer"]);
  });

  it("sends at most 50 a run", async () => {
    const { env, token, userId } = await setup("prefs-cap@mail.weber.edu");
    await call(env, token, "PUT", "/me/notification-prefs", { prefs: [{ kind: "reminder", inApp: true, email: true }] });
    await env.DB.prepare("UPDATE notifications SET email_pending = 0").run();
    for (let i = 0; i < 55; i++) await notifyOne(env, userId, "reminder", `R${i}`, "/projectum");
    expect(await sendPendingEmails(env, async () => true)).toBe(50);
    expect(await sendPendingEmails(env, async () => true)).toBe(5);
  });
});

describe("daily digest", () => {
  type Mail = { to: string; subject: string; text: string };
  const collect = (outbox: Mail[], ok = true) => async (_env: unknown, to: string, subject: string, text: string) => (outbox.push({ to, subject, text }), ok);

  it("PATCH /me saves digest for any role and /me returns it", async () => {
    const { env, token } = await setup("digest-pref@mail.weber.edu");
    const me = async () => ((await (await call(env, token, "GET", "/me")).json()) as { user: { digest: boolean } }).user.digest;
    expect(await me()).toBe(false);
    expect((await call(env, token, "PATCH", "/me", { digest: true })).status).toBe(200);
    expect(await me()).toBe(true);
    await call(env, token, "PATCH", "/me", { digest: false });
    expect(await me()).toBe(false);
  });

  it("lists unread notifications in one email, and sends nothing a second time", async () => {
    const { env, token, userId } = await setup("digest-on@mail.weber.edu");
    await call(env, token, "PATCH", "/me", { digest: true });
    await notifyOne(env, userId, "reminder", "First thing", "/projectum?view=a");
    await notifyOne(env, userId, "reminder", "Second thing", "/projectum?view=b");
    await notifyOne(env, userId, "reminder", "Already seen", "/projectum");
    await env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND title = 'Already seen'").bind(new Date().toISOString(), userId).run();

    const outbox: Mail[] = [];
    const now = new Date(Date.now() + 1000);
    expect(await sendDigests(env, now, collect(outbox))).toBe(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("digest-on@mail.weber.edu");
    expect(outbox[0].subject).toBe("Your Applied AI Lab digest");
    expect(outbox[0].text).toContain("First thing");
    expect(outbox[0].text).toContain(`${env.SITE_URL}/projectum?view=b`);
    expect(outbox[0].text).not.toContain("Already seen");
    expect(await sendDigests(env, new Date(now.getTime() + 1000), collect(outbox))).toBe(0);
    expect(outbox).toHaveLength(1);
  });

  it("sends nothing with the digest off, and keeps the clock when a send fails", async () => {
    const { env, token, userId } = await setup("digest-off@mail.weber.edu");
    await notifyOne(env, userId, "reminder", "Unseen", "/projectum");
    const outbox: Mail[] = [];
    const now = new Date(Date.now() + 1000);
    expect(await sendDigests(env, now, collect(outbox))).toBe(0);
    expect(outbox).toHaveLength(0);

    await call(env, token, "PATCH", "/me", { digest: true });
    expect(await sendDigests(env, now, collect(outbox, false))).toBe(0);
    const row = await env.DB.prepare("SELECT digest_sent_at AS at FROM users WHERE id = ?").bind(userId).first<{ at: string | null }>();
    expect(row!.at).toBeNull();
    expect(await sendDigests(env, now, collect(outbox))).toBe(1);
  });

  it("caps the list at 50 with an 'and N more' line", async () => {
    const { env, token, userId } = await setup("digest-cap@mail.weber.edu");
    await call(env, token, "PATCH", "/me", { digest: true });
    for (let i = 0; i < 53; i++) await notifyOne(env, userId, "reminder", `Item ${i}`, "/projectum");
    const outbox: Mail[] = [];
    await sendDigests(env, new Date(Date.now() + 1000), collect(outbox));
    expect(outbox[0].text.match(/^- /gm)).toHaveLength(50);
    expect(outbox[0].text).toContain("and 3 more");
  });
});
