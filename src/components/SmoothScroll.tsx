"use client";

// Smooth, eased scrolling for the landing, the way pxpush.com does it: Lenis
// takes the wheel and trackpad and glides the page toward where they point,
// while the page still scrolls natively underneath, so sticky sections,
// scroll-linked fades and the chrome mark's scroll push all work unchanged.
//
// Same-page links (the header's section links, How it works' tabs, See how
// it works) glide too. Their default jump is cancelled before Next's Link
// or ScrollLink sees the click, and their own click handlers still run.
// Scroll areas inside the page opt out with data-lenis-prevent. Off for
// reduced motion, where the page scrolls natively.

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { prefersReducedMotion } from "@/lib/motion";

export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09 });

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!link) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target);
    };
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      lenis.destroy();
    };
  }, []);

  return null;
}
