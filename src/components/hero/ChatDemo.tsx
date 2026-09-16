"use client";

/*
  The hero's chat panel: a scripted demo of the thing the Lab teaches, sitting
  to the right of the oval.

  Shaped like the assistant UIs everyone already knows — bubbled question on
  the right, plain streamed answer on the left under the Lab's asterisk, and a
  tall rounded composer with the round send button in its corner. The register
  is borrowed; the branding is not. No other product's name, mark, or palette
  appears here, because a panel that dresses up as someone else's product is
  a different thing from one that looks familiar.

  It runs itself. A pointer glides in, lands in the composer, a question types
  out a character at a time, the pointer moves to send and clicks, and the
  answer streams back word by word. Hovering the panel pauses the loop mid
  step rather than letting it run on under the reader.

  Semi-interactive, and honest about it: the composer is a real input. Type in
  it and the script yields — the pointer leaves, the loop stops for good, and
  what you send gets a canned answer routed by keyword. There is no model
  behind this and the panel says so, because a fake that claims to be live is
  a different thing from a demo.

  Under prefers-reduced-motion none of it runs: the panel renders one finished
  exchange and stays there.
*/

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowUp,
  MousePointer2,
  Plus,
} from "lucide-react";

/* ChatGPT-light neutral ramp. These stay local because the composer has a
   denser hierarchy than the surrounding marketing page. */
const FIELD = "#f4f4f4";
const SEGMENT = "#e7e7e7";
const SEGMENT_ON = "#ffffff";
const DIM = "#737373";
const LABEL = "#262626";
const ICON = "#525252";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

// Read as an external store rather than as state set from an effect: the
// server has no media query, so it reports false and the client corrects on
// hydration without a cascading render.
function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/* `revealed` is how many words of an assistant reply are showing. The whole
   reply is always in the DOM; streaming only uncovers more of it, so the
   bubble is at its final size from the first word and the transcript above it
   never shifts. */
type Message = { role: "user" | "assistant"; text: string; revealed?: number };
type Mode = "ask" | "build";

/* Two demos behind one control. Ask is the deciding student's questions
   about joining; Build is a member mid-project, working a problem in the
   room. Switching the segment swaps the script, the placeholder, and the
   keyword answers, and starts that demo over. Every answer here is drawn
   from what the site already promises: any major, zero to start, one problem
   a semester, a faculty review on four criteria, a public showcase. */
const SCRIPTS: Record<Mode, { prompt: string; reply: string }[]> = {
  ask: [
    {
      prompt: "I have an idea but I can't code. Is that a problem?",
      reply:
        "No. The first weeks start from zero, and any major is welcome. You bring the problem; the room teaches the build.",
    },
    {
      prompt: "What would I actually work on?",
      reply:
        "One problem, all semester. Yours, or a case a local organization brings us. Problem, build, review, show.",
    },
    {
      prompt: "What do I need to bring on day one?",
      reply: "Yourself. A laptop helps but isn't required, and meetings are free.",
    },
  ],
  build: [
    {
      prompt: "A club I volunteer for takes signups on paper. Where do I start?",
      reply:
        "Write the problem in one sentence, then the smallest thing that would fix it. That sentence is your first plan, and the room helps you cut it down.",
    },
    {
      prompt: "Draft the signup form for it.",
      reply:
        "Start with what the table already writes down. Four fields beat twelve, and you can add the rest once someone has used it.",
    },
    {
      prompt: "How do I know it is any good?",
      reply:
        "A faculty member rates the finished work on four criteria and talks it through with you. Then you show it in public at the end of the semester.",
    },
  ],
};

