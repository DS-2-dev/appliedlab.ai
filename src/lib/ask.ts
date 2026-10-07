// The Ask the Lab request, shared by the Next.js route (src/app/api/ask)
// and the Cloudflare Worker that serves the static site (worker/). Both
// validate the same way and use the same instructions and facts. The route
// always asks Claude; the Worker asks Claude when it has an API key and a
// free Cloudflare Workers AI model otherwise.

import type Anthropic from "@anthropic-ai/sdk";
import { LAB_KNOWLEDGE } from "@/content/lab-knowledge";
import { MAX_CHARS, MAX_TURNS, type Turn } from "@/lib/ask-limits";
import type { LabEvent, Settings } from "@/lib/types";

export type { Turn };

// Stable, so it caches: the rules, then the knowledge.
const INSTRUCTIONS = `You are the assistant on the Applied AI Lab's website, answering visitors' questions about the Lab: students of any major, faculty, and organizations thinking about bringing a problem.

Answer only from the Lab facts below and the schedule that follows them. If the facts do not cover a question, say you do not have that detail and point the visitor to ailab@weber.edu. Do not guess dates, rooms, names or numbers. Questions unrelated to the Lab get a short, friendly redirect to what you can help with.

Write like a clear graduate student explaining the Lab to someone new: short complete sentences, plain words, two to four sentences for most answers, and a short list only when the answer is a sequence. Use no em dashes and no headings. Speak about the Lab as "the Lab" or "we".

Latency-sensitive; begin your visible answer immediately.`;

const STABLE_PROMPT = `${INSTRUCTIONS}\n\n${LAB_KNOWLEDGE}`;

export function parseTurns(body: unknown): Turn[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns = raw.slice(-MAX_TURNS).map((m) => ({
    role: (m as Turn)?.role,
    content: typeof (m as Turn)?.content === "string" ? (m as Turn).content.trim().slice(0, MAX_CHARS) : "",
  }));
  // The history must alternate, start with the visitor and end with them.
  while (turns.length && turns[0].role !== "user") turns.shift();
  const valid =
    turns.length > 0 &&
    turns.every((t, i) => t.content && t.role === (i % 2 === 0 ? "user" : "assistant")) &&
    turns[turns.length - 1].role === "user";
  return valid ? turns : null;
}

// The schedule changes, so it goes after the cached block.
export function scheduleNote(settings: Settings, events: LabEvent[]): string {
  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.starts_at).getTime() >= now)
    .slice(0, 6)
    .map((e) => {
      const when = new Date(e.starts_at).toLocaleString("en-US", {
        timeZone: "America/Denver",
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const room = e.room ? `, ${e.room}${e.room_confirmed ? "" : " (room to be confirmed)"}` : "";
      return `- ${e.title}: ${when}${room}.${e.description ? ` ${e.description}` : ""}`;
    });
  return [
    `# Schedule (as of ${new Date(now).toLocaleDateString("en-US", { timeZone: "America/Denver", dateStyle: "long" })})`,
    `- Regular meetings: ${settings.meeting_schedule}.`,
    upcoming.length ? `Upcoming:\n${upcoming.join("\n")}` : `- ${settings.offseason_line}`,
  ].join("\n");
}

// The whole system prompt as one string, for hosts that take it that way
// (the Worker's Cloudflare Workers AI path).
export function systemPrompt(schedule: string): string {
  return `${STABLE_PROMPT}\n\n${schedule}`;
}

// Rate limit: questions per visitor per window.
export const ASK_LIMIT = 30;

// The same request from both hosts. Short conversational answers from a
// fixed set of facts, so effort is low; a declined request is re-run on
// Anthropic's recommended fallback model.
function askParams(turns: Turn[], schedule: string) {
  return {
    model: "claude-opus-5",
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: STABLE_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: schedule },
    ],
    messages: turns,
  } satisfies Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
}

const REFUSAL_TEXT = "I can't help with that one. For anything about the Lab, email ailab@weber.edu.";
const BUSY_TEXT = "The assistant is busy right now. Try again in a moment.";
export const FAILED_TEXT = "Something went wrong on our side. Email ailab@weber.edu and we'll answer there.";
export const LIMITED_TEXT = "Too many questions for now. Try again in a little while.";
export const BAD_REQUEST_TEXT = "Bad request.";
export const NOT_SET_UP_TEXT = "The assistant is not set up yet.";

// Every answer, and every refusal to answer, is plain text, never cached.
export const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

// A plain-text stream fed by `produce`, whichever engine writes it. Anything
// `produce` throws ends the answer with FAILED_TEXT, or with `onError`'s own
// text when it returns one.
export function textStream(
  produce: (emit: (text: string) => void) => Promise<void>,
  { onError, onCancel }: { onError?: (err: unknown) => string | undefined; onCancel?: () => void } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(encoder.encode(text));
        sent = true;
      };
      try {
        await produce(emit);
        if (!sent) emit(FAILED_TEXT);
      } catch (err) {
        const text = onError?.(err);
        if (text) emit(text);
        else {
          console.error("ask:", err instanceof Error ? err.message : err);
          if (!sent) emit(FAILED_TEXT);
        }
      } finally {
        controller.close();
      }
    },
    cancel: onCancel,
  });
}

// Claude's answer as plain text.
export function streamAnswer(client: Anthropic, turns: Turn[], schedule: string): ReadableStream<Uint8Array> {
  const stream = client.beta.messages.stream(askParams(turns, schedule));
  return textStream(
    async (emit) => {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") emit(event.delta.text);
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") emit(REFUSAL_TEXT);
    },
    {
      onError: (err) => ((err as { status?: number }).status === 429 ? BUSY_TEXT : undefined),
      onCancel: () => stream.abort(),
    },
  );
}
