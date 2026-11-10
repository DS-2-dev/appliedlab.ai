// The bell in Projectum: reading and clearing notifications. They are
// written by emit() (events.ts), one row per person per event, in the same
// batch as the change they describe. The title is the whole message, and
// href is the Projectum page it leads to. Each person also chooses, per
// kind, whether it shows in the bell and whether it comes by email
// (notification_prefs); the ones to email are sent from here.

import { defaultsFor, notificationKind, notificationKinds, type Channels } from "@/lib/notification-kinds";
import { type AccountEnv, type Json, type UserRow, isAdmin, sendEmail } from "./accounts";

// The event type that wrote it (emit), or an older kind from before the
// event log (claim-approved, reminder and the like).
export type NotificationKind = string;

export type NotificationOut = {
  id: string;
  kind: NotificationKind;
  title: string;
  href: string;
  court: boolean;
  read: boolean;
  createdAt: string;
};

// A person's newest notifications and how many are unread.
export async function listNotifications(env: AccountEnv, userId: string, limit: number): Promise<{ unread: number; notifications: NotificationOut[] }> {
  const { results } = await env.DB.prepare(
    "SELECT id, kind, title, href, court, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
  )
    .bind(userId, limit)
    .all<{ id: string; kind: NotificationKind; title: string; href: string; court: number; read_at: string | null; created_at: string }>();
  const unread = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL")
    .bind(userId)
    .first<{ n: number }>();
  return {
    unread: unread?.n ?? 0,
    notifications: results.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      href: n.href,
      court: n.court === 1,
      read: Boolean(n.read_at),
      createdAt: n.created_at,
    })),
  };
}

type Pref = Channels & { kind: string };

// Every kind, the person's role defaults with their saved prefs over them.
async function prefsOf(env: AccountEnv, user: UserRow): Promise<Pref[]> {
  const defaults = defaultsFor(isAdmin(env, user) ? "admin" : user.role);
  const { results } = await env.DB.prepare("SELECT kind, in_app, email FROM notification_prefs WHERE user_id = ?")
    .bind(user.id)
    .all<{ kind: string; in_app: number; email: number }>();
  const saved = new Map(results.map((r) => [r.kind, { inApp: r.in_app === 1, email: r.email === 1 }]));
  return notificationKinds.map((k) => ({ kind: k.kind, ...(saved.get(k.kind) ?? defaults[k.kind]) }));
}

// PUT /me/notification-prefs: { prefs: [{ kind, inApp, email }] }, any
// number of kinds, each a known one. A court kind stays on in the app, and
// email is off where the app is, since an email goes out for a stored
// notification only.
async function savePrefs(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { prefs?: unknown } | null;
  const list = body?.prefs;
  if (!Array.isArray(list) || list.length > notificationKinds.length) return json({ error: "prefs" }, 400);
  const rows: { kind: string; inApp: boolean; email: boolean }[] = [];
  for (const p of list as { kind?: unknown; inApp?: unknown; email?: unknown }[]) {
    const known = typeof p?.kind === "string" ? notificationKind(p.kind) : undefined;
    if (!known || typeof p.inApp !== "boolean" || typeof p.email !== "boolean") return json({ error: "prefs" }, 400);
    const inApp = known.court || p.inApp;
    rows.push({ kind: known.kind, inApp, email: inApp && p.email });
  }
  if (rows.length) {
    await env.DB.batch(
      rows.map((r) =>
        env.DB.prepare(
          "INSERT INTO notification_prefs (user_id, kind, in_app, email) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (user_id, kind) DO UPDATE SET in_app = excluded.in_app, email = excluded.email",
        ).bind(user.id, r.kind, r.inApp ? 1 : 0, r.email ? 1 : 0),
      ),
    );
  }
  return json({ prefs: await prefsOf(env, user) });
}

