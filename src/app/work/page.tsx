/*
  /work - the library and the record, one page until December.

  Composition: the library = dossier cards (cases are units). How a case
  works = a full-bleed band holding the sealed mechanic, the ownership
  commitments (lock treatment), the package anatomy as numbered parts, and
  the rating criteria as a rules list. The record = a split ledger with
  entry cards on the right.
*/

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { CASE_RUBRIC, CASE_SCHEMA, cases, claimableCases, type CasePackage } from "@/content/cases";
import { PUBLICATION_SCHEMA } from "@/content/showcase";
import { listShowcasePublic } from "@/lib/data";
import type { ShowcaseEntry } from "@/lib/types";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Section } from "@/components/Section";
import { ScrollLink } from "@/components/ScrollLink";
import { SealedCompare } from "@/components/visuals/SealedCompare";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.work.meta.title} | ${copy.meta.title}`,
  description: copy.work.lede,
};

const W = copy.work;

function LockIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default async function WorkPage() {
  const entries = await listShowcasePublic();
  const open = claimableCases();
  const examples = cases.filter((c) => c.isExample);

  return (
    <>
      <SiteNav />
      <main id="main">
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 md:px-8 md:pb-16 md:pt-20">
            <p className="kicker">{W.kicker}</p>
            <h1 className="display mt-4 max-w-3xl text-[2.125rem] md:text-[3.25rem]">
              {W.heading}
            </h1>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">{W.lede}</p>
            <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
              <ScrollLink href="#library" className="inline-flex items-center gap-1.5 text-brand-deep underline-offset-4 hover:underline">
                {W.libraryKicker}
                <ArrowDown aria-hidden className="link-arrow-down size-3.5 shrink-0" />
              </ScrollLink>
              <ScrollLink href="#record" className="inline-flex items-center gap-1.5 text-brand-deep underline-offset-4 hover:underline">
                {W.recordKicker}
                <ArrowDown aria-hidden className="link-arrow-down size-3.5 shrink-0" />
              </ScrollLink>
            </p>
            <p className="mt-4 inline-block border border-line-strong bg-ground-raised px-4 py-2 font-mono text-sm text-ink-soft">
              {W.statusLine}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ the library */}
        <Section
          id="library"
          kicker={W.libraryKicker}
          heading={W.libraryHeading}
          intro={W.libraryLede}
        >
          {open.length > 0 && (
            <>
              <h3 className="display text-[1.75rem]">{W.openHeading}</h3>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {open.map((c) => (
                  <CaseCard key={c.slug} c={c} />
                ))}
              </ul>
            </>
          )}

          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-faint">
            {W.exampleNote}
          </p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {examples.map((c) => (
              <CaseCard key={c.slug} c={c} />
            ))}
          </ul>
        </Section>

        {/* ------------------------------------------- how a case works */}
        <Section id="how-cases-work" kicker={W.howKicker} heading={W.sealedHeading} band>
          <p className="max-w-prose leading-relaxed text-ink-soft">{W.sealedBody}</p>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">{W.sealedCustody}</p>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">{W.aiBoundary}</p>
          <div className="mt-8 max-w-prose">
            <SealedCompare />
          </div>

          <h3 className="display mt-12 flex items-center gap-2 text-[1.75rem]">
            <span className="text-brand-deep">
              <LockIcon />
            </span>
            {W.ownershipHeading}
          </h3>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <p className="max-w-prose leading-relaxed text-ink-soft">{W.ownershipSealed}</p>
            <p className="max-w-prose leading-relaxed text-ink-soft">{W.ownershipMember}</p>
          </div>

          <h3 className="display mt-12 text-[1.75rem]">{W.schemaHeading}</h3>
          {/* anatomy: numbered parts, no boxes */}
          <dl className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {CASE_SCHEMA.map((f, i) => (
              <div key={f.field} className="flex gap-4">
                <span className="mt-0.5 shrink-0 font-mono text-sm text-brand-deep">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <dt className="font-medium">{f.field}</dt>
                  <dd className="mt-1 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
                    {f.body}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          <h3 className="display mt-12 text-[1.75rem]">{W.rubricHeading}</h3>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">{W.rubricBody}</p>
          {/* criteria: a rules list, one rule per criterion */}
          <dl className="mt-4 space-y-4 border-l-2 border-line pl-5">
            {CASE_RUBRIC.map((r) => (
              <div key={r.criterion}>
                <dt className="font-medium">{r.criterion}</dt>
                <dd className="mt-1 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
                  {r.body}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className="display mt-12 text-[1.75rem]">{W.claimHeading}</h3>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">{W.claimBody}</p>
          <Link
            href="/join"
            className="mt-8 inline-block rounded-full bg-brand-deep px-6 py-2.5 font-medium text-ground transition-colors hover:bg-ink"
          >
            {copy.hero.ctaPrimary}
          </Link>
        </Section>

        {/* ------------------------------------------------- the record */}
        <Section
          id="record"
          kicker={W.recordKicker}
          heading={W.recordHeading}
          intro={W.recordLede}
          split
        >
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-faint">
            {W.founderNote}
          </p>

          <ul className="mt-8 grid gap-4">
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </ul>

          <div className="mt-12">
            <p className="max-w-prose leading-relaxed text-ink-soft">{W.memberNote}</p>
            <ul className="mt-4 max-w-prose space-y-2 border-l-2 border-line pl-5">
              {PUBLICATION_SCHEMA.map((item) => (
                <li key={item} className="text-[0.9375rem] leading-relaxed text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-8 max-w-prose leading-relaxed text-ink-soft">{W.memberOwnLine}</p>
          <p className="mt-8 font-mono text-sm text-ink-soft">{W.showcaseEventLine}</p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}

function CaseCard({ c }: { c: CasePackage }) {
  return (
    <li className="dossier border border-line bg-ground-raised p-6">
      {c.isExample && (
        <p className="inline-flex items-center gap-1.5 border border-line-strong bg-ground px-2.5 py-0.5 font-mono text-xs text-ink-faint">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-faint" />
          {W.exampleBadge}
        </p>
      )}
      <h4 className="display mt-4 text-xl">
        <Link href={`/cases/${c.slug}`} className="underline-offset-4 hover:underline">
          {c.title}
        </Link>
      </h4>
      <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">{c.summary}</p>
      <p aria-hidden className="mt-4 flex items-center gap-2">
        <span className="redact w-16" />
        <span className="redact w-24" />
        <span className="redact w-10" />
      </p>
      <dl className="mt-4 grid gap-x-5 gap-y-2 border-t border-line pt-4 sm:grid-cols-3">
        {(
          [
            [copy.caseDetail.fields.org, c.org],
            [copy.caseDetail.fields.domain, c.domain],
            [copy.caseDetail.fields.scope, c.scope],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-faint">
              {label}
            </dt>
            <dd className="mt-1 text-sm leading-snug text-ink-soft">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4">
        <Link
          href={`/cases/${c.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep underline-offset-4 hover:underline"
        >
          Read the package
          <ArrowRight aria-hidden className="link-arrow size-3.5 shrink-0" />
        </Link>
      </p>
    </li>
  );
}

