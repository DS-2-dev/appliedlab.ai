// The instruments as labeled crossties: each tie spans only the rails its
// instrument actually runs on, so the drawing answers "where does this
// connect". Full ties serve both pipelines; stubs with an open end touch one.
// Desktop-only and decorative; the labeled list below carries the content.

import { handbook } from "@/content/handbook";

const P = handbook.pipelinesIntro;
const RAIL_TOP = 36;
const RAIL_BOTTOM = 84;

export function InstrumentTies() {
  const items = handbook.instruments.items;
  const xs = items.map((_, i) => 190 + (i * 680) / Math.max(items.length - 1, 1));
  return (
    <div className="hidden border border-line bg-ground-raised md:block md:px-6 md:py-5">
      <svg aria-hidden viewBox="0 0 960 136" className="w-full" style={{ maxHeight: 150 }}>
        <text x="24" y="40" className="fill-ink-faint" style={{ font: "600 11px var(--font-jetbrains, monospace)", letterSpacing: "0.14em" }}>
          {P.parallelLabel.toUpperCase()}
        </text>
        <text x="24" y="88" className="fill-ink-faint" style={{ font: "600 11px var(--font-jetbrains, monospace)", letterSpacing: "0.14em" }}>
          {P.integratedLabel.toUpperCase()}
        </text>
        <line x1="170" y1={RAIL_TOP} x2="900" y2={RAIL_TOP} className="stroke-brand" strokeWidth="2.5" />
        <line x1="170" y1={RAIL_BOTTOM} x2="900" y2={RAIL_BOTTOM} className="stroke-line-strong" strokeWidth="2" strokeDasharray="6 5" />
        {items.map((item, i) => {
          const x = xs[i];
          return (
            <g key={item.title}>
              {item.applies === "both" ? (
                <line x1={x} y1={RAIL_TOP} x2={x} y2={RAIL_BOTTOM} className="stroke-line-strong" strokeWidth="2" />
              ) : item.applies === "integrated" ? (
                <>
                  <line x1={x} y1={RAIL_BOTTOM} x2={x} y2={RAIL_BOTTOM - 22} className="stroke-line-strong" strokeWidth="2" />
                  <circle cx={x} cy={RAIL_BOTTOM - 26} r="3.5" className="fill-ground stroke-line-strong" strokeWidth="2" />
                </>
              ) : (
                <>
                  <line x1={x} y1={RAIL_TOP} x2={x} y2={RAIL_TOP + 22} className="stroke-line-strong" strokeWidth="2" />
                  <circle cx={x} cy={RAIL_TOP + 26} r="3.5" className="fill-ground stroke-line-strong" strokeWidth="2" />
                </>
              )}
              <text x={x} y="122" textAnchor="middle" className="fill-ink-soft" style={{ font: "11px var(--font-jetbrains, monospace)" }}>
                {item.short}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