// GET /notifications: the latest 40 and how many are unread.
// GET and PUT /me/notification-prefs: the person's choices (above).
// POST /notifications/read: { ids } marks those read, { all: true } all.
export async function handleNotifications(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname === "/me/notification-prefs" && req.method === "GET") return json({ prefs: await prefsOf(env, user) });
  if (pathname === "/me/notification-prefs" && req.method === "PUT") return savePrefs(req, env, user, json);
  if (pathname === "/notifications" && req.method === "GET") return json(await listNotifications(env, user.id, 40));
  if (pathname === "/notifications/read" && req.method === "POST") {
    const body = ((await req.json().catch(() => null)) ?? {}) as { ids?: unknown; all?: unknown };
    const at = new Date().toISOString();
    if (body.all === true) {
      await env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(at, user.id).run();
    } else if (Array.isArray(body.ids)) {
      const ids = body.ids.filter((i): i is string => typeof i === "string" && /^[\w-]{1,64}$/.test(i)).slice(0, 50);
      if (ids.length) {
        await env.DB.prepare(
          `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
        )
          .bind(at, user.id, ...ids)
          .run();
      }
    }
    return json({ ok: true });
  }
  return null;
}

// The daily tidy-up: read notifications older than 60 days go.
export async function clearOldNotifications(env: AccountEnv): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < ?").bind(cutoff).run();
}

export type SendEmail = (env: AccountEnv, to: string, subject: string, text: string) => Promise<boolean>;

const EMAIL_BATCH = 50;
const EMAIL_TRIES = 3;

// Emails the notifications marked email_pending, oldest first, up to 50 a
// run, to active accounts only. Runs after each request that changed
// something (index.ts) and in the daily cron. The rows are claimed before
// sending, so two runs at once don't send twice, and a failed send puts its
// flag back for the next run, up to three tries in all, so one that keeps
// failing gives up rather than holding the queue. Returns how many went out.
// send is sendEmail, or a stand-in in tests.
export async function sendPendingEmails(env: AccountEnv, send: SendEmail = sendEmail): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT n.id, n.title, n.href, u.email FROM notifications n JOIN users u ON u.id = n.user_id " +
      "WHERE n.email_pending = 1 AND u.status = 'active' ORDER BY n.created_at, n.id LIMIT ?",
  )
    .bind(EMAIL_BATCH)
    .all<{ id: string; title: string; href: string; email: string }>();
  if (results.length === 0) return 0;
  const claimed = await env.DB.prepare(
    `UPDATE notifications SET email_pending = 0, email_attempts = email_attempts + 1 WHERE email_pending = 1 AND id IN (${results.map(() => "?").join(",")}) RETURNING id`,
  )
    .bind(...results.map((r) => r.id))
    .all<{ id: string }>();
  const mine = new Set(claimed.results.map((r) => r.id));
  const failed: string[] = [];
  for (const n of results) {
    if (!mine.has(n.id)) continue;
    const ok = await send(env, n.email, n.title, `${n.title}\n\n${env.SITE_URL}${n.href}\n\nApplied AI Lab`).catch(() => false);
    if (!ok) failed.push(n.id);
  }
  if (failed.length) {
    await env.DB.prepare(
      `UPDATE notifications SET email_pending = 1 WHERE email_attempts < ? AND id IN (${failed.map(() => "?").join(",")})`,
    )
      .bind(EMAIL_TRIES, ...failed)
      .run();
  }
  return mine.size - failed.length;
}

const DIGEST_LINES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// The daily digest, for each active person who turned it on: one email
// listing their unread notifications made since the last one (or in the
// last 24 hours the first time), up to 50 with a count of the rest. Nothing
// goes out for an empty list. digest_sent_at moves to now only once the send
// worked, so a failed one is tried again next run. Returns how many emails
// went out. send is sendEmail, or a stand-in in tests.
export async function sendDigests(env: AccountEnv, now: Date, send: SendEmail = sendEmail): Promise<number> {
  const at = now.toISOString();
  const { results: people } = await env.DB.prepare("SELECT id, email, digest_sent_at FROM users WHERE digest = 1 AND status = 'active'").all<{
    id: string;
    email: string;
    digest_sent_at: string | null;
  }>();
  let sent = 0;
  for (const p of people) {
    const since = p.digest_sent_at ?? new Date(now.getTime() - DAY_MS).toISOString();
    const where = "WHERE user_id = ? AND read_at IS NULL AND created_at > ? AND created_at <= ?";
    const { results } = await env.DB.prepare(`SELECT title, href FROM notifications ${where} ORDER BY created_at, id LIMIT ?`)
      .bind(p.id, since, at, DIGEST_LINES)
      .all<{ title: string; href: string }>();
    if (results.length === 0) continue;
    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM notifications ${where}`).bind(p.id, since, at).first<{ n: number }>();
    const lines = results.map((n) => `- ${n.title}\n  ${env.SITE_URL}${n.href}`);
    const more = (total?.n ?? results.length) - results.length;
    if (more > 0) lines.push(`and ${more} more`);
    const ok = await send(env, p.email, "Your Applied AI Lab digest", `${lines.join("\n\n")}\n\nApplied AI Lab`).catch(() => false);
    if (!ok) continue;
    await env.DB.prepare("UPDATE users SET digest_sent_at = ? WHERE id = ?").bind(at, p.id).run();
    sent++;
  }
  return sent;
}
