// POST /api/ask: the landing's Ask the Lab chat on the Next.js server.
// Takes the conversation so far and streams Claude's answer back as plain
// text (src/lib/ask.ts), grounded in the Lab's facts and the live schedule.
//
// Needs ANTHROPIC_API_KEY on the server. Without it the route answers 503
// and the chat shows its offline note. The static GitHub Pages build has no
// server, so this route is left out there and the chat calls the
// Cloudflare Worker (worker/) through NEXT_PUBLIC_ASK_URL instead.

import Anthropic from "@anthropic-ai/sdk";
import {
  ASK_LIMIT,
  BAD_REQUEST_TEXT,
  LIMITED_TEXT,
  NOT_SET_UP_TEXT,
  TEXT_HEADERS,
  parseTurns,
  scheduleNote,
  streamAnswer,
} from "@/lib/ask";
import { getEvents, getSettings } from "@/lib/data";
import { ipFrom, rateLimited } from "@/lib/rate-limit";
import type { LabEvent, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

// The schedule changes rarely, so it is read at most once a minute. The
// note itself is rebuilt each time, since "upcoming" depends on the clock.
const SCHEDULE_TTL = 60_000;
let cached: { at: number; data: Promise<[Settings, LabEvent[]]> } | null = null;

async function loadSchedule(): Promise<string> {
  if (!cached || Date.now() - cached.at > SCHEDULE_TTL) {
    const data = Promise.all([getSettings(), getEvents()]);
    // A failed read is retried on the next question instead of cached.
    data.catch(() => {
      cached = null;
    });
    cached = { at: Date.now(), data };
  }
  const [settings, events] = await cached.data;
  return scheduleNote(settings, events);
}

export async function POST(req: Request) {
  if (rateLimited(ipFrom(req), "ask", { max: ASK_LIMIT })) {
    return new Response(LIMITED_TEXT, { status: 429, headers: TEXT_HEADERS });
  }

  // The schedule loads while the body is read.
  const schedule = loadSchedule();
  const turns = parseTurns(await req.json().catch(() => null));
  if (!turns) return new Response(BAD_REQUEST_TEXT, { status: 400, headers: TEXT_HEADERS });
  if (!process.env.ANTHROPIC_API_KEY) return new Response(NOT_SET_UP_TEXT, { status: 503, headers: TEXT_HEADERS });

  const body = streamAnswer(new Anthropic(), turns, await schedule);
  return new Response(body, { headers: TEXT_HEADERS });
}
