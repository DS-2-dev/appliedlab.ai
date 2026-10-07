"use client";

// The approvers' overview (Kylar and faculty reps): every problem, open or
// closed; every team's claim and where it stands, from a pending plan to a
// completed internship; and every account, with Approve for a waiting
// partner and Turn off or on for anyone but an approver. Counts across the
// top, then one table per tab, each searched and filtered.

import * as React from "react";
import Link from "next/link";
import { copy } from "@/content/copy";
import type { AccountRole } from "@/lib/email-rules";
import type { ClaimStatus } from "@/lib/problems";
import { type Person, type Problem, send, useApi } from "@/components/projectum/pipeline-store";
import { LoadError, Loading, ViewFrame, formatDate } from "@/components/projectum/pipeline-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

const P = copy.projectum.pipeline;
const V = P.overview;

type OverviewClaim = {
  id: string;
  problemId: string;
  title: string;
  origin: "partner" | "member";
  owner: string;
  status: ClaimStatus;
  createdAt: string;
  submission: "pending" | "accepted" | "returned" | null;
  meeting: "requested" | "arranged" | null;
  selection: "hired" | "complete" | null;
  projectId: string | null;
  team: Person[];
};

type OverviewPerson = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  status: "active" | "pending" | "removed";
  createdAt: string;
  approver: boolean;
  activeClaims: number;
  problems: number;
};

type Overview = { problems: Problem[]; claims: OverviewClaim[]; people: OverviewPerson[] };
type Stage = keyof typeof V.stages;

// Where a team stands, from its claim's status and what followed approval.
function stageOf(c: OverviewClaim): Stage {
  if (c.status !== "approved") return c.status;
  if (c.selection) return c.selection;
  if (c.submission === "accepted") return "accepted";
  if (c.submission === "pending") return "submitted";
  if (c.submission === "returned") return "returned";
  return "working";
}

const problemHref = (id: string) => `/projectum?problem=${encodeURIComponent(id)}`;

const matches = (q: string, ...texts: string[]) => !q || texts.some((t) => t.toLowerCase().includes(q));

// A plain table: a header row, then rows, scrolling sideways on its own if
// a narrow window needs it.
function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: boolean }) {
  if (empty) return <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{V.empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

// Search box and a row of filter chips, shared by the three tabs.
function Filters<T extends string>({
  query,
  onQuery,
  options,
  value,
  onValue,
  label,
}: {
  query: string;
  onQuery: (q: string) => void;
  options: { value: T | "all"; label: string; count: number }[];
  value: T | "all";
  onValue: (v: T | "all") => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        aria-label={V.search}
        placeholder={V.search}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        className="w-56"
      />
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options
          .filter((o) => o.value === "all" || o.count > 0)
          .map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={value === o.value ? "default" : "outline"}
              aria-pressed={value === o.value}
              onClick={() => onValue(o.value)}
            >
              {o.label}
              <span className="tabular-nums opacity-70">{o.count}</span>
            </Button>
          ))}
      </div>
    </div>
  );
}

