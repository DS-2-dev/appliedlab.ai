// "In your court": what is waiting on the signed-in person, one list across
// every role they hold. GET /court returns it sorted (action first, oldest
// first). The membership rules:
//
//   member   own projects in claimed, plan_returned, active,
//            submission_returned, integrated (action for claimed and the
//            returned ones, work otherwise)
//   partner  (with an organization) its postings in draft (work) and
//            returned (action); its projects delivered with no selection or
//            in completion_review (action); when primary, pending requests
//            to join (action)
//   rep/admin open reviews that are unassigned or mine, and requested
//            meetings (action)
//   admin    also pending partner accounts, and pending org requests older
//            than seven days or whose organization has no primary (action)

import { courtSort, type CourtItem } from "@/lib/pipeline/court";
import type { Role } from "@/lib/pipeline/domain";
import { stateOf } from "@/lib/pipeline/machines";
import { hasRole, isAdmin, isStaff, rolesOf, type AccountEnv, type Json, type UserRow } from "./accounts";
import { marks } from "./db";

const STALE_REQUEST_MS = 7 * 24 * 60 * 60 * 1000;
const MEMBER_STATUSES = ["claimed", "plan_returned", "active", "submission_returned", "integrated"];
const ACTION_STATUSES = ["claimed", "plan_returned", "submission_returned"];
export const REVIEW_GATES = ["posting", "action_plan", "submission", "completion"];
const GATE_LABEL: Record<string, string> = {
  posting: "Posting",
  action_plan: "Action plan",
  submission: "Submission",
  completion: "Completion",
};

const projectHref = (boardId: string | null) => (boardId ? `/projectum?project=${boardId}` : "/projectum?view=myprojects");
const statusLabel = (kind: "project" | "posting", status: string) => stateOf(kind, status).label;

type ProjectRow = {
  id: string;
  status: string;
  posting_title: string;
  lead_name: string;
  board_id: string | null;
  claimed_at: string;
  plan_submitted_at: string | null;
  activated_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  integrated_at: string | null;
  updated_at: string;
  plan_returned_at: string | null;
  submission_returned_at: string | null;
};

// The columns and joins both the member and partner project lists read.
const PROJECT_SELECT =
  "SELECT p.id, p.status, po.title AS posting_title, lead.name AS lead_name, b.id AS board_id, p.claimed_at, p.plan_submitted_at, " +
  "p.activated_at, p.submitted_at, p.delivered_at, p.integrated_at, p.updated_at, " +
  "(SELECT MAX(r.decided_at) FROM reviews r WHERE r.gate = 'action_plan' AND r.subject_id = p.id AND r.status = 'returned') AS plan_returned_at, " +
  "(SELECT MAX(r.decided_at) FROM reviews r WHERE r.gate = 'submission' AND r.subject_id = p.id AND r.status = 'returned') AS submission_returned_at " +
  "FROM projects p JOIN postings po ON po.id = p.posting_id JOIN users lead ON lead.id = p.lead_id LEFT JOIN boards b ON b.project_id = p.id ";

// When the project entered the status it is in.
function projectSince(p: ProjectRow): string {
  const at: Record<string, string | null> = {
    claimed: p.claimed_at,
    plan_returned: p.plan_returned_at ?? p.plan_submitted_at,
    active: p.activated_at,
    submission_returned: p.submission_returned_at ?? p.submitted_at,
    delivered: p.delivered_at,
    integrated: p.integrated_at,
    completion_review: p.integrated_at ?? p.delivered_at,
  };
  return at[p.status] ?? p.updated_at;
}

function projectItem(p: ProjectRow, role: Role, urgency: CourtItem["urgency"]): CourtItem {
  return {
    role,
    kind: "project",
    id: p.id,
    title: p.posting_title,
    subtitle: `${statusLabel("project", p.status)} · ${p.lead_name}`,
    status: p.status,
    urgency,
    since: projectSince(p),
    href: projectHref(p.board_id),
  };
}

