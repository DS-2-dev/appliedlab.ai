// GET /shell: the small payload the site polls for the sidebar badges and
// the bell. The court count reuses getCourt rather than a second set of
// queries (it is a handful of indexed reads per role); the open-review count
// is its own query because it counts reviews assigned to other reps too.

import { isStaff, type AccountEnv, type Json, type UserRow } from "./accounts";
import { getCourt, REVIEW_GATES } from "./court";
import { marks } from "./db";
import { listNotifications } from "./notify";

export async function handleShell(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  if (new URL(req.url).pathname !== "/shell" || req.method !== "GET") return null;
  const [items, bell, open] = await Promise.all([
    getCourt(env, user),
    listNotifications(env, user.id, 12),
    isStaff(env, user)
      ? env.DB.prepare(`SELECT COUNT(*) AS n FROM reviews WHERE status = 'open' AND gate IN (${marks(REVIEW_GATES.length)})`)
          .bind(...REVIEW_GATES)
          .first<{ n: number }>()
      : Promise.resolve(null),
  ]);
  return json({
    court: items.filter((i) => i.urgency === "action").length,
    reviews: open?.n ?? 0,
    unread: bell.unread,
    notifications: bell.notifications,
    // A primary's pending requests, an admin's stale ones; a request both
    // would see counts once.
    requests: new Set(items.filter((i) => i.kind === "org_request").map((i) => i.id)).size,
  });
}
