"use client";

// "In your court" as fixed columns: title, details, status, since. Used as a
// strip on the postings views (action items only, a few, with a link to the
// inbox) and as the inbox's full list. A project or posting wears its
// machine's status pill; other items (a review, a request, a meeting) wear a
// plain word for where they stand.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/content/copy";
import type { CourtItem } from "@/lib/pipeline/court";
import { courtStrip } from "@/components/projectum/court-helpers";
import { useApi } from "@/components/projectum/pipeline-store";
import { Empty, formatDate } from "@/components/projectum/pipeline-ui";
import { StatusPill } from "@/components/projectum/status-pill";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const C = copy.projectum.pipeline.court;
const COLUMNS = "grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_9rem_7rem]";

function Pill({ item }: { item: CourtItem }) {
  if (item.kind === "project" || item.kind === "posting") return <StatusPill kind={item.kind} status={item.status} size="sm" />;
  return (
    <Badge variant="outline" className="justify-self-start">
      {C.words[item.status] ?? item.status}
    </Badge>
  );
}

export function CourtList({ items, limit }: { items: readonly CourtItem[]; limit?: number }) {
  const shown = limit === undefined ? items : items.slice(0, limit);
  if (!shown.length) return <Empty>{C.empty}</Empty>;
  return (
    <div className="grid gap-2" data-court-list="">
      <div aria-hidden className={cn("grid gap-4 px-4 text-xs font-medium text-muted-foreground", COLUMNS)}>
        <span>{C.columns.title}</span>
        <span>{C.columns.subtitle}</span>
        <span>{C.columns.status}</span>
        <span>{C.columns.since}</span>
      </div>
      <ul className="grid gap-2">
        {shown.map((item) => (
          <li key={`${item.kind}:${item.id}:${item.role}`} data-court-item={item.id} className="rounded-lg border px-4 py-3">
            <div className={cn("grid items-center gap-4", COLUMNS)}>
              <Link href={item.href} className="truncate font-medium underline-offset-4 hover:underline">
                {item.title}
              </Link>
              <span className="truncate text-sm text-muted-foreground">{item.subtitle}</span>
              <Pill item={item} />
              <span className="text-sm text-muted-foreground tabular-nums">{formatDate(item.since)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The few moves waiting on the person, at the top of the postings views,
// with a link to the inbox. Quiet while loading, on error, or with nothing
// to do, so it never pushes the page around for nothing.
export function CourtStrip() {
  const { data } = useApi<{ items: CourtItem[] }>("/court");
  const { shown, more } = courtStrip(data?.items ?? []);
  if (!shown.length) return null;
  return (
    <section aria-label={C.title} className="grid gap-3" data-court-strip="">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{C.title}</h2>
        <Link href="/projectum?view=inbox" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {more ? C.more(more) : C.seeAll}
        </Link>
      </div>
      <CourtList items={shown} />
    </section>
  );
}
