// POST /api/ask: the landing's Ask the Lab chat on the Next.js server.
// Takes the conversation so far and streams Claude's answer back as plain
// text (src/lib/ask.ts), grounded in the Lab's facts and the live schedule.
//
// Needs ANTHROPIC_API_KEY on the server. Without it the route answers 503
// and the chat shows its offline note. The static GitHub Pages build has no
// server, so this route is left out there and the chat calls the
// Cloudflare Worker (worker/) through NEXT_PUBLIC_ASK_URL instead.

import Anthropic from "@anthropic-ai/sdk";
import { ASK_LIMIT, LIMITED_TEXT, parseTurns, scheduleNote, streamAnswer } from "@/lib/ask";
import { getEvents, getSettings } from "@/lib/data";
import { ipFrom, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (rateLimited(ipFrom(req), "ask", { max: ASK_LIMIT })) {
    return new Response(LIMITED_TEXT, { status: 429 });
  }

  const turns = parseTurns(await req.json().catch(() => null));
  if (!turns) return new Response("Bad request.", { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("The assistant is not set up yet.", { status: 503 });
  }

  const [settings, events] = await Promise.all([getSettings(), getEvents()]);
  const body = streamAnswer(new Anthropic(), turns, scheduleNote(settings, events));
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
