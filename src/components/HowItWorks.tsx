"use client";

/*
  How it works: the landing's scroll-driven section. The section is one
  screen tall per step, and a panel sticks to the screen while it scrolls:
  a column of step tabs at the left (a row on phones) and a black card at
  the right.

  Scrolling moves the active tab, whose dot stretches into a bar, and the
  card switches to that step, fading in from below. Each step has an anchor
  at its own scroll position, which the header links and the tabs jump to,
  and a tab click holds the card on its step until the scroll arrives.

  The card is one shell. What a step adds to it (a side panel beside the
  intro, bands below it) comes from its fields in copy.ts, drawn by
  StepAside and StepBands. The Pipeline step draws the whole pipeline as a
  lane diagram (PipelineDiagram.tsx) that visitors click through.
*/

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { Reveal } from "@/components/Reveal";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { ScrollLink } from "@/components/ScrollLink";
import { JOIN_HREF } from "@/lib/site";
import { pad2 } from "@/lib/utils";

const C = copy.how;
const STEPS = C.steps;
const LAST = STEPS.length - 1;
type Step = (typeof STEPS)[number];

// A copy.ts CTA may name "join" for the join page, which differs by build.
const ctaHref = (href: string) => (href === "join" ? JOIN_HREF : href);

// Staggers a list's entrance.
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });
const RISE = "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500";
const FADE = "animate-in fade-in-0 fill-mode-both duration-500";

