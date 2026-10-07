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
// - /problems, /claims, /queue, /partners, /proposals and /projects: the
//   pipeline and the boards it opens (pipeline.ts).
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
import { type GoogleEnv, approvePartner, handleAccounts, handleGoogle } from "./accounts";
import { type AlertEnv, alert, clientError, errorText, healthCheck } from "./alerts";
import { clearOldNotifications } from "./notify";
import { sendReminders } from "./reminders";
import { handlePipeline } from "./pipeline";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "@/lib/types";
import events from "../../data/events.json";
import settings from "../../data/settings.json";

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface Env extends GoogleEnv, AlertEnv {
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
// (reminders.ts), and clearing read notifications older than 60 days.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(healthCheck(env).then(() => undefined));
    ctx.waitUntil(clearOldNotifications(env).catch((e) => alert(env, "Cleanup failed", errorText(e).summary)));
    ctx.waitUntil(sendReminders(env).then(() => undefined).catch((e) => alert(env, "Reminders failed", errorText(e).summary, errorText(e).detail)));
  },
} satisfies ExportedHandler<Env>;

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if ((req.method === "GET" || req.method === "POST") && new URL(req.url).pathname === "/approve") return approvePartner(req, env);
  // Nothing the site sends is this big, apart from a report (pipeline.ts
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
  const account = (await handleAccounts(req, env, ip, headers)) ?? (await handlePipeline(req, env, headers));
  if (account) return account;
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
