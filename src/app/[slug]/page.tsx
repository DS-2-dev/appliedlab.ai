/* A landing tile's page (PROVISIONAL, 2026-11-10): the title, a few grey
   facts and the body in a column at the left that stays in view, with the
   tile's picture and its panels stacked down the right half, then a link
   on to the next tile's page. One column on a phone. The words are
   copy.home.pages, keyed by the tile's id. */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { copy } from "@/content/copy";
import { TileArt } from "@/components/home/TileArt";
import { INK, MUTED, SiteFrame, at } from "@/components/home/SiteFrame";

const H = copy.home;

// Only the tiles' pages exist; any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return H.tiles.map((t) => ({ slug: t.slug }));
}

function find(slug: string) {
  const i = H.tiles.findIndex((t) => t.slug === slug);
  return i < 0 ? null : { tile: H.tiles[i], next: H.tiles[(i + 1) % H.tiles.length] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = find((await params).slug);
  return found ? { title: `${found.tile.title} | ${copy.meta.title}` } : {};
}

export default async function TilePage({ params }: { params: Promise<{ slug: string }> }) {
  const found = find((await params).slug);
  if (!found) notFound();
  const { tile, next } = found;
  const page = H.pages[tile.id as keyof typeof H.pages];

  return (
    <SiteFrame>
      <div className="grid gap-x-5 gap-y-12 pt-[180px] pb-24 min-[810px]:grid-cols-2">
        <div className="home-rise min-[810px]:sticky min-[810px]:top-5 min-[810px]:self-start" style={at(1)}>
          <div className="max-w-[400px]">
            <h1 className={INK}>{tile.title}</h1>
            <div className={`mt-2 grid gap-0.5 text-sm/[17px] font-medium ${MUTED}`}>
              {page.meta.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
            <div className={`mt-8 grid gap-4 text-sm/[17px] font-medium ${INK}`}>
              {page.body.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
            <Link href={page.cta.href} className={`home-link mt-8 inline-block ${INK}`}>
              ↳ {page.cta.label}
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="home-rise" style={at(2)}>
            <TileArt id={tile.id} ratio="4 / 3" />
          </div>
          {page.panels.map((panel, i) => (
            <section key={panel.label} className="home-rise bg-[#f4f4f4] p-6" style={at(i + 3)}>
              <h2 className={INK}>{panel.label}</h2>
              <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm/[17px] sm:grid-cols-2">
                {panel.items.map((item) => (
                  <div key={item.title + item.body}>
                    {item.title && <dt className={INK}>{item.title}</dt>}
                    <dd className={`font-medium ${item.title ? "mt-1 text-[#737378]" : INK}`}>{item.body}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <Link href={`/${next.slug}`} className={`home-link mt-1.5 justify-self-end ${INK}`}>
            ↳ {next.title}
          </Link>
        </div>
      </div>
    </SiteFrame>
  );
}
