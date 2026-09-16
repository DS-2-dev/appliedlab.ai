// Tiny top-down room sketches for the three workshop shapes. Decorative;
// the card text carries the meaning.

const DOT = "fill-ink-faint";
const LEAD = "fill-brand";

function Collective() {
  // everyone facing one screen
  return (
    <svg aria-hidden viewBox="0 0 120 64" className="h-14 w-full">
      <rect x="38" y="6" width="44" height="6" rx="2" className="fill-line-strong" />
      {[
        [34, 30], [50, 26], [66, 26], [82, 30],
        [28, 46], [46, 44], [62, 44], [78, 44], [92, 46],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" className={DOT} />
      ))}
    </svg>
  );
}

function Focused() {
  // tables with leaders circulating between them
  return (
    <svg aria-hidden viewBox="0 0 120 64" className="h-14 w-full">
      {[
        [8, 14], [76, 10], [44, 40],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="34" height="14" rx="3" className="fill-none stroke-line-strong" strokeWidth="2" />
      ))}
      {[
        [14, 10], [36, 10], [82, 6], [104, 6], [50, 36], [72, 36],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.6" className={DOT} />
      ))}
      <circle cx="60" cy="20" r="4.2" className={LEAD} />
      <circle cx="28" cy="46" r="4.2" className={LEAD} />
    </svg>
  );
}

function Collaborative() {
  // pods clustered around shared problems
  return (
    <svg aria-hidden viewBox="0 0 120 64" className="h-14 w-full">
      {[
        [22, 22], [60, 40], [96, 18],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy - 10} r="4" className={DOT} />
          <circle cx={cx - 9} cy={cy + 5} r="4" className={DOT} />
          <circle cx={cx + 9} cy={cy + 5} r="4" className={DOT} />
        </g>
      ))}
    </svg>
  );
}

export function RoomShape({ name }: { name: string }) {
  if (name === "Collective") return <Collective />;
  if (name === "Focused") return <Focused />;
  return <Collaborative />;
}
