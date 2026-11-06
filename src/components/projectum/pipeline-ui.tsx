"use client";

// Small pieces the pipeline's views share: discipline and field tags, the
// teammate picker, claim status, a plan laid out, a team, dates, and the
// loading and error states.

import * as React from "react";
import { Award, CircleCheck, CircleDashed, CircleX, Download, ExternalLink, Sprout, Undo2, UserPlus, Wrench, X } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { initials } from "@/lib/initials";
import { type ClaimStatus, type Field, LIMITS } from "@/lib/problems";
import type { Launch, Person as BoardPerson } from "@/lib/projects";
import { usePeople } from "@/components/projectum/people-store";
import { type Claim, type Person, type Submission, type Taxonomy, downloadReport, useApi } from "@/components/projectum/pipeline-store";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

const P = copy.projectum.pipeline;

// The live taxonomy (GET /taxonomy), loaded once and shared, with a name
// for any discipline slug. A slug since retired shows as itself.
export function useTaxonomy(): { taxonomy: Taxonomy | undefined; name: (slug: string) => string } {
  const { data } = useApi<Taxonomy>("/taxonomy");
  const names = React.useMemo(() => new Map((data?.disciplines ?? []).map((d) => [d.slug, d.name])), [data]);
  const name = React.useCallback((slug: string) => names.get(slug) ?? slug, [names]);
  return { taxonomy: data, name };
}

export function DisciplineTags({ slugs, name }: { slugs: string[]; name: (slug: string) => string }) {
  if (!slugs.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {slugs.map((s) => (
        <Badge key={s} variant="secondary">
          {name(s)}
        </Badge>
      ))}
    </div>
  );
}

// The other members on a team: active members from /people, never the
// signed-in account, at most LIMITS.teammates.
export function TeammatePicker({ value, onChange }: { value: Person[]; onChange: (team: Person[]) => void }) {
  const me = useAccount();
  const people = usePeople();
  const id = React.useId();
  const T = P.teammates;
  const available = (people ?? []).filter((p) => p.role === "member" && p.id !== me.id && !value.some((t) => t.id === p.id));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={id} className="text-sm font-medium">
          {T.label}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="outline" size="sm" disabled={!available.length || value.length >= LIMITS.teammates} />}
          >
            <UserPlus />
            {T.add}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
            {available.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onChange([...value, { id: p.id, name: p.name }])}>
                <Avatar size="sm">
                  <AvatarFallback>{initials(p.name)}</AvatarFallback>
                </Avatar>
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {value.length ? (
        <ul aria-labelledby={id} className="grid gap-1 rounded-lg border p-1">
          {value.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
              <Avatar size="sm">
                <AvatarFallback>{initials(t.name)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{t.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${T.remove} ${t.name}`}
                onClick={() => onChange(value.filter((x) => x.id !== t.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{T.help}</p>
      )}
    </div>
  );
}

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
    <div className="mx-auto grid w-full min-w-0 max-w-6xl content-start [overflow-wrap:anywhere] gap-6 p-6">
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

// A team's latest submission: where it stands, the Lab's note, the report to
// download and, given the board's launch, its links and credits.
export function SubmissionPanel({
  submission,
  launch,
  people = [],
}: {
  submission: Submission;
  launch?: Launch | null;
  people?: BoardPerson[];
}) {
  const S = P.submission;
  const [failed, setFailed] = React.useState(false);
  const links = launch
    ? ([
        [S.links.site, launch.siteUrl],
        [S.links.slides, launch.slidesUrl],
        [S.links.demo, launch.demoUrl],
      ] as const).filter(([, url]) => url)
    : [];
  return (
    <section data-submission={submission.status} className="grid gap-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={submission.status === "accepted" ? "default" : "outline"}>
          {submission.status === "accepted" ? <CircleCheck /> : submission.status === "returned" ? <Undo2 /> : <CircleDashed />}
          {S[submission.status]}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFailed(false);
            downloadReport(submission).catch(() => setFailed(true));
          }}
        >
          <Download />
          {S.report}
        </Button>
      </div>
      {failed && <p className="text-destructive">{P.failed}</p>}
      {submission.reviewNote && (
        <div className="rounded-md bg-muted p-2.5">
          <p className="text-xs font-medium text-muted-foreground">{S.note}</p>
          <p>{submission.reviewNote}</p>
        </div>
      )}
      {links.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {links.map(([label, url]) => (
            <li key={label}>
              <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium hover:underline">
                <ExternalLink className="size-3.5" />
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {launch && people.length > 0 && (
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">{S.contributions}</p>
          <ul className="grid gap-0.5">
            {people.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.name}:</span> {launch.contributions[p.id]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export type Level = "affiliate" | "sponsored" | "builder";

const LEVEL_ICON: Record<Level, React.ReactNode> = {
  affiliate: <Sprout />,
  sponsored: <Award />,
  builder: <Wrench />,
};

// A member's level, with what it means on hover.
export function LevelBadge({ level }: { level: Level }) {
  return (
    <Badge variant={level === "affiliate" ? "outline" : "default"} title={P.levels[level].meaning} data-level={level}>
      {LEVEL_ICON[level]}
      {P.levels[level].name}
    </Badge>
  );
}
