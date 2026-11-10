// The art on the landing's tiles (app/page.tsx), one drawing per part of the
// Lab, keyed by the tile's id in copy.home.tiles. Each is drawn, not
// photographed, so it stays sharp at any size and needs no image files.
// PROVISIONAL, like the redesign it belongs to.

import type { ReactNode } from "react";
import { LabMark } from "@/components/LabMark";

// Width over height for each tile, varied the way the layout's grid is.
export const TILE_RATIO: Record<string, string> = {
  about: "1 / 1",
  how: "1 / 1",
  students: "270 / 407",
  faculty: "270 / 221",
  partners: "270 / 405",
};

function Pipeline() {
  // Three lanes, with the work stepping from lane to lane.
  const steps = [
    [40, 0],
    [80, 1],
    [120, 1],
    [160, 2],
    [200, 1],
    [240, 0],
  ];
  const y = (lane: number) => 70 + lane * 60;
  return (
    <svg viewBox="0 0 280 280" className="size-full bg-[#111]">
      {[0, 1, 2].map((l) => (
        <line key={l} x1="24" x2="256" y1={y(l)} y2={y(l)} stroke="white" strokeOpacity="0.18" />
      ))}
      <polyline
        points={steps.map(([x, l]) => `${x},${y(l)}`).join(" ")}
        fill="none"
        stroke="white"
        strokeWidth="1.5"
      />
      {steps.map(([x, l]) => (
        <circle key={x} cx={x} cy={y(l)} r="5" fill="white" />
      ))}
    </svg>
  );
}

function Students() {
  // The three student levels, each a step up from the last.
  return (
    <svg viewBox="0 0 270 407" className="size-full bg-[#f2e40c]">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={54 + i * 58} y={270 - i * 70} width="46" height={50 + i * 70} fill="#111" />
      ))}
      <line x1="30" x2="240" y1="320.5" y2="320.5" stroke="#111" />
    </svg>
  );
}

function Faculty() {
  // A submission under review: a card of lines with its check mark.
  return (
    <svg viewBox="0 0 270 221" className="size-full bg-[#efede7]">
      <g transform="rotate(-3 135 110)">
        <rect x="55" y="48" width="160" height="124" rx="6" fill="white" />
        <rect x="71" y="66" width="80" height="8" rx="4" fill="#1f1f1f" />
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x="71" y={88 + k * 13} width={k === 3 ? 70 : 126} height="5" rx="2.5" fill="#cfcdc7" />
        ))}
        <circle cx="205" cy="160" r="22" fill="#111" />
        <path d="M195 160l7 7 13-14" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function Partners() {
  return (
    <div className="flex size-full flex-col justify-end bg-[linear-gradient(160deg,#f3a56b_0%,#d9542b_45%,#3a1b12_100%)] p-[min(7cqw,32px)] text-white">
      <p className="text-[min(9.6cqw,40px)] leading-[1.05] font-semibold tracking-tight">What can you do for me?</p>
    </div>
  );
}

const ART: Record<string, () => ReactNode> = {
  about: () => (
    <div className="grid size-full place-items-center bg-[#e4e4e4] text-black">
      <LabMark className="w-[56%]" />
    </div>
  ),
  how: Pipeline,
  students: Students,
  faculty: Faculty,
  partners: Partners,
};

// `ratio` overrides the tile's own shape, for the wide picture at the top
// of its page; the drawing stays centred on its colour.
export function TileArt({ id, ratio }: { id: string; ratio?: string }) {
  const Art = ART[id];
  return (
    <div className="@container overflow-hidden" style={{ aspectRatio: ratio ?? TILE_RATIO[id] ?? "1 / 1" }}>
      {Art ? <Art /> : null}
    </div>
  );
}
