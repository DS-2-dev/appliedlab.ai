"use client";

// Movement rules, class "act here": an in-page CTA scrolls smoothly to its
// target and leaves NO hash in the URL, so a reload always opens the page at
// the top. The href stays real for accessibility and no-JS fallback.
// Cross-page links and reference deep-links (handbook chapters, /work zones)
// do not use this component; they navigate normally and land instantly.

import type { ReactNode, MouseEvent } from "react";

export function ScrollLink({
  href,
  className,
  children,
  onNavigate,
}: {
  href: `#${string}`;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    onNavigate?.();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
