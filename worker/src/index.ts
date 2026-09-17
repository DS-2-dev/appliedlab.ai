// Ask the Lab for the static site. GitHub Pages serves files only, so the
// chat's questions come here instead of to /api/ask: the same validation
// and the same Claude request (src/lib/ask.ts), with the API key held as a
// Worker secret. The schedule is bundled from data/ at deploy time, so
// redeploy after the schedule changes.

import Anthropic from "@anthropic-ai/sdk";
import { LIMITED_TEXT, parseTurns, scheduleNote, streamAnswer } from "@/lib/ask";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "@/lib/types";
import events from "../../data/events.json";
import settings from "../../data/settings.json";

interface Env {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  ASK_LIMITER: RateLimit;
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function text(body: string, status: number, headers: Record<string, string>): Response {
  return new Response(body, { status, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req.headers.get("origin"), env);
    // Only the Lab's own pages may ask.
    if (!headers["access-control-allow-origin"]) return text("Forbidden.", 403, {});
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return text("Method not allowed.", 405, headers);

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.ASK_LIMITER.limit({ key: ip });
    if (!success) return text(LIMITED_TEXT, 429, headers);

    const turns = parseTurns(await req.json().catch(() => null));
    if (!turns) return text("Bad request.", 400, headers);
    if (!env.ANTHROPIC_API_KEY) return text("The assistant is not set up yet.", 503, headers);

    const schedule = scheduleNote(
      { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) },
      events as LabEvent[],
    );
    const body = streamAnswer(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), turns, schedule);
    return new Response(body, {
      headers: { ...headers, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  },
} satisfies ExportedHandler<Env>;
