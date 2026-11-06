// The bell in Projectum: reading and clearing notifications. They are
// written by emit() (events.ts), one row per person per event, in the same
// batch as the change they describe. The title is the whole message, and
// href is the Projectum page it leads to.

import { type AccountEnv, type Json, type UserRow } from "./accounts";

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

// GET /notifications: the latest 40 and how many are unread.
// POST /notifications/read: { ids } marks those read, { all: true } all.
export async function handleNotifications(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
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
