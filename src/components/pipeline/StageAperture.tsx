"use client";

/*
  The four steps as a pinned run. The section is taller than the screen; while
  it passes, it sticks and the words track upward, one step per screen-height
  of scroll, so the reader cannot reach the next section without having passed
  all four.

  The words move vertically, with the scroll rather than across it. A sideways
  track fights the direction the wheel is going and reads as a hijack; moving
  the text the way the page is already moving reads as the page working.

  The aperture is the hero's hole in the wall, squared off: the same PixelOval
  at shape="rect", which is a superellipse rather than an ellipse, one
  exponent's difference, so both share a grid, a wobble and a code path.

  It morphs rather than cuts. The proportion and phase are tweened between
  steps over MORPH_MS, and the component is never re-keyed, so blocks join and
  leave the shape through their own 700ms opacity transition while the outline
  sweeps. A remount would dump every block and fade the whole thing back in,
  which is the jump this avoids.

  One image throughout, the same jetty the hero uses.

  Below lg, and under prefers-reduced-motion, there is no pinning and no
  sideways anything: one aperture and the four steps stacked, all text open.
*/

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copy } from "@/content/copy";
import { GooeyFilter } from "@/components/ui/GooeyFilter";
import { PixelOval } from "@/components/ui/PixelOval";

const STEPS = copy.howItWorks.steps;
const MORPH_MS = 520;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

// Proportion and phase per step. Width over height: a slot at 01, opening out
// to a broad rectangle by 04, so the run reads as something widening.
const SHAPES = [
  { aspect: 0.62, phase: 0 },
  { aspect: 0.92, phase: 1.7 },
  { aspect: 1.24, phase: 3.1 },
  { aspect: 1.58, phase: 4.6 },
];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

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

