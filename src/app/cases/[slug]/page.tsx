import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { cases, getCase } from "@/content/cases";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export function generateStaticParams() {
  return cases.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getCase(slug);
  if (!c) return { title: copy.meta.title };
  return {
    title: `${c.title} | ${copy.meta.title}`,
    description: c.summary,
  };
}

const F = copy.caseDetail.fields;

export default async function CasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCase(slug);
  if (!c) notFound();

  return (
    <>
      <SiteNav />
      <main id="main">
        <article>
          <header className="border-b border-line">
            <div className="mx-auto max-w-3xl px-5 pb-12 pt-14 md:px-8 md:pb-14 md:pt-20">
              <p className="text-sm">
                <Link
                  href="/work#library"
                  className="inline-flex items-center gap-1.5 text-ink-faint underline-offset-4 hover:text-brand-deep hover:underline"
                >
                  <ArrowLeft aria-hidden className="size-3.5 shrink-0" />
                  {copy.caseDetail.backTo}
                </Link>
              </p>

              {c.isExample && (
                <p className="mt-5 inline-flex items-center gap-1.5 border border-line-strong bg-ground-sunken px-3 py-1 font-mono text-xs text-ink-faint">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-faint" />
                  {copy.work.exampleBadge}
                </p>
              )}

              <h1 className="display mt-4 text-[2rem] md:text-[2.75rem]">{c.title}</h1>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">{c.summary}</p>

              <dl className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
                <Meta label={F.org} value={c.org} />
                <Meta label={F.domain} value={c.domain} />
                <Meta label={F.scope} value={c.scope} />
                <Meta label={F.needs} value={c.needs} />
              </dl>
            </div>
          </header>

          <div className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-16">
            <Block heading={F.businessModel}>
              <p>{c.businessModel}</p>
            </Block>

            <Block heading={F.problem}>
              {c.problem.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </Block>

            <Block heading={F.dependencies}>
              <ul className="space-y-3">
                {c.dependencies.map((d) => (
                  <Bullet key={d.slice(0, 24)}>{d}</Bullet>
                ))}
              </ul>
            </Block>

            <Block heading={F.achieves}>
              <p>{c.solvingAchieves}</p>
            </Block>

            <Block heading={F.constraints}>
              <ul className="space-y-3">
                {c.constraints.map((d) => (
                  <Bullet key={d.slice(0, 24)}>{d}</Bullet>
                ))}
              </ul>
            </Block>

            {/* The mess is the point. Kept in on purpose (master plan, step 1). */}
            <section className="mt-12 border-l-2 border-brand pl-5 md:pl-6">
              <h2 className="display text-xl">{F.mess}</h2>
              <ul className="mt-4 space-y-3">
                {c.mess.map((m) => (
                  <Bullet key={m.slice(0, 24)}>{m}</Bullet>
                ))}
              </ul>
            </section>

            <Block heading={F.deliverable}>
              <p>{c.deliverable}</p>
            </Block>

            {/* Sealed solution: described, never shipped to the client. */}
            <section className="mt-12 border border-line bg-ground-raised p-6 md:p-8">
              <h2 className="display flex items-center gap-2.5 text-xl">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {F.sealed}
              </h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{copy.caseDetail.sealedNote}</p>
            </section>

            <section className="mt-12 border-t border-line pt-8">
              <h2 className="display text-xl">{copy.caseDetail.claimHeading}</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{copy.caseDetail.claimBody}</p>
              <p className="mt-6 border-t border-line pt-5 text-[0.9375rem] leading-relaxed text-ink-soft">
                {copy.caseDetail.partnerCta.text}{" "}
                <Link
                  href={copy.caseDetail.partnerCta.href}
                  className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                >
                  {copy.caseDetail.partnerCta.label}
                  <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                </Link>
              </p>
              <Link
                href="/join"
                className="mt-5 inline-block rounded-full bg-brand-deep px-6 py-2.5 font-medium text-ground transition-colors hover:bg-ink"
              >
                {copy.hero.ctaPrimary}
              </Link>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 text-[0.9375rem] text-ink-soft">{value}</dd>
    </div>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="display text-xl md:text-2xl">{heading}</h2>
      <div className="mt-4 space-y-4 text-[1.0625rem] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[1.0625rem] leading-relaxed text-ink-soft">
      <span aria-hidden className="mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      <span>{children}</span>
    </li>
  );
}
