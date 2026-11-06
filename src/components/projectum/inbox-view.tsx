"use client";

// The inbox (?view=inbox): everything in the signed-in person's court from
// GET /court, then the notifications the shell already polls, with Mark all
// read (the same call the bell makes).

import * as React from "react";
import Link from "next/link";
import { copy } from "@/content/copy";
import type { CourtItem } from "@/lib/pipeline/court";
import { CourtList } from "@/components/projectum/court-list";
import { notificationDot } from "@/components/projectum/court-helpers";
import { LoadError, Loading, ViewFrame, formatDate } from "@/components/projectum/pipeline-ui";
import { useApi } from "@/components/projectum/pipeline-store";
import { markRead, useShell } from "@/components/projectum/shell-store";
import { Button } from "@/components/ui/button";

const I = copy.projectum.pipeline.inbox;
const N = copy.projectum.notifications;

export function InboxView() {
  const { data, error, retry } = useApi<{ items: CourtItem[] }>("/court");
  const shell = useShell();
  const [failed, setFailed] = React.useState(false);

  const markAll = () => {
    setFailed(false);
    markRead("all").catch(() => setFailed(true));
  };

  return (
    <ViewFrame title={I.title} description={I.description}>
      {error && !data ? <LoadError retry={retry} /> : !data ? <Loading /> : <CourtList items={data.items} />}
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{I.notifications}</h2>
          {shell.unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAll}>
              {N.markAll}
            </Button>
          )}
        </div>
        {failed && (
          <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
            {I.failed}
          </p>
        )}
        {shell.notifications.length ? (
          <ul className="grid gap-2">
            {shell.notifications.map((n) => {
              const dot = notificationDot(n);
              return (
                <li key={n.id} data-notification={n.read ? "read" : "unread"} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <span
                    aria-hidden
                    className={`size-2 shrink-0 rounded-full ${dot === "court" ? "bg-primary" : dot ? "bg-muted-foreground/50" : ""}`}
                  />
                  <Link
                    href={n.href || "/projectum"}
                    onClick={() => !n.read && void markRead([n.id]).catch(() => {})}
                    className={`min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline ${n.read ? "text-muted-foreground" : "font-medium"}`}
                  >
                    {n.title}
                  </Link>
                  {dot === "court" && <span className="text-xs font-medium">{N.yourMove}</span>}
                  <span className="text-sm text-muted-foreground tabular-nums">{formatDate(n.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{I.notificationsEmpty}</p>
        )}
      </section>
    </ViewFrame>
  );
}