function Aperture({
  aspect,
  phase,
  id,
  className = "aspect-[4/5] w-full",
}: {
  aspect: number;
  phase: number;
  // Both the stacked and the pinned aperture are in the DOM at once, so each
  // needs its own filter: two <filter> elements sharing an id would leave one
  // of them resolving to the other's definition.
  id: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-ground ${className}`}>
      <GooeyFilter id={id} strength={5} />
      <div aria-hidden className="absolute inset-0" style={{ filter: `url(#${id})` }}>
        <PixelOval
          pixelSize={30}
          heightRatio={0.94}
          aspect={aspect}
          wobble={0.07}
          phase={phase}
          shape="rect"
          src="/jetty.jpg"
          shiftMs={2200}
          fill={false}
        />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="text-center">
      <h2 className="display mx-auto max-w-3xl text-[1.75rem] leading-tight md:text-[2.5rem]">
        {copy.howItWorks.heading}
      </h2>
      <p className="mx-auto mt-3 max-w-prose leading-relaxed text-ink-soft">
        {copy.howItWorks.intro}
      </p>
    </div>
  );
}

function Words({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-brand-deep">
        {step.num}
      </p>
      <h3 className="display mt-3 text-[28px] leading-[1.1] md:text-[36px]">{step.title}</h3>
      <p className="mt-5 max-w-[44ch] text-[1.0625rem] leading-relaxed text-ink-soft">
        {step.caption}
      </p>
      {/* The second half, encased like the hero's facts strip: same black
          card, same radius, same Magistral. Weight 400 only, because that is
          the single weight the face ships. `on-dark` repoints the two rules
          that hardcode the light-mode purple. */}
      <div className="on-dark mt-5 max-w-[44ch] rounded-[var(--radius-image)] bg-ground-inverse p-5 md:p-6">
        <p className="font-magistral text-[14px] font-normal leading-[1.5] text-ink-inverse md:text-[15px]">
          {step.body}
        </p>
      </div>
    </div>
  );
}

export function StageAperture() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [shape, setShape] = useState(SHAPES[0]);

  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const morph = useRef<number | undefined>(undefined);

  // Tween the aperture between two steps' proportions. Runs on its own clock
  // rather than off scroll: the outline should finish its move even when the
  // reader stops mid-scroll.
  const morphTo = useCallback((from: typeof SHAPES[number], to: typeof SHAPES[number]) => {
    if (morph.current) cancelAnimationFrame(morph.current);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = easeOut(Math.min((now - t0) / MORPH_MS, 1));
      setShape({
        aspect: from.aspect + (to.aspect - from.aspect) * k,
        phase: from.phase + (to.phase - from.phase) * k,
      });
      if (k < 1) morph.current = requestAnimationFrame(tick);
    };
    morph.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => {
    if (morph.current) cancelAnimationFrame(morph.current);
  }, []);

  // Jump to a step. The run is scroll-driven, so moving to a step means
  // moving the page to the offset where that step is showing. It does not
  // scroll here: it hands the frame loop a target, and the loop drives it
  // with the same eased tween the settle uses. A native smooth scroll would
  // be a second thing moving the page, and the settle would fight it and drag
  // the reader back to whichever step they happened to pass.
  const jump = useRef<number | null>(null);
  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.min(Math.max(i, 0), STEPS.length - 1);
      if (!reduced) {
        jump.current = clamped;
        return;
      }
      // No loop under reduced motion, so place the page directly.
      const el = wrap.current;
      if (!el) return;
      const span = el.offsetHeight - (pin.current?.clientHeight ?? window.innerHeight);
      if (span <= 0) return;
      const top = window.scrollY + el.getBoundingClientRect().top;
      window.scrollTo({ top: top + (span * clamped) / (STEPS.length - 1) });
    },
    [reduced],
  );

  useEffect(() => {
    if (reduced) return;

    // One rAF loop owns the whole run: it reads the scroll, eases the words
    // toward it, and drives the settle. Scroll events fire at whatever
    // cadence the browser feels like, so reading them directly is what made
    // the travel look stepped; a frame loop reads the same number smoothly.
    let raf = 0;
    let live = false;
    // What the scroll says, and what is currently drawn. The gap between them
    // is the easing: the words chase the scroll instead of snapping to it.
    let toP = 0;
    let atP = 0;
    let primed = false;
    // The settle's own tween, run here rather than through scrollTo's
    // "smooth", whose curve is the browser's and lands hard.
    let from = 0;
    let to = 0;
    let t0 = 0;
    let settling = false;
    let lastInput = 0;

    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const metrics = () => {
      const el = wrap.current;
      if (!el) return null;
      // Against the pinned element's own height, not the viewport's: it sits
      // below the site header, so the two differ and the run would otherwise
      // finish early.
      const span = el.offsetHeight - (pin.current?.clientHeight ?? window.innerHeight);
      if (span <= 0) return null;
      return { top: window.scrollY + el.getBoundingClientRect().top, span };
    };

    const frame = (now: number) => {
      const m = metrics();
      if (m) {
        // A node was clicked: take it as the new target and let the same
        // tween carry it, marking it as input so the auto-settle does not
        // immediately re-aim at the nearest step on the way past.
        if (jump.current !== null) {
          from = window.scrollY;
          to = m.top + (jump.current * m.span) / (STEPS.length - 1);
          t0 = now;
          settling = true;
          lastInput = now;
          jump.current = null;
        }

        if (settling) {
          const k = easeInOut(Math.min((now - t0) / 420, 1));
          window.scrollTo(0, from + (to - from) * k);
          if (k >= 1) settling = false;
        }

        toP = Math.min(Math.max((window.scrollY - m.top) / m.span, 0), 1);
        if (!primed) {
          atP = toP;
          primed = true;
        }
        // Critically damped enough to feel immediate without arriving hard.
        atP += (toP - atP) * 0.3;
        if (Math.abs(toP - atP) < 0.0004) atP = toP;

        // A percentage translate resolves against this element's own size,
        // and the track is STEPS.length panels tall. One panel is therefore
        // 100/STEPS.length percent of it, not 100. Written straight to the
        // node: at 60fps this must not go through React.
        if (track.current) {
          const perPanel = 100 / STEPS.length;
          track.current.style.transform = `translate3d(0, ${
            -atP * (STEPS.length - 1) * perPanel
          }%, 0)`;
        }

        const i = Math.round(atP * (STEPS.length - 1));
        if (i !== activeRef.current) {
          const was = SHAPES[activeRef.current] ?? SHAPES[0];
          activeRef.current = i;
          setActive(i);
          morphTo(was, SHAPES[i] ?? SHAPES[0]);
        }

        // The push, built into the scroll rather than hung off a link: once
        // the wheel has been still for a moment, the page eases onto the
        // nearer step, so nobody comes to rest half way through a transition.
        // Both ends are left alone, so entering and leaving the section stay
        // ordinary scrolling.
        if (!settling && now - lastInput > 110 && toP > 0 && toP < 1) {
          const nearest = Math.round(toP * (STEPS.length - 1));
          const target = m.top + (nearest * m.span) / (STEPS.length - 1);
          // Under a few pixels, leave it: moving that far reads as a twitch.
          if (Math.abs(window.scrollY - target) > 6) {
            from = window.scrollY;
            to = target;
            t0 = now;
            settling = true;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    // Any real input cancels a settle in progress, so the wheel always wins.
    // Clicks are not in this list: a node's jump is a settle, and cancelling
    // it on the click that started it would leave the reader where they were.
    const onInput = () => {
      lastInput = performance.now();
      settling = false;
    };

    // The loop only runs while the section is on screen.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !live) {
          live = true;
          primed = false;
          raf = requestAnimationFrame(frame);
        } else if (!e.isIntersecting && live) {
          live = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 },
    );
    if (wrap.current) io.observe(wrap.current);

    window.addEventListener("wheel", onInput, { passive: true });
    window.addEventListener("touchmove", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("touchmove", onInput);
      window.removeEventListener("keydown", onInput);
    };
  }, [reduced, morphTo]);

  // No pinning below lg or under reduced motion: a stack, everything open.
  const stacked = (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-12 md:px-8 md:py-20 lg:hidden">
      <Header />
      <Aperture id="steps-goo-stacked" aspect={SHAPES[0].aspect} phase={SHAPES[0].phase} />
      {STEPS.map((step) => (
        <Words key={step.id} step={step} />
      ))}
    </div>
  );

  if (reduced) return stacked;

  return (
    <>
      {stacked}

      {/* The run's length. Each step costs about two thirds of a screen of
          wheel: enough that nobody skims past one, short enough that the
          section does not feel like a tunnel. */}
      <div
        ref={wrap}
        className="relative mx-auto hidden max-w-6xl px-5 md:px-8 lg:block"
        style={{ height: `${STEPS.length * 68}vh` }}
      >
        <div
          ref={pin}
          className="sticky top-[var(--site-header-height)] flex h-[calc(100svh-var(--site-header-height))] flex-col justify-between gap-8 overflow-hidden py-10"
        >
          <Header />

          {/* The middle takes whatever the header and the nodes leave, and
              the aperture fills it: no fixed aspect here, or it would either
              overflow a short screen or leave a hole in a tall one. */}
          <div className="grid min-h-0 flex-1 items-stretch gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Aperture
              id="steps-goo"
              aspect={shape.aspect}
              phase={shape.phase}
              className="h-full w-full"
            />

            {/* Right column, centred against the aperture beside it. */}
            <div className="flex min-h-0 flex-col justify-center">
              {/* The window is one step tall; the track holds all four and
                  slides up through it. */}
              <div className="h-[42svh] overflow-hidden">
                <div
                  ref={track}
                  className="flex flex-col"
                  style={{ height: `${STEPS.length * 100}%`, willChange: "transform" }}
                >
                  {STEPS.map((step, i) => (
                    <div
                      key={step.id}
                      aria-hidden={i !== active}
                      className="flex shrink-0 flex-col justify-center"
                      style={{ height: `${100 / STEPS.length}%` }}
                    >
                      <Words step={step} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* The nodes. Each carries its step's title, so the run shows what
              is behind and what is still coming rather than only how far
              along it is. Filled to here, faint after. */}
          <nav
            aria-label={copy.howItWorks.heading}
            className="grid grid-cols-4 gap-4"
          >
            {STEPS.map((s, i) => {
              const done = i <= active;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={i === active ? "step" : undefined}
                  onClick={() => goTo(i)}
                  className="cursor-pointer text-left"
                >
                  <span
                    className={`block h-[2px] w-full transition-colors duration-300 ${
                      done ? "bg-brand-deep" : "bg-line"
                    }`}
                  />
                  <span
                    className={`mt-3 block font-mono text-[11px] transition-colors duration-300 ${
                      i === active ? "text-brand-deep" : "text-ink-faint"
                    }`}
                  >
                    {s.num}
                  </span>
                  <span
                    className={`mt-1 block text-[13px] leading-[1.35] transition-colors duration-300 ${
                      i === active ? "text-ink" : "text-ink-faint"
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