function EntryCard({ entry }: { entry: ShowcaseEntry }) {
  const rated = entry.rating_average !== null && entry.rating_count !== null;
  return (
    <li className="flex flex-col border border-line bg-ground-raised p-6">
      <div className="flex flex-wrap items-center gap-2">
        {entry.running && (
          <span className="inline-flex items-center gap-1.5 border border-green bg-ok-wash px-2.5 py-0.5 font-mono text-xs text-green-deep">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-green-deep" />
            {W.runningLabel}
          </span>
        )}
        <span className="inline-flex items-center border border-line-strong bg-ground px-2.5 py-0.5 font-mono text-xs text-ink-faint">
          {rated
            ? `${W.ratingLabel} ${entry.rating_average!.toFixed(1)} (${entry.rating_count})`
            : W.unratedLabel}
        </span>
      </div>

      <h4 className="display mt-4 text-xl">{entry.title}</h4>
      <p className="mt-2 leading-relaxed text-ink-soft">{entry.does}</p>

      <dl className="mt-4 space-y-1 font-mono text-xs text-ink-faint">
        <div className="flex gap-2">
          <dt className="sr-only">Built by</dt>
          <dd>{entry.by_line}</dd>
        </div>
        {entry.affiliation && (
          <div className="flex gap-2">
            <dt className="sr-only">Affiliation</dt>
            <dd>{entry.affiliation}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="sr-only">Organization</dt>
          <dd>{entry.partner ?? W.partnerUnnamed}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">When</dt>
          <dd>{entry.when_label}</dd>
        </div>
      </dl>

      {entry.metric_label && entry.metric_before && entry.metric_after && (
        <div className="mt-4 border border-line bg-ground p-4">
          <p className="kicker">{entry.metric_label}</p>
          <div aria-hidden className="mt-4 space-y-2">
            <div className="flex items-center gap-4">
              <span className="h-2.5 w-full rounded-full bg-line-strong" />
              <span className="shrink-0 font-mono text-xs text-ink-faint">
                {entry.metric_before}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="h-2.5 w-[22%] rounded-full bg-brand" />
              <span className="shrink-0 font-mono text-xs text-brand-deep">
                {entry.metric_after}
              </span>
            </div>
          </div>
          <p className="sr-only">
            {entry.metric_before} before, {entry.metric_after} after
          </p>
        </div>
      )}

      {entry.story.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line pt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
          {entry.story.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
      )}

      <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-faint">
        <span className="kicker mr-2">{W.limitsLabel}</span>
        {entry.limits}
      </p>
    </li>
  );
}
