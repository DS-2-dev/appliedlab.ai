"use client";

/*
  An oval built out of the same blocks the cursor trail uses. Every cell whose
  centre falls inside the ellipse is filled; the stepped, staircased edge that
  produces is the point — run through the gooey filter it comes back as a
  soft, slightly lumpy oval rather than the dead-perfect one `border-radius`
  would give you.

  The fill is solid black, or one image tiled across the blocks when `src`
  is given: each cell shows its own slice via background-position, so
  together they reconstruct the picture and the oval reads as a window onto
  it.

  Every `shiftMs` the contour's phases advance, so edge blocks join and leave
  the shape and the outline drifts. Cells are never unmounted — the whole
  bounding grid stays rendered and only opacity changes, so the shift is a
  fade rather than a pop, and React is not rebuilding a thousand nodes on a
  timer.

  Sits in the same filtered layer as PixelTrail so the two fuse: the cursor
  drags blocks into and out of the oval's edge instead of floating over it.

  `heightRatio` is the oval's height as a fraction of the container.
  `aspect` is the oval's own width/height — below 1 it stands vertical, and
  because the width is derived from the height rather than from the
  container, it stays vertical on a wide viewport instead of flattening out.
  `wobble` is how far the edge wanders off a true ellipse; 0 gives a perfect
  one. `centerX` / `centerY` place it in the container as fractions; it sits
  centred, and the hero's text column is sized around it by the
  --hero-text-max token in globals.css.
*/

import { useEffect, useRef, useState } from "react";

// Frequency / amplitude / phase per harmonic. The phases are chosen, not
// arbitrary: the obvious ones stacked the 1x, 2x and 3x troughs together at
// 180 degrees, flattening the left side into a dead run at minimum radius and
// leaving a corner near 230. This set was solved for instead — radius
// 0.938-1.052, every 40-degree window still moving, and peak curvature about
// 24x lower, so there are no kinks. `drift` is how fast each harmonic's phase
// advances per shift; they are unequal so the outline never cycles back to a
// pose it has already held.
const HARMONICS = [
  { freq: 1, amp: 0.45, phase: 0.266, drift: 0.19 },
  { freq: 2, amp: 0.3, phase: 1.966, drift: -0.13 },
  { freq: 3, amp: 0.18, phase: 0.072, drift: 0.23 },
  { freq: 5, amp: 0.1, phase: 1.383, drift: -0.29 },
  { freq: 7, amp: 0.06, phase: 0.522, drift: 0.17 },
];

// The bowtie's half-height at its waist, as a fraction of full. Low enough
// that the middle is a neck rather than a dip, high enough that the neck does
// not break into two separate shapes once the gooey filter has softened it.
const BOWTIE_WAIST = 0.16;

