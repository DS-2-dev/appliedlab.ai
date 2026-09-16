/* Landing page. Parked sections remain behind the SHOW_* flags below. */

import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { copy } from "@/content/copy";
import { handbook } from "@/content/handbook";
import { CASE_RUBRIC } from "@/content/cases";
import { formsLive, getSettings, listShowcasePublic } from "@/lib/data";
import { requestNow } from "@/lib/format";
import { GooeyFilter } from "@/components/ui/GooeyFilter";
import { PixelOval } from "@/components/ui/PixelOval";
import { PixelTrail } from "@/components/ui/PixelTrail";
import { ChatDemo } from "@/components/hero/ChatDemo";
import { ScrollLink } from "@/components/ScrollLink";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { StageAperture } from "@/components/pipeline/StageAperture";
import { SemesterTimeline } from "@/components/visuals/SemesterTimeline";
import { PartnerSteps } from "@/components/visuals/PartnerSteps";
import { CaseChecker } from "@/components/CaseChecker";
import { PipelineJourney } from "@/components/visuals/PipelineJourney";
import { AboutOrbs } from "@/components/visuals/AboutOrbs";
import { SignupOrb } from "@/components/visuals/SignupOrb";
import { AudienceSwitch } from "@/components/AudienceSwitch";

export const dynamic = "force-dynamic";

// The hero's gooey cursor trail, hidden 2026-09-01. Nothing is deleted: the
// component, its props and the filtered layer it shares with the oval are all
// intact, so flipping this back to true restores it exactly.
const SHOW_CURSOR_TRAIL = false;

// The launch page is short by request: hero, how it runs, the pipelines, and
// the capture form. The rest of the landing is written and working, just not
// shown until after tomorrow.
const SHOW_ALL_SECTIONS = false;

// The four steps and their pinned run, off for now. The section is written
// and working; it is just not on the launch page.
const SHOW_STEPS = false;

// the statement's three movements, one per line, rising toward "elevate"
const STAIR_STEPS = ["block", "block pl-5 md:pl-10", "block pl-10 md:pl-20"];

function AskPill({ label, href }: { label: string; href: string }) {
  return (
    <p className="mt-8">
      <Link
        href={href}
        className="btn gap-1.5 bg-brand-deep text-white hover:bg-brand"
      >
        {label}
        <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
      </Link>
    </p>
  );
}

function Protections({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-8 max-w-prose space-y-3 border-l-2 border-brand pl-5">
      {items.map((p) => (
        <li key={p.slice(0, 24)} className="leading-relaxed text-ink-soft">
          {p}
        </li>
      ))}
    </ul>
  );
}

// Break a headline into exactly two lines at the most even word boundary.
// Data-driven rather than a hardcoded <br>, because the tagline is editable
// at /admin/settings and a fixed break would be wrong for any other wording.
function twoLines(text: string): [string, string] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text, ""];
  let at = 1;
  let best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(
      words.slice(0, i).join(" ").length - words.slice(i).join(" ").length,
    );
    if (diff < best) {
      best = diff;
      at = i;
    }
  }
  return [words.slice(0, at).join(" "), words.slice(at).join(" ")];
}

function BlockHeading({ text }: { text: string }) {
  return <h3 className="display mt-10 text-xl">{text}</h3>;
}

