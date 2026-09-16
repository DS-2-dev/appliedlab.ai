"use client";

// The signature visual, rebuilt for the master plan's Member Pipeline: one
// case traveling library -> claim -> faculty review -> the record. Auto-plays
// once when it scrolls into view. The SVG is decoration; the buttons below are
// the accessible interface. Straight connector only (brand spec §4.1, no
// zigzag).

import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";

const STEPS = copy.howItWorks.steps;
const CX = [120, 360, 600, 840];
const CY = 58;
const LINE_LEN = CX[3] - CX[0];

function Glyph({ id, x, y }: { id: string; x: number; y: number }) {
  const s = "stroke-current";
  const base = { fill: "none", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (id) {
    case "problem":
      // an inbox tray: the problem arrives
      return (
        <g transform={`translate(${x - 12}, ${y - 12})`} className={s} {...base}>
          <path d="M12 2v10m0 0l-4 -4m4 4l4 -4" />
          <path d="M2 16v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2 -2v-4" />
        </g>
      );
    case "build":
      // repeat arcs: the weekly loop
      return (
        <g transform={`translate(${x - 12}, ${y - 12})`} className={s} {...base}>
          <path d="M20 11a8 8 0 0 0 -14.5 -4M4 3v4h4" />
          <path d="M4 13a8 8 0 0 0 14.5 4M20 21v-4h-4" />
        </g>
      );
    case "review":
      // a rating star with a rule beneath: rubric plus written feedback
      return (
        <g transform={`translate(${x - 12}, ${y - 12})`} className={s} {...base}>
          <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
        </g>
      );
    default:
      // showcase flag
      return (
        <g transform={`translate(${x - 12}, ${y - 12})`} className={s} {...base}>
          <path d="M5 21V4" />
          <path d="M5 4h13l-3 4l3 4H5" />
        </g>
      );
  }
}

export function PipelineDiagram() {
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  const [played, setPlayed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played) {
          setPlayed(true);
          if (!reduced.current) setAuto(true);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [played]);

  useEffect(() => {
    // schedule only while there is a next step; at the end no timer runs, so
    // the auto flag can simply rest
    if (!auto || idx >= STEPS.length - 1) return;
    const t = setTimeout(() => setIdx((v) => v + 1), 2800);
    return () => clearTimeout(t);
  }, [auto, idx]);

  const select = (i: number) => {
    setAuto(false);
    setIdx(i);
  };

  const progress = CX[idx] - CX[0];

  return (
    <div ref={wrapRef}>
      {/* Mobile: a plain numbered list, every caption visible, no state */}
      <ol className="space-y-4 md:hidden">
        {STEPS.map((step) => (
          <li key={step.id} className="flex gap-4">
            <span className="mt-0.5 shrink-0 font-mono text-sm text-brand-deep">{step.num}</span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{step.caption}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop: the interactive diagram */}
      <div className="hidden border border-line bg-ground-raised p-6 md:block">
      <svg
        aria-hidden
        viewBox="0 0 960 132"
        className="w-full"
        style={{ maxHeight: 170 }}
      >
        <line x1={CX[0]} y1={CY} x2={CX[3]} y2={CY} className="stroke-line-strong" strokeWidth="2" />
        <line
          x1={CX[0]}
          y1={CY}
          x2={CX[3]}
          y2={CY}
          className="stroke-brand"
          strokeWidth="2.5"
          strokeDasharray={LINE_LEN}
          strokeDashoffset={LINE_LEN - progress}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
        {STEPS.map((step, i) => {
          const selected = i === idx;
          const visited = i <= idx;
          return (
            <g key={step.id} onClick={() => select(i)} className="cursor-pointer">
              <rect
                x={CX[i] - 28}
                y={CY - 28}
                width="56"
                height="56"
                rx="14"
                className={
                  selected
                    ? "fill-brand-wash stroke-brand-deep"
                    : visited
                      ? "fill-ground stroke-brand"
                      : "fill-ground stroke-line-strong"
                }
                strokeWidth="2"
                style={{ transition: "all 300ms ease-out" }}
              />
              <g
                className={visited ? "text-brand-deep" : "text-ink-faint"}
                style={{ transition: "color 300ms" }}
              >
                <Glyph id={step.id} x={CX[i]} y={CY} />
              </g>
              <text
                x={CX[i]}
                y={CY + 52}
                textAnchor="middle"
                className={selected ? "fill-ink" : "fill-ink-soft"}
                style={{ fontSize: 14, fontWeight: selected ? 600 : 400 }}
              >
                {step.title}
              </text>
            </g>
          );
        })}
        <g
          data-anim
          style={{
            transform: `translate(${CX[idx]}px, ${CY}px)`,
            transition: "transform 700ms ease-out",
          }}
        >
          <circle r="7" className="fill-brand" />
          <circle r="7" className="fill-none stroke-ground" strokeWidth="2" />
        </g>
      </svg>

      <div className="mt-4">
        <div
          role="tablist"
          aria-label="How a project moves through the semester"
          className="flex flex-wrap gap-2"
        >
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              role="tab"
              aria-selected={i === idx}
              aria-controls="pipeline-caption"
              onClick={() => select(i)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                i === idx
                  ? "border-brand-deep bg-brand-wash text-ink"
                  : "border-line-strong bg-ground text-ink-soft hover:border-brand-deep hover:text-ink"
              }`}
            >
              <span className="font-mono text-xs text-brand-deep">{step.num}</span>{" "}
              {step.title}
            </button>
          ))}
        </div>
        <div id="pipeline-caption" role="tabpanel" className="mt-4 min-h-[4.5rem]">
          <p
            key={idx}
            className="rise max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft md:text-base"
          >
            {STEPS[idx].caption}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
