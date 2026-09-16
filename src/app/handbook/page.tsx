/*
  /handbook - the operating model, with status markers.

  One document type only (2026-08-18 split): how the Lab runs. Identity
  (purpose, beliefs, behavior, people) lives at /about. The status marker on
  every block is what makes publishing an unbuilt plan honest.
*/

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUp, ChevronDown } from "lucide-react";
import { copy } from "@/content/copy";
import { STATUS_NOTES, handbook, type Status } from "@/content/handbook";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollLink } from "@/components/ScrollLink";
import { StatusBadge } from "@/components/StatusBadge";
import { RoomShape } from "@/components/visuals/RoomShapes";
import { PipelineJourney } from "@/components/visuals/PipelineJourney";
import { InstrumentTies } from "@/components/visuals/InstrumentTies";

export const metadata: Metadata = {
  title: `${handbook.meta.title} | ${copy.meta.title}`,
  description: handbook.meta.description,
};

const CONTENTS = [
  { id: "why", label: "Why it runs this way" },
  { id: "roadmap", label: "Where we are" },
  { id: "pipelines", label: "The pipelines" },
  { id: "parallel", label: "The Parallel Pipeline" },
  { id: "integrated", label: "The Integrated Pipeline" },
  { id: "instruments", label: "Instruments" },
  { id: "ladder", label: "Membership" },
  { id: "roles", label: "Structure" },
  { id: "operation", label: "Operation" },
  { id: "tools", label: "Tools" },
];

