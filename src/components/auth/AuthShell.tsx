// The frame every account page shares: the wordmark home, then one narrow
// column centred on a white page. Deliberately not the site header. Someone
// on a log in form has one job, and the nav's links and buttons would only
// be ways out of it.

import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/content/copy";
import { AsteriskMark } from "@/components/AsteriskMark";

export function AuthShell({
  heading,
  body,
  children,
  footer,
}: {
  heading: string;
  body?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell flex min-h-screen flex-col bg-ground">
      <header className="flex h-[var(--site-header-height)] items-center px-edge">
        <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-ui">
          <AsteriskMark size={15} className="shrink-0 text-brand-deep" />
          <span className="text-[1rem] font-semibold tracking-[-0.022em] text-ink">
            {copy.nav.wordmark}
          </span>
        </Link>
      </header>

      <main
        id="main"
        className="flex flex-1 justify-center px-5 pb-20 pt-10 md:items-center md:pb-28 md:pt-0"
      >
        <div className="w-full max-w-[400px]">
          <h1 className="display text-[2rem] leading-tight text-ink">{heading}</h1>
          {body && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-ink-soft">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-ink-faint">
      <span aria-hidden className="h-px flex-1 bg-line" />
      {copy.auth.divider}
      <span aria-hidden className="h-px flex-1 bg-line" />
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
      className="rounded-[var(--radius-control)] border border-error/25 bg-error-wash px-3.5 py-2.5 text-sm leading-snug text-error"
    >
      {message}
    </p>
  );
}

// Link styling for the small switches under each form.
export const authLink =
  "font-medium text-brand-deep underline-offset-4 hover:underline";
