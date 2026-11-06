// The static site's server side. GitHub Pages serves files only, so two
// things come here:
//
// - POST /: Ask the Lab's questions, with the shared
//   validation, instructions and facts (src/lib/ask.ts).
// - /auth/*, /me and /people: Projectum accounts,
//   in the DB D1 database (accounts.ts). GET /approve is the link that
//   approves a new partner, opened from an email, so it has no origin.
//   GET /auth/google/start and /auth/google/callback are Google sign-in,
//   also opened by the browser itself.
// - /taxonomy: the managed categories (taxonomy.ts). /orgs/*: organizations
//   and requests to join one (orgs.ts).
// - /postings: postings and gate 1, the representative's review (postings.ts).
// - /projects, /proposals and POST /postings/:id/claim: projects and gate 2,
//   the action plan (projects.ts); /boards: the boards they open (boards.ts).
// - POST /boards/:id/submissions and GET /submissions/:id/report: gate 3
//   (submissions.ts); phase 2's meetings, milestones and sign-off
//   (phase2.ts); /reviews: the review queue, taking and assigning
//   (reviews.ts).
// - /court: what waits on the signed-in person (court.ts); /shell: the
//   sidebar badges and the bell's count (shell.ts); /notifications: the
//   bell (notify.ts).
// - /overview, /accounts/:id/*, /partners/:id/approve (the admin's) and the
//   public /profiles/:handle (overview.ts). Any other path but / is a 404.
//
// For the chat there are two engines. With an ANTHROPIC_API_KEY secret it
// asks Claude. Without one it uses Cloudflare Workers AI (Llama 3.3
// 70B), which is free up to Cloudflare's daily allowance (about 70
// questions a day at this prompt's size); past that, requests fail and the
// chat shows its email note, and the free plan never bills.
//
// The schedule is bundled from data/ at deploy time, so redeploy after the
// schedule changes.

import Anthropic from "@anthropic-ai/sdk";
import {
  BAD_REQUEST_TEXT,
  LIMITED_TEXT,
  TEXT_HEADERS,
  parseTurns,
  scheduleNote,
  streamAnswer,
  systemPrompt,
  textStream,
  type Turn,
} from "@/lib/ask";
import { type GoogleEnv, type Json, type UserRow, approvePartner, handleAccounts, handleGoogle, sessionUser } from "./accounts";
import { type AlertEnv, alert, clientError, errorText, healthCheck } from "./alerts";
import { clearOldNotifications, handleNotifications } from "./notify";
import { handleCourt } from "./court";
import { handleShell } from "./shell";
import { sendReminders } from "./reminders";
import { handleSubmissions } from "./submissions";
import { handlePhase2 } from "./phase2";
import { handleAdmin, handleProfiles } from "./overview";
import { handleTaxonomy } from "./taxonomy";
import { handleOrgs } from "./orgs";
import { handlePostings } from "./postings";
import { handleProjects } from "./projects";
import { handleReviews } from "./reviews";
import { ensureBoards, handleBoards } from "./boards";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "@/lib/types";
import events from "../../data/events.json";
import settings from "../../data/settings.json";

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface Env extends GoogleEnv, AlertEnv {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  ASK_LIMITER: RateLimit;
  AI: Ai;
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function text(body: string, status: number, headers: Record<string, string>): Response {
  return new Response(body, { status, headers: { ...headers, ...TEXT_HEADERS } });
}

// The bundled settings, merged over the defaults once.
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) };

// Workers AI streams server-sent events, `data: {"response": "..."}` per
// piece and `data: [DONE]` at the end. This turns them into the same plain
// text the chat reads from Claude.
function streamFree(env: Env, turns: Turn[], schedule: string): ReadableStream<Uint8Array> {
  return textStream(async (emit) => {
    const events = (await env.AI.run(FREE_MODEL as keyof AiModels, {
      messages: [{ role: "system", content: systemPrompt(schedule) }, ...turns],
      max_tokens: 600,
      stream: true,
    } as never)) as unknown as ReadableStream<Uint8Array>;
    const reader = events.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data || data === "[DONE]") continue;
        try {
          emit((JSON.parse(data) as { response?: string }).response ?? "");
        } catch {
          // A partial or non-JSON line; the next read completes it.
        }
      }
    }
  });
}

