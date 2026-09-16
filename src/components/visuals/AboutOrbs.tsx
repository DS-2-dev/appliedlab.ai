/*
  One aperture behind the about card, on the same jetty fill as the hero's.

  It is an hourglass lying on its side, wider than the screen and centred on
  the card. The card is opaque black and sits above, so the waist is hidden
  and what shows is a lobe past each edge, each one running off its side of
  the page. Two visible pieces, one shape: the eye joins them behind the card
  on its own, and because neither end stops short of the screen the shape
  belongs to the page instead of sitting on it.

  This replaced a flanking pair (2026-09-02). The pair only worked above
  1536px, because below that the card's gutters were narrow enough that each
  orb was a sliver rather than a shape. A bowtie has no such floor. As the
  viewport narrows the lobes are simply cropped further, and cropped symmetric
  lobes still read as one thing behind a card.

  It holds its position. The drift classes .orb-drift-a / .orb-drift-b are
  still in globals.css if this should move later. What is left is the contour,
  running harder than the hero's: shiftMs 900 against 2000, wobble 0.13
  against 0.08, so the edges keep working while the block stays put.

  Decoration only, so aria-hidden and pointer-events-none. Below md the card
  runs edge to edge and there is nothing for a lobe to clear, so it is off.
*/

import { PixelOval } from "@/components/ui/PixelOval";
import { GooeyFilter } from "@/components/ui/GooeyFilter";

export function AboutOrbs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
      {/* Its own filter id. Two filters with one id on a page is a silent
          bug — the second definition wins for both. */}
      <GooeyFilter id="about-goo" strength={6} />

      <div className="absolute inset-0 opacity-90" style={{ filter: "url(#about-goo)" }}>
        {/* Sized in vw with no px cap, so both lobes run off the screen at
            every width and the shape reads as connected to the page rather
            than floating in it. A px cap would let the viewport outgrow it
            and pull the ends inboard.

            `aspect` is deliberately far larger than the shape needs. The
            oval's width is min(ry * aspect, container * 0.92 / 2), so an
            aspect this high guarantees the second term wins and the width is
            the container's, whatever the viewport is doing. Wobble then
            expands the region another 13% past that, which is the margin that
            keeps the ends off-screen even when the contour wanders inward.

            The height is in vw for the same reason. Pinning the width to the
            viewport and the height to a px number stretched the shape flatter
            the wider the screen got, and flat was worse. Scaling both keeps
            the roughly 3:1 the shape was drawn at. The clamp stops it going
            thin on a small laptop or absurd on a display. */}
        <div className="absolute left-1/2 top-1/2 h-[clamp(420px,34vw,760px)] w-[124vw] -translate-x-1/2 -translate-y-1/2">
          <PixelOval
            pixelSize={32}
            heightRatio={1}
            aspect={12}
            wobble={0.13}
            src="/jetty.jpg"
            shiftMs={900}
            shape="bowtie"
            fill={false}
          />
        </div>
      </div>
    </div>
  );
}
