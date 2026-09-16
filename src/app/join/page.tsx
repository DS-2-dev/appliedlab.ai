/*
  /join - the official QR target (2026-08-19) and the answer to "one button
  can't give the meeting information AND the form": the destination carries
  both, information first, capture directly under it. The audience switch
  captures every kind of scanner without gating anyone, and the escape is a
  plain link. Membership is still showing up.
*/

import type { Metadata } from "next";
import { copy } from "@/content/copy";
import { getEvents, getSettings, formsLive } from "@/lib/data";
import { upcomingEvents } from "@/lib/format";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Section } from "@/components/Section";
import { NextMeetingCard } from "@/components/NextMeetingCard";
import { AudienceSwitch } from "@/components/AudienceSwitch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.join.meta.title} | ${copy.meta.title}`,
  description: copy.join.lede,
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const [events, settings, live, params] = await Promise.all([
    getEvents(),
    getSettings(),
    formsLive(),
    searchParams,
  ]);
  const initial =
    params.as === "faculty" || params.as === "organization" ? params.as : undefined;
  const cadence = copy.nextMeeting.cadence.replace("{schedule}", settings.meeting_schedule);
  const future = upcomingEvents(events);
  const nextEvent = future.find((e) => e.title === "Kickoff") ?? future[0] ?? null;

  return (
    <>
      <SiteNav />
      <main id="main">
        {/* the information, first */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 md:px-8 md:pb-16 md:pt-20">
            <p className="kicker">{copy.join.kicker}</p>
            <h1 className="display mt-4 max-w-3xl text-[2.125rem] md:text-[3.25rem]">
              {copy.join.heading}
            </h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">
              {copy.join.lede}
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {nextEvent && <NextMeetingCard event={nextEvent} cadence={cadence} />}
              <div className="border border-line bg-ground-raised p-6">
                <h2 className="display text-xl">{copy.thisFall.heading}</h2>
                <p className="mt-4 leading-relaxed text-ink-soft">{copy.thisFall.intro}</p>
                <p className="mt-4 leading-relaxed text-ink-soft">{copy.thisFall.fundedLine}</p>
                <p className="mt-4 text-sm text-ink-faint">{copy.join.whatToBring}</p>
              </div>
            </div>
          </div>
        </section>

        {/* the form, directly beneath */}
        <Section id="signup" kicker="Stay in the loop" heading={copy.join.formHeading} compact>
          <AudienceSwitch formsLive={live} followupDays={settings.followup_days} initial={initial} />
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
