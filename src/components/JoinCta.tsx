// The invitation after Ask the Lab: one rounded black card with the ask to
// join, a button to the Join the Lab form and one to email a problem in. The
// hero's shape sits faintly in its corner.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { Reveal } from "@/components/Reveal";
import { JOIN_HREF } from "@/lib/site";

const C = copy.cta;

export function JoinCta() {
  return (
    <section aria-labelledby="join-cta" className="px-5 pb-16 lg:px-15 lg:pb-24">
      {/* The page ends here, so the card stays sharp once it is in. */}
      <Reveal leave={false}>
        <div className="relative overflow-hidden rounded-[2rem] bg-black px-7 py-14 text-white md:px-14 md:py-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing */}
          <img
            src="/ww.svg"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-20 -bottom-40 w-[34rem] max-w-[90%] opacity-[0.07] invert"
          />
          <div className="relative grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="kicker opacity-45">{C.kicker}</p>
              <h2 id="join-cta" className="mt-4 text-4xl leading-[1.05] font-light tracking-tight md:text-6xl">
                {C.heading}
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="max-w-md text-[15px] leading-relaxed font-light text-white/65 md:text-base">{C.body}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={JOIN_HREF}
                  className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm text-black transition hover:bg-white/85"
                >
                  {C.join}
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                </Link>
                <a
                  href={C.partnerHref}
                  className="inline-flex h-11 items-center rounded-full border border-white/25 px-5 text-sm transition hover:border-white/60"
                >
                  {C.partner}
                </a>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
