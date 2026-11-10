"use client";

// The site's fallback if a page throws while rendering: a short note, Try
// again (which renders the page afresh) and the way home, in place of a
// blank page. The error goes to the Lab as an alert (src/lib/report-error.ts).
// Projectum has its own (projectum/error.tsx).

import Link from "next/link";
import { useEffect } from "react";
import { copy } from "@/content/copy";
import { reportError } from "@/lib/report-error";
import { MessagePage, onward } from "@/components/home/MessagePage";

const C = copy.siteError;

export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportError(error, "Site page crashed"), [error]);
  return (
    <MessagePage title={C.title} body={C.body}>
      <button type="button" className={onward} onClick={() => retry()}>
        ↳ {C.retry}
      </button>
      <Link href="/" className={onward}>
        ↳ {C.home}
      </Link>
    </MessagePage>
  );
}
