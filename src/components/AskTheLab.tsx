"use client";

/*
  Ask the Lab: the landing's questions section, as a chat in place of an
  accordion of answers. Visitors type a question, and the answer streams in
  from the Worker (Claude, grounded in src/content/lab-knowledge.ts).

  Laid out like a tile's page: the heading and its note in a column at the
  left, and at the right one tall panel with the box to type in along its
  bottom, the way a messaging app sits. Messages stack up from the box, each
  rising in as it arrives, and an answer's words fade in as they stream.
  One column on a phone. The motion lives in globals.css under .ask-*.

  Where the questions go depends on the build (ASK_URL, src/lib/site.ts). A
  Worker with no Claude key answers 503, and the chat shows the offline
  note and the Lab's email.
*/

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { copy } from "@/content/copy";
import { MAX_CHARS, type Turn } from "@/lib/ask-limits";
import { ASK_URL } from "@/lib/site";
import { INK } from "@/components/home/SiteFrame";
import { LabMark } from "@/components/LabMark";

const A = copy.ask;

// A turn as shown: an answer also keeps where each streamed piece began,
// so only the newly arrived words fade in.
type Shown = Turn & { cuts?: number[] };

// An answer, its words fading in one after another as each streamed piece
// lands. A whole answer can arrive in one piece, so the cascade runs
// within a piece, a beat per word, capped so a long piece doesn't drag.
const WORD_BEAT_MS = 18;
const MAX_BEATS = 60;

function Streamed({ text, cuts }: { text: string; cuts: number[] }) {
  const ends = [...cuts.slice(1), text.length];
  return (
    <>
      {cuts.map((start, i) => {
        let word = 0;
        return text
          .slice(start, ends[i])
          .split(/(\s+)/)
          .map((part, k) =>
            /^\s*$/.test(part) ? (
              part
            ) : (
              <span
                key={`${start}-${k}`}
                className="ask-piece"
                style={{
                  animationDelay: `${Math.min(word++, MAX_BEATS) * WORD_BEAT_MS}ms`,
                }}
              >
                {part}
              </span>
            ),
          );
      })}
    </>
  );
}

export function AskTheLab() {
  const [turns, setTurns] = useState<Shown[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  // Whether earlier messages run off the top of the panel, which softens
  // its top edge into a fade.
  const [clipped, setClipped] = useState(false);
  const checkClipped = () => setClipped((log.current?.scrollTop ?? 0) > 4);

  // Keep the newest words in view as they stream, inside the log only.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => () => abort.current?.abort(), []);

  // The answer so far. A longer one adds a piece that starts where the
  // last text ended; anything else (an error note) replaces it whole.
  const reply = (text: string) =>
    setTurns((t) => {
      const next = [...t];
      const last = next[next.length - 1];
      const grew = last.content && text.startsWith(last.content);
      const cuts = grew ? [...(last.cuts ?? [0]), last.content.length] : [0];
      next[next.length - 1] = { role: "assistant", content: text, cuts };
      return next;
    });

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Turn[] = [
      ...turns.map(({ role, content }) => ({ role, content })),
      { role: "user", content: q },
    ];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");

    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch(ASK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        reply(
          res.status === 503
            ? A.offline
            : res.status === 429
              ? await res.text()
              : A.error,
        );
        return;
      }
      // Pieces arrive faster than the screen redraws, so the answer is
      // painted at most once a frame.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let frame = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            reply(text);
          });
        }
      }
      cancelAnimationFrame(frame);
      reply(text || A.error);
    } catch (err) {
      if ((err as Error).name !== "AbortError") reply(A.error);
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    abort.current?.abort();
    setTurns([]);
    setBusy(false);
  };

  const started = turns.length > 0;

  return (
    <section
      id="ask"
      className="grid scroll-mt-5 gap-x-5 gap-y-8 pt-40 pb-8 min-[810px]:grid-cols-2"
    >
      <div className="max-w-[400px] min-[810px]:sticky min-[810px]:top-5 min-[810px]:self-start">
        <h2 className={INK}>{A.kicker}</h2>
        <p className="mt-2 text-sm/[17px] font-medium text-[#737378]">
          {A.heading}
        </p>
        <p className="mt-6 text-xs/[14px] font-semibold text-[#9a9aa1]">
          {A.footnote}
        </p>
      </div>

      <div className="relative flex h-[min(36rem,75svh)] flex-col bg-[#f4f4f4]">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-linear-to-b from-[#f4f4f4] to-transparent transition-opacity duration-300 ${
            clipped ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* The conversation fills the panel from the bottom up, so the
            newest message always sits just above the box. */}
        <div
          ref={log}
          aria-live="polite"
          onScroll={checkClipped}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-6"
        >
          {started ? (
            <div className="mt-auto grid gap-5 pb-6 text-sm/[20px] font-medium">
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <p
                    key={i}
                    className={`ask-message ml-auto w-fit max-w-[85%] rounded-lg bg-white px-4 py-2.5 whitespace-pre-wrap ${INK}`}
                  >
                    {t.content}
                  </p>
                ) : (
                  <div
                    key={i}
                    className={`ask-message max-w-[90%] whitespace-pre-wrap ${INK}`}
                  >
                    {t.content ? (
                      <Streamed text={t.content} cuts={t.cuts ?? [0]} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-[#9a9aa1]">
                        <LabMark className="ask-thinking size-4" />
                        {A.thinking}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="ask-message m-auto grid justify-items-center gap-3 text-center text-[#9a9aa1]">
              <LabMark className="size-8 text-[#cfcfcf]" />
              <p className="text-sm/[17px] font-medium">{A.empty}</p>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="m-3 mt-0 flex items-end gap-2 rounded-lg border border-[#e4e4e4] bg-white p-2 pl-3 transition-colors focus-within:border-[#1f1f1f]"
        >
          <label htmlFor="ask-input" className="sr-only">
            {A.placeholder}
          </label>
          <textarea
            id="ask-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter starts a new line.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                ask(draft);
              }
            }}
            rows={1}
            maxLength={MAX_CHARS}
            placeholder={A.placeholder}
            className={`field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm/[20px] font-medium outline-none placeholder:text-[#9a9aa1] ${INK}`}
          />
          {started && (
            <button
              type="button"
              onClick={reset}
              aria-label={A.reset}
              title={A.reset}
              className="grid size-8 shrink-0 place-items-center rounded-md text-[#9a9aa1] transition-colors hover:bg-[#f4f4f4] hover:text-[#1f1f1f]"
            >
              <RotateCcw className="size-4" strokeWidth={2} />
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label={A.send}
            className="grid size-8 shrink-0 place-items-center rounded-md bg-[#1f1f1f] text-white transition-colors hover:bg-black disabled:bg-[#e4e4e4]"
          >
            <ArrowUp className="size-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </section>
  );
}
