"use client";

/*
  Header: 52px / 56px at md, matching cursor.com's bar. Solid white, flush to all three edges, no bottom border.
  Wordmark hard left, nav absolutely centred in the bar, Log in / Sign up on
  the right. `sticky` rather than `fixed` — the landing hero starts below the
  bar rather than running under it, and the other four pages that render this
  nav keep their flow.

  The client half of the header. SiteNav.tsx, the server half, reads the
  session and passes `signedIn`, which swaps Log in and Sign up for a single
  Dashboard button.
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { AsteriskMark } from "@/components/AsteriskMark";
import { ScrambleText } from "@/components/ui/ScrambleText";
import { logoutAction } from "@/lib/auth-actions";

// The five landing-anchor links are off for the launch page (2026-09-01):
// one short page, so there is nowhere for them to go. The header carries
// copy.nav.launchItems instead, and those three open the construction notice
// rather than navigating, because the pages behind them are not ready to be
// read. The original markup is all intact behind this flag.
const SHOW_NAV_LINKS = false;
const LINKS = copy.nav.launchItems;

// The GitHub Pages build has no accounts, so there is nothing to log in to.
// The header offers Projectum's demo in place of Log in.
const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

// Sizes and the face come from .btn/.btn-sm (globals.css, cursor.com's
// dimensions); these only carry colour. The `font-sans` override that used to
// sit here is gone: .btn takes the body face itself now, so every button on
// the site matches these two.
const BTN_SOLID = "btn btn-sm bg-brand-deep text-white hover:bg-brand";
const BTN_GHOST = "btn btn-sm border-line-strong text-ink hover:border-ink";

// The notice. A plain dialog: backdrop click, Escape, and focus moved onto
// the close button, which is the whole of what a box like this owes anyone.
function ConstructionNotice({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-edge"
      role="dialog"
      aria-modal="true"
      aria-labelledby="construction-heading"
    >
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-[26rem] rounded-[var(--radius-image)] border border-line bg-ground p-7 md:p-8">
        <h2 id="construction-heading" className="display text-[1.375rem] leading-tight">
          {copy.nav.construction.heading}
        </h2>
        <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink-soft">
          {copy.nav.construction.body}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${BTN_SOLID} mt-6`}
        >
          {copy.nav.construction.close}
        </button>
      </div>
    </div>
  );
}

export function SiteNavClient({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => href !== "/" && pathname.startsWith(href);

  return (
    <>
    {/* Glass rather than solid, dialled back on 2026-09-02. The bar only
        reads as a surface when something with colour passes under it, which
        on this page is the hero orb and the chat demo, and at 70% over a
        24px blur that pass was an event: the orb smeared into a visible
        band across the header. 85% and 8px keeps the effect present without
        announcing itself, and the saturate comes down with it so colour
        under the bar is not pushed either.

        supports-[] keeps the solid fill on anything without backdrop-filter,
        where a translucent bar would just be see-through. */}
    <header className="sticky top-0 z-50 bg-ground font-ui supports-[backdrop-filter]:bg-ground/85 supports-[backdrop-filter]:backdrop-blur-sm supports-[backdrop-filter]:backdrop-saturate-125">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ground"
      >
        {copy.nav.skipLink}
      </a>

      <div className="relative flex h-[var(--site-header-height)] items-center justify-between px-edge">
        <Link
          href="/"
          className="flex items-center gap-2 whitespace-nowrap"
          onClick={() => setOpen(false)}
        >
          <AsteriskMark size={15} className="shrink-0 text-brand-deep" />
          <span className="text-[1rem] font-semibold tracking-[-0.022em] text-ink">
            {copy.nav.wordmark}
          </span>
          <span className="hidden text-[0.9375rem] tracking-[-0.011em] text-ink-faint 2xl:inline">
            {copy.nav.wordmarkSuffix}
          </span>
        </Link>

        {/* Absolutely centred in the bar, so the nav sits dead centre of the
            page rather than drifting with the wordmark's width. */}
        {/* The three, centred. Buttons, not links: they open the notice, and
            a link that does not go anywhere is a lie about what it does. */}
        <nav
          aria-label="Site"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-x-9 lg:flex"
        >
          {LINKS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => setNotice(true)}
              className="cursor-pointer text-[15px] font-normal leading-[1.35] tracking-[-0.01em] text-ink-soft transition-colors hover:text-ink"
            >
              <ScrambleText text={item.label} />
            </button>
          ))}
        </nav>

        {SHOW_NAV_LINKS && (
        <nav
          aria-label="Site"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-x-9 lg:flex"
        >
          {copy.nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`text-[15px] leading-[1.35] tracking-[-0.01em] transition-colors hover:text-ink ${
                isActive(item.href) ? "font-medium text-ink" : "font-normal text-ink-soft"
              }`}
            >
              {/* Taste Labs' hover: the label flips through junk glyphs and
                  resolves back to itself, left to right. */}
              <ScrambleText text={item.label} />
            </a>
          ))}
        </nav>
        )}

        <div className="flex items-center gap-x-2.5">
          {/* Signed in, Log in becomes Log out and Sign up becomes the way
              back to /projectum. Log out lives here because /projectum carries
              nothing but its placeholder. */}
          {signedIn ? (
            <>
              <form action={logoutAction} className="hidden lg:block">
                <button type="submit" className={BTN_GHOST}>
                  {copy.nav.logout}
                </button>
              </form>
              <Link
                href={copy.nav.dashboardHref}
                className={`${BTN_SOLID} hidden lg:inline-flex`}
              >
                {copy.nav.dashboard}
              </Link>
            </>
          ) : (
            <>
              <Link
                href={STATIC_SITE ? copy.nav.dashboardHref : copy.nav.loginHref}
                className={`${BTN_GHOST} hidden lg:inline-flex`}
              >
                {STATIC_SITE ? copy.nav.demo : copy.nav.login}
              </Link>
              <Link
                href={copy.nav.ctaHref}
                className={`${BTN_SOLID} hidden lg:inline-flex`}
              >
                {copy.nav.cta}
              </Link>
            </>
          )}

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href={signedIn ? copy.nav.dashboardHref : copy.nav.ctaHref}
              className={BTN_SOLID}
              onClick={() => setOpen(false)}
            >
              {signedIn ? copy.nav.dashboard : copy.nav.cta}
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="flex size-8 items-center justify-center"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none">
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Site"
          className="flex flex-col border-t border-line bg-ground px-edge pb-5 pt-2 lg:hidden"
        >
          {LINKS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                setOpen(false);
                setNotice(true);
              }}
              className="cursor-pointer border-b border-line py-3 text-left text-[0.9375rem] tracking-[-0.011em] text-ink-soft"
            >
              {item.label}
            </button>
          ))}
          {signedIn ? (
            <form action={logoutAction} className="mt-4 self-start">
              <button type="submit" className={BTN_GHOST}>
                {copy.nav.logout}
              </button>
            </form>
          ) : (
            <Link
              href={STATIC_SITE ? copy.nav.dashboardHref : copy.nav.loginHref}
              className={`${BTN_GHOST} mt-4 self-start`}
              onClick={() => setOpen(false)}
            >
              {STATIC_SITE ? copy.nav.demo : copy.nav.login}
            </Link>
          )}
        </nav>
      )}

      {SHOW_NAV_LINKS && open && (
        <nav
          id="mobile-nav"
          aria-label="Site"
          className="flex flex-col border-t border-line bg-ground px-edge pb-5 pt-2 lg:hidden"
        >
          {copy.nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`border-b border-line py-3 text-[0.9375rem] tracking-[-0.011em] ${
                isActive(item.href) ? "font-medium text-ink" : "text-ink-soft"
              }`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          {signedIn ? (
            <form action={logoutAction} className="mt-4 self-start">
              <button type="submit" className={BTN_GHOST}>
                {copy.nav.logout}
              </button>
            </form>
          ) : (
            <Link
              href={STATIC_SITE ? copy.nav.dashboardHref : copy.nav.loginHref}
              className={`${BTN_GHOST} mt-4 self-start`}
              onClick={() => setOpen(false)}
            >
              {STATIC_SITE ? copy.nav.demo : copy.nav.login}
            </Link>
          )}
        </nav>
      )}
    </header>

    {/* Outside the header on purpose. The bar carries backdrop-filter for its
        glass, and a filter (backdrop-filter included) makes an element the
        containing block for any fixed descendant, so the notice's
        `fixed inset-0` was resolving against the 52px bar rather than the
        viewport and landing in the top-left corner. As a sibling it has no
        filtered ancestor and covers the screen again. */}
    {notice && <ConstructionNotice onClose={() => setNotice(false)} />}
    </>
  );
}