async function memberItems(env: AccountEnv, user: UserRow): Promise<CourtItem[]> {
  const { results } = await env.DB.prepare(
    `${PROJECT_SELECT}JOIN project_members m ON m.project_id = p.id AND m.user_id = ? WHERE p.status IN (${marks(MEMBER_STATUSES.length)})`,
  )
    .bind(user.id, ...MEMBER_STATUSES)
    .all<ProjectRow>();
  return results.map((p) => projectItem(p, "member", ACTION_STATUSES.includes(p.status) ? "action" : "work"));
}

async function partnerItems(env: AccountEnv, user: UserRow, orgId: string): Promise<CourtItem[]> {
  const items: CourtItem[] = [];
  const postings = await env.DB.prepare(
    "SELECT po.id, po.title, po.status, po.updated_at, " +
      "(SELECT MAX(r.decided_at) FROM reviews r WHERE r.gate = 'posting' AND r.subject_id = po.id AND r.status = 'returned') AS returned_at " +
      "FROM postings po WHERE po.org_id = ? AND po.status IN ('draft', 'returned')",
  )
    .bind(orgId)
    .all<{ id: string; title: string; status: string; updated_at: string; returned_at: string | null }>();
  for (const po of postings.results) {
    items.push({
      role: "partner",
      kind: "posting",
      id: po.id,
      title: po.title,
      subtitle: statusLabel("posting", po.status),
      status: po.status,
      urgency: po.status === "returned" ? "action" : "work",
      since: po.status === "returned" ? (po.returned_at ?? po.updated_at) : po.updated_at,
      href: `/projectum?view=posting&id=${po.id}`,
    });
  }
  const projects = await env.DB.prepare(
    `${PROJECT_SELECT}WHERE po.org_id = ? AND (p.status = 'completion_review' OR (p.status = 'delivered' AND NOT EXISTS (SELECT 1 FROM selections s WHERE s.project_id = p.id)))`,
  )
    .bind(orgId)
    .all<ProjectRow>();
  for (const p of projects.results) items.push(projectItem(p, "partner", "action"));

  const requests = await env.DB.prepare(
    "SELECT r.id, r.created_at, u.name AS user_name, o.name AS org_name FROM org_requests r JOIN users u ON u.id = r.user_id " +
      "JOIN orgs o ON o.id = r.org_id WHERE r.org_id = ? AND o.primary_user_id = ? AND r.status = 'pending'",
  )
    .bind(orgId, user.id)
    .all<{ id: string; created_at: string; user_name: string; org_name: string }>();
  for (const r of requests.results) items.push(requestItem(r, "partner"));
  return items;
}

const requestItem = (r: { id: string; created_at: string; user_name: string; org_name: string }, role: Role): CourtItem => ({
  role,
  kind: "org_request",
  id: r.id,
  title: r.user_name,
  subtitle: r.org_name,
  status: "pending",
  urgency: "action",
  since: r.created_at,
  href: "/projectum?view=org",
});

