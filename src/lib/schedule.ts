// The Lab's meeting schedule, read from data/settings.json (the weekly line)
// and data/events.json (dated meetings and events), so copy never carries a
// day or a time of its own. Times show in Utah's time zone.

import settings from "../../data/settings.json";
import events from "../../data/events.json";

export type LabEvent = {
  id: string;
  title: string;
  type: string;
  starts_at: string;
  room: string | null;
  room_confirmed: boolean;
};

const ZONE = "America/Denver";

// The weekly line, e.g. "Thursdays, 1:30 pm".
export const weekly: string = settings.meeting_schedule;

// Where meetings happen: the room of the latest dated meeting, and whether
// it is confirmed.
export function meetingRoom(list: LabEvent[] = events): { room: string; confirmed: boolean } | null {
  const meetings = list.filter((e) => e.type === "meeting" && e.room).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return meetings[0] ? { room: meetings[0].room!, confirmed: meetings[0].room_confirmed } : null;
}

// The next event that hasn't started, or null when none is listed.
export function nextEvent(now: Date, list: LabEvent[] = events): LabEvent | null {
  const upcoming = list.filter((e) => new Date(e.starts_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return upcoming[0] ?? null;
}

// "Thu, Dec 3, 1:30 pm", in Utah time.
export function eventWhen(e: LabEvent): string {
  const d = new Date(e.starts_at);
  const day = d.toLocaleDateString("en-US", { timeZone: ZONE, weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `${day}, ${time}`;
}
