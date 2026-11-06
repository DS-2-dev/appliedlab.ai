// The event log and the notifications that hang off it. emit() only builds
// statements: the caller pushes more onto the same array and runs one
// env.DB.batch(stmts), so the state change, the event and the notifications
// land together or not at all. Recipient helpers are async and run first.

import { isAdmin, type AccountEnv, type UserRow } from "./accounts";

export type Recipients = { userIds: string[]; court?: boolean };

export type EmitInput = {
  type: string;
  actor: UserRow | null;
  subject: { kind: "posting" | "project" | "org" | "user" | "review" | "lab"; id: string };
  postingId?: string;
  projectId?: string;
  orgId?: string;
  payload?: Record<string, unknown>;
  notify: Array<Recipients & { title: string; href: string }>;
};

// Pushes one events row and one notifications row per recipient. The actor
// never hears about their own action; ids repeat within a group only once,
// but a person in two groups gets a notification for each.
export function emit(env: AccountEnv, stmts: D1PreparedStatement[], e: EmitInput): void {
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  const actorId = e.actor?.id ?? null;
  stmts.push(
    env.DB.prepare(
      "INSERT INTO events (id, type, actor_id, via_user_id, subject_kind, subject_id, posting_id, project_id, org_id, payload, created_at) " +
        "VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, e.type, actorId, e.subject.kind, e.subject.id, e.postingId ?? null, e.projectId ?? null, e.orgId ?? null, JSON.stringify(e.payload ?? {}), at),
  );
  for (const group of e.notify) {
    const ids = [...new Set(group.userIds.filter((u) => u && u !== actorId))];
    for (const userId of ids) {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO notifications (id, user_id, kind, title, href, court, event_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(crypto.randomUUID(), userId, e.type, group.title.slice(0, 200), group.href, group.court ? 1 : 0, id, at),
      );
    }
  }
}

type Who = { id: string; email: string; status: string; roles: string };

async function activeUsers(env: AccountEnv): Promise<Who[]> {
  const { results } = await env.DB.prepare("SELECT id, email, status, roles FROM users WHERE status = 'active'").all<Who>();
  return results;
}

// Active accounts with the admin role, or listed in APPROVER_EMAIL/APPROVERS.
export async function adminIds(env: AccountEnv): Promise<string[]> {
  return (await activeUsers(env)).filter((u) => isAdmin(env, u)).map((u) => u.id);
}

export async function repIds(env: AccountEnv): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT u.id FROM users u WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM json_each(u.roles) WHERE value = 'rep')",
  ).all<{ id: string }>();
  return results.map((r) => r.id);
}

// Reps and admins, once each.
export async function staffIds(env: AccountEnv): Promise<string[]> {
  const [a, r] = await Promise.all([adminIds(env), repIds(env)]);
  return [...new Set([...a, ...r])];
}

export async function orgUserIds(env: AccountEnv, orgId: string): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT id FROM users WHERE org_id = ? AND status = 'active'").bind(orgId).all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function projectMemberIds(env: AccountEnv, projectId: string): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT user_id FROM project_members WHERE project_id = ?").bind(projectId).all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}

// The organization's active primary contact, or every admin when it has none.
export async function orgPrimaryOrAdmins(env: AccountEnv, orgId: string): Promise<string[]> {
  const primary = await env.DB.prepare(
    "SELECT u.id FROM orgs o JOIN users u ON u.id = o.primary_user_id WHERE o.id = ? AND u.status = 'active'",
  )
    .bind(orgId)
    .first<{ id: string }>();
  return primary ? [primary.id] : adminIds(env);
}
