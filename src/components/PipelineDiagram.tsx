"use client";

/*
  The Pipeline step of How it works, drawn as the advisory board deck draws
  it: three lanes (Partners, Members, Reps) across the seven steps, grouped
  into Phase 1, the gate and Phase 2. Each step puts a node in every lane it
  touches. The chosen step's column lights up, the steps before it stay lit
  and the steps after it are dim, and the detail under the diagram shows
  what happens there and who is involved.

  Visitors move with Back and Next or by picking a step's number or node;
  the arrow keys work once a control has focus. On phones the diagram gives
  way to a numbered list with the chosen step opened.
*/

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { pad2 as pad } from "@/lib/utils";

export type PipelineData = {
  lanes: readonly string[];
  phases: readonly { label: string; name: string; from: number; to: number }[];
  steps: readonly { title: string; body: string; who: readonly string[] }[];
  back: string;
  next: string;
  stepWord: string;
  of: string;
  whoLabel: string;
};

export function PipelineDiagram({ data }: { data: PipelineData }) {
  const { lanes, phases, steps } = data;
  const last = steps.length - 1;
  const [at, setAt] = useState(0);
  const go = (i: number) => setAt(Math.min(last, Math.max(0, i)));
  const step = steps[at];
  const gate = phases.find((p) => p.from === p.to);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(at - 1);
    }
  };

  // The grid: a lane-label column, then one column per step.
  const cols = { gridTemplateColumns: `5.5rem repeat(${steps.length}, minmax(0, 1fr))` };

  return (
    <div className="mt-8 short:mt-5" onKeyDown={onKey}>
      {/* The diagram, from sm */}
      <div className="hidden sm:block" role="group" aria-label={data.stepWord}>
        {/* Phase headers */}
        <div className="grid items-end" style={cols}>
          <span />
          {phases.map((p) => (
            <div
              key={p.label}
              className={`mx-1 border-b pb-1.5 text-[11px] ${p === gate ? "text-center" : ""} ${
                at >= p.from && at <= p.to ? "border-white/60" : "border-white/15"
              }`}
              style={{ gridColumn: `${p.from + 2} / ${p.to + 3}` }}
            >
              <span className="kicker text-[11px] tracking-[0.14em] opacity-70">{p.label}</span>
              {p !== gate && <span className="ml-2 hidden opacity-40 lg:inline">{p.name}</span>}
            </div>
          ))}
        </div>

        {/* Lanes */}
        <div className="relative mt-2">
          {lanes.map((lane) => (
            <div key={lane} className="grid h-9 items-center short:h-7" style={cols}>
              <span className="text-xs opacity-50">{lane}</span>
              {steps.map((s, i) => {
                const here = s.who.includes(lane);
                const lead = s.who[0] === lane;
                const state = i === at ? "on" : i < at ? "done" : "later";
                return (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => go(i)}
                    className={`relative flex h-full items-center justify-center ${i === at ? "bg-white/[0.06]" : ""} ${
                      gate && i === gate.from ? "border-x border-dashed border-white/20" : ""
                    }`}
                  >
                    {/* the lane's line through this column */}
                    <span
                      className={`absolute inset-x-0 top-1/2 h-px transition-colors duration-300 ${
                        i < at ? "bg-white/50" : "bg-white/12"
                      }`}
                    />
                    {here && (
                      <span
                        className={`relative rounded-full border transition-all duration-300 ${
                          lead ? "size-3" : "size-2.5"
                        } ${
                          state === "on"
                            ? "scale-125 border-white bg-white"
                            : state === "done"
                              ? `border-white/70 ${lead ? "bg-white/70" : "bg-black"}`
                              : "border-white/30 bg-black"
                        }`}
                      >
                        {state === "on" && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-white/40 motion-reduce:hidden" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Step numbers */}
        <div className="mt-2 grid" style={cols}>
          <span />
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-current={i === at ? "step" : undefined}
              aria-label={`${data.stepWord} ${i + 1}, ${s.title}`}
              className={`mx-auto rounded-full px-2 py-0.5 text-xs tabular-nums transition ${
                i === at ? "bg-white text-black" : "opacity-45 hover:opacity-90"
              }`}
            >
              {pad(i + 1)}
            </button>
          ))}
        </div>
      </div>

      {/* The chosen step, from sm */}
      <div className="mt-6 hidden items-end justify-between gap-8 border-t border-white/15 pt-5 sm:flex short:mt-4 short:pt-4">
        <div key={at} aria-live="polite" className="min-w-0 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
          <p className="kicker font-normal opacity-40">
            {data.stepWord} {pad(at + 1)} {data.of} {pad(steps.length)}
          </p>
          <p className="mt-1 text-xl font-light">{step.title}</p>
          <p className="mt-1 max-w-xl text-sm font-light opacity-60">{step.body}</p>
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 opacity-40">{data.whoLabel}</span>
            {step.who.map((w) => (
              <span key={w} className="rounded-full border border-white/25 px-2 py-0.5">
                {w}
              </span>
            ))}
          </p>
        </div>
        <Controls data={data} at={at} last={last} go={go} />
      </div>

      {/* Phones: the steps as a list, the chosen one opened */}
      <ol className="space-y-1 sm:hidden">
        {steps.map((s, i) => (
          <li key={i}>
            <button type="button" onClick={() => go(i)} className="flex w-full items-baseline gap-3 py-1 text-left">
              <span className={`text-xs tabular-nums ${i === at ? "" : "opacity-40"}`}>{pad(i + 1)}</span>
              <span className={i === at ? "" : "opacity-60"}>{s.title}</span>
            </button>
            {i === at && (
              <p className="pb-1 pl-8 text-sm font-light opacity-60 animate-in fade-in-0 duration-300">{s.body}</p>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 sm:hidden">
        <Controls data={data} at={at} last={last} go={go} />
      </div>
    </div>
  );
}

function Controls({
  data,
  at,
  last,
  go,
}: {
  data: PipelineData;
  at: number;
  last: number;
  go: (i: number) => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => go(at - 1)}
        disabled={at === 0}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 px-4 text-sm transition hover:border-white/60 disabled:opacity-30"
      >
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.5} />
        {data.back}
      </button>
      <button
        type="button"
        onClick={() => go(at + 1)}
        disabled={at === last}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm text-black transition hover:bg-white/85 disabled:opacity-30"
      >
        {data.next}
        <ArrowRight aria-hidden className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
