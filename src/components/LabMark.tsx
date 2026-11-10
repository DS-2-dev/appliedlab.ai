// The Lab's mark: twelve petals around an open centre, traced from the
// master artwork as exact ellipses (public/lab-mark.svg holds the same
// shapes as a file). It takes the text colour.

export function LabMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="-351 -351 702 702"
      fill="currentColor"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse cx="-207.38" cy="-120.92" rx="109.10" ry="25.34" transform="rotate(30.00 -207.38 -120.92)"/>
      <ellipse cx="-119.18" cy="-208.45" rx="109.12" ry="21.80" transform="rotate(60.00 -119.18 -208.45)"/>
      <ellipse cx="0.01" cy="-240.10" rx="109.08" ry="16.85" transform="rotate(89.98 0.01 -240.10)"/>
      <ellipse cx="120.84" cy="-207.50" rx="109.13" ry="30.54" transform="rotate(-60.04 120.84 -207.50)"/>
      <ellipse cx="208.36" cy="-119.29" rx="109.10" ry="30.56" transform="rotate(-30.04 208.36 -119.29)"/>
      <ellipse cx="239.43" cy="0.00" rx="109.06" ry="55.74" transform="rotate(-0.04 239.43 0.00)"/>
      <ellipse cx="207.50" cy="120.79" rx="109.09" ry="48.83" transform="rotate(29.97 207.50 120.79)"/>
      <ellipse cx="119.34" cy="208.35" rx="109.11" ry="45.34" transform="rotate(59.96 119.34 208.35)"/>
      <ellipse cx="0.01" cy="240.11" rx="109.10" ry="40.02" transform="rotate(90.00 0.01 240.11)"/>
      <ellipse cx="-120.67" cy="207.59" rx="109.12" ry="37.83" transform="rotate(-60.08 -120.67 207.59)"/>
      <ellipse cx="-208.24" cy="119.44" rx="109.12" ry="33.20" transform="rotate(-30.08 -208.24 119.44)"/>
      <ellipse cx="-240.03" cy="-0.00" rx="109.06" ry="30.56" transform="rotate(0.00 -240.03 -0.00)"/>
    </svg>
  );
}
