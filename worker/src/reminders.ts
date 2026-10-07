// Reminders, run once a day with the health check (index.ts, the cron in
// wrangler.jsonc), so work doesn't quietly stall:
// - Waiting on the Lab: when a claim, submission, meeting request or new
//   partner has waited more than 3 days, the approver gets one summary
//   email that day (APPROVER_EMAIL), and every approver a bell notification.
// - Deadline close: 3 days or less before a team's deadline (the partner's,
//   or the team's own finish date, whichever comes first), the team hears
//   once.
// - Quiet board: when an approved team's board hasn't changed in 14 days,
//   the team hears once; editing the board starts the clock again.
// Each reminder is recorded in reminders_sent under a key naming what it
// was about, and a key already there is never sent again.

import { type AccountEnv, sendEmail } from "./accounts";
import { approverIds, notify, teamIds } from "./notify";

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

async function teamEmails(env: AccountEnv, claimId: string) {
  const { results } = await env.DB.prepare(
    "SELECT u.email, u.name FROM claim_members m JOIN users u ON u.id = m.user_id WHERE m.claim_id = ? AND u.status = 'active'",
  )
    .bind(claimId)
    .all<{ email: string; name: string }>();
  return results;
}

const day = (iso: string) => iso.slice(0, 10);

function niceDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// What has waited on the Lab more than 3 days, as lines for the summary.
async function waitingOnLab(env: AccountEnv): Promise<string[]> {
  const before = new Date(Date.now() - WAITING_DAYS * DAY).toISOString();
  const lines: string[] = [];
  const claims = await env.DB.prepare(
    "SELECT pr.title, u.name, c.created_at FROM claims c JOIN problems pr ON pr.id = c.problem_id JOIN users u ON u.id = c.owner_id " +
      "WHERE c.status = 'pending' AND c.created_at < ? ORDER BY c.created_at",
  )
    .bind(before)
    .all<{ title: string; name: string; created_at: string }>();
  for (const c of claims.results) lines.push(`Claim: "${c.title}" by ${c.name}, since ${niceDate(day(c.created_at))}`);
  const subs = await env.DB.prepare(
    "SELECT pr.title, s.created_at FROM submissions s JOIN claims c ON c.id = s.claim_id JOIN problems pr ON pr.id = c.problem_id " +
      "WHERE s.status = 'pending' AND s.created_at < ? ORDER BY s.created_at",
  )
    .bind(before)
    .all<{ title: string; created_at: string }>();
  for (const s of subs.results) lines.push(`Submission: "${s.title}", since ${niceDate(day(s.created_at))}`);
  const meetings = await env.DB.prepare(
    "SELECT pr.title, m.created_at FROM meetings m JOIN claims c ON c.id = m.claim_id JOIN problems pr ON pr.id = c.problem_id " +
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
    `These are waiting on the Lab in Approvals:\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\n${env.SITE_URL}/projectum?view=queue\n\nApplied AI Lab`,
  );
  await notify(
    env,
    await approverIds(env),
    "reminder",
    `${n} ${n === 1 ? "item has" : "items have"} waited in Approvals more than ${WAITING_DAYS} days`,
    "/projectum?view=queue",
  );
  return 1;
}

interface ActiveClaim {
  id: string;
  title: string;
  deadline: string;
  plan: string;
  reviewed_at: string | null;
  board_updated: string | null;
  board_id: string | null;
}

// Approved claims still being worked: nothing submitted or accepted yet, and
// not hired (phase 2 has its own checklist).
async function activeClaims(env: AccountEnv): Promise<ActiveClaim[]> {
  const { results } = await env.DB.prepare(
    "SELECT c.id, pr.title, pr.deadline, c.plan, c.reviewed_at, pj.updated_at AS board_updated, pj.id AS board_id " +
      "FROM claims c JOIN problems pr ON pr.id = c.problem_id LEFT JOIN projects pj ON pj.claim_id = c.id " +
      "WHERE c.status = 'approved' " +
      "AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.claim_id = c.id AND s.status IN ('pending', 'accepted')) " +
      "AND NOT EXISTS (SELECT 1 FROM selections sel WHERE sel.claim_id = c.id)",
  ).all<ActiveClaim>();
  return results;
}

function finishBy(plan: string): string {
  try {
    const v = JSON.parse(plan) as { finishBy?: unknown };
    return typeof v.finishBy === "string" ? v.finishBy : "";
  } catch {
    return "";
  }
}

async function remindDeadline(env: AccountEnv, claim: ActiveClaim, today: string): Promise<number> {
  const dates = [claim.deadline, finishBy(claim.plan)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const due = dates[0];
  if (!due) return 0;
  const daysLeft = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (daysLeft < 0 || daysLeft > DEADLINE_DAYS) return 0;
  if (!(await firstTime(env, `deadline:${claim.id}:${due}`))) return 0;
  const when = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days, on ${niceDate(due)}`;
  const href = claim.board_id ? `/projectum?project=${claim.board_id}` : "/projectum?view=claims";
  for (const t of await teamEmails(env, claim.id)) {
    await sendEmail(
      env,
      t.email,
      `"${claim.title}" is due ${daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}`,
      `Hi ${t.name},\n\n"${claim.title}" is due ${when}. When your work is ready, submit it from your board with your final report.\n\n${env.SITE_URL}${href}\n\nApplied AI Lab`,
    );
  }
  await notify(env, await teamIds(env, claim.id), "reminder", `"${claim.title}" is due ${when}`, href);
  return 1;
}

async function remindQuiet(env: AccountEnv, claim: ActiveClaim): Promise<number> {
  const last = claim.board_updated ?? claim.reviewed_at;
  if (!last || Date.now() - Date.parse(last) < QUIET_DAYS * DAY) return 0;
  // Keyed by when the board last changed, so a fresh edit resets it.
  if (!(await firstTime(env, `quiet:${claim.id}:${last}`))) return 0;
  const href = claim.board_id ? `/projectum?project=${claim.board_id}` : "/projectum?view=claims";
  for (const t of await teamEmails(env, claim.id)) {
    await sendEmail(
      env,
      t.email,
      `How's "${claim.title}" going?`,
      `Hi ${t.name},\n\nYour board for "${claim.title}" hasn't changed in ${QUIET_DAYS} days. Log a build with what you've done since, so the partner can follow along, or ask the Lab if you're stuck.\n\n${env.SITE_URL}${href}\n\nApplied AI Lab`,
    );
  }
  await notify(env, await teamIds(env, claim.id), "reminder", `Your board for "${claim.title}" hasn't changed in ${QUIET_DAYS} days`, href);
  return 1;
}

// The daily run. Returns how many reminders went out, by kind.
export async function sendReminders(env: AccountEnv, now = new Date()): Promise<{ lab: number; deadline: number; quiet: number }> {
  const today = now.toISOString().slice(0, 10);
  const sent = { lab: await remindLab(env, today), deadline: 0, quiet: 0 };
  for (const claim of await activeClaims(env)) {
    sent.deadline += await remindDeadline(env, claim, today);
    sent.quiet += await remindQuiet(env, claim);
  }
  return sent;
}
