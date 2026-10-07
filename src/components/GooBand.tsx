"use client";

// The hero's shape: a black band from the box's left edge to its right, full
// height where it meets each edge and drawn in toward the middle, like a
// cloth pulled from its sides.
//
// Two gooey steps make it. The outline comes from a row of round blobs
// melted into one another (a smooth union of circles), sampled on a fixed
// pixel grid, so the edge steps in even square pixels. Then the goo filter
// (blur, then a hard alpha threshold) softens every step, rounding each
// pixel's corner and filling each inner corner.
//
// It moves the way the original goo orb did: a few waves of different
// lengths push the edge in and out, their phases drift every couple of
// seconds at unequal rates so the outline never repeats, and edge pixels
// fade in and out rather than pop, which the filter melts into a slow,
// liquid change. The deep inside is one static path; only the pixels the
// edge can reach are separate, and only their opacity changes. Still for
// reduced motion, and paused while off screen.

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const W = 1200;
const H = 360;
const MID = H / 2;
const CELL = 6; // one pixel of the grid, in viewBox units
const ROUND = 2.2; // how softly each pixel corner rounds (the goo blur)
const BLEED = 20; // runs reach this far past each edge, so the ends stay square
const MELT = 28; // how far apart two shapes start to melt together
const COUNT = 41; // blobs along the band
const WAIST = 0.46; // the pinch's height, as a share of the full height
const SAG = 2.4; // how long the band stays near full height before it curves
const END = 0.9; // the height of the caps past each edge
const WOBBLE = 12; // how far the edge wanders, in viewBox units
const SHIFT_MS = 2000; // how often the waves move on
const FADE_MS = 700; // how long an edge pixel takes to fade in or out

const coshShare = (u: number) => (Math.cosh(SAG * u) - 1) / (Math.cosh(SAG) - 1);

// The blobs, left edge to right: each one's centre and radius, following a
// hanging-cloth curve.
const BLOBS = Array.from({ length: COUNT }, (_, i) => {
  const t = i / (COUNT - 1);
  return { x: t * W, r: MID * (WAIST + (1 - WAIST) * coshShare(Math.abs(2 * t - 1))) };
});

// The original orb's waves: frequency, amplitude, starting phase, and how
// far the phase moves per shift. The drifts are unequal, so a pose never
// comes back.
const HARMONICS = [
  { freq: 1, amp: 0.45, phase: 0.266, drift: 0.19 },
  { freq: 2, amp: 0.3, phase: 1.966, drift: -0.13 },
  { freq: 3, amp: 0.18, phase: 0.072, drift: 0.23 },
  { freq: 5, amp: 0.1, phase: 1.383, drift: -0.29 },
  { freq: 7, amp: 0.06, phase: 0.522, drift: 0.17 },
];
const REACH = WOBBLE * HARMONICS.reduce((sum, h) => sum + h.amp, 0);

// Polynomial smooth minimum: the union of two shapes with a rounded,
// liquid neck where they meet.
function smin(a: number, b: number) {
  const h = Math.max(MELT - Math.abs(a - b), 0) / MELT;
  return Math.min(a, b) - (h * h * MELT) / 4;
}

// Signed distance to a box reaching from far past the left edge to x = 0,
// a little shorter than the band, so the band's ends melt into it with
// rounded corners.
function capDistance(px: number, py: number) {
  const dx = Math.max(px, 0);
  const dy = Math.max(Math.abs(py) - MID * END, 0);
  return Math.hypot(dx, dy) + Math.min(Math.max(px, Math.abs(py) - MID * END), 0);
}

// Inside the band when negative: the distance to the melted shape.
function distance(px: number, py: number) {
  let dist = capDistance(px, py);
  for (const b of BLOBS) {
    // Far blobs cannot reach this point.
    if (Math.abs(px - b.x) > b.r + MELT) continue;
    dist = smin(dist, Math.hypot(px - b.x, py) - b.r);
  }
  return dist;
}

// How far the edge is pushed out (or in, when negative) at a pixel, at
// shift `tick`. The waves run along the band from its middle, mirrored left
// to right, with the top and bottom edges out of step, and they die away at
// the ends so the band stays anchored to both edges.
function push(px: number, py: number, tick: number) {
  const s = Math.abs(px - W / 2) / (W / 2);
  const th = s * Math.PI * 1.5 + (py < 0 ? 0 : 1.7);
  const wave = HARMONICS.reduce((sum, h) => sum + h.amp * Math.sin(h.freq * th + h.phase + h.drift * tick), 0);
  return WOBBLE * wave * Math.min(1, (1 - s) * 6);
}

// The grid, sampled once. Pixels the edge can never reach are either the
// core, drawn as one path of runs, or empty. The rest are the edge pixels,
// each kept with its distance to the shape.
function sample() {
  const rect = (x: number, y: number, w: number) => `M${x} ${y}h${w}v${CELL}h${-w}z`;
  let core = "";
  const edge: { x: number; y: number; dist: number }[] = [];
  for (let y = 0; y < H; y += CELL) {
    const py = y + CELL / 2 - MID;
    let start = -1;
    const close = (x: number) => {
      // A run from the left edge starts past it, so the ends stay square.
      const from = start === 0 ? -BLEED : start;
      core += rect(from, y, x - from) + rect(W - x, y, x - from);
      start = -1;
    };
    for (let x = 0; x < W / 2; x += CELL) {
      const px = x + CELL / 2;
      const dist = distance(px, py);
      const solid = dist < -REACH;
      if (solid && start < 0) start = x;
      if (!solid && start >= 0) close(x);
      if (Math.abs(dist) <= REACH) {
        edge.push({ x, y, dist });
        edge.push({ x: W - CELL - x, y, dist });
      }
    }
    // A run that reaches the middle joins its mirror as one.
    if (start >= 0) {
      const from = start === 0 ? -BLEED : start;
      core += rect(from, y, W - 2 * from);
    }
  }
  return { core, edge };
}

const { core: CORE, edge: EDGE } = sample();

export function GooBand({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion() || !svg.current) return;
    let timer = 0;
    const io = new IntersectionObserver(([entry]) => {
      clearInterval(timer);
      if (entry.isIntersecting) timer = window.setInterval(() => setTick((t) => t + 1), SHIFT_MS);
    });
    io.observe(svg.current);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, []);

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden className={className}>
      <defs>
        <filter id="goo-band" x="-5%" y="-10%" width="110%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={ROUND} result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 40 -20" result="goo" />
          <feFlood floodColor="currentColor" />
          <feComposite in2="goo" operator="in" />
        </filter>
      </defs>
      <g filter="url(#goo-band)">
        <path d={CORE} />
        {EDGE.map((c) => (
          <rect
            key={`${c.x}-${c.y}`}
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            opacity={c.dist < push(c.x + CELL / 2, c.y + CELL / 2 - MID, tick) ? 1 : 0}
            style={{ transition: `opacity ${FADE_MS}ms ease` }}
          />
        ))}
      </g>
    </svg>
  );
}
