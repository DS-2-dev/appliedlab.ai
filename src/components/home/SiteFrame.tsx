// The frame shared by the landing and its tile pages (app/page.tsx,
// app/[slug]/page.tsx): the mark and two links across the top, the page,
// and a three-part footer low on the screen: the Lab and its school, links,
// and the site's credit. Inter at 14px throughout. The
// motion lives in globals.css under .home-*. The account pages leave the
// two links out (`links={false}`): someone signing in has one job.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { copy } from "@/content/copy";
import { LabMark } from "@/components/LabMark";
import { StartAtTop } from "@/components/home/StartAtTop";
import { JOIN_HREF, LOGIN_HREF } from "@/lib/site";

const H = copy.home;

export const INK = "text-[#1f1f1f]";
export const MUTED = "text-[#9a9aa1]";

// The load's stagger: each step rises a beat after the one before.
export const at = (i: number) => ({ "--i": i }) as CSSProperties;

export function SiteFrame({ children, links = true }: { children: ReactNode; links?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col bg-white font-[family-name:var(--font-inter)] text-sm/4 font-semibold antialiased">
      <StartAtTop />
      <header className="home-rise flex h-20 items-center justify-between px-5" style={at(0)}>
        <Link href="/" aria-label={copy.nav.wordmark} className={`home-mark ${INK}`}>
          <LabMark className="size-10" />
        </Link>
        {links && (
          <nav className={`flex gap-5 ${INK}`}>
            <Link href={LOGIN_HREF} className="home-link">
              {copy.nav.login}
            </Link>
            <Link href={JOIN_HREF} className="home-link">
              {H.join}
            </Link>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1 px-5">
        {children}
      </main>

      <footer className="grid gap-4 px-5 pt-8 pb-3 min-[810px]:grid-cols-3 min-[810px]:items-center">
        <p className={`text-xs/[14px] ${MUTED}`}>
          © {new Date().getFullYear()} {copy.nav.wordmark}
          <a href={H.footerSchoolHref} className="home-link ml-2">
            ↳ {H.footerSchool}
          </a>
        </p>
        <nav className={`flex gap-2 min-[810px]:justify-center ${INK}`}>
          {H.footerLinks.map((l) => (
            <Link key={l.label} href={l.href} className="home-link">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className={`text-xs/[14px] min-[810px]:text-right ${MUTED}`}>
          {H.credit.lead}{" "}
          <a href={H.credit.href} target="_blank" rel="noopener noreferrer" className="home-link">
            {H.credit.name}
          </a>
        </p>
      </footer>
    </div>
  );
}
