"use client";

// Projectum's fallback if a view throws while rendering: a short note, Try
// again (which renders the view afresh) and Reload, in place of a blank
// page. The error goes to the Lab as an alert (src/lib/report-error.ts).

import { useEffect } from "react";
import { copy } from "@/content/copy";
import { reportError } from "@/lib/report-error";
import { Button } from "@/components/ui/button";

const C = copy.projectum.crash;

export default function ProjectumError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportError(error, "Projectum view crashed"), [error]);
  return (
    <main className="projectum-ui grid min-h-svh place-items-center p-6">
      <div className="grid max-w-md gap-3 text-center">
        <h1 className="text-xl font-medium">{C.title}</h1>
        <p className="text-muted-foreground">{C.body}</p>
        <div className="mt-2 flex justify-center gap-2">
          <Button onClick={() => retry()}>{C.retry}</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {C.reload}
          </Button>
        </div>
      </div>
    </main>
  );
}
