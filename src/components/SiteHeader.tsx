"use client";

/*
  The site header, in three shapes that morph into each other. One glass
  shell springs between their real widths and heights (never a scale, which
  would stretch the text), and each shape's content sits at a fixed size
  inside it and crossfades:

  - At the top of the page, the full bar after openwebui.com's: the Lab's
    name at the left, the links and the round Log in and Sign up at the
    right, on a see-through ground.
  - The moment the page scrolls, a frosted glass pill in the top centre,
    shaped like the iPhone's Dynamic Island: the logo (the star, standing in
    until the logo exists), three links and a menu button.
  - The menu button opens the pill into a rounded glass panel with every link and
    the account buttons. The pill and the panel are one piece: its top row
    (the logo and the menu button, whose two lines turn into an X) rides the
    shell's edges as it grows, the short links give way to the
    Lab's name, and the rest opens underneath. A link, Escape, a click
    outside, or scrolling back to the top closes it.

  The links follow the advisory board deck's sections. On the static GitHub
  Pages build there are no accounts, so Log in becomes the Projectum demo
  and Sign up is left out.
*/

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { copy } from "@/content/copy";
import { JOIN_HREF, LOGIN_HREF, LOGIN_LABEL, SHOW_SIGNUP } from "@/lib/site";

// The links are How it works' steps, so the two lists cannot drift.
const NAV = copy.how.steps.map((s) => ({ id: s.id, label: s.label, href: `/#${s.id}` }));
// The pill's short list.
const PILL_IDS = ["about", "pipeline", "partners"];
const PILL_LINKS = NAV.filter((item) => PILL_IDS.includes(item.id));

// Log in and Sign up, in the bar's size or the open panel's.
function AccountLinks({ size, onClick }: { size: "bar" | "panel"; onClick?: () => void }) {
  const shape = size === "bar" ? "h-8 shrink-0 px-3.5 whitespace-nowrap" : "h-10 flex-1 justify-center";
  return (
    <>
      <Link
        href={LOGIN_HREF}
        onClick={onClick}
        className={`flex items-center rounded-full bg-black/5 text-sm transition hover:bg-black/10 ${shape} ${
          size === "bar" ? "text-gray-700 hover:text-gray-900 md:ml-2" : ""
        }`}
      >
        {LOGIN_LABEL}
      </Link>
      {SHOW_SIGNUP && (
        <Link
          href={JOIN_HREF}
          onClick={onClick}
          className={`flex items-center rounded-full bg-black text-sm text-white transition hover:bg-black/80 ${shape}`}
        >
          {copy.nav.signup}
        </Link>
      )}
    </>
  );
}

// Width and height spring without overshoot, so the glass never wobbles.
const SPRING = { type: "spring", stiffness: 420, damping: 42, mass: 0.9 } as const;
const TWEEN = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;
const ROW = 44; // the island's top row, and the closed pill's height
const BAR = 60; // the full bar's height
const EDGE = 6; // the island's inner padding
const BUTTON = 32;

// Crossfade with a light blur, for content that swaps in place.
const swap = (on: boolean, delay = 0) => ({
  opacity: on ? 1 : 0,
  filter: on ? "blur(0px)" : "blur(4px)",
  transition: { duration: on ? 0.22 : 0.12, delay: on ? delay : 0 },
});

// The menu button's icon: two lines that turn into an X.
function MenuIcon({ open }: { open: boolean }) {
  const line = "absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]";
  return (
    <span aria-hidden className="relative grid size-4 place-items-center">
      <span className={line} style={{ transform: open ? "translateY(0) rotate(45deg)" : "translateY(-3px) rotate(0deg)" }} />
      <span className={line} style={{ transform: open ? "translateY(0) rotate(-45deg)" : "translateY(3px) rotate(0deg)" }} />
    </span>
  );
}

// The star as the logo until the logo exists.
function LogoMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing
  return <img src="/star.svg" alt="" aria-hidden className={className} />;
}

