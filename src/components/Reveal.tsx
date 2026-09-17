"use client";

// Ties its content's opacity and blur to where it sits on screen: it comes
// into focus and rises as it comes up from the bottom, and blurs out
// drifting up as it leaves through the top. Because it follows the scroll rather than firing
// once, neighbouring sections cross over: the one leaving thins out over
// the same stretch of scrolling that brings the next one in, so the white
// between them reads as a hand-off rather than a gap.
//
// Works on a pinned panel too (How it works): while it is stuck to the
// screen it stays fully shown, and it fades only as its section carries it
// on or off. Visible throughout for anyone who asks for reduced motion.

import { useEffect, useRef, type ReactNode } from "react";

// As fractions of the screen height: the content's top fades in between
// ENTER_FROM and ENTER_TO, and its bottom fades out between LEAVE_FROM and
// LEAVE_TO.
const ENTER_FROM = 0.95;
const ENTER_TO = 0.45;
const LEAVE_FROM = 0.75;
const LEAVE_TO = 0.1;
const DRIFT = 40; // px
const BLUR = 14; // px, fully out of view

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const paint = () => {
      frame = 0;
      const vh = window.innerHeight;
      const { top, bottom } = node.getBoundingClientRect();
      const enter = clamp((ENTER_FROM * vh - top) / ((ENTER_FROM - ENTER_TO) * vh));
      const leave = clamp((bottom - LEAVE_TO * vh) / ((LEAVE_FROM - LEAVE_TO) * vh));
      const v = Math.min(enter, leave);
      node.style.opacity = String(v);
      node.style.filter = v < 1 ? `blur(${(1 - v) * BLUR}px)` : "";
      node.style.transform = `translate3d(0, ${((1 - enter) - (1 - leave)) * DRIFT}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={el} className={`will-change-[opacity,transform,filter] ${className ?? ""}`}>
      {children}
    </div>
  );
}
