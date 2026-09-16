/* The Lab's mark. Inline so it inherits the current emphasis colour. */
export function AsteriskMark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
        <line x1="32" y1="8" x2="32" y2="56" />
        <line x1="8" y1="32" x2="56" y2="32" />
        <line x1="15" y1="15" x2="49" y2="49" />
        <line x1="49" y1="15" x2="15" y2="49" />
      </g>
    </svg>
  );
}
