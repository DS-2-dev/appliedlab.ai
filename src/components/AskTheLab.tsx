"use client";

/*
  Ask the Lab: the landing's questions section, as a chat in place of an
  accordion of answers. Visitors type a question, and the answer streams in
  from the Worker (Claude, grounded in src/content/lab-knowledge.ts).

  Laid out like a tile's page: the heading and its note in a column at the
  left, the conversation and the box to type in at the right. One column
  on a phone.

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

      <div className="grid gap-3">
        {started && (
          <div
            ref={log}
            aria-live="polite"
            className="grid max-h-[32rem] gap-5 overflow-y-auto bg-[#f4f4f4] p-6 text-sm/[20px] font-medium"
          >
            {turns.map((t, i) =>
              t.role === "user" ? (
                <p
                  key={i}
                  className={`ml-auto w-fit max-w-[85%] rounded-lg bg-white px-4 py-2.5 whitespace-pre-wrap ${INK}`}
                >
                  {t.content}
                </p>
              ) : (
                <div
                  key={i}
                  className={`max-w-[90%] whitespace-pre-wrap ${INK}`}
                >
                  {t.content || (
                    <span className="inline-flex items-center gap-2 text-[#9a9aa1]">
                      <span className="size-1.5 animate-pulse rounded-full bg-current" />
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
          className="flex items-end gap-2 rounded-lg border border-[#e4e4e4] bg-white p-2 pl-3 transition-colors focus-within:border-[#1f1f1f]"
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
