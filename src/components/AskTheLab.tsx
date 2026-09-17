"use client";

/*
  Ask the Lab: the landing's questions section, as a chat instead of an
  accordion. Visitors pick a suggested question or type their own, and the
  answer streams in from /api/ask (Claude, grounded in
  src/content/lab-knowledge.ts).

  Where the questions go depends on the build (ASK_URL, src/lib/site.ts):
  the static site sends them to the Cloudflare Worker in worker/, and with
  nowhere to send them the chat answers with the offline note and the Lab's
  email.
*/

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { copy } from "@/content/copy";
import { MAX_CHARS, type Turn } from "@/lib/ask-limits";
import { ASK_URL } from "@/lib/site";
import { Reveal } from "@/components/Reveal";

const A = copy.ask;

export function AskTheLab() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Keep the newest words in view as they stream, inside the log only.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  useEffect(() => () => abort.current?.abort(), []);

  const reply = (text: string) =>
    setTurns((t) => {
      const next = [...t];
      next[next.length - 1] = { role: "assistant", content: text };
      return next;
    });

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");

    if (!ASK_URL) {
      reply(A.offline);
      return;
    }

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
        reply(res.status === 503 ? A.offline : res.status === 429 ? await res.text() : A.error);
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
    <section id="ask" className="flex min-h-svh flex-col justify-center px-5 py-24 text-ink lg:px-15">
      {/* Laid out like the ChatGPT and Claude home screens: a centred
          heading over one large composer, with the suggestions under it.
          Once a conversation starts, it runs in a centred column above the
          composer. The whole block sits in the middle of the screen, so
          scrolling to the end of the page centres it. */}
      <Reveal leave={false} className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <p className="kicker mb-3 opacity-35">{A.kicker}</p>
        <h2 className="text-center text-3xl font-light tracking-tight md:text-4xl">{A.heading}</h2>

        {started && (
          <div
            ref={log}
            aria-live="polite"
            className="mt-10 max-h-[28rem] w-full space-y-6 overflow-y-auto px-1"
          >
            {turns.map((t, i) =>
              t.role === "user" ? (
                <p
                  key={i}
                  className="ml-auto w-fit max-w-[80%] rounded-3xl bg-black/[0.05] px-5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap"
                >
                  {t.content}
                </p>
              ) : (
                <div key={i} className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {t.content || (
                    <span className="inline-flex items-center gap-2 opacity-50">
                      <span className="size-2 animate-pulse rounded-full bg-current" />
                      {A.thinking}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="mt-10 w-full rounded-[28px] border border-black/10 bg-white p-3 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.12)] transition focus-within:border-black/25"
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
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(draft);
              }
            }}
            rows={2}
            maxLength={MAX_CHARS}
            placeholder={A.placeholder}
            className="field-sizing-content max-h-40 min-h-12 w-full resize-none bg-transparent px-2 pt-1 text-[15px] leading-relaxed outline-none placeholder:text-black/40"
          />
          <div className="flex items-center justify-end gap-1.5">
            {started && (
              <button
                type="button"
                onClick={reset}
                aria-label={A.reset}
                title={A.reset}
                className="grid size-9 place-items-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black"
              >
                <RotateCcw className="size-4" strokeWidth={1.75} />
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={A.send}
              className="grid size-9 place-items-center rounded-full bg-black text-white transition hover:bg-black/80 disabled:bg-black/15"
            >
              <ArrowUp className="size-4" strokeWidth={2} />
            </button>
          </div>
        </form>

        {!started && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {A.suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-full border border-black/10 px-4 py-2 text-sm text-black/70 transition hover:border-black/25 hover:text-black"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-xs opacity-40">{A.footnote}</p>
      </Reveal>
    </section>
  );
}
