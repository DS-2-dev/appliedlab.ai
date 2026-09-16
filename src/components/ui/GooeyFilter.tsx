/*
  Gooey SVG filter.

  `shadcn add https://21st.dev/r/danielpetho/gooey-filter` now 403s — that
  registry item requires an authenticated 21st.dev account. The component is
  still public in the author's own repo, so this is ported from source:
  danielpetho/fancy, src/fancy/components/filter/gooey-svg-filter.tsx.

  How it works: blur the source, then run the alpha channel through a steep
  contrast ramp (the 19 / -9 row) so soft edges snap back to hard ones.
  Shapes overlapping inside the blur radius fuse with a liquid fillet instead
  of a seam. Apply with `filter: url(#id)` on the parent of the shapes.
*/

export function GooeyFilter({ id = "gooey-filter", strength = 10 }: { id?: string; strength?: number }) {
  return (
    <svg aria-hidden className="absolute hidden" focusable="false">
      <defs>
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={strength} result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
