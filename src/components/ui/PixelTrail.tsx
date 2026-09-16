"use client";

/*
  Cursor trail of blocks. Ported from danielpetho/fancy
  (src/fancy/components/background/pixel-trail.tsx), rewritten without its
  `motion/react` and `uuid` dependencies — this drives opacity straight on the
  DOM node instead, so a grid of a thousand cells costs no React renders.

  Meant to sit inside a element carrying `filter: url(#gooey)`: on its own the
  trail is a grid of hard squares, and the filter is what fuses them into one
  torn, liquid shape.

  Listens on window rather than owning pointer events, so it can stay
  `pointer-events-none` and never swallow a click meant for the hero's links.
*/

import { useEffect, useRef, useState } from "react";

export function PixelTrail({
  pixelSize = 32,
  fadeDuration = 600,
  delay = 0,
  pixelClassName = "bg-ground-inverse",
}: {
  pixelSize?: number;
  fadeDuration?: number;
  delay?: number;
  pixelClassName?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setGrid({
        cols: Math.ceil(width / pixelSize),
        rows: Math.ceil(height / pixelSize),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pixelSize]);

  useEffect(() => {
    if (!grid.cols || !grid.rows) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Per-cell timers, so re-entering a cell restarts its hold rather than
    // letting the first timer cut it off early.
    const timers = new Map<number, ReturnType<typeof setTimeout>>();

    const onMove = (e: MouseEvent) => {
      const el = container.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / pixelSize);
      const y = Math.floor((e.clientY - r.top) / pixelSize);
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return;

      const i = y * grid.cols + x;
      const cell = cells.current[i];
      if (!cell) return;

      // Snap on, hold for `delay`, then leave. With fadeDuration 0 that exit
      // is instantaneous, which is what keeps the trail reading as blocks
      // instead of a smear. The hold is a timer rather than a CSS
      // transition-delay because a 0ms duration makes delay unreliable.
      cell.style.transition = "none";
      cell.style.opacity = "1";

      const existing = timers.get(i);
      if (existing) clearTimeout(existing);
      timers.set(
        i,
        setTimeout(() => {
          cell.style.transition = fadeDuration > 0 ? `opacity ${fadeDuration}ms linear` : "none";
          cell.style.opacity = "0";
          timers.delete(i);
        }, delay),
      );
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      timers.forEach(clearTimeout);
    };
  }, [grid, pixelSize, fadeDuration, delay]);

  return (
    <div ref={container} aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: grid.rows }).map((_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: grid.cols }).map((_, col) => (
            <div
              key={col}
              ref={(el) => {
                cells.current[row * grid.cols + col] = el;
              }}
              className={pixelClassName}
              style={{ width: pixelSize, height: pixelSize, opacity: 0 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
