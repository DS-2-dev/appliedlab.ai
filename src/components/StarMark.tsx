// The Lab's mark (better.svg, the hero's shape), wherever a page shows a
// logo. Every page uses this, so a new mark is a one-line swap.

export function StarMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing
  return <img src="/better.svg" alt="" aria-hidden className={className} />;
}
