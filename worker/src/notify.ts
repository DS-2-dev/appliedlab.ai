// Notifications for the bell in Projectum: one row per person per event,
// written next to the emails that already go out (pipeline.ts, accounts.ts).
// The title is the whole message, and href is the Projectum page it leads
// to. Writing one never fails a request: a notification that can't be
// saved is only logged.

import { type AccountEnv, type Json, type UserRow } from "./accounts";
import { normalizeEmail } from "@/lib/email-rules";

export type NotificationKind =
  | "claim-new"
  | "claim-approved"
  | "claim-denied"
  | "submission-new"
  | "submission-accepted"
  | "submission-returned"
  | "partner-new"
  | "partner-approved"
  | "meeting-requested"
  | "selected"
  | "complete"
  | "team-submitted"
  | "reminder";

export async function notify(
  env: AccountEnv,
  userIds: string[],
  kind: NotificationKind,
  title: string,
  href: string,
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  const at = new Date().toISOString();
  try {
    await env.DB.batch(
      ids.map((id) =>
        env.DB.prepare("INSERT INTO notifications (id, user_id, kind, title, href, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
          crypto.randomUUID(),
          id,
          kind,
          title.slice(0, 200),
          href,
          at,
        ),
      ),
    );
  } catch (e) {
    console.error("[notify] couldn't save", kind, e);
  }
}

// Everyone who approves: reps, APPROVER_EMAIL and APPROVERS, if they have
// an account. `except` leaves out whoever caused the event.
export async function approverIds(env: AccountEnv & { APPROVERS?: string }, except = ""): Promise<string[]> {
  const listed = [env.APPROVER_EMAIL, ...(env.APPROVERS ?? "").split(",")].map((e) => normalizeEmail(e)).filter(Boolean);
  const marks = listed.map(() => "?").join(",") || "''";
  const { results } = await env.DB.prepare(
    `SELECT id FROM users WHERE status = 'active' AND (role = 'rep' OR email IN (${marks}))`,
  )
    .bind(...listed)
    .all<{ id: string }>();
  return results.map((r) => r.id).filter((id) => id !== except);
}

export async function teamIds(env: AccountEnv, claimId: string): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT user_id FROM claim_members WHERE claim_id = ?").bind(claimId).all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}

// GET /notifications: the latest 40 and how many are unread.
// POST /notifications/read: { ids } marks those read, { all: true } all.
export async function handleNotifications(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname === "/notifications" && req.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, kind, title, href, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40",
    )
      .bind(user.id)
      .all<{ id: string; kind: NotificationKind; title: string; href: string; read_at: string | null; created_at: string }>();
    const unread = await env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL")
      .bind(user.id)
      .first<{ n: number }>();
    return json({
      unread: unread?.n ?? 0,
      notifications: results.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        href: n.href,
        read: Boolean(n.read_at),
        createdAt: n.created_at,
      })),
    });
  }
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