export default async function Home() {
  const [settings, showcase, live] = await Promise.all([
    getSettings(),
    listShowcasePublic(),
    formsLive(),
  ]);
  const tagline = settings.tagline || copy.hero.headline;
  const [line1, line2] = twoLines(tagline);
  // Size the headline off the column it has to fit in, not off the viewport:
  // the longest of the two lines must sit inside --hero-text-max. 0.46em per
  // character is Goudy Bookletter's average advance, narrower than the 0.5
  // the previous grotesque needed (2026-09-02).
  const headlineEm = (Math.max(line1.length, line2.length) * 0.46).toFixed(2);

  const strip = showcase.slice(0, 2);
  const S = copy.students;
  const F = copy.faculty;
  const P = copy.partners;

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <SiteNav />
      <main id="main">
        {/* Hero: blank canvas, 2026-08-30. White ground, and nothing on it
            but the gooey cursor trail. The content it used to carry is parked
            verbatim in components/hero/HeroContent.tsx — that file's header
            has the restore steps. */}
        <section className="relative isolate flex min-h-[calc(100svh-var(--site-header-height))] flex-col justify-start overflow-hidden bg-ground">
          {/* strength 5 is the reference's: it fillets where blocks touch and
              leaves them reading as blocks rather than melting them. */}
          <GooeyFilter id="hero-goo" strength={5} />

          {/* The oval and the trail share one filtered layer and one block
              size, so the cursor's blocks fuse into the oval's edge rather
              than passing over it. Same fill for both. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ filter: "url(#hero-goo)" }}
          >
            <PixelOval
              pixelSize={32}
              heightRatio={0.72}
              aspect={0.88}
              wobble={0.08}
              src="/jetty.jpg"
              shiftMs={2000}
            />
            {SHOW_CURSOR_TRAIL && (
              <PixelTrail
                pixelSize={32}
                fadeDuration={0}
                delay={500}
                pixelClassName="bg-ground-inverse"
              />
            )}
          </div>

          {/* Hero content, two columns on lg: the words on the left and the
              chat panel on the right, with the oval centred between them.
              Both columns are capped at --hero-text-max, which is derived
              from the oval's own half-width, so neither can reach it. Below
              lg the panel drops under the words. */}
          <div className="relative w-full px-edge pt-12 md:pt-16 lg:flex lg:flex-1 lg:items-center lg:justify-between lg:gap-8 lg:px-[var(--hero-text-inset)] lg:pt-0">
            {/* The words stay pinned to the oval's top edge; the row itself
                fills the hero so the panel beside them can centre. */}
            <div className="w-full lg:max-w-[var(--hero-text-max)] lg:self-start lg:pt-[var(--hero-text-top)]">
              {/* Goudy Bookletter ships one weight and one style, so the
                  headline sets font-normal explicitly: anything heavier and
                  the browser synthesises a bold by smearing the outlines.
                  The tracking is near zero, where the old grotesque wanted
                  -0.03em — an old-style serif is drawn with its spacing
                  already in it. */}
              <h1
                className="font-goudy max-w-[46ch] font-normal leading-[1.08] tracking-[-0.005em] text-ground-inverse lg:max-w-[var(--hero-text-max)]"
                style={{
                  fontSize: `clamp(28px, min(4.6vw, calc(var(--hero-text-max) / ${headlineEm})), 80px)`,
                }}
              >
                <span className="block">{line1}</span>
                <span className="block">{line2}</span>
              </h1>
              {/* Body face — the cursor.com register, Inter standing in for
                  their proprietary CursorGothic. */}
              <p className="mt-6 max-w-[46ch] font-sans text-[19px] leading-[1.45] tracking-[-0.01em] text-ink [text-wrap:pretty] md:mt-8 md:text-[22px] lg:max-w-[var(--hero-text-max)]">
                {copy.hero.sub}
              </p>

              {/* Facts strip, under the sub, now encased: a rounded dark card
                  on the white hero. `on-dark` repoints emphasis and focus
                  tones so nothing inside goes invisible. The radius is --radius-image
                  rather than a new number — the site rounds at exactly one
                  value plus the button pill, and a card is not a reason to
                  invent a third. Magistral, weight 400: it has no other. */}
              <div className="on-dark mt-8 max-w-[46ch] rounded-[var(--radius-image)] bg-ground-inverse p-6 md:mt-10 md:p-7 lg:max-w-[var(--hero-text-max)]">
                <ul className="flex flex-col gap-2 font-magistral text-[15px] font-normal leading-[1.5] text-ink-inverse md:text-[16px]">
                  {copy.hero.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>

              {/* The two asks, last in the column — inline text links with a
                  trailing arrow, the same pattern the section footers use, not
                  pills. They stack in the narrow lg band and sit side by side
                  once the column widens, so nothing has to overhang toward the
                  oval. */}
              <div className="mt-8 flex max-w-[46ch] flex-wrap items-center gap-x-7 gap-y-2 md:mt-10 lg:max-w-[var(--hero-text-max)]">
                <Link
                  href="/join"
                  className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                >
                  {copy.hero.ctaPrimary}
                  <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                </Link>
                <ScrollLink
                  // #how, the four-step section, is behind SHOW_STEPS, so
                  // the anchor had no target and the link did nothing. It
                  // lands on the first section under the hero rather than
                  // skipping to the pipelines, so the page is read in order.
                  href="#about"
                  className="inline-flex items-center gap-1.5 font-medium text-ink-soft underline-offset-4 hover:underline"
                >
                  {copy.hero.ctaSecondary}
                  <ArrowDown aria-hidden className="link-arrow-down size-4 shrink-0" />
                </ScrollLink>
              </div>
            </div>

            {/* The panel. Same measure as the text column, and centred on the
                hero's y axis — the same axis the oval is centred on — so the
                two read as a pair rather than as a column with something
                stuck beside it. */}
            <div className="mt-12 w-full max-w-[46ch] lg:mt-0 lg:max-w-[var(--hero-text-max)]">
              <ChatDemo />
            </div>
          </div>
        </section>

        {/* 01 the loop */}
        {/* What the Lab is, ahead of how it runs. The three paragraphs are
            the first site's own description, recovered from git; the two
            blocks under them are the member deal's strings, so this section
            and /#for-students cannot drift apart. */}
        <Section
          id="about"
          heading={copy.clubShort.heading}
          centered
          decoration={<AboutOrbs />}
        >
          {/* One card, on the hero's pattern: dark ground, the one site
              radius, `on-dark` so .kicker and the focus ring use the inverse
              neutral ramp, with Magistral at the hero strip's size.

              It was two cards until 2026-09-02. Combining them without
              flattening the two messages into one wall took three things: a
              sub-heading naming each half, a divider between them, and the
              deal's own two blocks demoted to kickers so the card has two
              levels rather than three. What the Lab is on the left, what
              membership is on the right, and neither borrows the other's
              weight. */}
          <div className="on-dark rounded-[var(--radius-image)] bg-ground-inverse p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-2 md:gap-12">
              <div>
                <h3 className="display text-xl text-ink-inverse">
                  {copy.clubShort.subheading}
                </h3>
                <div className="mt-4 space-y-5">
                  {copy.clubShort.paragraphs.map((para) => (
                    <p
                      key={para.slice(0, 24)}
                      className="font-magistral text-[15px] font-normal leading-[1.6] text-ink-inverse-soft md:text-[16px]"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>

              {/* The divider runs along the split, so it is a top rule while
                  the halves are stacked and a left rule once they are side by
                  side. */}
              <div className="border-t border-line-inverse pt-8 md:border-l md:border-t-0 md:pl-12 md:pt-0">
                <h3 className="display text-xl text-ink-inverse">
                  {copy.clubShort.dealSubheading}
                </h3>

                <p className="kicker mt-6">{S.getBlock.heading}</p>
                <p className="mt-2 font-magistral text-[15px] font-normal leading-[1.6] text-ink-inverse-soft md:text-[16px]">
                  {S.getBlock.body}
                </p>

                <p className="kicker mt-7">{S.asks.heading}</p>
                <p className="mt-2 font-magistral text-[15px] font-normal leading-[1.6] text-ink-inverse-soft md:text-[16px]">
                  {S.asks.body}
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* The four steps, hidden 2026-09-01. The pinned run, the aperture
            and the nodes are all intact; only the section is off. */}
        {SHOW_STEPS && (
          // Not a Section: this one's heading belongs inside the pinned
          // screen with the aperture and the nodes, so StageAperture owns the
          // whole thing, header included. No kicker and no number either, so
          // it opens on the four words themselves.
          <section id="how" className="scroll-mt-20">
          <StageAperture />
          {/* No bottom padding: the next section brings its own top padding,
              and stacking the two left a hole under the run. */}
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <p>
              <Link
                href="/handbook"
                className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
              >
                {copy.howItWorks.fullLink}
                <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
              </Link>
            </p>
          </div>
        </section>
        )}

        {/* The pipelines: the scroll-drawn journey from the handbook, with
            the two chapters it tracks. This is what "see how it runs" means,
            so the hero's second ask lands here. */}
        <Section
          id="pipelines"
          heading={handbook.pipelinesIntro.heading}
          intro={handbook.pipelinesIntro.lede}
        >
          <PipelineJourney>
            <div>
              <p className="kicker">{handbook.parallel.kicker}</p>
              <h3 className="display mt-3 text-2xl md:text-3xl">
                {handbook.parallel.heading}
              </h3>
              <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
                {handbook.parallel.lede}
              </p>
              <ol className="mt-8 space-y-4">
                {handbook.parallel.steps.map((step) => (
                  <li key={step.n} className="border border-line p-6">
                    <p className="font-mono text-sm text-brand-deep">{step.n}</p>
                    <p className="display mt-2 text-lg">{step.title}</p>
                    <p className="mt-3 leading-relaxed text-ink-soft">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-16">
              <p className="kicker">{handbook.integrated.kicker}</p>
              <h3 className="display mt-3 text-2xl md:text-3xl">
                {handbook.integrated.heading}
              </h3>
              <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">
                {handbook.integrated.lede}
              </p>
              <ol className="mt-8 space-y-3">
                {handbook.integrated.steps.map((step, i) => (
                  <li key={step.slice(0, 24)} className="flex gap-4 border border-line p-5">
                    <span className="font-mono text-sm text-brand-deep">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-relaxed text-ink-soft">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </PipelineJourney>
        </Section>

        {/* The capture form. The switch at its head is the "pick which one you
            are" ask: student, faculty, or organization, each with its own
            form, all on this page so nobody has to navigate to be counted. */}
        {/* No `intro`: the same copy.join.formIntro was rendering here and
            again inside JoinForm, so the section led with its own form's
            first paragraph. It belongs in the card, next to the fields it
            explains. */}
        <Section
          id="signup"
          heading={copy.join.formHeading}
          compact
          decoration={<SignupOrb />}
        >
          <AudienceSwitch formsLive={live} followupDays={settings.followup_days} />
        </Section>

        {/* Everything from the proof down is off for the launch page
            (2026-09-01). Kylar needs a short page tomorrow: hero, how it
            runs, the pipelines, and a capture form. Nothing is deleted, and
            nothing about these sections changed. Flip the flag back to true
            and the full landing returns exactly as it was. */}
        {SHOW_ALL_SECTIONS && (
          <>
          {/* 02 the proof */}
          <Section
            id="work"
            num={num()}
            kicker={copy.theWork.kicker}
            heading={copy.theWork.heading}
            intro={copy.theWork.intro}
            split
          >
            <ul className="divide-y divide-line border-y border-line">
              {strip.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-2 py-6">
                  <h3 className="display text-2xl">{entry.title}</h3>
                  {entry.running && (
                    <span className="inline-flex items-center gap-1.5 border border-green bg-ok-wash px-2.5 py-0.5 font-mono text-xs text-green-deep">
                      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-green-deep" />
                      {copy.work.runningLabel}
                    </span>
                  )}
                  <p className="w-full leading-relaxed text-ink-soft">{entry.does}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-prose text-sm text-ink-faint">{copy.theWork.recordNote}</p>
            <p className="mt-8">
              <Link
                href="/work"
                className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
              >
                {copy.theWork.cta}
                <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
              </Link>
            </p>
          </Section>

          {/* 03 the member deal */}
          <Section id={S.id} num={num()} kicker={S.label} heading={S.heading} intro={S.definition}>
            <ol className="grid gap-6 md:grid-cols-2">
              {S.doBlock.items.map((item, i) => (
                <li key={item.title} className="border border-line bg-ground-raised p-6">
                  <p className="font-mono text-sm text-brand-deep">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="display mt-2 text-xl">{item.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{item.body}</p>
                </li>
              ))}
            </ol>

            <BlockHeading text={S.ladderHeading} />
            <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{S.ladderLede}</p>
            <ol className="mt-6 space-y-4">
              {handbook.ladder.rungs.map((r) => (
                <li key={r.level} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-2 border-line pl-5">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                    {r.level}
                  </span>
                  <StatusBadge status={r.status} />
                  <p className="w-full max-w-prose leading-relaxed">
                    <span className="font-medium">{r.requirement}</span>{" "}
                    <span className="text-ink-soft">{r.body}</span>
                  </p>
                </li>
              ))}
            </ol>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-faint">
              {copy.statusKey.items.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>

            <BlockHeading text={S.getBlock.heading} />
            <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{S.getBlock.body}</p>
            <BlockHeading text={S.asks.heading} />
            <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{S.asks.body}</p>
            <Protections items={S.protections} />
            <AskPill label={S.ask.label} href={S.ask.href} />
          </Section>

          {/* 04 the representative deal: the band, the trio's center */}
          <Section id={F.id} num={num()} kicker={F.label} heading={F.heading} intro={F.definition} band>
            <p className="max-w-prose leading-relaxed text-ink-soft">{F.doBlock.intro}</p>
            <ol className="mt-6 grid gap-6 lg:grid-cols-3">
              {F.doBlock.items.map((item, i) => (
                <li key={item.title} className="border border-line bg-ground p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-mono text-sm text-brand-deep">{String(i + 1).padStart(2, "0")}</p>
                    {"planned" in item && item.planned && <StatusBadge status="planned" />}
                  </div>
                  <h3 className="display mt-2 text-xl">{item.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{item.body}</p>
                </li>
              ))}
            </ol>

            <BlockHeading text={F.rubricHeading} />
            <dl className="mt-4 max-w-prose space-y-3 border-l-2 border-brand pl-5">
              {CASE_RUBRIC.map((c) => (
                <div key={c.criterion}>
                  <dt className="font-medium">{c.criterion}</dt>
                  <dd className="text-[0.9375rem] leading-relaxed text-ink-soft">{c.body}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 max-w-2xl border border-brand bg-ground p-6">
              <h3 className="display text-xl">{F.numbers.heading}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{F.numbers.body}</p>
              <p className="mt-4">
                {F.numbers.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                  >
                    {l.label}
                    <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                  </Link>
                ))}
              </p>
            </div>

            <BlockHeading text={F.getBlock.heading} />
            <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{F.getBlock.body}</p>
            <Protections items={F.protections} />
            <AskPill label={F.ask.label} href={F.ask.href} />
          </Section>

          {/* 05 the partner deal, in owner order */}
          <Section id={P.id} num={num()} kicker={P.label} heading={P.heading} intro={P.definition}>
            <p className="max-w-prose font-mono text-sm text-ink-faint">{P.heroNote}</p>

            <BlockHeading text={P.give.heading} />
            <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{P.give.body}</p>
            <div className="mt-8">
              <PartnerSteps />
            </div>
            <p className="mt-6 max-w-prose leading-relaxed text-ink-soft">{P.give.timeLine}</p>

            <BlockHeading text={P.info.heading} />
            <ul className="mt-4 max-w-prose space-y-3 border-l-2 border-brand pl-5">
              {P.info.lines.map((line) => (
                <li key={line.slice(0, 24)} className="leading-relaxed text-ink-soft">
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div>
                <h3 className="display text-xl">{P.getBlock.heading}</h3>
                <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">{P.getBlock.body}</p>
                <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">{P.getBlock.ownLine}</p>
                <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
                  {P.getBlock.agreementLine}
                </p>
                <AskPill label={P.ask.label} href={P.ask.href} />
              </div>
              <CaseChecker />
            </div>
          </Section>

          {/* 06 this semester */}
          <Section
            id="fall"
            num={num()}
            kicker={copy.thisFall.kicker}
            heading={copy.thisFall.heading}
            intro={copy.thisFall.intro}
          >
            <SemesterTimeline now={requestNow()} />
            <div className="mt-12 max-w-2xl">
              <div className="border border-line bg-ground-raised p-6">
                <h3 className="display text-xl">{copy.thisFall.joinHeading}</h3>
                <p className="mt-4 leading-relaxed text-ink-soft">{copy.thisFall.joinBody}</p>
                <p className="mt-4 text-sm text-ink-faint">{copy.thisFall.joinFacts}</p>
                <p className="mt-2 text-sm text-ink-faint">{copy.thisFall.fundedLine}</p>
                <p className="mt-4">
                  <Link
                    href="/join"
                    className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
                  >
                    {copy.thisFall.joinCta}
                    <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
                  </Link>
                </p>
              </div>
            </div>
          </Section>

          {/* 07 the close: purpose, vision, people */}
          <Section
            id="purpose"
            num={num()}
            kicker={copy.close.kicker}
            heading={copy.close.peopleHeading}
            split
          >
            <h3 className="display max-w-3xl text-[1.75rem] leading-tight md:text-[2.25rem]">
              {copy.close.statement.split(/(?<=,) /).map((line, i) => (
                <span key={line} className={STAIR_STEPS[i] ?? "block"}>
                  {line}
                </span>
              ))}
            </h3>
            <p className="mt-6 max-w-prose leading-relaxed text-ink-soft">{copy.close.belonging}</p>
            <p className="mt-8 max-w-prose border-l-2 border-brand pl-5 font-serif text-xl leading-snug">
              {copy.close.vision}
            </p>
            <ul className="mt-10 space-y-2">
              {copy.close.people.map((p) => (
                <li key={p.name} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-ink-soft">{p.role}</span>
                  <span className="text-sm text-ink-faint">{p.detail}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-prose text-sm text-ink-faint">{copy.close.officersNote}</p>
            <p className="mt-8 max-w-prose leading-relaxed text-ink-soft">{copy.close.horizon}</p>
            <p className="mt-8">
              <Link
                href={copy.close.whyCta.href}
                className="inline-flex items-center gap-1.5 font-medium text-brand-deep underline-offset-4 hover:underline"
              >
                {copy.close.whyCta.label}
                <ArrowRight aria-hidden className="link-arrow size-4 shrink-0" />
              </Link>
            </p>
          </Section>
          </>
        )}

      </main>
      <SiteFooter />
    </>
  );
}
