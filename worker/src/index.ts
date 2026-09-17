// The static site's server side. GitHub Pages serves files only, so two
// things come here:
//
// - POST /: Ask the Lab's questions, instead of /api/ask, with the same
//   validation, instructions and facts (src/lib/ask.ts).
// - POST /interest: the Join the Lab form, instead of /api/interest, checked
//   with the same rules (src/lib/interest.ts) and kept in the INTEREST KV
//   namespace. worker/README.md shows how to read them.
//
// For the chat there are
// two engines. With an ANTHROPIC_API_KEY secret it asks Claude, exactly as
// the route does. Without one it uses Cloudflare Workers AI (Llama 3.3
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
import { checkInterest } from "@/lib/interest";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "@/lib/types";
import events from "../../data/events.json";
import settings from "../../data/settings.json";

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface Env {
  ANTHROPIC_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  ASK_LIMITER: RateLimit;
  JOIN_LIMITER: RateLimit;
  INTEREST: KVNamespace;
  AI: Ai;
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

// Join the Lab. Each submission is one KV entry, keyed by time so a listing
// reads oldest first, with the role, name and email as metadata so the
// listing alone shows who joined. No IP address is kept.
async function saveInterest(req: Request, env: Env, ip: string, headers: Record<string, string>): Promise<Response> {
  const { success } = await env.JOIN_LIMITER.limit({ key: ip });
  if (!success) return new Response(null, { status: 429, headers });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // The bot trap: accept quietly, keep nothing.
  if (body?.website) return new Response(null, { status: 204, headers });

  const checked = checkInterest(body);
  if ("errors" in checked) return Response.json(checked, { status: 400, headers });

  const { role, name, email } = checked.value;
  const at = new Date().toISOString();
  await env.INTEREST.put(`${at}_${crypto.randomUUID()}`, JSON.stringify({ ...checked.value, at }), {
    metadata: { role, name, email },
  });
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req.headers.get("origin"), env);
    // Only the Lab's own pages may call.
    if (!headers["access-control-allow-origin"]) return text("Forbidden.", 403, {});
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return text("Method not allowed.", 405, headers);

    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    if (new URL(req.url).pathname === "/interest") return saveInterest(req, env, ip, headers);

    const { success } = await env.ASK_LIMITER.limit({ key: ip });
    if (!success) return text(LIMITED_TEXT, 429, headers);

    const turns = parseTurns(await req.json().catch(() => null));
    if (!turns) return text(BAD_REQUEST_TEXT, 400, headers);

    const schedule = scheduleNote(SETTINGS, events as LabEvent[]);
    const body = env.ANTHROPIC_API_KEY
      ? streamAnswer(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), turns, schedule)
      : streamFree(env, turns, schedule);
    return new Response(body, { headers: { ...headers, ...TEXT_HEADERS } });
  },
} satisfies ExportedHandler<Env>;
