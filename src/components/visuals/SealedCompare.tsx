"use client";

// The sealed-solution mechanic, shown instead of explained: two solution
// cards, theirs under a seal while you work, both on the table at review.
// Auto-plays once when scrolled into view; the button replays it. Reduced
// motion renders the final state with no animation.

import { useEffect, useRef, useState } from "react";

const CAPTIONS = {
  sealed: "While you work, their solution stays sealed.",
  open: "At your review, both are on the table.",
};

function SolutionCard({
  label,
  redacted,
  children,
}: {
  label: string;
  redacted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="dossier relative min-w-0 flex-1 border border-line bg-ground p-4">
      <p className="kicker text-[0.6875rem]">{label}</p>
      <div aria-hidden className="mt-3 space-y-2">
        {redacted ? (
          <>
            <span className="redact w-11/12" style={{ display: "block" }} />
            <span className="redact w-4/5" style={{ display: "block" }} />
            <span className="redact w-full" style={{ display: "block" }} />
            <span className="redact w-2/3" style={{ display: "block" }} />
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function TextLines() {
  return (
    <>
      <span className="block h-2 w-11/12 bg-line-strong" />
      <span className="block h-2 w-4/5 bg-line-strong" />
      <span className="block h-2 w-full bg-line-strong" />
      <span className="block h-2 w-2/3 bg-line-strong" />
    </>
  );
}

export function SealedCompare() {
  const [open, setOpen] = useState(false);
  const [played, setPlayed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setOpen(true);
      setPlayed(true);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played) {
          setPlayed(true);
          timer = setTimeout(() => setOpen(true), 1100);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [played]);

  return (
    <div ref={wrapRef} className="border border-line bg-ground p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <SolutionCard label="Your solution">
          <TextLines />
        </SolutionCard>

        <div className="relative min-w-0 flex-1">
          <SolutionCard label="Their solution" redacted={!open}>
            <TextLines />
          </SolutionCard>
          {/* the seal, over their card until review */}
          <div
            aria-hidden
            className={`absolute -right-2 -top-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand-deep bg-brand-wash text-brand-deep shadow-sm ${
              open ? "seal-lift" : ""
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p key={String(open)} className="rise text-sm text-ink-soft" role="status">
          {open ? CAPTIONS.open : CAPTIONS.sealed}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand-deep hover:text-ink"
        >
          {open ? "Seal it again" : "Run the review"}
        </button>
      </div>
    </div>
  );
}
