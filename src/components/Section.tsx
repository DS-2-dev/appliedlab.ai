// Section shell. The route-rail motif it used to carry, a continuous line
// down the left with a checkpoint dot per section, was dropped on 2026-09-01:
// the sections read as a sequence on their own, and the rail was the only
// reason this needed to be a client component.
//
// Composition variants (2026-08-19 design pass), so pages vary placement
// without inventing per-page layouts:
// - default: heading on top, content below, full column
// - split:   heading and intro in a left column, content on the right (lg+)
// - band:    full-bleed ground-raised background with top and bottom rules;
//            cards inside a band should sit on bg-ground, wash stays wash

import { type ReactNode } from "react";

export function Section({
  id,
  num,
  kicker,
  heading,
  intro,
  children,
  band = false,
  split = false,
  centered = false,
  flushLeft = false,
  compact = false,
  decoration,
}: {
  id: string;
  num?: string;
  kicker?: string;
  heading: string;
  intro?: string;
  children: ReactNode;
  band?: boolean;
  split?: boolean;
  centered?: boolean;
  flushLeft?: boolean;
  compact?: boolean;
  /* Art that sits behind the column and bleeds to the section's edges rather
     than living in the content grid. Positioned against the section itself,
     clipped by it, and under the copy. */
  decoration?: ReactNode;
}) {
  // `kicker` is optional: a section can lead with its heading alone. When it
  // does, the heading takes the space the kicker would have held rather than
  // leaving a gap.
  const header = (
    <div className={centered ? "text-center" : undefined}>
      {kicker && (
        <p className="kicker">
          {num && <span className="mr-2 text-brand-deep">{num}</span>}
          {kicker}
        </p>
      )}
      <h2
        className={`display max-w-3xl text-[1.75rem] leading-tight md:text-[2.5rem] ${
          kicker ? "mt-4" : ""
        } ${centered ? "mx-auto" : ""}`}
      >
        {heading}
      </h2>
      {intro && (
        <p
          className={`mt-4 max-w-prose leading-relaxed text-ink-soft ${
            centered ? "mx-auto" : ""
          }`}
        >
          {intro}
        </p>
      )}
    </div>
  );

  return (
    <section
      id={id}
      className={`scroll-mt-20 ${band ? "border-y border-line bg-ground-raised" : ""} ${
        decoration ? "relative isolate overflow-hidden" : ""
      }`}
    >
      {decoration}

      {/* `flushLeft` drops the centring so the column hugs the page's left
          edge at the hero's own inset, which is much further left than a
          centred max-w-6xl sits on a wide screen. Content width is unchanged;
          only the gutter moves. */}
      <div
        className={
          flushLeft
            ? "max-w-6xl px-edge lg:pl-[var(--hero-text-inset)]"
            : "mx-auto max-w-6xl px-5 md:px-8"
        }
      >
        {split ? (
          <div className="py-12 md:py-20 lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-x-12">
            <div className="lg:sticky lg:top-24 lg:self-start">{header}</div>
            <div className="mt-8 lg:mt-0">{children}</div>
          </div>
        ) : (
          <div className={compact ? "py-10 md:py-12" : "py-12 md:py-20"}>
            {header}
            {/* The full gap is sized for a heading, an intro and then the
                content. With no intro the heading is the only thing above,
                and that gap reads as a hole, so it closes to the one the
                intro would have sat in. */}
            <div className={intro ? "mt-8 md:mt-12" : "mt-5 md:mt-6"}>{children}</div>
          </div>
        )}
      </div>
    </section>
  );
}
