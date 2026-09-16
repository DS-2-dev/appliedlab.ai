// Settings' Attended meetings, drawn like GitHub's contribution graph with
// one square per weekly meeting: a year of them left to right, month names
// over the columns, each square attended, missed or still to come. The
// meeting day comes from the schedule in data/settings.json.
// Sample attendance until check-ins are recorded (the attendance QR code in
// the sidebar), seeded by the date so a meeting always gets the same
// sample. Rendered on the server, so its dates never disagree with the
// browser's.

import { copy } from "@/content/copy";
import { cn } from "@/lib/utils";

const P = copy.projectum.settingsPage;
const DAY = 86_400_000;

type State = keyof typeof P.attendanceStates;

// GitHub's green for attended, its empty grey for missed, and a dashed
// outline for the meeting still to come.
const HAIRLINE = "outline outline-1 -outline-offset-1 outline-black/5 dark:outline-white/5";
const STATE_STYLE: Record<State, string> = {
  attended: cn("bg-[#30a14e] dark:bg-[#26a641]", HAIRLINE),
  missed: cn("bg-muted", HAIRLINE),
  upcoming: "border border-dashed border-muted-foreground/50",
};
const STATES = Object.keys(STATE_STYLE) as State[];

const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const weekdayLong = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// The weekday the schedule names ("Thursdays, 1:30 pm"), or Thursday when
// it names none. 7 January 2024 was a Sunday.
function meetingWeekday(schedule: string) {
  const text = schedule.toLowerCase();
  const day = [0, 1, 2, 3, 4, 5, 6].findIndex((d) =>
    text.includes(weekdayLong.format(new Date(Date.UTC(2024, 0, 7 + d))).toLowerCase()),
  );
  return day === -1 ? 4 : day;
}

// A small seeded generator (mulberry32), so a meeting always gets one sample.
function seeded(n: number) {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// The sample: attended most weeks, in runs, each week's pace blended with
// its neighbours'.
function sampleAttended(t: number) {
  const week = Math.floor(t / DAY / 7);
  const pace = (seeded(week - 1) + seeded(week) + seeded(week + 1)) / 3;
  return seeded(week * 31 + 7) < 0.45 + pace * 0.5;
}

export function AttendanceGraph({ schedule, today = new Date() }: { schedule: string; today?: Date }) {
  const weekday = meetingWeekday(schedule);

  // Today is the server's own day, counted in UTC from there on. The year
  // runs from the first meeting day in the last 52 weeks through the next
  // meeting.
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const yearAgo = end - 364 * DAY;
  const first = yearAgo + ((weekday - new Date(yearAgo).getUTCDay() + 7) % 7) * DAY;
  const meetings: { date: Date; state: State }[] = [];
  for (let t = first; t < end + 7 * DAY; t += 7 * DAY) {
    meetings.push({ date: new Date(t), state: t > end ? "upcoming" : sampleAttended(t) ? "attended" : "missed" });
  }
  const attended = meetings.filter((m) => m.state === "attended").length;
  const held = meetings.filter((m) => m.state !== "upcoming").length;
  const summary = P.attendanceSummary(attended, held);

  // A month's name sits over its first meeting. The first column is named
  // only when the next name is far enough away, and none sits so near the
  // end that it would run off the graph.
  const changes = [...meetings.keys()].filter((i) => i > 0 && i <= meetings.length - 2 && meetings[i].date.getUTCMonth() !== meetings[i - 1].date.getUTCMonth());
  const months = (changes[0] >= 3 ? [0, ...changes] : changes).map((i) => ({
    column: i,
    name: monthName.format(meetings[i].date),
  }));

  return (
    <div data-attendance-graph="" className="grid gap-3">
      <p data-attendance-summary="" className="text-sm font-medium">
        {summary}
      </p>
      <div
        role="img"
        aria-label={summary}
        className="grid gap-[3px] text-xs leading-none text-muted-foreground"
        style={{ gridTemplateColumns: `auto repeat(${meetings.length}, minmax(0, 1fr))` }}
      >
        {months.map(({ column, name }) => (
          <span key={column} className="w-0 pb-1 whitespace-nowrap" style={{ gridColumn: column + 2, gridRow: 1 }}>
            {name}
          </span>
        ))}
        <span className="self-center pr-1.5" style={{ gridColumn: 1, gridRow: 2 }}>
          {weekdayShort.format(meetings[0].date)}
        </span>
        {meetings.map(({ date, state }, i) => (
          <span
            key={date.getTime()}
            data-meeting={date.toISOString().slice(0, 10)}
            data-state={state}
            title={`${P.attendanceStates[state]}, ${dayName.format(date)}`}
            className={cn("aspect-square rounded-[2px]", STATE_STYLE[state])}
            style={{ gridColumn: i + 2, gridRow: 2 }}
          />
        ))}
      </div>
      <div
        data-attendance-legend=""
        className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground"
      >
        {STATES.map((state) => (
          <span key={state} className="flex items-center gap-1.5">
            <span data-state={state} className={cn("size-3 rounded-[2px]", STATE_STYLE[state])} />
            {P.attendanceStates[state]}
          </span>
        ))}
      </div>
    </div>
  );
}
