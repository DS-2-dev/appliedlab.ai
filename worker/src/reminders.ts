// Reminders, run once a day with the health check (index.ts, the cron in
// wrangler.jsonc), so work doesn't quietly stall:
// - Waiting on the Lab: when an open review (any gate), a pending partner
//   account, a pending request to join an organization or a requested
//   meeting has waited more than 3 days, the approver gets one summary email
//   that day (APPROVER_EMAIL), and all staff a bell notification.
// - Deadline close: 3 days or less before the deadline of a project being
//   worked (active or submission_returned), the posting's or the plan's own
//   finish date, whichever comes first, the team hears once.
// - Quiet board: when such a project, with nothing waiting, has a board
//   that hasn't changed in 14 days, the team hears once; editing the board
//   starts the clock again.
// Each reminder is recorded in reminders_sent under a key naming what it
// was about, and a key already there is never sent again. Bell notices go
// out through emit() as "reminder" events.

import { type AccountEnv, sendEmail } from "./accounts";
import { json as parse } from "./db";
import { emit, projectMemberIds, staffIds } from "./events";

const DAY = 24 * 60 * 60 * 1000;
const WAITING_DAYS = 3;
const DEADLINE_DAYS = 3;
const QUIET_DAYS = 14;

// Records the key; false when it was already there.
async function firstTime(env: AccountEnv, key: string): Promise<boolean> {
  const r = await env.DB.prepare("INSERT INTO reminders_sent (key, sent_at) VALUES (?, ?) ON CONFLICT(key) DO NOTHING")
    .bind(key, new Date().toISOString())
    .run();
  return r.meta.changes > 0;
}

async function teamEmails(env: AccountEnv, projectId: string) {
  const { results } = await env.DB.prepare(
    "SELECT u.email, u.name FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? AND u.status = 'active'",
  )
    .bind(projectId)
    .all<{ email: string; name: string }>();
  return results;
}

// One "reminder" event with its bell notices.
async function remind(env: AccountEnv, subject: { kind: "project" | "lab"; id: string }, userIds: string[], title: string, href: string) {
  const stmts: D1PreparedStatement[] = [];
  emit(env, stmts, {
    type: "reminder",
    actor: null,
    subject,
    projectId: subject.kind === "project" ? subject.id : undefined,
    notify: [{ userIds, court: false, title, href }],
  });
  await env.DB.batch(stmts);
}

const day = (iso: string) => iso.slice(0, 10);

function niceDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const GATE_LABEL: Record<string, string> = {
  posting: "Posting",
  action_plan: "Action plan",
  submission: "Submission",
  completion: "Completion",
};

// What has waited on the Lab more than 3 days, as lines for the summary.
async function waitingOnLab(env: AccountEnv): Promise<string[]> {
  const before = new Date(Date.now() - WAITING_DAYS * DAY).toISOString();
  const lines: string[] = [];
  const reviews = await env.DB.prepare(
    "SELECT r.gate, r.opened_at, COALESCE(g.title, pg.title, '') AS title FROM reviews r " +
      "LEFT JOIN postings g ON r.gate = 'posting' AND g.id = r.subject_id " +
      "LEFT JOIN projects p ON r.gate <> 'posting' AND p.id = r.subject_id LEFT JOIN postings pg ON pg.id = p.posting_id " +
      "WHERE r.status = 'open' AND r.opened_at < ? ORDER BY r.opened_at",
  )
    .bind(before)
    .all<{ gate: string; opened_at: string; title: string }>();
  for (const r of reviews.results) lines.push(`${GATE_LABEL[r.gate] ?? "Review"}: "${r.title}", since ${niceDate(day(r.opened_at))}`);
  // Submissions from before the event log have no review of their own.
  const subs = await env.DB.prepare(
    "SELECT g.title, s.created_at FROM submissions s JOIN projects p ON p.id = s.project_id JOIN postings g ON g.id = p.posting_id " +
      "WHERE s.status = 'pending' AND s.created_at < ? " +
      "AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.gate = 'submission' AND r.subject_id = s.project_id AND r.status = 'open') ORDER BY s.created_at",
  )
    .bind(before)
    .all<{ title: string; created_at: string }>();
  for (const s of subs.results) lines.push(`Submission: "${s.title}", since ${niceDate(day(s.created_at))}`);
  const meetings = await env.DB.prepare(
    "SELECT g.title, m.created_at FROM meetings m JOIN projects p ON p.id = m.project_id JOIN postings g ON g.id = p.posting_id " +
      "WHERE m.status = 'requested' AND m.created_at < ? ORDER BY m.created_at",
  )
    .bind(before)
    .all<{ title: string; created_at: string }>();
  for (const m of meetings.results) lines.push(`Meeting to arrange: "${m.title}", since ${niceDate(day(m.created_at))}`);
  const partners = await env.DB.prepare(
    "SELECT name, created_at FROM users WHERE role = 'partner' AND status = 'pending' AND created_at < ? ORDER BY created_at",
  )
    .bind(before)
    .all<{ name: string; created_at: string }>();
  for (const p of partners.results) lines.push(`New business: ${p.name}, since ${niceDate(day(p.created_at))}`);
  const requests = await env.DB.prepare(
    "SELECT u.name, o.name AS org, r.created_at FROM org_requests r JOIN users u ON u.id = r.user_id JOIN orgs o ON o.id = r.org_id " +
      "WHERE r.status = 'pending' AND r.created_at < ? ORDER BY r.created_at",
  )
    .bind(before)
    .all<{ name: string; org: string; created_at: string }>();
  for (const r of requests.results) lines.push(`Join request: ${r.name} to ${r.org}, since ${niceDate(day(r.created_at))}`);
  return lines;
}

