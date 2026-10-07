"use client";

// The Notice Board (members and approvers: every open problem, filtered by
// field and searched) and My Problems (a partner's own, with Post a
// problem). One grid of problem cards for both; the Worker decides which
// problems each account gets.

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Plus, Search, Users } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { FIELDS, type Field } from "@/lib/problems";
import { type Problem, useApi } from "@/components/projectum/pipeline-store";
import { Empty, FieldTags, LoadError, Loading, ViewFrame, formatDate } from "@/components/projectum/pipeline-ui";
import { ProblemFormDialog } from "@/components/projectum/problem-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

const P = copy.projectum.pipeline;

function ProblemCard({ problem, partner }: { problem: Problem; partner: boolean }) {
  const mine = problem.myClaim === "pending" || problem.myClaim === "approved" ? problem.myClaim : null;
  return (
    <Link
      href={`/projectum?problem=${encodeURIComponent(problem.id)}`}
      data-problem-card=""
      className="group/card block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="h-full gap-3 transition-colors group-hover/card:bg-muted/40">
        <CardHeader className="gap-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2">{problem.title}</CardTitle>
            {partner && <Badge variant="outline">{problem.status === "open" ? P.card.open : P.card.closed}</Badge>}
          </div>
          {!partner && <p className="truncate text-xs text-muted-foreground">{problem.owner.name}</p>}
          <CardDescription className="line-clamp-2">{problem.summary}</CardDescription>
        </CardHeader>
        <div className="mt-auto grid gap-3 px-3 pb-3">
          <FieldTags fields={problem.fields} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {P.card.teams(problem.counts.approved)}
              {!partner && problem.counts.pending > 0 && <>, {P.card.pending(problem.counts.pending)}</>}
            </span>
            {problem.deadline && (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {P.card.due(formatDate(problem.deadline))}
              </span>
            )}
          </div>
          {mine && (
            <Badge variant={mine === "approved" ? "default" : "outline"} className="justify-self-start">
              {P.card.yourClaim[mine]}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}

function Grid({ problems, partner }: { problems: Problem[]; partner: boolean }) {
  return (
    <div data-problem-grid="" className="grid grid-cols-3 gap-4 xl:grid-cols-4">
      {problems.map((p) => (
        <ProblemCard key={p.id} problem={p} partner={partner} />
      ))}
    </div>
  );
}

export function NoticeBoard() {
  const { data, error, retry } = useApi<{ problems: Problem[] }>("/problems");
  const [field, setField] = React.useState<"all" | Field>("all");
  const [query, setQuery] = React.useState("");
  const problems = data?.problems ?? [];
  const q = query.trim().toLowerCase();
  const matches = (p: Problem) =>
    !q || [p.title, p.summary, p.owner.name, p.details].some((t) => t.toLowerCase().includes(q));
  const shown = problems.filter((p) => (field === "all" || p.fields.includes(field)) && matches(p));
  // Only the fields some open problem uses, so no tab is always empty.
  const used = FIELDS.filter((f) => problems.some((p) => p.fields.includes(f)));

  return (
    <ViewFrame
      title={P.board.title}
      description={P.board.description}
      action={
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={P.board.search}
            placeholder={P.board.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          {used.length > 1 && (
            <Tabs value={field} onValueChange={(v) => setField(v as "all" | Field)}>
              <TabsList aria-label={P.board.filterLabel} className="relative">
                <TabsIndicator />
                {(["all", ...used] as const).map((f) => (
                  <TabsTrigger
                    key={f}
                    value={f}
                    className="z-[1] data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none"
                  >
                    {f === "all" ? P.board.all : P.fields[f]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {shown.length ? <Grid problems={shown} partner={false} /> : <Empty>{P.board.empty}</Empty>}
        </>
      )}
    </ViewFrame>
  );
}

export function MyProblems() {
  const { data, error, retry } = useApi<{ problems: Problem[] }>("/problems");
  const [posting, setPosting] = React.useState(false);
  const me = useAccount();
  return (
    <ViewFrame
      title={P.myProblems.title}
      description={P.myProblems.description}
      action={
        me.status === "active" && (
          <Button onClick={() => setPosting(true)}>
            <Plus />
            {P.nav.post}
          </Button>
        )
      }
    >
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : data.problems.length ? (
        <Grid problems={data.problems} partner />
      ) : (
        <Empty>{P.myProblems.empty}</Empty>
      )}
      <ProblemFormDialog open={posting} onOpenChange={setPosting} />
    </ViewFrame>
  );
}