// Glass: a white tint over a blur of whatever scrolls beneath, with a thin
// light edge. The blur is animated with the tint, so the bar does not snap
// to frosted.
const GLASS_EDGE =
  "border border-white/60 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-black/5"

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ vw: 0, links: 0, body: 0 });
  const shell = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only a change of state reaches React, not every scroll event.
    let last: boolean | null = null;
    const onScroll = () => {
      const s = window.scrollY > 0;
      if (s === last) return;
      last = s;
      setScrolled(s);
      if (!s) setOpen(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The shell animates real widths and heights (a scale would stretch the
  // text), so it measures the page, the pill's links and the panel's body.
  useLayoutEffect(() => {
    const measure = () =>
      setSize((prev) => {
        const next = {
          vw: document.documentElement.clientWidth,
          links: linksRef.current?.offsetWidth ?? 0,
          body: bodyRef.current?.offsetHeight ?? 0,
        };
        return next.vw === prev.vw && next.links === prev.links && next.body === prev.body ? prev : next;
      });
    measure();
    const ro = new ResizeObserver(measure);
    if (linksRef.current) ro.observe(linksRef.current);
    if (bodyRef.current) ro.observe(bodyRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (shell.current && !shell.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const shape = !scrolled ? "bar" : open ? "panel" : "pill";
  const close = () => setOpen(false);
  const island = shape !== "bar";

  const { vw } = size;
  const panelW = Math.min(352, vw - 32);
  // The pill hugs its links; on phones, where they hide, it keeps the
  // island's own width.
  const pillW = Math.max(126, EDGE * 2 + BUTTON * 2 + 8 + size.links);
  const width = shape === "bar" ? vw || "100%" : shape === "pill" ? pillW : panelW;
  const height = shape === "bar" ? BAR : shape === "pill" ? ROW : ROW + size.body;

  return (
    <MotionConfig reducedMotion="user">
      <header className="font-archivo pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
        <motion.div
          ref={shell}
          initial={false}
          animate={{
            width,
            height,
            marginTop: island ? 12 : 0,
            borderRadius: island ? ROW / 2 : 0,
            backgroundColor: island ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0)",
            backdropFilter: island ? "blur(20px) saturate(180%)" : "blur(0px) saturate(100%)",
            transition: { default: SPRING, backgroundColor: TWEEN, backdropFilter: TWEEN, borderRadius: TWEEN },
          }}
          className={`pointer-events-auto relative overflow-hidden border text-ink ${
            island ? GLASS_EDGE : "border-transparent"
          }`}
        >
          {/* The full bar, the page's width, centred so it clips evenly as
              the shell narrows. */}
          <motion.div
            initial={false}
            animate={swap(!island, 0.08)}
            inert={island}
            style={{ width: vw || "100%" }}
            className="absolute top-0 left-1/2 flex h-[60px] -translate-x-1/2 items-center gap-2 px-4.5"
          >
            <Link href="/" className="flex h-8 shrink-0 items-center text-[15px] font-medium tracking-tight">
              {copy.nav.wordmark}
            </Link>
            <div className="min-w-0 flex-1" />
            <nav aria-label="Site" className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hidden self-center rounded-full px-2.5 py-0.5 text-sm whitespace-nowrap text-gray-600 transition hover:text-gray-900 md:flex"
                >
                  {item.label}
                </Link>
              ))}
              <AccountLinks size="bar" />
            </nav>
          </motion.div>

          {/* The island's top row: the logo rides the left edge and the menu
              button the right, while the short links give way to the name. */}
          <motion.div
            initial={false}
            animate={swap(island, 0.1)}
            inert={!island}
            className="absolute inset-x-0 top-0 flex items-center justify-between"
            style={{ height: ROW, paddingInline: EDGE }}
          >
            <Link
              href="/"
              onClick={close}
              aria-label={copy.nav.wordmark}
              className="grid size-8 shrink-0 place-items-center rounded-full"
            >
              <LogoMark className="w-5" />
            </Link>
            <div className="relative h-full min-w-0 flex-1">
              <motion.nav
                ref={linksRef}
                aria-label="Site"
                initial={false}
                animate={swap(!open, 0.12)}
                inert={open}
                className="absolute top-1/2 left-1/2 hidden w-max -translate-x-1/2 -translate-y-1/2 items-center sm:flex"
              >
                {PILL_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-3 py-1 text-[13px] whitespace-nowrap text-black/65 transition hover:bg-black/5 hover:text-black"
                  >
                    {item.label}
                  </Link>
                ))}
              </motion.nav>
              <motion.span
                aria-hidden={!open}
                initial={false}
                animate={swap(open, 0.1)}
                className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-sm whitespace-nowrap"
              >
                {copy.nav.wordmark}
              </motion.span>
            </div>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-black/70 transition-colors hover:bg-black/5 hover:text-black"
            >
              <MenuIcon open={open} />
            </button>
          </motion.div>

          {/* The rest of the panel, laid out at the panel's width and uncovered
              as the shell grows. */}
          <motion.div
            ref={bodyRef}
            initial={false}
            animate={{
              opacity: open ? 1 : 0,
              y: open ? 0 : -8,
              transition: open ? { duration: 0.28, delay: 0.06, ease: [0.4, 0, 0.2, 1] } : { duration: 0.12 },
            }}
            inert={!open}
            className="absolute left-0 flex flex-col"
            style={{ top: ROW, width: panelW > 0 ? panelW : undefined, padding: `0 ${EDGE}px ${EDGE}px` }}
          >
            <nav aria-label="Site" className="flex flex-col pt-1">
              {NAV.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={false}
                  animate={{
                    opacity: open ? 1 : 0,
                    y: open ? 0 : 6,
                    transition: open ? { delay: 0.1 + i * 0.035, duration: 0.24 } : { duration: 0.1 },
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block rounded-xl px-3 py-2.5 text-[15px] text-black/75 transition hover:bg-black/5 hover:text-black"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="mt-2 flex gap-2">
              <AccountLinks size="panel" onClick={close} />
            </div>
          </motion.div>
        </motion.div>
      </header>
    </MotionConfig>
  );
}
