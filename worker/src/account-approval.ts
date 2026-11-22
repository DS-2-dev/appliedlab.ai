import { type AccountEnv, type UserRow, USER_COLS, escapeHtml, hmac, same, sendEmail } from "./account-helpers";
import { emit } from "./events";
import { ensureOrgFor } from "./orgs";

const APPROVAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The emailed link to approve a partner, signed and good for 30 days.
export async function approvalLink(env: AccountEnv, req: Request, userId: string): Promise<string> {
  const exp = String(Date.now() + APPROVAL_TTL_MS);
  const url = new URL("/approve", req.url);
  url.searchParams.set("u", userId);
  url.searchParams.set("e", exp);
  url.searchParams.set("t", await hmac(env.AUTH_SECRET, `approve:${userId}:${exp}`));
  return url.toString();
}

// What an approved account is told, by role.
export function approvedTitle(role: string): string {
  return role === "rep" ? "The Lab approved your account." : "The Lab approved your account. Post your first problem.";
}

export function approvedEmail(user: { name: string; role: string }, siteUrl: string): string {
  const what = user.role === "rep" ? "Log in to review student work" : "Log in to post problems for our students";
  return `Hi ${user.name},\n\nThe Applied AI Lab approved your account. ${what}:\n${siteUrl}/login\n\nApplied AI Lab, Weber State University`;
}

export async function askApproval(env: AccountEnv, req: Request, user: UserRow): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const link = await approvalLink(env, req, user.id);
  const faculty = user.role === "rep";
  await sendEmail(
    env,
    env.APPROVER_EMAIL,
    `New ${faculty ? "faculty" : "partner"} on Projectum: ${user.name}`,
    `${user.name} (${user.email}) signed up as ${faculty ? "faculty" : "a partner organization"}.\n\nApprove them, so they can ${faculty ? "review student work" : "post problems"}:\n${link}\n\nIf you don't recognize them, ignore this email and they stay pending.`,
  );
}

export function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#111">` +
      `<h1 style="font-size:1.4rem">${escapeHtml(title)}</h1><p>${body}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// Opening the emailed link shows who is asking and an Approve button; only
// the button, a POST, approves. Mail scanners open links on their own, and
// opening alone must change nothing.
export async function approvePartner(req: Request, env: AccountEnv): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("u") ?? "";
  const exp = url.searchParams.get("e") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!id || !/^\d+$/.test(exp) || !same(token, await hmac(env.AUTH_SECRET, `approve:${id}:${exp}`))) {
    return page("That link doesn't work", "It may have been copied incompletely.", 400);
  }
  if (Number(exp) < Date.now()) return page("That link has expired", "Approve them in Approvals on Projectum instead.", 400);
  const user = await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();
  if (!user) return page("No such account", "It may have been deleted.", 404);
  if (req.method !== "POST") {
    const faculty = user.role === "rep";
    if (user.status !== "pending") return page("Already approved", `${escapeHtml(user.name)} is approved.`);
    return page(
      `Approve ${user.name}?`,
      `${escapeHtml(user.name)} (${escapeHtml(user.email)}) signed up as ${faculty ? "faculty. Once approved, they can review student work" : "a partner organization. Once approved, they can post problems for students"}.` +
        `</p><form method="post"><button style="font:inherit;padding:.6rem 1.2rem;border-radius:999px;border:0;background:#111;color:#fff;cursor:pointer">Approve</button></form><p>`,
    );
  }
  if (user.status === "pending") {
    await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(id).run();
    if (user.role === "partner") await ensureOrgFor(env, user);
    const stmts: D1PreparedStatement[] = [];
    emit(env, stmts, {
      type: "account.approved",
      actor: null,
      subject: { kind: "user", id },
      notify: [{ userIds: [id], title: approvedTitle(user.role), href: "/w" }],
    });
    await env.DB.batch(stmts);
    await sendEmail(
      env,
      user.email,
      "You're approved on Projectum",
      approvedEmail(user, env.SITE_URL),
    );
  }
  return page("Approved", `${escapeHtml(user.name)} (${escapeHtml(user.email)}) is approved.`);
}
