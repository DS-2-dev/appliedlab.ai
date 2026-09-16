"use client";

/*
  Taste Labs' nav hover, rebuilt: on hover the label's characters flip through
  a small set of junk glyphs and resolve back to the word, left to right.

  Their alphabet, read off tastelabs.com: 01#/()[]_, with a character locking
  once the run has passed its share of the total frames. Their timing was 0.7s
  on a 40ms tick; ours is shorter, see below. Leaving mid-run snaps the word
  back rather than letting it finish.

  One departure. Theirs gives every character a fixed 0.65em cell so the junk
  glyphs cannot reflow the line; at that width a proportional face like ours
  reads visibly spaced out. This measures each character's own advance on a
  canvas and pins the cell to that instead — same guarantee that nothing moves
  while it runs, but the resting label is identical to plain text.

  Listeners go on the parent element, not on this span, so the whole link is
  the hover target and a keyboard focus scrambles it too.

  Under prefers-reduced-motion it never runs: the label renders and stays.
*/

import { useEffect, useRef, useState } from "react";

const CHARS = "01#/()[]_";
// Theirs runs 0.7s on a 40ms tick. Trimmed here: on a three-item header the
// full run reads as the label being slow to settle, and it is a hover, not a
// reveal.
const DURATION_MS = 380;
const INTERVAL_MS = 32;
// Their fallback cell, used when canvas measurement is unavailable.
const FALLBACK_EM = 0.65;

export function ScrambleText({ text }: { text: string }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);
  const [widths, setWidths] = useState<string[] | null>(null);

  // Per-character advance widths, so a junk glyph occupies exactly the cell
  // its character does and the line never shifts mid-run.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const cs = window.getComputedStyle(host);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setWidths(null);
        return;
      }
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      setWidths([...text].map((c) => `${ctx.measureText(c).width}px`));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  useEffect(() => {
    const host = hostRef.current;
    const trigger = host?.parentElement;
    if (!host || !trigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tick: ReturnType<typeof setInterval> | undefined;
    const total = DURATION_MS / INTERVAL_MS;
    // How many frames each character waits before it locks.
    const per = total / text.length;

    const stop = () => {
      if (tick) clearInterval(tick);
      tick = undefined;
    };

    const start = () => {
      stop();
      let frame = 0;
      tick = setInterval(() => {
        frame++;
        const settled = Math.floor(frame / per);
        setShown(
          [...text]
            .map((c, i) =>
              c === " " || i < settled
                ? c
                : CHARS[Math.floor(Math.random() * CHARS.length)],
            )
            .join(""),
        );
        if (frame >= total) {
          stop();
          setShown(text);
        }
      }, INTERVAL_MS);
    };

    const reset = () => {
      stop();
      setShown(text);
    };

    trigger.addEventListener("mouseenter", start);
    trigger.addEventListener("mouseleave", reset);
    trigger.addEventListener("focus", start);
    trigger.addEventListener("blur", reset);
    return () => {
      stop();
      trigger.removeEventListener("mouseenter", start);
      trigger.removeEventListener("mouseleave", reset);
      trigger.removeEventListener("focus", start);
      trigger.removeEventListener("blur", reset);
    };
  }, [text]);

  return (
    // The real word stays in the accessibility tree; the flipping glyphs are
    // decoration and would otherwise be read out as junk.
    <span ref={hostRef} className="inline-block">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {[...shown].map((c, i) => (
          <span
            key={i}
            className="inline-block text-center"
            style={{ width: widths ? widths[i] : `${FALLBACK_EM}em` }}
          >
            {c === " " ? " " : c}
          </span>
        ))}
      </span>
    </span>
  );
}
