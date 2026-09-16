/*
  A quiet endcap. The old four-column directory duplicated the nav and buried
  the one useful action: email us.
*/

import { ArrowUpRight } from "lucide-react";
import { copy } from "@/content/copy";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto w-full border-t border-line bg-ground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-end sm:justify-between md:px-8 md:py-11">
        <div>
          <p className="kicker">{copy.nav.wordmark}</p>
          <a
            href={`mailto:${copy.footer.email}`}
            className="display mt-2 inline-flex items-center gap-2 text-[1.75rem] text-ink underline-offset-4 hover:underline md:text-[2.25rem]"
          >
            {copy.footer.email}
            <ArrowUpRight aria-hidden className="link-arrow -mt-1 size-5 shrink-0" />
          </a>
        </div>

        <div className="flex items-center gap-4 text-sm text-ink-faint sm:pb-1">
          <span>{copy.footer.orgLine}</span>
        </div>
      </div>
    </footer>
  );
}
