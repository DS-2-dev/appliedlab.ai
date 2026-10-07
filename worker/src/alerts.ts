// Error alerts: an email to ALERT_EMAIL when something breaks, so problems
// reach a person before users have to report them. Four sources:
// - a request the Worker fails to answer (index.ts catches the throw),
// - an email Resend refuses (accounts.ts), since sign-in depends on email,
// - the daily health check (healthCheck, on the cron in wrangler.jsonc),
// - errors in people's browsers on Projectum, sent to POST /client-errors.
//
// Each distinct alert is sent at most once an hour, and at most 20 an hour
// in all, counted in the REPORTS KV namespace under "alert:" keys that
// expire on their own. Alerts are sent in the background (waitUntil) so the
// person whose request failed isn't kept waiting.

import type { AccountEnv } from "./accounts";

export interface AlertEnv extends AccountEnv {
  ALERT_EMAIL?: string;
}

const HOUR = 3600;
const MAX_PER_HOUR = 20;

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Sends the alert unless the same one went out within the hour or the
// hour's cap is reached. Never throws: an alert that fails is only logged.
export async function alert(env: AlertEnv, kind: string, summary: string, detail = ""): Promise<void> {
  console.error(`[alert] ${kind}: ${summary}${detail ? `\n${detail}` : ""}`);
  try {
    if (!env.ALERT_EMAIL || !env.RESEND_API_KEY) return;
    const seenKey = `alert:seen:${await digest(`${kind}|${summary}`)}`;
    if (await env.REPORTS.get(seenKey)) return;
    const hourKey = `alert:count:${Math.floor(Date.now() / 1000 / HOUR)}`;
    const count = Number((await env.REPORTS.get(hourKey)) ?? 0);
    if (count >= MAX_PER_HOUR) return;
    await env.REPORTS.put(seenKey, "1", { expirationTtl: HOUR });
    await env.REPORTS.put(hourKey, String(count + 1), { expirationTtl: HOUR * 2 });
    // Straight to Resend rather than through sendEmail, which alerts on its
    // own failures: an alert about email must not loop.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM || "Applied AI Lab <login@appliedlab.ai>",
        to: [env.ALERT_EMAIL],
        subject: `[Projectum alert] ${kind}: ${summary}`.slice(0, 180),
        text:
          `${summary}\n\n${detail}\n\n` +
          `When: ${new Date().toISOString()}\n` +
          `The same alert won't be sent again for an hour. Logs: Cloudflare dashboard > Workers & Pages > appliedlab-ask > Logs, ` +
          `or "npx wrangler tail" in worker/.\n\nApplied AI Lab`,
      }),
    });
    if (!res.ok) console.error("[alert] couldn't send", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("[alert] failed", e);
  }
}

export function errorText(e: unknown): { summary: string; detail: string } {
  if (e instanceof Error) return { summary: e.message.slice(0, 160) || e.name, detail: (e.stack ?? "").slice(0, 3000) };
  return { summary: String(e).slice(0, 160), detail: "" };
}

// The daily check: the database answers, report storage answers, and the
// Resend key still works. Alerts only when something doesn't.
export async function healthCheck(env: AlertEnv): Promise<string[]> {
  const problems: string[] = [];
  try {
    await env.DB.prepare("SELECT COUNT(*) FROM users").first();
  } catch (e) {
    problems.push(`Database: ${errorText(e).summary}`);
  }
  try {
    await env.REPORTS.get("alert:health");
  } catch (e) {
    problems.push(`Report storage: ${errorText(e).summary}`);
  }
  if (!env.RESEND_API_KEY) {
    problems.push("Email: RESEND_API_KEY isn't set, so no sign-in codes can be sent.");
  } else {
    const res = await fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${env.RESEND_API_KEY}` } }).catch(
      () => null,
    );
    // A sending-only key can't list domains (401/403 here); anything else
    // means the key or Resend itself is in trouble.
    if (!res || (res.status >= 500 && res.status !== 501)) problems.push(`Email: Resend didn't answer (${res?.status ?? "no response"}).`);
    if (res && res.status === 400) problems.push("Email: Resend rejected the API key.");
  }
  if (problems.length) await alert(env, "Health check", problems[0], problems.join("\n"));
  return problems;
}

// POST /client-errors: an error in someone's browser on Projectum. Small,
// limited per visitor, and only text is kept; nothing about the person. The
// alert goes out after the reply.
export async function clientError(
  req: Request,
  env: AlertEnv,
  ip: string,
  limiter: RateLimit,
  ctx: ExecutionContext,
  headers: Record<string, string>,
): Promise<Response> {
  const done = new Response(null, { status: 204, headers });
  const { success } = await limiter.limit({ key: `client-error:${ip}` });
  if (!success) return done;
  const body = (await req.json().catch(() => null)) as { message?: unknown; stack?: unknown; page?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";
  if (!message) return done;
  const stack = typeof body?.stack === "string" ? body.stack.slice(0, 2000) : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : "";
  ctx.waitUntil(alert(env, "Browser error", message, `Page: ${page}\n\n${stack}`));
  return done;
}
