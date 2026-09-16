import type { LabEvent } from "./types";

const TZ = "America/Denver";

export function fmtEventDate(iso: string): string {
  // "Thu Sep 3" style
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function fmtEventTime(iso: string): string {
  // "1:30 pm" style (spec renders lowercase am/pm)
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  })
    .format(new Date(iso))
    .replace("AM", "am")
    .replace("PM", "pm");
}

export function fmtEventLong(iso: string): string {
  // "Thursday, September 3 at 1:30 pm"
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
  return `${date} at ${fmtEventTime(iso)}`;
}

export function eventLine(e: LabEvent): string {
  return `${fmtEventDate(e.starts_at)}, ${fmtEventTime(e.starts_at)}`;
}

/** The request moment. Server components use this instead of calling
 * Date.now() in render, keeping components pure while dynamic pages stay
 * per-request fresh. */
export function requestNow(): number {
  return Date.now();
}

/** Events at or after the given moment, soonest first. Server components
 * pass nothing, because the request time is the right "now". */
export function upcomingEvents(events: LabEvent[], from: number = Date.now()): LabEvent[] {
  return events
    .filter((e) => new Date(e.starts_at).getTime() >= from)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function roomLine(e: LabEvent, fallback: string): string {
  // An unconfirmed room still renders (Kylar: give the room we think we have),
  // flagged so nothing on the site reads as a promise it is not.
  if (e.room) return e.room_confirmed ? e.room : `${e.room} (to be confirmed)`;
  if (e.location_note) return e.location_note;
  return fallback;
}

function toCalStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalUrl(e: LabEvent): string {
  const start = toCalStamp(e.starts_at);
  const end = toCalStamp(
    e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000).toISOString(),
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Applied AI Lab: ${e.title}`,
    dates: `${start}/${end}`,
    details: e.description ?? "Applied AI Lab at Weber State",
    location: e.room ? `Shepherd Union ${e.room}` : "Shepherd Union, Weber State",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEvent(e: LabEvent): string[] {
  const start = toCalStamp(e.starts_at);
  const end = toCalStamp(
    e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000).toISOString(),
  );
  return [
    "BEGIN:VEVENT",
    `UID:${e.id}@appliedailab`,
    `DTSTAMP:${toCalStamp(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Applied AI Lab: ${e.title}`,
    `LOCATION:${e.room ?? "Shepherd Union, Weber State"}`,
    `DESCRIPTION:${(e.description ?? "").replace(/\n/g, "\\n")}`,
    "END:VEVENT",
  ];
}

/** One calendar file carrying the whole agenda. Imports into Google, Apple,
 * and Outlook; when the site has a public domain, the same URL also works as
 * a Google "from URL" subscription. */
export function buildIcsAll(events: LabEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Applied AI Lab at Weber State//EN",
    "X-WR-CALNAME:Applied AI Lab",
    ...events.flatMap(icsEvent),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