async function remindLab(env: AccountEnv, today: string): Promise<number> {
  const lines = await waitingOnLab(env);
  if (!lines.length || !(await firstTime(env, `lab:${today}`))) return 0;
  const n = lines.length;
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `${n} ${n === 1 ? "thing has" : "things have"} waited more than ${WAITING_DAYS} days`,
    `These are waiting on the Lab:\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\n${env.SITE_URL}/projectum?view=reviews\n\nApplied AI Lab`,
  );
  await remind(
    env,
    { kind: "lab", id: today },
    await staffIds(env),
    `${n} ${n === 1 ? "item has" : "items have"} waited on the Lab more than ${WAITING_DAYS} days`,
    "/projectum?view=reviews",
  );
  return 1;
}

interface ActiveProject {
  id: string;
  title: string;
  deadline: string;
  plan: string;
  activated_at: string | null;
  board_updated: string | null;
  board_id: string | null;
}

// Projects being worked: active, or back from a returned submission, with
// nothing waiting or accepted.
async function activeProjects(env: AccountEnv): Promise<ActiveProject[]> {
  const { results } = await env.DB.prepare(
    "SELECT p.id, g.title, g.deadline, p.plan, p.activated_at, b.updated_at AS board_updated, b.id AS board_id " +
      "FROM projects p JOIN postings g ON g.id = p.posting_id LEFT JOIN boards b ON b.project_id = p.id " +
      "WHERE p.status IN ('active', 'submission_returned') " +
      "AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.project_id = p.id AND s.status IN ('pending', 'accepted'))",
  ).all<ActiveProject>();
  return results;
}

function finishBy(plan: string): string {
  const v = parse<{ finishBy?: unknown }>(plan, {});
  return typeof v.finishBy === "string" ? v.finishBy : "";
}

async function remindDeadline(env: AccountEnv, project: ActiveProject, today: string): Promise<number> {
  const dates = [project.deadline, finishBy(project.plan)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const due = dates[0];
  if (!due) return 0;
  const daysLeft = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (daysLeft < 0 || daysLeft > DEADLINE_DAYS) return 0;
  if (!(await firstTime(env, `deadline:${project.id}:${due}`))) return 0;
  const when = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days, on ${niceDate(due)}`;
  const href = project.board_id ? `/projectum?project=${project.board_id}` : "/projectum?view=myprojects";
  for (const t of await teamEmails(env, project.id)) {
    await sendEmail(
      env,
      t.email,
      `"${project.title}" is due ${daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}`,
      `Hi ${t.name},\n\n"${project.title}" is due ${when}. When your work is ready, submit it from your board with your final report.\n\n${env.SITE_URL}${href}\n\nApplied AI Lab`,
    );
  }
  await remind(env, { kind: "project", id: project.id }, await projectMemberIds(env, project.id), `"${project.title}" is due ${when}`, href);
  return 1;
}

async function remindQuiet(env: AccountEnv, project: ActiveProject): Promise<number> {
  const last = project.board_updated ?? project.activated_at;
  if (!last || Date.now() - Date.parse(last) < QUIET_DAYS * DAY) return 0;
  // Keyed by when the board last changed, so a fresh edit resets it.
  if (!(await firstTime(env, `quiet:${project.id}:${last}`))) return 0;
  const href = project.board_id ? `/projectum?project=${project.board_id}` : "/projectum?view=myprojects";
  for (const t of await teamEmails(env, project.id)) {
    await sendEmail(
      env,
      t.email,
      `How's "${project.title}" going?`,
      `Hi ${t.name},\n\nYour board for "${project.title}" hasn't changed in ${QUIET_DAYS} days. Log a build with what you've done since, so the partner can follow along, or ask the Lab if you're stuck.\n\n${env.SITE_URL}${href}\n\nApplied AI Lab`,
    );
  }
  await remind(
    env,
    { kind: "project", id: project.id },
    await projectMemberIds(env, project.id),
    `Your board for "${project.title}" hasn't changed in ${QUIET_DAYS} days`,
    href,
  );
  return 1;
}

// The daily run. Returns how many reminders went out, by kind.
export async function sendReminders(env: AccountEnv, now = new Date()): Promise<{ lab: number; deadline: number; quiet: number }> {
  const today = now.toISOString().slice(0, 10);
  const sent = { lab: await remindLab(env, today), deadline: 0, quiet: 0 };
  for (const project of await activeProjects(env)) {
    sent.deadline += await remindDeadline(env, project, today);
    sent.quiet += await remindQuiet(env, project);
  }
  return sent;
}