function ProblemsTab({ problems }: { problems: Problem[] }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"open" | "closed" | "all">("all");
  const q = query.trim().toLowerCase();
  const shown = problems.filter((p) => (status === "all" || p.status === status) && matches(q, p.title, p.owner.name));
  return (
    <div className="grid gap-3">
      <Filters
        query={query}
        onQuery={setQuery}
        label={V.columns.status}
        value={status}
        onValue={setStatus}
        options={[
          { value: "all", label: V.all, count: problems.length },
          { value: "open", label: V.problemStatus.open, count: problems.filter((p) => p.status === "open").length },
          { value: "closed", label: V.problemStatus.closed, count: problems.filter((p) => p.status === "closed").length },
        ]}
      />
      <Table head={[V.columns.problem, V.columns.postedBy, V.columns.status, V.columns.teams, V.columns.created]} empty={!shown.length}>
        {shown.map((p) => (
          <tr key={p.id} data-overview-problem="">
            <td className="px-3 py-2">
              <Link href={problemHref(p.id)} className="font-medium hover:underline">
                {p.title}
              </Link>
              {p.origin === "member" && (
                <Badge variant="secondary" className="ml-2">
                  {P.queue.studentProject}
                </Badge>
              )}
            </td>
            <td className="px-3 py-2">{p.owner.name}</td>
            <td className="px-3 py-2">
              <Badge variant="outline">{V.problemStatus[p.status]}</Badge>
            </td>
            <td className="px-3 py-2 whitespace-nowrap tabular-nums">
              {P.card.teams(p.counts.approved)}
              {p.counts.pending > 0 && <span className="text-muted-foreground">, {P.card.pending(p.counts.pending)}</span>}
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

const STAGE_ORDER: Stage[] = ["pending", "working", "submitted", "returned", "accepted", "hired", "complete", "denied", "withdrawn"];

function TeamsTab({ claims }: { claims: OverviewClaim[] }) {
  const [query, setQuery] = React.useState("");
  const [stage, setStage] = React.useState<Stage | "all">("all");
  const q = query.trim().toLowerCase();
  const staged = claims.map((c) => ({ ...c, stage: stageOf(c) }));
  const shown = staged.filter(
    (c) => (stage === "all" || c.stage === stage) && matches(q, c.title, c.owner, ...c.team.map((t) => t.name)),
  );
  return (
    <div className="grid gap-3">
      <Filters
        query={query}
        onQuery={setQuery}
        label={V.columns.stage}
        value={stage}
        onValue={setStage}
        options={[
          { value: "all", label: V.all, count: claims.length },
          ...STAGE_ORDER.map((s) => ({ value: s, label: V.stages[s], count: staged.filter((c) => c.stage === s).length })),
        ]}
      />
      <Table head={[V.columns.problem, V.columns.team, V.columns.stage, V.columns.created, ""]} empty={!shown.length}>
        {shown.map((c) => (
          <tr key={c.id} data-overview-team={c.stage}>
            <td className="px-3 py-2">
              <Link href={problemHref(c.problemId)} className="font-medium hover:underline">
                {c.title}
              </Link>
              <p className="text-xs text-muted-foreground">{c.origin === "member" ? P.queue.studentProject : c.owner}</p>
            </td>
            <td className="px-3 py-2">{c.team.map((t) => t.name).join(", ")}</td>
            <td className="px-3 py-2">
              <Badge variant={c.stage === "complete" || c.stage === "hired" ? "default" : "outline"}>{V.stages[c.stage]}</Badge>
              {c.meeting && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.meeting === "arranged" ? P.phase.meetingArranged : P.phase.meetingRequested}
                </span>
              )}
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(c.createdAt)}</td>
            <td className="px-3 py-2 text-right">
              {c.projectId && (
                <Link
                  href={`/projectum?project=${encodeURIComponent(c.projectId)}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {V.openBoard}
                </Link>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function PersonAction({ person }: { person: OverviewPerson }) {
  const [busy, setBusy] = React.useState(false);
  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      await send(path, "POST", body);
    } finally {
      setBusy(false);
    }
  };
  if (person.status === "pending" && person.role === "partner") {
    return (
      <Button size="sm" disabled={busy} onClick={() => void act(`/partners/${person.id}/approve`)}>
        {V.approve}
      </Button>
    );
  }
  if (person.approver) return null;
  return person.status === "removed" ? (
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(`/accounts/${person.id}/status`, { status: "active" })}>
      {V.turnOn}
    </Button>
  ) : (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => {
        if (window.confirm(V.turnOffConfirm(person.name))) void act(`/accounts/${person.id}/status`, { status: "removed" });
      }}
    >
      {V.turnOff}
    </Button>
  );
}

function PeopleTab({ people }: { people: OverviewPerson[] }) {
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState<AccountRole | "all">("all");
  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => (role === "all" || p.role === role) && matches(q, p.name, p.email));
  return (
    <div className="grid gap-3">
      <Filters
        query={query}
        onQuery={setQuery}
        label={V.columns.role}
        value={role}
        onValue={setRole}
        options={[
          { value: "all", label: V.all, count: people.length },
          ...(["member", "rep", "partner"] as const).map((r) => ({
            value: r,
            label: V.roles[r],
            count: people.filter((p) => p.role === r).length,
          })),
        ]}
      />
      <Table
        head={[V.columns.name, V.columns.email, V.columns.role, V.columns.status, V.columns.activity, V.columns.joined, ""]}
        empty={!shown.length}
      >
        {shown.map((p) => (
          <tr key={p.id} data-overview-person={p.status}>
            <td className="px-3 py-2 font-medium">{p.name}</td>
            <td className="px-3 py-2">
              <a href={`mailto:${p.email}`} className="hover:underline">
                {p.email}
              </a>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              {V.roles[p.role]}
              {p.approver && (
                <Badge variant="secondary" className="ml-2">
                  {V.approverBadge}
                </Badge>
              )}
            </td>
            <td className="px-3 py-2">
              <Badge variant={p.status === "active" ? "outline" : "secondary"}>{V.personStatus[p.status]}</Badge>
            </td>
            <td className="px-3 py-2 text-muted-foreground">{V.activity(p.problems, p.activeClaims)}</td>
            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</td>
            <td className="px-3 py-2 text-right">
              <PersonAction person={p} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <Card size="sm" className="gap-1 px-4 py-3">
      <span className="text-2xl font-medium tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}

export function OverviewView() {
  const { data, error, retry } = useApi<Overview>("/overview");
  const queue = useApi<{ meetings: unknown[]; claims: unknown[]; submissions: unknown[]; partners: unknown[] }>("/queue").data;
  const [tab, setTab] = React.useState("problems");
  const waiting = queue ? queue.meetings.length + queue.claims.length + queue.submissions.length + queue.partners.length : 0;

  return (
    <ViewFrame title={V.title} description={V.description}>
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-5 gap-3" data-overview-stats="">
            <Stat label={V.stats.open} value={data.problems.filter((p) => p.status === "open").length} />
            <Stat label={V.stats.working} value={data.claims.filter((c) => stageOf(c) === "working").length} />
            <Stat label={V.stats.waiting} value={waiting} href="/projectum?view=queue" />
            <Stat label={V.stats.hired} value={data.claims.filter((c) => c.selection).length} />
            <Stat label={V.stats.complete} value={data.claims.filter((c) => c.selection === "complete").length} />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-4">
            <TabsList className="relative">
              <TabsIndicator />
              {(["problems", "teams", "people"] as const).map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="z-[1] data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none"
                >
                  {V.tabs[t]}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="problems">
              <ProblemsTab problems={data.problems} />
            </TabsContent>
            <TabsContent value="teams">
              <TeamsTab claims={data.claims} />
            </TabsContent>
            <TabsContent value="people">
              <PeopleTab people={data.people} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </ViewFrame>
  );
}