export default function HandbookPage() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 md:px-8 md:pb-14 md:pt-20">
            <p className="kicker">{handbook.intro.kicker}</p>
            <h1 className="display mt-4 max-w-3xl text-[2.125rem] md:text-[3.25rem]">
              {handbook.intro.heading}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
              {handbook.intro.lede}
            </p>
            <div className="mt-8 border border-line bg-ground-raised p-5 md:p-6">
              <h2 className="kicker">{handbook.intro.statusKeyHeading}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {(["running", "fall", "planned"] as Status[]).map((s) => (
                  <li key={s}>
                    <StatusBadge status={s} />
                    <p className="mt-1.5 text-sm text-ink-soft">{STATUS_NOTES[s]}</p>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-sm text-ink-faint">{copy.handbookPage.sourceNote}</p>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[14rem_1fr] lg:gap-16">
          <nav aria-label="Handbook contents" className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="kicker">{copy.handbookPage.contentsHeading}</h2>
            <ul className="mt-3 space-y-1.5">
              {CONTENTS.map((c) => (
                <li key={c.id}>
                  <ScrollLink
                    href={`#${c.id}`}
                    className="text-[0.9375rem] text-ink-soft underline-offset-4 hover:text-brand-deep hover:underline"
                  >
                    {c.label}
                  </ScrollLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            {/* Why first (2026-08-22): conviction moved in from the retired
                /about, so the reference carries its reasons. */}
            <Chapter id="why" kicker={handbook.why.kicker} heading={handbook.why.heading}>
              <h3 className="display mt-8 text-[1.75rem]">{handbook.why.beliefs.heading}</h3>
              <dl className="mt-6 grid gap-8 md:grid-cols-2">
                {handbook.why.beliefs.items.map((b) => (
                  <div key={b.title}>
                    <dt className="display text-xl">{b.title}</dt>
                    <dd className="mt-2 max-w-prose leading-relaxed text-ink-soft">{b.body}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10 max-w-3xl border border-brand bg-ground-raised p-6 md:p-8">
                <p className="kicker">{handbook.why.beliefs.approachKicker}</p>
                <p className="mt-3 text-[1.0625rem] leading-relaxed">
                  {handbook.why.beliefs.approach} {handbook.why.beliefs.spine}
                </p>
              </div>

              <h3 className="display mt-12 text-[1.75rem]">{handbook.why.thesis.heading}</h3>
              <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
                {handbook.why.thesis.body}
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-2 gap-y-2">
                {handbook.why.thesis.qualities.map((q) => (
                  <li
                    key={q}
                    className="border border-line-strong px-3 py-1 font-mono text-xs text-ink-soft"
                  >
                    {q}
                  </li>
                ))}
              </ul>

              <h3 className="display mt-12 text-[1.75rem]">{handbook.why.culture.heading}</h3>
              <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">
                {handbook.why.culture.lede}
              </p>
              <div className="mt-8 space-y-12">
                {handbook.why.culture.values.map((v) => (
                  <div
                    key={v.name}
                    className="lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-x-12"
                  >
                    <div className="lg:sticky lg:top-24 lg:self-start">
                      <h4 className="display text-[1.5rem]">{v.name}</h4>
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-faint">
                        {v.gloss}
                      </p>
                    </div>
                    <ul className="mt-6 space-y-7 border-l-2 border-line pl-5 lg:mt-0">
                      {v.rows.map((row) => (
                        <li key={row.situation.slice(0, 30)}>
                          <p className="max-w-prose font-medium">{row.situation}</p>
                          <dl className="mt-2 space-y-2">
                            <div className="flex gap-4">
                              <dt className="kicker w-12 shrink-0 pt-0.5 text-green-deep">
                                {handbook.why.culture.weLabel}
                              </dt>
                              <dd className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
                                {row.we}
                              </dd>
                            </div>
                            <div className="flex gap-4">
                              <dt className="kicker w-12 shrink-0 pt-0.5 text-ink-faint">
                                {handbook.why.culture.avoidLabel}
                              </dt>
                              <dd className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
                                {row.avoid}
                              </dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Chapter>

            {/* Roadmap: it is what makes everything below safe to publish. */}
            <Chapter id="roadmap" kicker={handbook.roadmap.kicker} heading={handbook.roadmap.heading}>
              {/* you-are-here meter: three steps, first one live */}
              <div aria-hidden className="mt-6 flex max-w-md items-center gap-2">
                {handbook.roadmap.steps.map((s, i) => (
                  <div key={s.n} className="flex flex-1 items-center gap-2">
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                        i === 0 ? "border-brand-deep bg-brand" : "border-line-strong bg-ground"
                      }`}
                    />
                    {i < handbook.roadmap.steps.length - 1 && (
                      <span className={`h-px w-full ${i === 0 ? "bg-brand" : "bg-line-strong"}`} />
                    )}
                  </div>
                ))}
                <span className="shrink-0 font-mono text-xs text-brand-deep">we are here</span>
              </div>
              <ol className="mt-6 space-y-4">
                {handbook.roadmap.steps.map((s) => (
                  <li key={s.n} className="border border-line bg-ground-raised p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-brand-deep">{s.n}</span>
                      <h3 className="display text-xl">{s.title}</h3>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-ink-faint">{s.when}</p>
                    <p className="mt-3 leading-relaxed text-ink-soft">{s.body}</p>
                  </li>
                ))}
              </ol>
            </Chapter>

            <Chapter id="pipelines" kicker={handbook.pipelinesIntro.kicker} heading={handbook.pipelinesIntro.heading}>
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.pipelinesIntro.lede}</p>
            </Chapter>

            <PipelineJourney>
            <Chapter
              id="parallel"
              kicker={handbook.parallel.kicker}
              heading={handbook.parallel.heading}
              status={handbook.parallel.status}
            >
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.parallel.lede}</p>
              <ol className="mt-8 space-y-5">
                {handbook.parallel.steps.map((s) => (
                  <li key={s.n} className="border border-line bg-ground-raised p-6">
                    <p className="font-mono text-sm text-brand-deep">{s.n}</p>
                    <h3 className="display mt-1 text-xl">{s.title}</h3>
                    <p className="mt-3 leading-relaxed text-ink-soft">{s.body}</p>
                    <p className="mt-3 leading-relaxed text-ink-soft">{s.detail}</p>
                    {"note" in s && s.note && (
                      <p className="mt-4 border border-line bg-ground p-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                        {s.note}
                      </p>
                    )}
                    {"mess" in s && s.mess && (
                      <p className="mt-4 border-l-2 border-brand pl-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                        {s.mess}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-6">
                <Link
                  href="/work#library"
                  className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                >
                  The case library
                  <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                </Link>
              </p>
            </Chapter>

            <Chapter
              id="integrated"
              kicker={handbook.integrated.kicker}
              heading={handbook.integrated.heading}
              status={handbook.integrated.status}
            >
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.integrated.lede}</p>
              <ol className="mt-8 space-y-4">
                {handbook.integrated.steps.map((s, i) => (
                  <li key={s.slice(0, 24)} className="flex gap-4">
                    <span className="mt-0.5 shrink-0 font-mono text-sm text-brand-deep">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-relaxed text-ink-soft">{s}</span>
                  </li>
                ))}
              </ol>
            </Chapter>
            </PipelineJourney>

            <Chapter
              id="instruments"
              kicker={handbook.instruments.kicker}
              heading={handbook.instruments.heading}
              status={handbook.instruments.status}
            >
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.instruments.lede}</p>
              <div className="mt-8">
                <InstrumentTies />
              </div>
              <dl className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-2">
                {handbook.instruments.items.map((i, idx) => (
                  <div key={i.title} className="flex gap-4">
                    <span className="mt-0.5 shrink-0 font-mono text-sm text-brand-deep">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <dt className="flex flex-wrap items-center gap-2 font-medium">
                        {i.title}
                        <span className="border border-line-strong bg-ground px-2 py-0.5 font-mono text-xs text-ink-faint">
                          {i.applies === "both" ? "both pipelines" : i.applies}
                        </span>
                        {"status" in i && i.status && <StatusBadge status={i.status} />}
                      </dt>
                      <dd className="mt-1 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
                        {i.body}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Chapter>

            <Chapter
              id="ladder"
              kicker={handbook.ladder.kicker}
              heading={handbook.ladder.heading}
              status={handbook.ladder.status}
            >
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.ladder.lede}</p>
              {/* the ladder, drawn as one: a rail connecting the rungs, top rung last */}
              <ol className="relative mt-8 space-y-4 pl-8">
                <span
                  aria-hidden
                  className="absolute bottom-6 left-[0.4375rem] top-6 w-px bg-line-strong"
                />
                {handbook.ladder.rungs.map((r, i) => (
                  <li key={r.name} className="relative border border-line bg-ground-raised p-6">
                    <span
                      aria-hidden
                      className={`absolute -left-8 top-7 h-4 w-4 rounded-full border-2 ${
                        r.status === "planned"
                          ? "border-line-strong bg-ground"
                          : "border-brand-deep bg-brand"
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-brand-deep">{i + 1}</span>
                      <h3 className="display text-xl">{r.name}</h3>
                      <span className="font-mono text-xs text-ink-faint">{r.level}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-3 font-medium">{r.requirement}</p>
                    <p className="mt-2 leading-relaxed text-ink-soft">{r.body}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.ladder.outcome}</p>
            </Chapter>

            <Chapter
              id="roles"
              kicker={handbook.roles.kicker}
              heading={handbook.roles.heading}
              status={handbook.roles.status}
            >
              <div className="mt-6 space-y-4">
                {handbook.roles.entries.map((r) => (
                  <details
                    key={r.id}
                    id={r.id}
                    className="group scroll-mt-24 border border-line bg-ground-raised p-6"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="display text-xl">{r.title}</h3>
                        <StatusBadge status={r.status} />
                        <span
                          aria-hidden
                          className="ml-auto text-ink-faint transition-transform group-open:rotate-180"
                        >
                          <ChevronDown className="size-[18px]" />
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-ink-faint">{r.who}</p>
                      <p className="mt-3 leading-relaxed text-ink-soft">{r.summary}</p>
                    </summary>
                    <ul className="mt-5 space-y-3 border-t border-line pt-5">
                      {r.points.map((p) => (
                        <li
                          key={p.slice(0, 24)}
                          className="flex gap-3 leading-relaxed text-ink-soft"
                        >
                          <span
                            aria-hidden
                            className="mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                          />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                    {"note" in r && r.note && (
                      <p className="mt-4 border border-line bg-ground p-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                        {r.note}
                      </p>
                    )}
                    {"pressure" in r && r.pressure && (
                      <div className="mt-6">
                        <h4 className="kicker">Under pressure</h4>
                        <ul className="mt-4 space-y-6 border-l-2 border-line pl-5">
                          {r.pressure.map((row) => (
                            <li key={row.situation.slice(0, 30)}>
                              <p className="max-w-prose font-medium">{row.situation}</p>
                              <dl className="mt-2 space-y-2">
                                <div className="flex gap-4">
                                  <dt className="kicker w-12 shrink-0 pt-0.5 text-green-deep">We</dt>
                                  <dd className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">{row.we}</dd>
                                </div>
                                <div className="flex gap-4">
                                  <dt className="kicker w-12 shrink-0 pt-0.5 text-ink-faint">Avoid</dt>
                                  <dd className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">{row.avoid}</dd>
                                </div>
                              </dl>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {"fullRole" in r && r.fullRole && (
                      <p className="mt-5">
                        <Link
                          href={r.fullRole}
                          className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                        >
                          The full role
                          <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                        </Link>
                      </p>
                    )}
                  </details>
                ))}
              </div>
              <p className="mt-6">
                <Link
                  href="/#for-faculty"
                  className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                >
                  The Representative role
                  <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                </Link>
              </p>
            </Chapter>

            <Chapter
              id="operation"
              kicker={handbook.operation.kicker}
              heading={handbook.operation.heading}
              status={handbook.operation.status}
            >
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.operation.lede}</p>

              <h3 className="display mt-8 text-[1.75rem]">{handbook.operation.shapeHeading}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">
                {handbook.operation.shapeIntro}
              </p>
              <ul className="mt-5 grid gap-4 md:grid-cols-3">
                {handbook.operation.shapes.map((s) => (
                  <li key={s.name} className="border border-line bg-ground-raised p-5">
                    <RoomShape name={s.name} />
                    <p className="mt-3 font-medium">{s.name}</p>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{s.body}</p>
                  </li>
                ))}
              </ul>

              <h3 className="display mt-12 text-[1.75rem]">{handbook.operation.socialsHeading}</h3>
              <div className="mt-3 space-y-4 leading-relaxed text-ink-soft">
                {handbook.operation.socials.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </Chapter>

            <Chapter
              id="tools"
              kicker={handbook.tools.kicker}
              heading={handbook.tools.heading}
              status={handbook.tools.status}
              last
            >
              <p className="mt-6 leading-relaxed text-ink-soft">{handbook.tools.lede}</p>
              <dl className="mt-8 grid gap-4 md:grid-cols-2">
                {handbook.tools.items.map((t) => (
                  <div
                    key={t.name}
                    className="border border-line-strong bg-ground-sunken p-5"
                  >
                    <dt className="font-medium">{t.name}</dt>
                    <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">
                      {t.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </Chapter>

            <p className="mt-12 border-t border-line pt-6 text-sm">
              <ScrollLink
                href="#main"
                className="inline-flex items-center gap-1.5 text-ink-faint underline-offset-4 hover:text-brand-deep hover:underline"
              >
                <ArrowUp aria-hidden className="link-arrow-up size-3.5 shrink-0" />
                {copy.handbookPage.backToTop}
              </ScrollLink>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Chapter({
  id,
  kicker,
  heading,
  status,
  last = false,
  children,
}: {
  id: string;
  kicker: string;
  heading: string;
  status?: Status;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${last ? "" : "border-b border-line pb-12 md:pb-16"} ${
        id === "roadmap" ? "" : "pt-12 md:pt-16"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="kicker">{kicker}</p>
        {status && <StatusBadge status={status} />}
      </div>
      <h2 className="display mt-3 text-[1.75rem] leading-tight md:text-[2.25rem]">{heading}</h2>
      {children}
    </section>
  );
}
