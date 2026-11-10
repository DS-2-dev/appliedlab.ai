"use client";

// Projectum's fallback if a view throws while rendering: a short note, Try
// again (which renders the view afresh) and Reload, in place of a blank
// page, in the site's frame (MessagePage). The error goes to the Lab as an
// alert (src/lib/report-error.ts).

import { useEffect } from "react";
import { copy } from "@/content/copy";
import { reportError } from "@/lib/report-error";
import { MessagePage, onward } from "@/components/home/MessagePage";

const C = copy.projectum.crash;

export default function ProjectumError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportError(error, "Projectum view crashed"), [error]);
  return (
    <MessagePage title={C.title} body={C.body}>
      <button type="button" className={onward} onClick={() => retry()}>
        ↳ {C.retry}
      </button>
      <button type="button" className={onward} onClick={() => window.location.reload()}>
        ↳ {C.reload}
      </button>
    </MessagePage>
  );
}
