// The frame every account page shares: the site's frame (SiteFrame) without
// its two links, since someone on a log in form has one job. The heading
// and its note sit in a column at the left, as a tile's page has them, and
// the form takes the right half. One column on a phone.

import type { ReactNode } from "react";
import { copy } from "@/content/copy";
import { INK, SiteFrame, at } from "@/components/home/SiteFrame";

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
    <SiteFrame links={false}>
      <div className="grid gap-x-5 gap-y-10 pt-[clamp(60px,calc(100svh-640px),180px)] pb-24 min-[810px]:grid-cols-2">
        <div className="home-rise max-w-[400px]" style={at(1)}>
          <h1 className={INK}>{heading}</h1>
          {body && <p className="mt-2 text-sm/[17px] font-medium text-[#737378]">{body}</p>}
        </div>
        <div className="home-rise w-full max-w-[400px]" style={at(2)}>
          {children}
          {footer && <p className="mt-8 text-sm/[17px] font-medium text-[#737378]">{footer}</p>}
        </div>
      </div>
    </SiteFrame>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs/[14px] font-semibold text-[#9a9aa1]">
      <span aria-hidden className="h-px flex-1 bg-[#e4e4e4]" />
      {copy.auth.divider}
      <span aria-hidden className="h-px flex-1 bg-[#e4e4e4]" />
    </div>
  );
}

// A form-level message: bad credentials, a stale link, too many attempts.
// role="alert" so a screen reader announces it when it appears after submit.
export function AuthAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-[#f4f4f4] px-4 py-3 text-sm/[17px] font-medium text-[#1f1f1f]">
      {message}
    </p>
  );
}

// The small switches under each form, coloured like the site's links.
export const authLink = "font-semibold text-[#1f1f1f] transition-colors hover:text-[#737378]";

// The buttons every account form uses, and the outlined look for the
// ones that aren't the form's main action.
export const authButton =
  "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed";
export const authSecondary = "border border-[#e4e4e4] bg-white text-[#1f1f1f] hover:bg-[#f4f4f4]";
