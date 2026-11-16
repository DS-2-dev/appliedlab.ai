"use client";

// The platform moved to Arch (appliedlab.ai/arch, 2026-11-16). The old addresses on this static site forward there, so
// links in emails, bookmarks and flyers still land in the right place.

import { useEffect } from "react";

export function ForwardTo({ href }: { href: string }) {
  useEffect(() => { window.location.replace(href); }, [href]);
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p>
        Taking you to <a className="underline" href={href}>Arch</a>…
      </p>
    </main>
  );
}
