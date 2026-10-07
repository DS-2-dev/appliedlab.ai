"use client";

// Small pieces the pipeline's views share: field tags, claim status, a
// plan laid out, a team, dates, and the loading and error states.

import * as React from "react";
import { CircleCheck, CircleDashed, CircleX, Undo2 } from "lucide-react";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import type { ClaimStatus, Field } from "@/lib/problems";
import type { Claim, Person } from "@/components/projectum/pipeline-store";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const P = copy.projectum.pipeline;

// A stored YYYY-MM-DD, as "Dec 1, 2026". Read as UTC so it never shifts a day.
export function formatDate(date: string): string {
  if (!date) return "";
  const d = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function FieldTags({ fields }: { fields: Field[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <Badge key={f} variant="secondary">
          {P.fields[f]}
        </Badge>
      ))}
    </div>
  );
}

const STATUS_ICON: Record<ClaimStatus, React.ReactNode> = {
  pending: <CircleDashed />,
  approved: <CircleCheck />,
  denied: <CircleX />,
  withdrawn: <Undo2 />,
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <Badge variant={status === "approved" ? "default" : "outline"} data-claim-status={status}>
      {STATUS_ICON[status]}
      {P.claimStatus[status]}
    </Badge>
  );
}

export function Team({ team }: { team: Person[] }) {
  return (
    <div className="flex items-center gap-2">
      <AvatarGroup className="-space-x-1">
        {team.slice(0, 4).map((p) => (
          <Avatar key={p.id} size="sm" title={p.name}>
            <AvatarFallback>{initials(p.name)}</AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
      <span className="truncate text-sm">{team.map((p) => p.name).join(", ")}</span>
    </div>
  );
}

export function PlanView({ plan }: { plan: Claim["plan"] }) {
  return (
    <div className="grid gap-3 text-sm">
      <section className="grid gap-1">
        <h4 className="text-xs font-medium text-muted-foreground">{P.plan.approach}</h4>
        <p className="whitespace-pre-line">{plan.approach}</p>
      </section>
      <section className="grid gap-1">
        <h4 className="text-xs font-medium text-muted-foreground">{P.plan.milestones}</h4>
        <ol className="grid gap-1.5">
          {plan.milestones.map((m, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-1">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              <span>{m.title}</span>
              <span />
              <span className="text-muted-foreground">
                {P.plan.criterion}: {m.criterion}
              </span>
            </li>
          ))}
        </ol>
      </section>
      {plan.finishBy && (
        <p className="text-muted-foreground">
          {P.plan.finishBy} {formatDate(plan.finishBy)}
        </p>
      )}
    </div>
  );
}

// The page frame every pipeline view uses: a title, a line under it, an
// optional action at the right, then the content.
export function ViewFrame({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl content-start gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-medium">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div aria-label={P.loading} aria-busy className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}

export function LoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-2 rounded-lg border border-dashed p-6 text-sm">
      <p>{P.failed}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        {P.retry}
      </Button>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{children}</p>;
}
