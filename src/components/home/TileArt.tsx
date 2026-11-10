// The art on the landing's tiles (app/page.tsx), one picture per part of the
// Lab, keyed by the tile's id in copy.home.tiles: a photograph from
// public/tiles/ (sources in its CREDITS.md), cropped to the tile's shape.
// PROVISIONAL, like the redesign it belongs to.

import type { ReactNode } from "react";

// Width over height for each tile, varied the way the layout's grid is.
export const TILE_RATIO: Record<string, string> = {
  about: "1 / 1",
  how: "1 / 1",
  students: "270 / 407",
  faculty: "270 / 221",
  partners: "270 / 405",
};

// A photograph that fills its tile, cropped to the tile's shape. Plain
// <img>, since the site is a static export with images unoptimized.
function Photo({ src, position = "center" }: { src: string; position?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
  );
}

// Each part of the Lab as a photograph, cropped to its tile.
const ART: Record<string, () => ReactNode> = {
  // The Utah monolith, found in the desert in 2020: something new in Utah.
  about: () => <Photo src="/tiles/about.webp" position="center 45%" />,
  // A chip's floor, with an arm carrying work along a path: the pipeline.
  how: () => <Photo src="/tiles/how.webp" />,
  // Students at a computer, working a problem together.
  students: () => <Photo src="/tiles/students.webp" position="center 40%" />,
  // A shelf of books, from language and poetry to typography and finance.
  faculty: () => <Photo src="/tiles/faculty.webp" position="center 62%" />,
  // A glass bridge joining two buildings: the Lab and its partners.
  partners: () => <Photo src="/tiles/partners.webp" />,
};

// `ratio` overrides the tile's own shape, for the wide picture at the top
// of its page; the photograph is cropped to fit.
export function TileArt({ id, ratio }: { id: string; ratio?: string }) {
  const Art = ART[id];
  return (
    <div className="@container overflow-hidden" style={{ aspectRatio: ratio ?? TILE_RATIO[id] ?? "1 / 1" }}>
      {Art ? <Art /> : null}
    </div>
  );
}
