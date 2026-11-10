"use client";

// A reload opens the page at its top. Browsers put a reloaded page back where
// it was scrolled, which hides the open space and the intro at the top of the
// site's pages. Going back to a page still returns to where it was left.

import { useEffect } from "react";

export function StartAtTop() {
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") window.scrollTo(0, 0);
  }, []);
  return null;
}
