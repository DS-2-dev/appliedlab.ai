// The frame every account page shares, in the landing's look: the star and
// the Lab's name at the top left, then one narrow centred column with the
// star over a light heading, like the ChatGPT and Claude sign-in screens.
// Deliberately not the site header. Someone on a log in form has one job,
// and the nav's links and buttons would only be ways out of it.

import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/content/copy";

function Star({ className }: { className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimizing
  return <img src="/star.svg" alt="" aria-hidden className={className} />;
}

export function AuthShell({
  heading,
  body,
  children,
  footer,
  wide,
}: {
  heading: string;
  wide?: boolean;
  body?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="font-archivo flex min-h-svh flex-col bg-white text-ink">
      <header className="flex h-16 items-center px-5 lg:px-15">
        <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap">
          <Star className="w-5" />
          <span className="text-[15px] font-medium tracking-tight">{copy.nav.wordmark}</span>
        </Link>
      </header>

      <main id="main" className="flex flex-1 justify-center px-5 pt-8 pb-20 md:items-center md:pt-0 md:pb-28">
        <div className={`w-full ${wide ? "max-w-[440px]" : "max-w-[380px]"} animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none`}>
          <Star className="mx-auto w-14" />
          <h1 className="mt-6 text-center text-3xl font-light tracking-tight text-balance">{heading}</h1>
          {body && <p className="mt-3 text-center text-[15px] leading-relaxed font-light text-black/55">{body}</p>}
          <div className="mt-9">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-black/55">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="kicker my-6 flex items-center gap-4 text-black/35">
      <span aria-hidden className="h-px flex-1 bg-black/10" />
      {copy.auth.divider}
      <span aria-hidden className="h-px flex-1 bg-black/10" />
    </div>
  );
}

// A form-level message: bad credentials, a stale link, too many attempts.
// role="alert" so a screen reader announces it when it appears after submit.
export function AuthAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl bg-black/[0.04] px-4 py-3 text-center text-sm leading-snug text-black/75 animate-in fade-in-0 duration-300"
    >
      {message}
    </p>
  );
}

// On the static site, where accounts are not open, the way into Projectum.
export function DemoLink() {
  return (
    <p className="mt-5 text-center text-sm">
      <Link href="/projectum" className={authLink}>
        {copy.auth.staticDemo}
      </Link>
    </p>
  );
}

// Link styling for the small switches under each form.
export const authLink =
  "font-medium text-ink underline decoration-black/20 underline-offset-4 transition hover:decoration-black";

// The round buttons every account form uses.
export const authButton =
  "flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full text-[15px] transition disabled:cursor-not-allowed";
