// One glyph per pipeline step, standalone so both the diagram and the staged
// scroller can draw the same marks. Decoration only — always aria-hidden, and
// the step's title carries the meaning.

const PATHS: Record<string, string[]> = {
  // an inbox tray: the problem arrives
  problem: ["M12 2v10m0 0l-4 -4m4 4l4 -4", "M2 16v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2 -2v-4"],
  // repeat arcs: the weekly loop
  build: ["M20 11a8 8 0 0 0 -14.5 -4M4 3v4h4", "M4 13a8 8 0 0 0 14.5 4M20 21v-4h-4"],
  // a rating star: the rubric
  review: ["M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"],
  // a flag: the showcase
  showcase: ["M5 21V4", "M5 4h13l-3 4l3 4H5"],
};

export function StepGlyph({
  id,
  size = 24,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const paths = PATHS[id] ?? PATHS.showcase;
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