export function PixelOval({
  pixelSize = 32,
  heightRatio = 0.72,
  aspect = 0.88,
  wobble = 0.08,
  src,
  shiftMs = 2000,
  centerX = 0.5,
  centerY = 0.5,
  shape = "ellipse",
  phase = 0,
  fill = true,
  outline = false,
  background,
}: {
  pixelSize?: number;
  heightRatio?: number;
  aspect?: number;
  wobble?: number;
  src?: string;
  shiftMs?: number;
  centerX?: number;
  centerY?: number;
  /* The aperture's family. `ellipse` and `rect` are the same superellipse and
     differ only in exponent: 2 is a true ellipse, 5 a rectangle with corners
     soft enough that the gooey filter still reads them as one shape rather
     than four corners.

     `bowtie` is a different curve, not another exponent. The half-height is a
     function of x, pinched at the middle and flaring to full at either end,
     so the shape is an hourglass lying on its side. Behind an opaque card
     that waist is hidden and what shows is a lobe on each side, which reads
     as one shape passing behind rather than two ornaments in the gutters. */
  shape?: "ellipse" | "rect" | "bowtie";
  /* Offsets every harmonic, so two apertures on one page, or one aperture at
     two different steps, never hold the same pose. */
  phase?: number;
  /* False lets the caller size the shape to its own container without the
     narrow-viewport shrink the hero needs. */
  fill?: boolean;
  /* Keep only the boundary cells. The same contour maths still drives the
     shape; this simply turns its filled aperture into a reusable mask ring. */
  outline?: boolean;
  /* A continuous CSS image tiled across the cells. When omitted, the
     existing image aperture remains unchanged. */
  background?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((v) => v + 1), shiftMs);
    return () => clearInterval(t);
  }, [shiftMs]);

  // Below the lg breakpoint the text runs full width, so the oval cannot
  // share the row with it — it drops underneath and shrinks instead.
  const narrow = fill && box.w > 0 && box.w < 1024;
  const placeX = narrow ? 0.5 : centerX;
  const placeY = narrow ? 0.72 : centerY;
  const ry = (box.h * (narrow ? heightRatio * 0.5 : heightRatio)) / 2;
  // Width follows the height, then gets clamped so a narrow viewport cannot
  // push the oval past its own edges.
  const rx = Math.min(ry * aspect, (box.w * 0.92) / 2);

  // The grid covers the oval at its widest possible wobble, so a block that
  // will ever be needed already exists and only has to fade in.
  const reach = 1 + wobble;
  // Whole cells, and an odd count each way, so a row and a column run
  // through the centre and the grid is the same on both sides of it.
  const odd = (n: number) => (n % 2 === 1 ? n : n + 1);
  const cols = odd(Math.ceil((rx * 2 * reach) / pixelSize));
  const rows = odd(Math.ceil((ry * 2 * reach) / pixelSize));
  const regionW = cols * pixelSize;
  const regionH = rows * pixelSize;

  const cells: { x: number; y: number; on: boolean }[] = [];
  if (rx > 0 && ry > 0) {
    const cx = regionW / 2;
    const cy = regionH / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * pixelSize;
        const y = row * pixelSize;
        // Test the cell's centre, so the edge steps evenly on both sides.
        const dx = x + pixelSize / 2 - cx;
        const dy = y + pixelSize / 2 - cy;
        // The bowtie takes its angle off |dx|, so the contour is mirrored
        // across the vertical axis and its two lobes are the same shape. Read
        // from a signed dx they are not: the odd harmonics land at opposite
        // signs on the two sides, and the lobes come out visibly unalike,
        // which on a shape whose whole job is to look like one object passing
        // behind a card reads as the left one being wrong. The closed shapes
        // keep the signed angle, where the asymmetry is what stops them
        // looking machined.
        const th = Math.atan2(dy, shape === "bowtie" ? Math.abs(dx) : dx);
        const edge =
          1 +
          wobble *
            HARMONICS.reduce(
              (sum, h) =>
                sum + Math.sin(h.freq * th + h.phase + phase + h.drift * tick) * h.amp,
              0,
            );

        let on: boolean;
        if (shape === "bowtie") {
          // Half-height as a function of x: WAIST at the centre, full at
          // either end. The exponent decides how long the shape stays pinched
          // before it flares, and 2 keeps the flare in the outer third, which
          // is the part that clears the card.
          const u = Math.abs(dx) / rx;
          const v = Math.abs(dy) / ry;
          const profile = BOWTIE_WAIST + (1 - BOWTIE_WAIST) * Math.pow(u, 2);
          on = u <= edge && v <= profile * edge;
        } else {
          // Minkowski distance: the exponent is what turns the same maths
          // from an ellipse into a rounded rectangle, so both shapes share
          // one wobble, one grid and one code path.
          const p = shape === "rect" ? 5 : 2;
          const d = Math.pow(
            Math.pow(Math.abs(dx) / rx, p) + Math.pow(Math.abs(dy) / ry, p),
            1 / p,
          );
          on = d <= edge;
        }
        cells.push({ x, y, on });
      }
    }
  }

  if (outline && cells.length > 0) {
    const solid = cells.map((cell) => cell.on);
    for (let index = 0; index < cells.length; index++) {
      if (!solid[index]) continue;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const neighbors = [
        row > 0 ? index - cols : -1,
        row < rows - 1 ? index + cols : -1,
        col > 0 ? index - 1 : -1,
        col < cols - 1 ? index + 1 : -1,
      ];
      cells[index].on = neighbors.some((neighbor) => neighbor < 0 || !solid[neighbor]);
    }
  }

  return (
    <div ref={container} aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute"
        style={{
          left: box.w * placeX,
          top: box.h * placeY,
          width: regionW,
          height: regionH,
          transform: "translate(-50%, -50%)",
        }}
      >
        {cells.map((c) => (
          <div
            key={`${c.x}-${c.y}`}
            className="absolute"
            style={{
              left: c.x,
              top: c.y,
              width: pixelSize,
              height: pixelSize,
              opacity: c.on ? 1 : 0,
              transition: "opacity 700ms ease",
              // Solid black unless given an image or a CSS background.
              backgroundImage: background ?? (src ? `url(${src})` : undefined),
              backgroundColor: background || src ? undefined : "#000",
              // One image across the whole region; each cell shows its slice.
              backgroundSize: `${regionW}px ${regionH}px`,
              backgroundPosition: `${-c.x}px ${-c.y}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
