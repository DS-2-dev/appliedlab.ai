"use client";

// The reviews queue (?view=reviews), a representative's view: every open
// review at a gate, oldest first, from GET /reviews. Each row has its gate,
// what it is, who sent it, how long it has waited and who has it, with Take
// for one nobody has and Open. J and K move through the rows and Enter opens
// the one selected, unless the focus is in a field.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { ApiError, useAccount } from "@/lib/account";
import { type ReviewRow, send, useApi } from "@/components/projectum/pipeline-store";
import { Empty, LoadError, Loading, ViewFrame, formatDate } from "@/components/projectum/pipeline-ui";
import { isTyping, queueKey, queueRows } from "@/components/projectum/review-helpers";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const R = copy.projectum.pipeline.reviews;
const COLUMNS = "grid-cols-[8rem_minmax(0,2fr)_minmax(0,1.25fr)_8rem_minmax(0,1fr)_auto]";

// Takes an open review, and says so when someone else got it first.
export async function takeReview(id: string): Promise<string | null> {
  try {
    await send(`/reviews/${encodeURIComponent(id)}/take`, "POST");
    return null;
  } catch (e) {
    return e instanceof ApiError && e.code === "taken" ? R.taken : R.failed;
  }
}

export function ReviewsView() {
  const me = useAccount();
  const router = useRouter();
  const { data, error, retry } = useApi<{ reviews: ReviewRow[] }>("/reviews");
  const rows = React.useMemo(() => queueRows(data?.reviews ?? [], me.id), [data, me.id]);
  const [selected, setSelected] = React.useState(-1);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<{ id: string; text: string } | null>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  // The selection, held to the rows there are now.
  const index = Math.min(selected, rows.length - 1);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(target)) return;
      // Enter on a focused link or button is that control's own.
      if (e.key === "Enter" && target?.closest?.("a, button")) return;
      const action = queueKey(e.key, index, rows.length);
      if (!action) return;
      e.preventDefault();
      if ("open" in action) router.push(rows[action.open].href);
      else setSelected(action.move);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, rows, router]);

  React.useEffect(() => {
    if (index >= 0) listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const take = async (id: string) => {
    setBusy(id);
    setFailed(null);
    const text = await takeReview(id);
    if (text) setFailed({ id, text });
    setBusy(null);
  };

  return (
    <ViewFrame title={R.title} description={R.description}>
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>{R.empty}</Empty>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">{R.keys}</p>
          <div aria-hidden className={cn("grid gap-4 px-4 text-xs font-medium text-muted-foreground", COLUMNS)}>
            <span>{R.columns.gate}</span>
            <span>{R.columns.title}</span>
            <span>{R.columns.who}</span>
            <span>{R.columns.waiting}</span>
            <span>{R.columns.assignee}</span>
            <span className="invisible">{R.open}</span>
          </div>
          <ul ref={listRef} className="grid gap-2">
            {rows.map((r, i) => (
              <li
                key={r.id}
                data-review-row={r.id}
                data-selected={i === index ? "" : undefined}
                aria-current={i === index ? "true" : undefined}
                className={cn("grid gap-2 rounded-lg border p-4", i === index && "border-ring ring-2 ring-ring/40")}
              >
                <div className={cn("grid items-center gap-4", COLUMNS)}>
                  <Badge variant="outline" className="justify-self-start">
                    {r.gate}
                  </Badge>
                  <Link href={r.href} className="truncate font-medium underline-offset-4 hover:underline">
                    {r.title}
                  </Link>
                  <span className="truncate text-sm">{r.who}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(r.waitingSince)}</span>
                  <span className="truncate text-sm text-muted-foreground">{r.assignee}</span>
                  <div className="flex items-center gap-2">
                    {r.canTake && (
                      <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void take(r.id)}>
                        {R.take}
                        <span className="sr-only"> {r.title}</span>
                      </Button>
                    )}
                    <Link href={r.href} className={buttonVariants({ size: "sm" })}>
                      {R.open}
                      <span className="sr-only"> {r.title}</span>
                    </Link>
                  </div>
                </div>
                {failed?.id === r.id && (
                  <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
                    {failed.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ViewFrame>
  );
}
