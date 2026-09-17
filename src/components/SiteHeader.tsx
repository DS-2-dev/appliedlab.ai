"use client";

/*
  The site header, in three shapes that morph into each other (one element,
  animated with framer-motion's layout):

  - At the top of the page, the full bar after openwebui.com's: the Lab's
    name at the left, the links and the round Log in and Sign up at the
    right, on a see-through ground.
  - The moment the page scrolls, a frosted glass pill in the top centre,
    shaped like the iPhone's Dynamic Island: the logo (the star, standing in
    until the logo exists), three links and a menu button.
  - The menu button opens the pill into a rounded glass panel with every link and
    the account buttons. A link, Escape, a click outside, or scrolling back
    to the top closes it.

  The links follow the advisory board deck's sections. On the static GitHub
  Pages build there are no accounts, so Log in becomes the Projectum demo
  and Sign up is left out.
*/

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
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

const SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;
const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

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
  const shell = useRef<HTMLDivElement>(null);

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

  return (
    <MotionConfig reducedMotion="user">
      <header className="font-archivo pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
        <motion.div
          ref={shell}
          layout
          transition={SPRING}
          initial={false}
          animate={{
            backgroundColor: shape === "bar" ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.62)",
            backdropFilter: shape === "bar" ? "blur(0px) saturate(100%)" : "blur(20px) saturate(180%)",
            borderRadius: shape === "bar" ? 0 : shape === "pill" ? 22 : 28,
            marginTop: shape === "bar" ? 0 : 12,
          }}
          className={`pointer-events-auto overflow-hidden text-[#1a1a1a] ${
            shape === "bar"
              ? "w-full border border-transparent px-4.5 py-3.5"
              : shape === "pill"
                ? `h-11 px-2 ${GLASS_EDGE}`
                : `w-[min(22rem,calc(100vw-2rem))] p-3 ${GLASS_EDGE}`
          }`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {shape === "bar" && (
              <motion.div key="bar" layout="position" {...FADE} className="flex items-center gap-2">
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
            )}

            {shape === "pill" && (
              <motion.div key="pill" layout="position" {...FADE} className="flex h-full items-center gap-1">
                <Link href="/" aria-label={copy.nav.wordmark} className="grid size-8 place-items-center rounded-full">
                  <LogoMark className="w-5" />
                </Link>
                <nav aria-label="Site" className="hidden items-center sm:flex">
                  {PILL_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-full px-3 py-1 text-[13px] whitespace-nowrap text-black/65 transition hover:bg-black/5 hover:text-black"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <button
                  type="button"
                  aria-label="Open menu"
                  aria-expanded={false}
                  onClick={() => setOpen(true)}
                  className="grid size-8 place-items-center rounded-full text-black/70 transition hover:bg-black/5 hover:text-black"
                >
                  <Menu className="size-4" strokeWidth={1.75} />
                </button>
              </motion.div>
            )}

            {shape === "panel" && (
              <motion.div key="panel" layout="position" {...FADE} transition={{ duration: 0.2, delay: 0.05 }}>
                <div className="flex items-center justify-between pb-2 pl-1">
                  <Link href="/" onClick={close} className="flex items-center gap-2 text-sm">
                    <LogoMark className="w-5" />
                    {copy.nav.wordmark}
                  </Link>
                  <button
                    type="button"
                    aria-label="Close menu"
                    aria-expanded
                    onClick={close}
                    className="grid size-8 place-items-center rounded-full text-black/70 transition hover:bg-black/5 hover:text-black"
                  >
                    <X className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
                <nav aria-label="Site" className="flex flex-col">
                  {NAV.map((item, i) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.03, duration: 0.2 }}
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
                <div className="mt-3 flex gap-2">
                  <AccountLinks size="panel" onClick={close} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </header>
    </MotionConfig>
  );
}
