"use client";

// The whole pipeline as one journey, drawn vertically and read by scrolling:
// the Member line runs parallel to the Business line (sealed lock on the
// business side), meets it once across the dashed review where the seal opens
// temporarily, then merges into it for the integrated stretch and its
// milestones. The integrated track is dashed because that route is designed
// and not yet traveled.
//
// On lg the map sits sticky beside the two pipeline chapters, and the copper
// fill plus marker track the reader's scroll progress through them. All
// movement is scroll-driven (user-controlled), so no autonomous animation
// runs and reduced-motion needs no special case. Below lg the chapters render
// alone and their ledes carry the meaning.

import { useEffect, useRef, type ReactNode } from "react";
import { handbook } from "@/content/handbook";

const P = handbook.pipelinesIntro;

// One geometry, used by track, fill, and marker: down the member lane,
// merging into the business lane after the review.
const MEMBER_ROUTE = "M70 40 L70 400 Q70 470 150 505 L150 720";

export function PipelineJourney({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const fill = fillRef.current;
    const marker = markerRef.current;
    if (!wrap || !fill || !marker) return;

    const total = fill.getTotalLength();
    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = wrap.getBoundingClientRect();
      const anchor = window.innerHeight * 0.4;
      const p = Math.min(1, Math.max(0, (anchor - rect.top) / rect.height));
      fill.style.strokeDashoffset = String(1 - p);
      const pt = fill.getPointAtLength(p * total);
      marker.setAttribute("cx", String(pt.x));
      marker.setAttribute("cy", String(pt.y));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-10">
      <div aria-hidden className="hidden lg:block">
        <div className="sticky top-24">
          <svg viewBox="0 0 220 760" className="w-full" style={{ maxHeight: "78vh" }}>
            {/* line labels */}
            <text x="70" y="20" textAnchor="middle" className="fill-brand-deep" style={{ font: "600 11px var(--font-jetbrains, monospace)", letterSpacing: "0.1em" }}>
              {P.memberLabel.toUpperCase()}
            </text>
            <text x="150" y="20" textAnchor="middle" className="fill-ink-faint" style={{ font: "600 11px var(--font-jetbrains, monospace)", letterSpacing: "0.1em" }}>
              {P.businessLabel.toUpperCase()}
            </text>

            {/* zone brackets and labels */}
            <line x1="20" y1="46" x2="20" y2="496" className="stroke-line" strokeWidth="2" />
            <text transform="rotate(-90 12 271)" x="12" y="271" textAnchor="middle" className="fill-ink-faint" style={{ font: "600 11px var(--font-jetbrains, monospace)", letterSpacing: "0.14em" }}>
              {P.parallelLabel.toUpperCase()}
            </text>
            <line x1="20" y1="516" x2="20" y2="714" className="stroke-line" strokeWidth="2" />
            <text transform="rotate(-90 12 615)" x="12" y="615" textAnchor="middle" className="fill-ink-faint" style={{ font: "600 11px var(--font-jetbrains, monospace)", letterSpacing: "0.14em" }}>
              {P.integratedLabel.toUpperCase()}
            </text>

            {/* business line, with the seal closed mid-parallel and open at review */}
            <line x1="150" y1="40" x2="150" y2="720" className="stroke-line-strong" strokeWidth="2" />
            <g transform="translate(150, 210)">
              <circle r="11" className="fill-ground stroke-line-strong" strokeWidth="2" />
              <g transform="translate(-6, -6)" className="stroke-ink-faint" fill="none" strokeWidth="1.6" strokeLinecap="round">
                <rect x="2" y="5.5" width="8.5" height="6" rx="1" />
                <path d="M4 5.5V4a2.3 2.3 0 0 1 4.6 0v1.5" />
              </g>
            </g>

            {/* the review: the one dashed meeting, seal open */}
            <line x1="76" y1="400" x2="136" y2="400" className="stroke-brand-deep" strokeWidth="2" strokeDasharray="3 4" />
            <text x="106" y="388" textAnchor="middle" className="fill-ink-faint" style={{ font: "11px var(--font-jetbrains, monospace)" }}>
              {P.reviewLabel}
            </text>
            <g transform="translate(150, 400)">
              <circle r="11" className="fill-brand-wash stroke-brand-deep" strokeWidth="2" />
              <g transform="translate(-6, -5)" className="stroke-brand-deep" fill="none" strokeWidth="1.6" strokeLinecap="round">
                <rect x="2" y="5" width="8.5" height="6" rx="1" />
                <path d="M8.6 5V3.4a2.3 2.3 0 0 1 4.4-1" />
              </g>
            </g>

            {/* member track: solid while parallel, dashed once merged (designed, not traveled) */}
            <path d="M70 40 L70 400 Q70 470 150 505" fill="none" className="stroke-line-strong" strokeWidth="2" />
            <path d="M150 505 L150 720" fill="none" className="stroke-line-strong" strokeWidth="2" strokeDasharray="6 5" />

            {/* integrated milestones */}
            {[560, 615, 670, 720].map((y) => (
              <circle key={y} cx="150" cy={y} r="4.5" className="fill-ground stroke-brand" strokeWidth="2" />
            ))}

            {/* scroll progress: the copper fill and its tip */}
            <path
              ref={fillRef}
              d={MEMBER_ROUTE}
              fill="none"
              className="stroke-brand"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="1"
            />
            <circle ref={markerRef} cx="70" cy="40" r="6" className="fill-brand stroke-ground" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