export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  // The step the scroll has reached. Only the rounded step is kept, so the
  // card re-renders when the step changes, not on every scroll frame.
  const [reached, setReached] = useState(0);
  // After a tab click, the step it picked, held until the scroll arrives so
  // the card does not flash every step in between.
  const [lock, setLock] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const scrolled = -el.getBoundingClientRect().top / window.innerHeight;
      setReached(Math.round(Math.min(LAST, Math.max(0, scrolled))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // While a jump is held, any wheel turn or touch hands control straight
  // back to the scroll.
  useEffect(() => {
    if (lock === null) return;
    const release = () => setLock(null);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
    };
  }, [lock]);

  const active = lock ?? reached;
  if (lock !== null && reached === lock) setLock(null);
  const step = STEPS[active];
  const compact = "compact" in step && step.compact;

  return (
    <section
      ref={section}
      aria-label={C.kicker}
      className="relative text-ink"
      style={{ height: `${STEPS.length * 100}svh` }}
    >
      {/* One anchor per step, at the scroll position that shows it. */}
      {STEPS.map((s, i) => (
        <div key={s.id} id={s.id} aria-hidden className="absolute inset-x-0 h-px" style={{ top: `${i * 100}svh` }} />
      ))}

      <div className="sticky top-0 h-svh">
        <Reveal className="flex h-full flex-col justify-center gap-8 px-5 pt-20 pb-10 md:grid md:grid-cols-12 md:items-center md:gap-8 lg:px-15">
          {/* The tabs, marked with the same smooth dots the card used to carry:
              the active step's dot stretches into a bar. On phones they run
              across. */}
          <nav aria-label={C.kicker} className="md:col-span-3 lg:col-span-2">
            <p className="kicker mb-6 opacity-35">{C.kicker}</p>
            <ol className="flex flex-wrap gap-1 md:flex-col md:gap-0.5">
              {STEPS.map((s, i) => {
                const on = i === active;
                return (
                  <li key={s.id}>
                    <ScrollLink
                      href={`#${s.id}`}
                      aria-current={on ? "step" : undefined}
                      onClick={() => setLock(i)}
                      className={`group flex items-center gap-2.5 py-1.5 pr-2.5 text-[13px] font-[450] tracking-[-0.005em] transition-colors duration-300 md:py-2 md:pr-0 ${
                        on ? "" : "text-ink/60 hover:text-ink"
                      }`}
                    >
                      {/* The label rides beside its dot, sliding over as the dot grows. */}
                      <span
                        aria-hidden
                        className={`h-1.5 shrink-0 rounded-full transition-all duration-500 ${
                          on ? "w-6 bg-ink" : "w-1.5 bg-black/25 group-hover:bg-black/50"
                        }`}
                      />
                      {s.label}
                    </ScrollLink>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* The card */}
          <div className="md:col-span-9 lg:col-span-10">
            {/* Every step's card is the height of the tallest (Pipeline,
                Partners), so the card holds still as the steps change. */}
            <div className="relative flex min-h-[36rem] flex-col overflow-hidden rounded-3xl bg-black p-7 text-white md:min-h-[min(47rem,calc(100svh-8rem))] md:p-12 lg:p-14">
              <div
                key={step.id}
                className="flex flex-1 flex-col animate-in duration-500 ease-out fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none"
              >
                {"status" in step && (
                  <p className="-mb-1">
                    <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] opacity-80">
                      {step.status}
                    </span>
                  </p>
                )}

                {/* The intro, with the step's side panel beside it from lg */}
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
                  <div>
                    <h2 className="mt-3 max-w-2xl text-2xl leading-[1.12] font-light tracking-tight md:text-4xl lg:text-5xl">
                      {step.title}
                    </h2>
                    {/* A compact step's own detail carries the story where space is short. */}
                    <p
                      className={`mt-5 max-w-xl text-sm leading-relaxed font-light opacity-70 md:text-base ${
                        compact ? "max-sm:hidden short:hidden" : ""
                      }`}
                    >
                      {step.body}
                    </p>
                    {"cta" in step && (
                      <a
                        href={ctaHref(step.cta.href)}
                        className="group mt-7 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm text-black transition hover:bg-white/85"
                      >
                        {step.cta.label}
                        <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-0.5" strokeWidth={1.5} />
                      </a>
                    )}
                    {"purpose" in step && (
                      <p className="mt-8 max-w-xl">
                        <span className="kicker block opacity-40">{step.purposeLabel}</span>
                        <span className="mt-2 block text-lg leading-snug font-light md:text-xl">{step.purpose}</span>
                      </p>
                    )}
                  </div>
                  <StepAside step={step} />
                </div>

                <StepBands step={step} />

                <p className={`mt-auto pt-8 pr-20 text-xs opacity-50 ${compact ? "max-sm:hidden" : ""}`}>{step.footnote}</p>
              </div>


              {/* The step's number, large in the corner. */}
              <span
                key={`n-${step.id}`}
                aria-hidden
                className="pointer-events-none absolute right-7 bottom-5 text-4xl font-light tracking-tight tabular-nums opacity-30 animate-in fade-in-0 duration-500 md:right-12 md:bottom-9 md:text-6xl"
              >
                {pad2(active + 1)}
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// The panel beside a step's intro, from sm.
function StepAside({ step }: { step: Step }) {
  if ("exchange" in step) {
    return (
      <SquarePair
        label={step.exchange.label}
        items={step.exchange.asks.map((a) => ({ top: a.who, main: <>&ldquo;{a.question}&rdquo;</> }))}
        caption={step.exchange.answer}
      />
    );
  }
  if ("earn" in step) {
    return <SquarePair label={step.earnLabel} items={step.earn.map((e) => ({ top: e.when, main: e.what }))} />;
  }
  if ("portal" in step) {
    return (
      <PreviewCard label={step.portal.label} status={step.portal.status}>
        <ul className="mt-3 divide-y divide-black/5">
          {step.portal.rows.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{row.name}</span>
              <span className="text-xs whitespace-nowrap text-black/50">{row.meta}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-black/40">{step.portal.note}</p>
      </PreviewCard>
    );
  }
  if ("board" in step) {
    return (
      <PreviewCard label={step.board.label} status={step.board.status}>
        <div aria-hidden className="mt-3 flex gap-1">
          {step.board.filters.map((f, i) => (
            <span
              key={f}
              className={`rounded-full px-2.5 py-0.5 text-[11px] ${i === 0 ? "bg-black text-white" : "bg-black/5 text-black/60"}`}
            >
              {f}
            </span>
          ))}
        </div>
        <ul className="mt-2 divide-y divide-black/5">
          {step.board.rows.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block text-sm">{row.name}</span>
                <span className="block text-[11px] text-black/45">{row.field}</span>
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] whitespace-nowrap ${
                  row.state === "Claim" ? "border border-black/20" : "bg-black/5 text-black/45"
                }`}
              >
                {row.state}
              </span>
            </li>
          ))}
        </ul>
      </PreviewCard>
    );
  }
  return null;
}

// Two white squares, the second set lower, so they read one after the other.
function SquarePair({
  label,
  items,
  caption,
}: {
  label: string;
  items: { top: string; main: ReactNode }[];
  caption?: string;
}) {
  return (
    <aside className="hidden self-end sm:block">
      <p className="kicker opacity-40">{label}</p>
      <div className="mt-4 flex items-start justify-between">
        {items.map((item, i) => (
          <div
            key={item.top}
            className={`flex aspect-square w-[47%] flex-col justify-between rounded-2xl bg-white p-4 text-ink ${RISE} ${
              i % 2 === 1 ? "mt-16" : ""
            }`}
            style={delay(200 + i * 180)}
          >
            <p className="text-xs text-black/50">{item.top}</p>
            <p className="text-lg leading-snug">{item.main}</p>
          </div>
        ))}
      </div>
      {caption && (
        <p className={`mt-4 text-center text-sm opacity-70 ${FADE}`} style={delay(600)}>
          {caption}
        </p>
      )}
    </aside>
  );
}

// A white preview of a platform screen, marked with its status.
function PreviewCard({ label, status, children }: { label: string; status: string; children: ReactNode }) {
  return (
    <aside
      aria-label={label}
      className={`hidden self-start rounded-2xl bg-white p-4 text-ink sm:block ${RISE}`}
      style={delay(200)}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-black/60">{status}</span>
      </div>
      {children}
    </aside>
  );
}

// The bands under a step's intro.
function StepBands({ step }: { step: Step }) {
  return (
    <>
      {"pipeline" in step && <PipelineDiagram data={step.pipeline} />}

      {"aims" in step && (
        <ul className="mt-8 grid gap-2 border-t border-white/15 pt-5 sm:mt-10 sm:grid-cols-3 sm:gap-8 sm:pt-6">
          {step.aims.map((aim, i) => (
            <li key={aim.title} className={FADE} style={delay(120 + i * 90)}>
              <p className="text-sm font-medium">{aim.title}</p>
              <p className="mt-1.5 hidden text-sm leading-relaxed font-light opacity-60 sm:block">{aim.body}</p>
            </li>
          ))}
        </ul>
      )}

      {"flow" in step && (
        <div className="mt-8 hidden sm:block short:mt-5">
          <p className="kicker opacity-40">{step.flowLabel}</p>
          <ol className="mt-3 flex flex-wrap items-center gap-y-2">
            {step.flow.map((f, i) => (
              <li key={f} className="flex items-center">
                {i > 0 && (
                  <span
                    aria-hidden
                    className="h-px w-4 origin-left bg-white/40 animate-in zoom-in-0 fill-mode-both duration-300 md:w-10"
                    style={delay(i * 180)}
                  />
                )}
                <span
                  className="rounded-full border border-white/25 px-3 py-1 text-xs whitespace-nowrap animate-in fade-in-0 fill-mode-both duration-300 md:text-sm"
                  style={delay(i * 180 + 90)}
                >
                  {f}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {"levels" in step && (
        // Connected nodes: a rail across the top of the band, a node over each column.
        <ol className="relative mt-6 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-8 sm:pt-7 short:mt-6">
          <span aria-hidden className="absolute top-[3px] right-0 left-0 hidden h-px bg-white/15 sm:block" />
          {step.levels.map((lvl, i) => (
            <li key={lvl.name} className={`relative ${FADE}`} style={delay(150 + i * 120)}>
              <span aria-hidden className="absolute -top-7 left-0 hidden size-[7px] rounded-full bg-white sm:block" />
              <p className="kicker font-normal opacity-40">{lvl.level}</p>
              <p className="mt-0.5 text-lg font-light sm:mt-1">{lvl.name}</p>
              <ul className="mt-2 hidden space-y-1 text-sm font-light opacity-60 sm:block short:hidden">
                {lvl.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {"help" in step && (
        <div className="mt-8 grid gap-8 border-t border-white/15 pt-6 lg:grid-cols-12">
          <div className="hidden sm:block lg:col-span-5">
            <p className="kicker opacity-40">{step.helpLabel}</p>
            <ol className="mt-3 space-y-2.5 short:space-y-1">
              {step.help.map((h, i) => (
                <li key={h.title} className="flex gap-3 text-sm">
                  <span className="opacity-40">{pad2(i + 1)}</span>
                  <span>
                    <span className="font-medium">{h.title}</span>
                    <span className="block font-light opacity-60 short:hidden">{h.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-7">
            <p className="kicker opacity-40">{step.examplesLabel}</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {step.examples.map((ex, i) => (
                <li
                  key={ex.problem}
                  className={`text-sm ${FADE} ${i > 2 ? "hidden sm:block" : ""}`}
                  style={delay(150 + i * 60)}
                >
                  <span className="block">{ex.problem}</span>
                  <span className="block text-xs opacity-45">{ex.field}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
