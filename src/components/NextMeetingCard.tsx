// The next meeting, given a place where it stands out: full detail (title,
// date, time, room with its to-be-confirmed flag, what happens), a one-click
// Google Calendar add for this meeting, and the whole semester as one
// calendar file. Shared by the landing hero and /join.

import { copy } from "@/content/copy";
import { eventLine, googleCalUrl, roomLine } from "@/lib/format";
import type { LabEvent } from "@/lib/types";

export function NextMeetingCard({
  event,
  cadence,
  variant = "card",
}: {
  event: LabEvent;
  cadence?: string;
  variant?: "card" | "glass";
}) {
  // "glass" is the kickoff card in the hero: a frosted panel over the Spiral
  // Jetty photo. `on-dark` repoints .kicker and the focus ring; the rest of
  // the type runs on the inverse ink scale.
  if (variant === "glass") {
    return (
      <div className="on-dark flex w-full flex-col gap-8 border border-white/20 bg-white/10 p-7 text-ink-inverse shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-9">
        <div>
          <p className="kicker">{copy.nextMeeting.kicker}</p>
          <h2 className="display mt-3 text-3xl">{event.title}</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-inverse-faint">
                When
              </dt>
              <dd className="mt-1 font-mono text-sm">{eventLine(event)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-inverse-faint">
                Where
              </dt>
              <dd className="mt-1 font-mono text-sm">
                {roomLine(event, copy.thisFall.roomFallback)}
              </dd>
            </div>
          </dl>
          {cadence && (
            <p className="mt-6 text-sm leading-relaxed text-ink-inverse-soft">{cadence}</p>
          )}
          {event.description && (
            <p className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed text-ink-inverse-soft">
              {event.description}
            </p>
          )}
        </div>
        <div className="border-t border-white/20 pt-5">
          <p className="text-sm text-ink-inverse-soft">{copy.nextMeeting.calendarLead}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a
              href={googleCalUrl(event)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-inverse underline-offset-4 hover:underline"
            >
              {copy.calendar.addGoogle}
            </a>
            <a
              href="/calendar.ics"
              className="font-medium text-brand-inverse underline-offset-4 hover:underline"
            >
              {copy.nextMeeting.semesterCta}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-brand bg-brand-wash p-6">
      <p className="kicker">{copy.nextMeeting.kicker}</p>
      <h2 className="display mt-2 text-2xl">{event.title}</h2>
      <p className="mt-2 font-mono text-sm">{eventLine(event)}</p>
      <p className="mt-1 font-mono text-sm text-ink-soft">
        {roomLine(event, copy.thisFall.roomFallback)}
      </p>
      {cadence && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{cadence}</p>}
      {event.description && (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">{event.description}</p>
      )}
      <div className="mt-auto pt-4">
        <p className="text-sm text-ink-soft">{copy.nextMeeting.calendarLead}</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a
            href={googleCalUrl(event)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-deep underline-offset-4 hover:underline"
          >
            {copy.calendar.addGoogle}
          </a>
          <a
            href="/calendar.ics"
            className="font-medium text-brand-deep underline-offset-4 hover:underline"
          >
            {copy.nextMeeting.semesterCta}
          </a>
        </div>
      </div>
    </div>
  );
}
