"use client";

/*
  The four steps in diabrowser.com's stage layout, rebuilt from their markup
  rather than approximated. Their structure, read off the page:

    grid grid-cols-12 gap-x-20
      col-span-4  -> sticky top-[20vh] > nav.flex.flex-col
        button    -> relative text-left px-24 py-20 rounded-16
                     active bg-primary/[0.06], inactive bg-transparent
        bar       -> absolute left-0 top-[16%] bottom-[16%] w-[3px]
                     rounded-full, active bg-primary, inactive bg-primary/15
        number    -> font-mono text-11 leading-14 mb-8
                     active text-tertiary, inactive text-quaternary
        title     -> text-22 leading-28 (text-24 at 1000)
                     active text-primary, inactive text-tertiary
        caption   -> div.grid.overflow-hidden with grid-template-rows 0fr/1fr
                     and opacity 0/1 > div.min-h-0 > pt-10 text-14 leading-20
                     max-w-[32ch]
      col-span-8  -> flex flex-col gap-y-20, each panel
                     min-h-[60vh] flex items-start pb-40

  Their colour names map onto ours: primary is ink, secondary ink-soft,
  tertiary ink-faint, quaternary a step lighter again. Their type is Exposure
  and a mono; ours is automate and JetBrains. Their panels hold product
  screenshots; ours hold the step's glyph.

  Below their 800 breakpoint they drop the whole mechanism for a plain stack
  with every caption showing, which is what the lg:hidden block does here.
*/

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { StepGlyph } from "@/components/pipeline/StepGlyph";

const STEPS = copy.howItWorks.steps;

// The visual half. Theirs is a screenshot; ours is the step's glyph on the
// wash. Radius is --radius-image rather than their 24, because the site
// rounds at exactly one value and a second one would break that.
function Panel({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div className="flex w-full items-center justify-center overflow-hidden rounded-[var(--radius-image)] border border-line bg-brand-wash p-8 lg:min-h-[420px] lg:p-12">
      <StepGlyph id={step.id} size={96} className="text-brand-deep" />
    </div>
  );
}

// Below lg there is no rail to hold the words, so the stacked form carries
// them, every caption open.
function StackedStep({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel step={step} />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-brand-deep">
          {step.num}
        </p>
        <p className="display mt-3 text-3xl">{step.title}</p>
        <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-soft">
          {step.caption}
        </p>
      </div>
    </div>
  );
}

export function StageScroller() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // A band across the middle of the viewport: whichever panel is crossing
    // it owns the rail.
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.index);
            if (!Number.isNaN(i)) setActive(i);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    panels.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const go = (i: number) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panels.current[i]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  };

  return (
    <>
      {/* Below lg: plain stack, no state. */}
      <div className="flex flex-col gap-12 lg:hidden">
        {STEPS.map((step) => (
          <StackedStep key={step.id} step={step} />
        ))}
      </div>

      {/* lg and up: their 12-column split, 20px gutters. */}
      <div className="hidden gap-x-5 lg:grid lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="sticky top-[20vh]">
            <nav className="flex flex-col" aria-label={copy.howItWorks.heading}>
              {STEPS.map((step, i) => {
                const on = i === active;
                return (
                  <button
                    key={step.id}
                    type="button"
                    aria-current={on ? "step" : undefined}
                    onClick={() => go(i)}
                    className={`group relative cursor-pointer rounded-[var(--radius-image)] px-6 py-5 text-left transition-all duration-300 ${
                      on ? "bg-ink/[0.06]" : "bg-transparent"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute bottom-[16%] left-0 top-[16%] w-[3px] rounded-full transition-all duration-300 ${
                        on ? "bg-ink" : "bg-ink/15"
                      }`}
                    />
                    <span
                      className={`mb-2 block font-mono text-[11px] leading-[14px] transition-colors duration-300 ${
                        on ? "text-ink-faint" : "text-ink-faint/60"
                      }`}
                    >
                      {step.num}
                    </span>
                    <span
                      className={`display block text-[22px] leading-[28px] tracking-[-0.02em] transition-all duration-300 xl:text-[24px] xl:leading-[30px] ${
                        on ? "text-ink" : "text-ink-faint"
                      }`}
                    >
                      {step.title}
                    </span>
                    <span
                      className="grid overflow-hidden transition-all duration-300"
                      style={{
                        gridTemplateRows: on ? "1fr" : "0fr",
                        opacity: on ? 1 : 0,
                      }}
                    >
                      <span className="min-h-0">
                        <span className="block max-w-[32ch] pt-[10px] text-[14px] leading-[20px] text-ink-soft">
                          {step.caption}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="flex flex-col gap-y-5 lg:col-span-8">
          {STEPS.map((step, i) => (
            <div
              key={step.id}
              data-index={i}
              ref={(el) => {
                panels.current[i] = el;
              }}
              className="flex min-h-[60vh] items-start pb-10"
            >
              <Panel step={step} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
