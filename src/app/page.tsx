/* Landing page, redesigned 2026-11-09 (PROVISIONAL): a short intro low on
   the first screen, then a grid of tiles, one per part of the Lab, each
   with its name beneath and leading to its page (app/[slug]/page.tsx): one
   row of five on a wide screen, wrapping to four and two columns on a
   tablet and a phone, with each row starting level and its tiles keeping
   their own heights. Ask the Lab follows, as the page's questions. The
   header and footer are SiteFrame's. */

import Link from "next/link";
import { copy } from "@/content/copy";
import { TileArt } from "@/components/home/TileArt";
import { INK, SiteFrame, at } from "@/components/home/SiteFrame";
import { AskTheLab } from "@/components/AskTheLab";

const H = copy.home;

export default function Home() {
  return (
    <SiteFrame>
      {/* 180px above the intro, less on a short screen so the footer still
          fits without scrolling. */}
      <div className="home-rise pt-[clamp(80px,calc(100svh-690px),180px)] pb-5" style={at(1)}>
        <h1 className={INK}>{copy.nav.wordmark}</h1>
        <p className="mt-2 max-w-[300px] text-sm/[17px] font-medium text-[#737378]">{H.intro}</p>
      </div>

      <ul className="grid grid-cols-2 items-start gap-x-3 gap-y-8 min-[810px]:grid-cols-4 min-[1200px]:grid-cols-5">
        {H.tiles.map((t, i) => (
          <li key={t.id} className="home-rise" style={at(i + 2)}>
            <Link href={`/${t.slug}`} className="home-lift block">
              <TileArt id={t.id} />
              <p className={`mt-2.5 ${INK}`}>{t.title}</p>
            </Link>
          </li>
        ))}
      </ul>

      <AskTheLab />
    </SiteFrame>
  );
}