// Answers for anything the reader types, per mode. Matched on the first
// keyword that appears; the last entry in each list has no keys and is the
// fallback.
const REPLIES: Record<Mode, { keys: string[]; text: string }[]> = {
  ask: [
    {
      keys: ["cost", "free", "pay", "money", "dues", "fee"],
      text: "Meetings are free. No dues, and nothing you have to buy.",
    },
    {
      keys: ["when", "time", "meet", "schedule", "day"],
      text: "The schedule is on the join page, and the next meeting is always listed there.",
    },
    {
      keys: ["major", "cs", "computer science", "business", "art", "engineer"],
      text: "Any major. The problems come from everywhere, so the room needs people who understand more than code.",
    },
    {
      keys: ["code", "coding", "program", "experience", "beginner", "new"],
      text: "No experience needed. The first weeks start from zero and nobody is behind.",
    },
    {
      keys: ["laptop", "computer", "hardware", "bring"],
      text: "A laptop helps but isn't required. Come as you are for the first one.",
    },
    {
      keys: [],
      text: "This panel is a demo, so that one is past me. Come to a meeting and ask it out loud. That is what the room is for.",
    },
  ],
  build: [
    {
      keys: ["start", "begin", "idea", "first"],
      text: "Write the problem in one sentence, then the smallest thing that would fix it. That sentence is your first plan.",
    },
    {
      keys: ["stuck", "help", "error", "broken", "bug"],
      text: "Bring it to the room. Each meeting opens with one short skill, and the rest of the hour is yours with help beside you.",
    },
    {
      keys: ["review", "grade", "criteria", "judge"],
      text: "A faculty member rates finished work on four criteria and talks it through with you in person.",
    },
    {
      keys: ["show", "showcase", "present", "demo", "finish"],
      text: "The semester ends with a public showcase where members present what they built.",
    },
    {
      keys: ["case", "partner", "organization", "client"],
      text: "A case is a problem a local organization brings us. You can claim one instead of bringing your own.",
    },
    {
      keys: [],
      text: "This panel is a demo, so that one is past me. Bring it to a meeting and work it there.",
    },
  ],
};

const PLACEHOLDER: Record<Mode, string> = {
  ask: "How can I help you today?",
  build: "What do you want to build?",
};

function replyFor(mode: Mode, input: string): string {
  const q = input.toLowerCase();
  const list = REPLIES[mode];
  for (const r of list) {
    if (r.keys.length === 0) return r.text;
    if (r.keys.some((k) => q.includes(k))) return r.text;
  }
  return list[list.length - 1].text;
}

type Target = "away" | "input" | "send";

