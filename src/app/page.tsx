/* Landing page, rebuilt from 2026-09-16 (design/STYLE.md): the header, then
   a hero led by the star (public/star.svg) with the copy beside it. */

import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { AskTheLab } from "@/components/AskTheLab";
import { HowItWorks } from "@/components/HowItWorks";
import { JoinCta } from "@/components/JoinCta";
import { Reveal } from "@/components/Reveal";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollLink } from "@/components/ScrollLink";
import { SiteHeader } from "@/components/SiteHeader";
import { JOIN_HREF } from "@/lib/site";

const H = copy.home;

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="font-archivo bg-white text-ink">
        {/* The hero: the shape (better.svg, for now) in a box across the top of the first
            screen, then one row beneath it, the large heading at the left
            and the rest of the copy with the buttons at the right. */}
        <section className="min-h-svh">
          <Reveal className="flex min-h-svh flex-col gap-10 px-5 pt-24 pb-10 lg:px-15 lg:pb-12">
            <div className="flex min-h-[10rem] flex-1 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing */}
              <img src="/better.svg" alt="" className="max-h-[46svh] w-full object-contain" />
            </div>

            {/* From lg the right column stretches to the heading block's
                height: its paragraph starts level with the kicker and its
                button row ends level with the heading's last line. */}
            <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-12">
              <div className="lg:col-span-8">
                <p className="kicker mb-4 opacity-35">{H.kicker}</p>
                <h1 className="max-w-4xl text-[2rem] leading-[1.02] font-light tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                  {H.heading.split(H.headingTilt).map((part, i) =>
                    i === 0 ? (
                      part
                    ) : (
                      <span key={i}>
                        <span className="tilt-word">{H.headingTilt}</span>
                        {part}
                      </span>
                    ),
                  )}
                </h1>
              </div>

              <div className="flex flex-col justify-between gap-6 lg:col-span-4">
                <p className="max-w-md text-sm leading-relaxed font-light opacity-60 lg:text-[15px]">{H.lede}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Link
                    href={JOIN_HREF}
                    className="group inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-sm text-white transition hover:bg-black/80"
                  >
                    {H.join}
                    <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-0.5" strokeWidth={1.5} />
                  </Link>
                  <ScrollLink
                    href={`#${copy.how.steps[0].id}`}
                    className="group inline-flex items-center gap-1.5 text-sm opacity-60 transition hover:opacity-100"
                  >
                    {H.how}
                    <ArrowDown aria-hidden className="size-3.5 transition group-hover:translate-y-0.5" strokeWidth={1.5} />
                  </ScrollLink>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <HowItWorks />
        <AskTheLab />
        <JoinCta />
      </main>
      <SiteFooter />
    </>
  );
}
