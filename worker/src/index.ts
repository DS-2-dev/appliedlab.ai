// Ask the Lab for the static site. GitHub Pages serves files only, so the
// chat's questions come here instead of to /api/ask, with the same
// validation, instructions and facts (src/lib/ask.ts).
//
// Two engines. With an ANTHROPIC_API_KEY secret it asks Claude, exactly as
// the route does. Without one it uses Cloudflare Workers AI (Llama 3.3
// 70B), which is free up to Cloudflare's daily allowance (about 70
// questions a day at this prompt's size); past that, requests fail and the
// chat shows its email note, and the free plan never bills.
//
// The schedule is bundled from data/ at deploy time, so redeploy after the
// schedule changes.

import Anthropic from "@anthropic-ai/sdk";
import {
  FAILED_TEXT,
  LIMITED_TEXT,
  parseTurns,
  scheduleNote,
  streamAnswer,
  systemPrompt,
  type Turn,
} from "@/lib/ask";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "@/lib/types";
import events from "../../data/events.json";
import settings from "../../data/settings.json";

const FREE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface Env {
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
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function text(body: string, status: number, headers: Record<string, string>): Response {
  return new Response(body, { status, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
}

// Workers AI streams server-sent events, `data: {"response": "..."}` per
// piece and `data: [DONE]` at the end. This turns them into plain text, the
// same shape the chat reads from Claude.
function streamFree(env: Env, turns: Turn[], schedule: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        const events = (await env.AI.run(FREE_MODEL as keyof AiModels, {
          messages: [{ role: "system", content: systemPrompt(schedule) }, ...turns],
          max_tokens: 600,
          stream: true,
        } as never)) as unknown as ReadableStream<Uint8Array>;
        const reader = events.getReader();
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
              const piece = (JSON.parse(data) as { response?: string }).response;
              if (piece) {
                controller.enqueue(encoder.encode(piece));
                sent = true;
              }
            } catch {
              // A partial or non-JSON line; the next read completes it.
            }
          }
        }
        if (!sent) controller.enqueue(encoder.encode(FAILED_TEXT));
      } catch (err) {
        console.error("ask (workers ai):", err instanceof Error ? err.message : err);
        if (!sent) controller.enqueue(encoder.encode(FAILED_TEXT));
      } finally {
        controller.close();
      }
    },
  });
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

    const schedule = scheduleNote(
      { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) },
      events as LabEvent[],
    );
    const body = env.ANTHROPIC_API_KEY
      ? streamAnswer(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), turns, schedule)
      : streamFree(env, turns, schedule);
    return new Response(body, {
      headers: { ...headers, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  },
} satisfies ExportedHandler<Env>;
