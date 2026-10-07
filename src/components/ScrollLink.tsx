"use client";

// An in-page link that glides to its target instead of jumping, leaving
// the URL as it was. On the landing SmoothScroll takes the click first and
// glides with Lenis; without it (reduced motion, other pages) the browser's
// own smooth scroll does, and reduced motion gets the plain jump.

import type { ComponentProps, MouseEvent } from "react";
import { prefersReducedMotion } from "@/lib/motion";

export function ScrollLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: `#${string}` }) {
  const glide = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    const target = document.getElementById(href.slice(1));
    if (!target || e.defaultPrevented) return;
    e.preventDefault();
    const reduce = prefersReducedMotion();
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return <a href={href} onClick={glide} {...props} />;
}
