"use client";

// The fall arc as a route: five stops, evenly spaced (it reads as a sequence,
// not a scaled axis), with a "today" marker that moves through the semester.
// Thanksgiving renders as a deliberate break in the line.

import { useState } from "react";
import { copy } from "@/content/copy";

const STOPS = copy.thisFall.milestones;
const POS = [6, 28, 50, 72, 94]; // percent along the line

// piecewise date anchors for the today marker (weekly stop carries no date)
const DATE_ANCHORS: Array<{ date: string; pos: number }> = [
  { date: "2026-08-28", pos: POS[0] },
  { date: "2026-09-03", pos: POS[1] },
  { date: "2026-11-26", pos: POS[3] },
  { date: "2026-12-03", pos: POS[4] },
];

function todayPct(now: Date): number | null {
  const t = now.getTime();
  const first = new Date(DATE_ANCHORS[0].date + "T00:00:00-06:00").getTime();
  const last = new Date(DATE_ANCHORS[3].date + "T23:59:59-07:00").getTime();
  if (t < first) return 2;
  if (t > last) return null;
  for (let i = 0; i < DATE_ANCHORS.length - 1; i++) {
    const a = new Date(DATE_ANCHORS[i].date + "T00:00:00-06:00").getTime();
    const b = new Date(DATE_ANCHORS[i + 1].date + "T00:00:00-06:00").getTime();
    if (t >= a && t <= b) {
      const f = (t - a) / (b - a);
      return DATE_ANCHORS[i].pos + f * (DATE_ANCHORS[i + 1].pos - DATE_ANCHORS[i].pos);
    }
  }
  return null;
}

export function SemesterTimeline({ now }: { now: number }) {
  const [idx, setIdx] = useState(1);
  // computed from the request moment, so render stays pure and the marker is
  // as fresh as the page itself
  const today = todayPct(new Date(now));

  const stop = STOPS[idx];

  return (
    <div>
      {/* Desktop: horizontal route */}
      <div className="hidden md:block">
        <div className="relative h-36">
          {/* base line, broken around the Thanksgiving stop */}
          <div className="absolute top-16 h-0.5 bg-line-strong" style={{ left: `${POS[0]}%`, width: `${POS[3] - 1.6 - POS[0]}%` }} />
          <div className="absolute top-16 h-0.5 bg-line-strong" style={{ left: `${POS[3] + 1.6}%`, width: `${POS[4] - POS[3] - 1.6}%` }} />

          {/* weekly cadence ticks between kickoff and the break */}
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute top-[3.65rem] h-2 w-0.5 bg-brand/60"
              style={{ left: `${POS[1] + ((i + 1) * (POS[3] - POS[1])) / 10}%` }}
            />
          ))}

          {today !== null && (
            <div
              aria-hidden
              className="absolute top-1 -translate-x-1/2 text-center"
              style={{ left: `${today}%` }}
            >
              <span className="font-mono text-xs text-green-deep">{copy.thisFall.todayLabel}</span>
              <svg width="10" height="8" viewBox="0 0 10 8" className="mx-auto mt-0.5 fill-green-deep">
                <path d="M5 8L0 0h10z" />
              </svg>
            </div>
          )}

          {STOPS.map((m, i) => {
            const selected = i === idx;
            const isBreak = m.id === "thanksgiving";
            const isBand = m.id === "weekly";
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={selected}
                aria-controls="semester-detail"
                onClick={() => setIdx(i)}
                className="absolute top-10 w-32 -translate-x-1/2 text-center"
                style={{ left: `${POS[i]}%` }}
              >
                <span className="block h-5 font-mono text-xs text-ink-faint">{m.dateLabel}</span>
                <span className="mt-1 flex h-7 items-center justify-center">
                  {isBand ? (
                    <span
                      className={`inline-block h-3 w-16 rounded-full border-2 transition-colors ${
                        selected ? "border-brand-deep bg-brand-wash" : "border-brand bg-ground"
                      }`}
                    />
                  ) : (
                    <span
                      className={`inline-block h-4 w-4 rounded-full border-2 transition-all ${
                        isBreak
                          ? selected
                            ? "border-ink bg-ground"
                            : "border-line-strong bg-ground"
                          : selected
                            ? "scale-110 border-brand-deep bg-brand"
                            : "border-brand bg-ground"
                      }`}
                    />
                  )}
                </span>
                <span className={`mt-1 block text-sm leading-tight ${selected ? "font-medium text-ink" : "text-ink-soft"}`}>
                  {m.title}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id="semester-detail"
          role="tabpanel"
          key={idx}
          className="rise mt-6 border border-line bg-ground-raised px-5 py-4"
        >
          <p className="text-sm text-ink-soft">
            <span className="font-mono text-xs text-brand-deep">{stop.dateLabel}</span>
            <span aria-hidden className="mx-2.5 inline-block h-3 w-px translate-y-0.5 bg-line-strong" />
            <span className="font-medium text-ink">{stop.title}.</span> {stop.note}
          </p>
        </div>
      </div>

      {/* Mobile: vertical route, everything visible */}
      <ol className="md:hidden">
        {STOPS.map((m, i) => (
          <li key={m.id} className="relative flex gap-4 pb-7 last:pb-0">
            {i < STOPS.length - 1 && (
              <span aria-hidden className="absolute left-[7px] top-5 h-full w-px bg-line-strong" />
            )}
            <span
              aria-hidden
              className={`mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                m.id === "thanksgiving" ? "border-line-strong bg-ground" : "border-brand-deep bg-brand"
              }`}
            />
            <div>
              <p className="font-mono text-xs text-ink-faint">{m.dateLabel}</p>
              <p className="mt-0.5 font-medium">{m.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{m.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