export default {
  // Every request goes through route(); one that throws gets a plain 500 the
  // site can show, and an alert by email (alerts.ts).
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      const { summary, detail } = errorText(e);
      const url = new URL(req.url);
      ctx.waitUntil(alert(env, "Worker error", summary, `${req.method} ${url.pathname}\n\n${detail}`));
      return Response.json(
        { error: "server" },
        { status: 500, headers: { ...cors(req.headers.get("origin"), env), "cache-control": "no-store" } },
      );
    }
  },

  // Daily (the cron in wrangler.jsonc): the health check, reminders
  // (reminders.ts), clearing read notifications older than 60 days, and a
  // board for any project without one (boards.ts).
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(healthCheck(env).then(() => undefined));
    ctx.waitUntil(clearOldNotifications(env).catch((e) => alert(env, "Cleanup failed", errorText(e).summary)));
    ctx.waitUntil(sendReminders(env).then(() => undefined).catch((e) => alert(env, "Reminders failed", errorText(e).summary, errorText(e).detail)));
    ctx.waitUntil(ensureBoards(env).then(() => undefined).catch((e) => alert(env, "Boards failed", errorText(e).summary, errorText(e).detail)));
  },
} satisfies ExportedHandler<Env>;

// Runs the handlers that need an active signed-in account. Each handler
// returns null for a path that is not its own; the session is only looked up
// (and a 401 or 403 only sent) when one of them claims the path, so the
// other routes below stay reachable.
type UserHandler = (req: Request, env: Env, user: UserRow, json: Json) => Promise<Response | null>;

async function withUser(
  req: Request,
  env: Env,
  headers: Record<string, string>,
  ...handlers: UserHandler[]
): Promise<Response | null> {
  const json: Json = (body, status = 200) =>
    Response.json(body, { status, headers: { ...headers, "cache-control": "no-store" } });
  const { pathname } = new URL(req.url);
  if (!USER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const user = await sessionUser(req, env);
  if (!user) return json({ error: "signed-out" }, 401);
  if (user.status !== "active") return json({ error: "pending" }, 403);
  for (const h of handlers) {
    const res = await h(req, env, user, json);
    if (res) return res;
  }
  return null;
}

// The path prefixes withUser guards; later handlers add theirs here.
const USER_PATHS = [
  "/taxonomy",
  "/orgs",
  "/postings",
  "/projects",
  "/proposals",
  "/boards",
  "/reviews",
  "/submissions",
  "/meetings",
  "/overview",
  "/accounts",
  "/partners",
  "/notifications",
  "/court",
  "/shell",
];

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if ((req.method === "GET" || req.method === "POST") && new URL(req.url).pathname === "/approve") return approvePartner(req, env);
  // Nothing the site sends is this big, apart from a report (submissions.ts
  // checks those against their own limit).
  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > 256 * 1024 && !/\/submissions$/.test(new URL(req.url).pathname)) return new Response(null, { status: 413 });
  const google = await handleGoogle(req, env);
  if (google) return google;

  const headers = cors(req.headers.get("origin"), env);
  // Only the Lab's own pages may call.
  if (!headers["access-control-allow-origin"]) return text("Forbidden.", 403, {});
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  if (req.method === "POST" && new URL(req.url).pathname === "/client-errors") {
    return clientError(req, env, ip, env.LOGIN_IP_LIMITER, ctx, headers);
  }
  const account =
    (await handleAccounts(req, env, ip, headers)) ??
    (await handleProfiles(req, env, headers)) ??
    (await withUser(
      req,
      env,
      headers,
      handleTaxonomy,
      handleOrgs,
      handleSubmissions(headers),
      handlePhase2,
      handleProjects,
      handlePostings,
      handleBoards,
      handleReviews,
      handleAdmin,
      handleNotifications,
      handleCourt,
      handleShell,
    ));
  if (account) return account;
  // Only the Ask endpoint is left, at the root; anything else (the old
  // problems, claims and queue routes among it) is gone.
  if (new URL(req.url).pathname !== "/") {
    return Response.json({ error: "not-found" }, { status: 404, headers: { ...headers, "cache-control": "no-store" } });
  }
  if (req.method !== "POST") return text("Method not allowed.", 405, headers);

  const { success } = await env.ASK_LIMITER.limit({ key: ip });
  if (!success) return text(LIMITED_TEXT, 429, headers);

  const turns = parseTurns(await req.json().catch(() => null));
  if (!turns) return text(BAD_REQUEST_TEXT, 400, headers);

  const schedule = scheduleNote(SETTINGS, events as LabEvent[]);
  const body = env.ANTHROPIC_API_KEY
    ? streamAnswer(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), turns, schedule)
    : streamFree(env, turns, schedule);
  return new Response(body, { headers: { ...headers, ...TEXT_HEADERS } });
}
