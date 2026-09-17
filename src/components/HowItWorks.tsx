"use client";

/*
  How it works: the landing's scroll-driven section. The section is one
  screen tall per step, and a panel sticks to the screen while it scrolls:
  a column of step tabs at the left (a row on phones) and a black card at
  the right.

  Scrolling moves the active tab, whose tick stretches into a bar, and the
  card switches to that step, fading in from below. A tab click jumps
  straight to its step. Each step has
  an anchor at its own scroll position, which is what the header links and
  the rail's nodes jump to, so any step can be opened directly.

  Steps whose chips are a sequence (`chain`) draw them as their own small
  node chain inside the card, lit one after another.
*/

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { Reveal } from "@/components/Reveal";
import { ScrollLink } from "@/components/ScrollLink";

const C = copy.how;
const STEPS = C.steps;
const LAST = STEPS.length - 1;

export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  // Scroll progress through the section, in steps: 0 at the first, LAST at
  // the last.
  const [progress, setProgress] = useState(0);
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
      setProgress(Math.min(LAST, Math.max(0, scrolled)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Any wheel turn or touch hands control straight back to the scroll.
    const release = () => setLock(null);
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      cancelAnimationFrame(frame);
    };
  }, []);

  const reached = Math.round(progress);
  const active = lock ?? reached;
  if (lock !== null && reached === lock) setLock(null);
  const step = STEPS[active];

  return (
    <section
      ref={section}
      aria-label={C.kicker}
      className="font-archivo relative text-[#1a1a1a]"
      style={{ height: `${STEPS.length * 100}svh` }}
    >
      {/* One anchor per step, at the scroll position that shows it. */}
      {STEPS.map((s, i) => (
        <div key={s.id} id={s.id} aria-hidden className="absolute inset-x-0 h-px" style={{ top: `${i * 100}svh` }} />
      ))}

      <div className="sticky top-0 h-svh">
        <Reveal className="flex h-full flex-col justify-center gap-8 px-5 pt-20 pb-10 md:grid md:grid-cols-12 md:items-center md:gap-8 lg:px-15">
          {/* The rail */}
          <nav aria-label={C.kicker} className="md:col-span-4 lg:col-span-3">
            <p className="mb-6 text-[11px] font-medium tracking-[0.18em] uppercase opacity-35">{C.kicker}</p>
            {/* Tabs after weave2-demo.vercel.app's showcase: each carries a
                small tick that stretches into a bar on the active step. On
                phones they run across, and the active one is underlined. */}
            <ol className="flex flex-wrap gap-x-1 gap-y-1 md:flex-col md:gap-0.5">
              {STEPS.map((s, i) => {
                const on = i === active;
                return (
                  <li key={s.id}>
                    <ScrollLink
                      href={`#${s.id}`}
                      aria-current={on ? "step" : undefined}
                      onClick={() => setLock(i)}
                      className={`relative block py-1.5 pr-2.5 text-[13px] font-[450] tracking-[-0.005em] transition-colors duration-250 md:py-2 md:pr-0 md:pl-[1.1rem] ${
                        on
                          ? "text-[#1a1a1a] max-md:underline max-md:underline-offset-4"
                          : "text-[#1a1a1a]/75 hover:text-[#1a1a1a]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute top-1/2 left-0 hidden w-0.5 -translate-y-1/2 rounded-full transition-[height,background-color] duration-250 md:block ${
                          on ? "h-[1.3rem] bg-[#1a1a1a]" : "h-[0.4rem] bg-black/35"
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
          <div className="md:col-span-8 lg:col-span-8 lg:col-start-5">
            <div className="relative min-h-[26rem] overflow-hidden bg-black p-7 text-white md:min-h-[28rem] md:p-12">
              <div
                key={step.id}
                className="flex h-full flex-col animate-in duration-500 ease-out fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none"
              >
                <p className="flex gap-3 text-[11px] font-medium tracking-[0.18em] uppercase">
                  <span className="opacity-40">{String(active + 1).padStart(2, "0")}</span>
                  <span className="opacity-70">{step.label}</span>
                </p>
                <h2 className="mt-5 max-w-xl text-2xl leading-[1.15] font-light tracking-tight md:text-4xl">{step.title}</h2>
                <p className="mt-5 max-w-xl text-sm leading-relaxed font-light opacity-70 md:text-base">{step.body}</p>

                {"chain" in step && step.chain ? (
                  <ol className="mt-10 flex flex-wrap items-center gap-y-2">
                    {step.chips.map((chip, i) => (
                      <li key={chip} className="flex items-center">
                        {i > 0 && (
                          <span
                            aria-hidden
                            className="h-px w-3 origin-left bg-white/40 animate-in zoom-in-0 fill-mode-both duration-300 md:w-10"
                            style={{ animationDelay: `${i * 180}ms` }}
                          />
                        )}
                        <span
                          className="rounded-full border border-white/25 px-2.5 py-1 text-xs whitespace-nowrap animate-in fade-in-0 fill-mode-both duration-300 md:px-3 md:text-sm"
                          style={{ animationDelay: `${i * 180 + 90}ms` }}
                        >
                          {chip}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className="mt-10 flex flex-wrap gap-2">
                    {step.chips.map((chip, i) => (
                      <li
                        key={chip}
                        className="rounded-full border border-white/25 px-3 py-1 text-xs animate-in fade-in-0 fill-mode-both duration-300 md:text-sm"
                        style={{ animationDelay: `${i * 90}ms` }}
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Which step, as dots in the corner. */}
              <div aria-hidden className="absolute right-7 bottom-7 flex gap-1.5 md:right-12 md:bottom-12">
                {STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/30"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

