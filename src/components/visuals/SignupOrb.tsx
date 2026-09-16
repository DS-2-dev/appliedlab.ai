/*
  One aperture beside the capture form, on the same jetty fill as the hero's
  and the about section's.

  The form card is capped at max-w-3xl and sits on the left of a max-w-6xl
  section, so the right half of this section is empty ground. This fills it
  without competing: an upright oval centred on the card's own axis and kept
  inside the viewport so its full contour remains visible.

  It holds its position, like the about section's. What moves is the contour,
  at the same settings that one uses: shiftMs 900 against the hero's 2000,
  wobble 0.13 against 0.08. `phase` offsets every harmonic so this one and the
  bowtie further up the page are never in the same pose.

  Decoration only, so aria-hidden and pointer-events-none. Below lg the card
  takes the full row and there is no space beside it, so it is off.
*/

import { PixelOval } from "@/components/ui/PixelOval";
import { GooeyFilter } from "@/components/ui/GooeyFilter";

export function SignupOrb() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
      {/* Its own filter id. Two filters with one id on a page is a silent
          bug — the second definition wins for both. */}
      <GooeyFilter id="signup-goo" strength={6} />

      <div className="absolute inset-0 opacity-90" style={{ filter: "url(#signup-goo)" }}>
        <div className="absolute right-[clamp(1.5rem,4vw,4rem)] top-1/2 h-[420px] w-[320px] -translate-y-1/2">
          <PixelOval
            pixelSize={26}
            heightRatio={1}
            aspect={0.82}
            wobble={0.13}
            src="/jetty.jpg"
            shiftMs={900}
            phase={2.4}
            fill={false}
          />
        </div>
      </div>
    </div>
  );
}
