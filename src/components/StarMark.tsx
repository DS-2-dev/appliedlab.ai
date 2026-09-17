// The star, standing in as the Lab's logo until the logo exists. Every page
// that shows it uses this, so the swap happens in one place.

export function StarMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing
  return <img src="/star.svg" alt="" aria-hidden className={className} />;
}