async function staffItems(env: AccountEnv, user: UserRow, role: Role): Promise<CourtItem[]> {
  const items: CourtItem[] = [];
  // A review of the viewer's own team's work belongs to other reps.
  const reviews = await env.DB.prepare(
    "SELECT r.id, r.gate, r.opened_at, COALESCE(pp.title, po.title, r.subject_id) AS title, COALESCE(pa.name, lead.name, '') AS who " +
      "FROM reviews r " +
      "LEFT JOIN postings pp ON r.gate = 'posting' AND pp.id = r.subject_id " +
      "LEFT JOIN users pa ON pa.id = pp.author_id " +
      "LEFT JOIN projects pr ON r.gate <> 'posting' AND pr.id = r.subject_id " +
      "LEFT JOIN postings po ON po.id = pr.posting_id " +
      "LEFT JOIN users lead ON lead.id = pr.lead_id " +
      `WHERE r.status = 'open' AND r.gate IN (${marks(REVIEW_GATES.length)}) AND (r.assigned_to IS NULL OR r.assigned_to = ?) ` +
      "AND NOT EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = pr.id AND m.user_id = ?)",
  )
    .bind(...REVIEW_GATES, user.id, user.id)
    .all<{ id: string; gate: string; opened_at: string; title: string; who: string }>();
  for (const r of reviews.results) {
    items.push({
      role,
      kind: "review",
      id: r.id,
      title: `${GATE_LABEL[r.gate] ?? r.gate}: ${r.title}`,
      subtitle: r.who,
      status: "open",
      urgency: "action",
      since: r.opened_at,
      href: `/projectum?view=review&id=${r.id}`,
    });
  }
  const meetings = await env.DB.prepare(
    "SELECT m.id, m.project_id, m.created_at, po.title, COALESCE(u.name, '') AS who FROM meetings m JOIN projects p ON p.id = m.project_id " +
      "JOIN postings po ON po.id = p.posting_id LEFT JOIN users u ON u.id = m.requested_by WHERE m.status = 'requested'",
  ).all<{ id: string; project_id: string; created_at: string; title: string; who: string }>();
  for (const m of meetings.results) {
    items.push({
      role,
      kind: "meeting",
      id: m.id,
      title: m.title,
      subtitle: m.who,
      status: "requested",
      urgency: "action",
      since: m.created_at,
      // The project's board, where staff mark it arranged.
      href: `/projectum?view=project&id=${m.project_id}`,
    });
  }
  return items;
}

async function adminItems(env: AccountEnv): Promise<CourtItem[]> {
  const items: CourtItem[] = [];
  const partners = await env.DB.prepare(
    "SELECT id, name, email, created_at FROM users WHERE status = 'pending' AND role = 'partner'",
  ).all<{ id: string; name: string; email: string; created_at: string }>();
  for (const u of partners.results) {
    items.push({
      role: "admin",
      kind: "partner",
      id: u.id,
      title: u.name,
      subtitle: u.email,
      status: "pending",
      urgency: "action",
      since: u.created_at,
      href: "/projectum?view=overview",
    });
  }
  const cutoff = new Date(Date.now() - STALE_REQUEST_MS).toISOString();
  const requests = await env.DB.prepare(
    "SELECT r.id, r.created_at, u.name AS user_name, o.name AS org_name FROM org_requests r JOIN users u ON u.id = r.user_id " +
      "JOIN orgs o ON o.id = r.org_id LEFT JOIN users pu ON pu.id = o.primary_user_id " +
      "WHERE r.status = 'pending' AND (r.created_at < ? OR pu.id IS NULL OR pu.status <> 'active')",
  )
    .bind(cutoff)
    .all<{ id: string; created_at: string; user_name: string; org_name: string }>();
  for (const r of requests.results) items.push(requestItem(r, "admin"));
  return items;
}

// Everything waiting on the person across the roles they hold, unsorted.
export async function getCourt(env: AccountEnv, user: UserRow): Promise<CourtItem[]> {
  const parts: Array<Promise<CourtItem[]>> = [];
  const roles = rolesOf(user);
  if (roles.includes("member")) parts.push(memberItems(env, user));
  if (roles.includes("partner") && user.org_id) parts.push(partnerItems(env, user, user.org_id));
  if (isStaff(env, user)) parts.push(staffItems(env, user, hasRole(env, user, "rep") ? "rep" : "admin"));
  if (isAdmin(env, user)) parts.push(adminItems(env));
  return (await Promise.all(parts)).flat();
}

export async function handleCourt(req: Request, env: AccountEnv, user: UserRow, json: Json): Promise<Response | null> {
  if (new URL(req.url).pathname !== "/court" || req.method !== "GET") return null;
  return json({ items: courtSort(await getCourt(env, user)) });
}
