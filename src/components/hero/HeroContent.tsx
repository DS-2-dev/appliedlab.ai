/*
  The hero's content, parked here on 2026-08-30 while the hero is being
  designed as a blank canvas — white ground plus the gooey tear, nothing on
  top of it. Nothing about this markup changed on the way out; it is the last
  rendered version verbatim.

  To put it back, in src/app/page.tsx:

  1. Restore the data this needs. The page now fetches only the showcase,
     because nothing else was still reading events or settings:

       const [events, settings, showcase] = await Promise.all([
         getEvents(),
         getSettings(),
         listShowcasePublic(),
       ]);

       const future = upcomingEvents(events);
       const nextEvent = future[0] ?? null;
       const tagline = settings.tagline || copy.hero.headline;
       const cadence = copy.nextMeeting.cadence.replace("{schedule}", settings.meeting_schedule);

  2. Restore the imports dropped with it: `getEvents, getSettings` from
     @/lib/data, and `upcomingEvents` from @/lib/format.

  3. Render inside the hero <section>, after the filter layer:

       <HeroContent
         tagline={tagline}
         nextEvent={nextEvent}
         cadence={cadence}
         offseasonLine={settings.offseason_line}
       />
*/

import Link from "next/link";
import { copy } from "@/content/copy";
import { ScrollLink } from "@/components/ScrollLink";
import { NextMeetingCard } from "@/components/NextMeetingCard";
import type { LabEvent } from "@/lib/types";

export function HeroContent({
  tagline,
  nextEvent,
  cadence,
  offseasonLine,
}: {
  tagline: string;
  nextEvent: LabEvent | null;
  cadence: string;
  offseasonLine: string;
}) {
  return (
    <div className="relative w-full px-edge py-16 md:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14">
        {/* Text, hard left. */}
        <div className="flex flex-col gap-8 lg:gap-12">
          <h1
            className="font-display font-normal leading-[1.04] tracking-[-0.005em] text-ink [text-wrap:balance]"
            style={{ fontSize: "clamp(40px, 5.4vw, 76px)" }}
          >
            {tagline}
          </h1>
          <div className="relative flex flex-col items-start gap-8 pl-6">
            <div aria-hidden className="absolute left-0 top-0 h-full w-px bg-line" />
            <div
              aria-hidden
              className="absolute left-0 top-0 h-6 w-[5px] -translate-x-1/2 bg-brand"
            />
            <p className="max-w-[46ch] text-[18px] leading-[1.45] tracking-[-0.01em] text-ink-soft [text-wrap:pretty] md:text-[20px]">
              {copy.hero.sub}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/join" className="btn bg-brand-deep text-white hover:bg-brand">
                {copy.hero.ctaPrimary}
              </Link>
              <ScrollLink href="#how" className="btn border-line-strong text-ink hover:border-ink">
                {copy.hero.ctaSecondary}
              </ScrollLink>
            </div>
          </div>
        </div>

        {/* The glass kickoff card, hard right, sitting on the tear. */}
        <div className="w-full">
          {nextEvent ? (
            <NextMeetingCard event={nextEvent} cadence={cadence} variant="glass" />
          ) : (
            <p className="on-dark w-full border border-white/20 bg-white/10 p-8 font-mono text-sm text-ink-inverse-soft backdrop-blur-xl">
              {offseasonLine}
            </p>
          )}
        </div>
      </div>

      <div className="mt-14 flex max-w-[46ch] flex-col gap-5 md:mt-20 lg:max-w-[52%]">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          {copy.hero.eyebrow}
        </p>
        <ul className="flex flex-wrap gap-x-8 gap-y-2 border-y border-line py-5 font-mono text-[0.8125rem] text-ink-soft">
          {copy.hero.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