export function ChatDemo() {
  const reduced = useReducedMotion();

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [clicking, setClicking] = useState(false);
  // True while the pointer is standing in the field. Separate from `typing`,
  // because the beam shows on arrival and then the pointer hides.
  const [overField, setOverField] = useState(false);
  // The whole question the script is about to type. It is laid out in the
  // field from the first keystroke, with the untyped tail transparent, so the
  // line breaks and the box height are settled before any character lands.
  // Without it the last word grows until it no longer fits and then jumps to
  // the next line, which is the jitter that read as unpolished.
  const [pending, setPending] = useState("");
  // Where the caret sits, in the mirror's own coordinates.
  const [caret, setCaret] = useState<{ x: number; y: number } | null>(null);
  // Set while the finished exchange is on its way out between demo turns.
  const [fading, setFading] = useState(false);
  // True only while words are still landing. The caret belongs to the act of
  // writing, so it goes the moment the reply is complete rather than sitting
  // at the end of a finished sentence.
  const [streaming, setStreaming] = useState(false);
  // Set the moment the reader touches the composer: the script stands down
  // and does not come back for the rest of the visit.
  const [manual, setManual] = useState(false);
  // Which demo the segment is showing. Switching it restarts that demo.
  const [mode, setMode] = useState<Mode>("ask");

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const sendSlotRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const pausedRef = useRef(false);
  const targetRef = useRef<Target>("away");
  // Every pending timeout, so a cleanup can cut the run mid-step.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // The pointer is moved by writing its transform, not by holding a position
  // in state: it steps a dozen times per exchange and none of those steps
  // need to re-render the transcript.
  const paint = useCallback((t: Target, click = false) => {
    targetRef.current = t;
    const panel = panelRef.current;
    const cursor = cursorRef.current;
    if (!panel || !cursor) return;
    const pr = panel.getBoundingClientRect();
    let x = pr.width * 0.5;
    let y = pr.height + 56;
    if (t !== "away") {
      const el = t === "send" ? sendSlotRef.current : fieldRef.current;
      if (el) {
        const er = el.getBoundingClientRect();
        // Over the field the pointer stands a little in from the left, on the
        // first text line, which is where a reader would have clicked. It does
        // not follow the text as it grows.
        x = er.left - pr.left + (t === "send" ? er.width / 2 : 26);
        y = er.top - pr.top + (t === "send" ? er.height / 2 : 11);
      }
    }
    cursor.style.transform = `translate(${x}px, ${y}px) scale(${click ? 0.82 : 1})`;
  }, []);

  useEffect(() => {
    paint("away");
    const onResize = () => paint(targetRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paint]);

  useEffect(() => {
    if (reduced || manual) return;

    let alive = true;
    const sleep = (ms: number) =>
      new Promise<void>((res) => {
        const id = setTimeout(res, ms);
        timers.current.push(id);
      });
    // Hovering holds the loop wherever it is, including mid-word.
    const gate = async () => {
      while (alive && pausedRef.current) await sleep(120);
    };

    (async () => {
      await sleep(1100);
      const script = SCRIPTS[mode];
      let i = 0;
      while (alive) {
        const turn = script[i % script.length];

        await gate();
        if (!alive) return;
        paint("input");
        setOverField(true);
        await sleep(760);

        setPending(turn.prompt);
        setTyping(true);
        for (let c = 1; c <= turn.prompt.length; c++) {
          await gate();
          if (!alive) return;
          setDraft(turn.prompt.slice(0, c));
          // Slower across spaces, so it reads as words rather than a ticker.
          await sleep(turn.prompt[c - 1] === " " ? 52 : 20);
        }
        setTyping(false);
        // Re-anchor before it fades back in, in case anything shifted while
        // the text was landing.
        paint("input");
        // Long enough for the beam to be seen in the field before the
        // pointer travels to send. At 340 it read as still hidden, because
        // the reveal and the departure ran together.
        await sleep(780);

        await gate();
        if (!alive) return;
        setOverField(false);
        paint("send");
        await sleep(620);
        setClicking(true);
        paint("send", true);
        await sleep(150);
        setClicking(false);
        paint("send");

        setDraft("");
        setPending("");
        setMessages([{ role: "user", text: turn.prompt }]);
        paint("away");
        await sleep(560);

        await gate();
        if (!alive) return;
        setThinking(true);
        await sleep(950);
        setThinking(false);

        const words = turn.reply.split(" ");
        setStreaming(true);
        setMessages((m) => [...m, { role: "assistant", text: turn.reply, revealed: 0 }]);
        for (let w = 1; w <= words.length; w++) {
          await gate();
          if (!alive) return;
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", text: turn.reply, revealed: w };
            return next;
          });
          await sleep(38);
        }
        setStreaming(false);

        // The exchange leaves the way it arrived: it fades, and the panel
        // sits empty for a beat before the next question starts typing.
        await sleep(3400);
        await gate();
        if (!alive) return;
        setFading(true);
        await sleep(420);
        if (!alive) return;
        setMessages([]);
        setFading(false);
        await sleep(420);
        i++;
      }
    })();

    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduced, manual, mode, paint]);

  // The reader's own send. Same streaming as the script's, minus the pointer.
  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || thinking) return;
    setManual(true);
    paint("away");
    setDraft("");
    setPending("");
    setMessages([{ role: "user", text }]);
    setThinking(true);

    const full = replyFor(mode, text);
    const words = full.split(" ");
    const start = setTimeout(() => {
      setThinking(false);
      setStreaming(true);
      setMessages((m) => [...m, { role: "assistant", text: full, revealed: 0 }]);
      words.forEach((_, w) => {
        const id = setTimeout(() => {
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", text: full, revealed: w + 1 };
            return next;
          });
          if (w === words.length - 1) setStreaming(false);
        }, w * 38);
        timers.current.push(id);
      });
    }, 900);
    timers.current.push(start);
  }, [draft, thinking, mode, paint]);

  // Measure the caret off the last visible character. Runs after each
  // character lands; reading one box is cheap next to the paint that just
  // happened, and it keeps the caret out of the text flow entirely.
  useEffect(() => {
    const mirror = mirrorRef.current;
    const place = () => {
      if (!mirror || !typing || manual) {
        setCaret(null);
        return;
      }
      const chars = mirror.querySelectorAll<HTMLSpanElement>("[data-ch]");
      if (chars.length === 0) {
        setCaret(null);
        return;
      }
      const mr = mirror.getBoundingClientRect();
      // Before the first character, sit at the head of the line; after it,
      // at the trailing edge of the character just typed.
      const idx = Math.min(Math.max(draft.length - 1, 0), chars.length - 1);
      const cr = chars[idx].getBoundingClientRect();
      const atStart = draft.length === 0;
      setCaret({
        x: (atStart ? cr.left : cr.right) - mr.left,
        y: cr.top - mr.top + 2,
      });
    };
    place();
  }, [draft, pending, typing, manual]);

  // Switching the segment starts that demo from a clean panel. It also hands
  // the script back control, even if the reader had typed earlier: they asked
  // for the other demo, so they should get it running rather than an empty
  // box.
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setMode(next);
      setMessages([]);
      setFading(false);
      setStreaming(false);
      setDraft("");
      setPending("");
      setTyping(false);
      setThinking(false);
      setClicking(false);
      setOverField(false);
      setManual(false);
      paint("away");
    },
    [mode, paint],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Under reduced motion the panel shows one finished exchange from whichever
  // demo is selected, rather than running either of them.
  const view = reduced
    ? [
        { role: "user" as const, text: SCRIPTS[mode][0].prompt },
        { role: "assistant" as const, text: SCRIPTS[mode][0].reply },
      ]
    : messages;
  // Drives the send button's fill: the composer is armed the moment the
  // field holds something that is not whitespace.
  const ready = draft.trim().length > 0;

  return (
    <div
      ref={panelRef}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      className="relative w-full"
    >
      {/* Transcript. Fixed height and bottom-anchored, so the panel never
          resizes under the hero while a reply streams in. */}
      <div
        className="flex h-[236px] flex-col justify-end gap-5 overflow-hidden px-1 pb-5"
        style={{ opacity: fading ? 0 : 1, transition: "opacity 400ms ease" }}
      >
        {view.map((m, i) =>
          m.role === "user" ? (
            <p
              key={`u-${i}`}
              className="msg-in ml-auto max-w-[82%] rounded-[20px] bg-brand-wash px-4 py-2.5 text-[14px] leading-[1.45] text-ink"
            >
              {m.text}
            </p>
          ) : (
            <div key={`a-${i}`} className="msg-in">
              <p className="max-w-[96%] text-[14px] leading-[1.55] text-ink">
                {m.revealed === undefined
                  ? m.text
                  : m.text.split(" ").map((word, wi, all) => {
                      const shown = wi < (m.revealed ?? 0);
                      const last = wi === (m.revealed ?? 0) - 1;
                      return (
                        <span key={wi}>
                          <span
                            className="relative"
                            style={{ visibility: shown ? "visible" : "hidden" }}
                          >
                            {word}
                            {/* Rides the last revealed word, out of the flow,
                                so it cannot nudge the words behind it. */}
                            {last && streaming && !reduced && (
                              <span
                                aria-hidden
                                className="caret-blink absolute left-full top-[0.15em] ml-[2px] h-[1em] w-[2px] bg-brand"
                              />
                            )}
                          </span>
                          {wi < all.length - 1 ? " " : ""}
                        </span>
                      );
                    })}
              </p>
            </div>
          ),
        )}
        {thinking && (
          <span aria-hidden className="flex items-center gap-1.5">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="size-1.5 animate-bounce rounded-full bg-ink-faint"
                style={{ animationDelay: `${d * 140}ms` }}
              />
            ))}
          </span>
        )}
      </div>

      {/* ChatGPT-style light composer: a soft neutral capsule, open text area,
          compact tools on the left and the send action alone on the right. */}
      <div
        className="chat-composer rounded-[26px] border border-transparent px-4 pb-3 pt-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,box-shadow] duration-200 focus-within:border-line-strong focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
        style={{ background: FIELD }}
      >
        {/* The field grows down rather than running off to the right. The
            text in flow is a mirror: it wraps, and its height is what sets
            the row's, so the box gets taller as the question gets longer.
            The textarea sits over it filling the same box, transparent while
            the script drives and opaque once the reader takes over, so the
            field is always clickable but never shows the text twice. */}
        <div
          ref={fieldRef}
          className="relative flex max-h-[136px] min-h-[40px] items-start gap-0"
        >
          {/* The idle caret, ahead of the placeholder as in the reference. */}
          {!manual && draft.length === 0 && (
            <span
              aria-hidden
              className="caret-blink mt-[3px] h-[19px] w-px shrink-0"
              style={{ background: LABEL }}
            />
          )}
          {/* The whole question is in the DOM from the first frame, one span
              per character, and typing only flips characters from hidden to
              visible. Nothing is inserted or removed while it runs, so the
              line breaks and the box height are decided once and no word can
              grow and then jump. `visibility` rather than a colour, so a
              hidden character still occupies its exact advance width.

              The caret is absolutely placed from the last visible
              character's box instead of sitting in the text, because an
              inline caret is itself a box: it shifts the tail by its own
              width and adds a break opportunity, which is what was still
              nudging the wrap as the line filled. */}
          <span
            ref={mirrorRef}
            aria-hidden
            className="relative min-w-0 flex-1 whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.5]"
            style={{
              color:
                manual
                  ? "transparent"
                  : draft.length > 0 || pending.length > 0
                    ? LABEL
                    : DIM,
            }}
          >
            {draft.length === 0 && pending.length === 0
              ? PLACEHOLDER[mode]
              : [...(pending || draft)].map((ch, i) => (
                  <span
                    key={i}
                    data-ch
                    style={{ visibility: i < draft.length ? "visible" : "hidden" }}
                  >
                    {ch}
                  </span>
                ))}
            {typing && !manual && caret && (
              <span
                className="caret-blink absolute"
                style={{
                  left: caret.x,
                  top: caret.y,
                  width: 1,
                  height: 19,
                  background: LABEL,
                }}
              />
            )}
          </span>
          <textarea
            ref={inputRef}
            rows={1}
            value={manual ? draft : ""}
            onChange={(e) => {
              setManual(true);
              setDraft(e.target.value);
            }}
            onFocus={() => setManual(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={manual ? PLACEHOLDER[mode] : ""}
            aria-label="Ask about the Lab"
            className="absolute inset-0 w-full resize-none overflow-y-auto bg-transparent font-sans text-[15px] leading-[1.5] text-ink outline-none placeholder:text-[#737373]"
            style={{ color: manual ? undefined : "transparent", caretColor: manual ? LABEL : "transparent" }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#d4d4d4] bg-white">
              <Plus aria-hidden className="size-4 shrink-0" style={{ color: ICON }} />
            </span>
            {/* The segment is a real control: it swaps which demo runs, and
                which canned answers a typed question is matched against. */}
            <div
              role="group"
              aria-label="Demo"
              className="flex items-center gap-0.5 rounded-full p-1"
              style={{ background: SEGMENT }}
            >
              {(["ask", "build"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => switchMode(m)}
                  className="cursor-pointer rounded-full px-3 py-1 font-sans text-[13px] capitalize transition-colors duration-200"
                  style={{
                    background: mode === m ? SEGMENT_ON : "transparent",
                    color: mode === m ? LABEL : DIM,
                    boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.08)" : undefined,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            {/* Always present, so the pointer has a fixed place to land and
                the floor never reflows. Dim and genuinely disabled while
                there is nothing to send; it fills as the first character
                lands and drains again when the field empties. */}
            <span ref={sendSlotRef} className="flex items-center">
              <button
                type="button"
                onClick={send}
                disabled={!ready}
                aria-label="Send"
                className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200 disabled:cursor-default"
                style={{
                  background: ready ? "var(--brand-deep)" : "#d7d7d7",
                  color: ready ? "#ffffff" : "#8a8a8a",
                  transform: clicking ? "scale(0.92)" : undefined,
                }}
              >
                <ArrowUp className="size-4" />
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* The script's pointer. Hidden once the reader takes over — two
          cursors on one panel is a bug, not a flourish.

          It changes the way a real one does, and only where a real one does:
          an arrow while it travels, an I-beam once it is in the field. A
          click does not change the glyph on any real system, so the press is
          carried by the scale the runner writes and by the button reacting.
          The ref stays on the wrapper, so swapping the glyph never disturbs
          that transform. The drop shadow keeps it legible across the white
          hero and the soft-grey composer. */}
      {!manual && !reduced && (
        <span
          ref={cursorRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 block drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
          style={{
            // Hidden while the keys are going, the way a real pointer gets
            // out of the way of typing, and back the moment it moves again.
            opacity: typing ? 0 : 1,
            transition:
              "transform 620ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 140ms linear",
          }}
        >
          {overField ? (
            // A real I-beam, drawn rather than borrowed: lucide's text glyph
            // is a stroked box that reads as an icon, not as a cursor. Two
            // passes of one path, a white halo under a dark bar, so it holds
            // up on the light field. Its hotspot is the middle, so it is
            // pulled back onto the point the arrow was standing on.
            <span
              className="block"
              // Plain CSS transform, not a translate utility: the wrapper
              // already writes `transform`, and stacking a second transform
              // system on the child is what made the beam go missing.
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <svg
                width="11"
                height="20"
                viewBox="0 0 11 20"
                fill="none"
                style={{ display: "block", overflow: "visible" }}
              >
                <path
                  d="M3 2h5M5.5 2v16M3 18h5"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <path
                  d="M3 2h5M5.5 2v16M3 18h5"
                  stroke="#111111"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          ) : (
            <MousePointer2 className="size-5 fill-ink text-ground" />
          )}
        </span>
      )}
    </div>
  );
}
