// The landing's footer, after openwebui.com's: the star and the Lab's name
// with the hero's line, three short columns of links, a fine print row, and
// the name set large along the bottom edge. It sits still, with no scroll
// fade.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { CopyText } from "@/components/CopyText";
import { copy } from "@/content/copy";

const F = copy.footer;
const LAB = copy.how.steps.map((s) => ({ label: s.label, href: `/#${s.id}` }));

// LinkedIn's "in" mark (lucide dropped brand icons).
function LinkedInMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

const LINK = "inline-flex items-center gap-2 text-black/55 transition hover:text-black";

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="kicker opacity-35">{label}</p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="font-archivo overflow-hidden border-t border-black/[0.08] bg-white px-5 text-sm text-ink lg:px-15">
      <div className="grid gap-12 pt-14 pb-10 md:grid-cols-12 md:gap-8 md:pt-20">
        <div className="md:col-span-5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing */}
            <img src="/star.svg" alt="" aria-hidden className="w-6" />
            <span className="text-[15px] font-medium tracking-tight">{F.name}</span>
          </Link>
          <p className="mt-4 max-w-xs text-lg leading-snug font-light tracking-tight text-black/60">
            {copy.home.heading}
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          <Column label={F.labLabel}>
            {LAB.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={LINK}>
                  {l.label}
                </Link>
              </li>
            ))}
          </Column>
          <Column label={F.contactLabel}>
            <li>
              <CopyText text={F.email} label={F.copyEmail} className={`${LINK} cursor-pointer`} />
            </li>
            <li>
              <a href={F.linkedinHref} target="_blank" rel="noopener noreferrer" className={LINK}>
                <LinkedInMark />
                {F.linkedin}
                <ArrowUpRight aria-hidden className="size-3.5 opacity-60" strokeWidth={1.75} />
              </a>
            </li>
          </Column>
          <Column label={F.tryLabel}>
            <li>
              <Link href="/#ask" className={LINK}>
                {F.askLink}
              </Link>
            </li>
            <li>
              <Link href="/projectum" className={LINK}>
                {F.projectum}
              </Link>
            </li>
          </Column>
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-black/[0.06] py-5 text-xs text-black/40">
        <p>
          © {new Date().getFullYear()} {F.name}, {F.school}
        </p>
        <p>{F.place}</p>
      </div>

      {/* The name along the bottom edge, cut off by the page's end. */}
      <p
        aria-hidden
        className="-mb-[0.22em] text-center text-[15.5vw] leading-none font-medium tracking-[-0.05em] whitespace-nowrap text-ink select-none"
      >
        {F.name}
      </p>
    </footer>
  );
}
