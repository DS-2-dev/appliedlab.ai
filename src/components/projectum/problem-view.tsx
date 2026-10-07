"use client";

// One problem: what the partner posted, and the teams on it. Members claim
// it from here with an action plan. Its partner, and reps, edit or close it.
// Partners see only teams the Lab approved; everyone else sees every claim
// with its plan.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Eye, Pencil } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { type ClaimWithSubmission, type Problem, send, useApi } from "@/components/projectum/pipeline-store";
import { ClaimFormDialog } from "@/components/projectum/claim-form";
import {
  ClaimStatusBadge,
  FieldTags,
  LoadError,
  Loading,
  PlanView,
  SubmissionPanel,
  Team,
  formatDate,
} from "@/components/projectum/pipeline-ui";
import { ProblemFormDialog } from "@/components/projectum/problem-form";
import { PartnerActions, PhasePanel } from "@/components/projectum/phase-two";
import { ProjectCard } from "@/components/projectum/project-board";
import { useVisibleProjects } from "@/components/projectum/project-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const P = copy.projectum.pipeline;

// A team's claim, with its board once approved: the team opens it, and
// everyone else views it as it stands.
function ClaimCard({
  claim,
  ownsProblem,
  approver,
}: {
  claim: ClaimWithSubmission;
  // The partner whose problem this is, who meets and selects teams.
  ownsProblem: boolean;
  approver: boolean;
}) {
  const { entries } = useVisibleProjects();
  const accepted = claim.submission?.status === "accepted";
  const board = claim.projectId ? entries.find((e) => e.project.id === claim.projectId) : undefined;
  const [viewing, setViewing] = React.useState(false);
  return (
    <Card size="sm" data-claim="">
      <CardHeader className="flex items-center justify-between gap-3">
        <Team team={claim.team} />
        <div className="flex items-center gap-2">
          {board &&
            (board.editable ? (
              <Link href={`/projectum?project=${encodeURIComponent(board.project.id)}`} className={buttonVariants({ size: "sm" })}>
                {P.problem.openBoard}
              </Link>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setViewing(true)}>
                <Eye />
                {P.problem.viewProgress}
              </Button>
            ))}
          <ClaimStatusBadge status={claim.status} />
        </div>
      </CardHeader>
      {board && (
        <Dialog open={viewing} onOpenChange={setViewing}>
          <DialogContent className="sm:max-w-5xl" bodyClassName="p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>{board.project.name}</DialogTitle>
              <DialogDescription>{P.problem.progressDescription}</DialogDescription>
            </DialogHeader>
            <ProjectCard project={board.project} overview className="bg-transparent ring-0" />
          </DialogContent>
        </Dialog>
      )}
      <CardContent className="grid gap-4">
        {claim.submission && (
          <SubmissionPanel submission={claim.submission} launch={board?.project.launch} people={board?.project.people} />
        )}
        {accepted && ownsProblem && <PartnerActions claimId={claim.id} meeting={claim.meeting} selection={claim.selection} />}
        {claim.selection && (
          <PhasePanel
            claimId={claim.id}
            selection={claim.selection}
            editable={Boolean(board?.onTeam)}
            canComplete={ownsProblem || approver}
          />
        )}
        <PlanView plan={claim.plan} />
      </CardContent>
    </Card>
  );
}

export function ProblemView({ id }: { id: string }) {
  const me = useAccount();
  const { data, error, retry } = useApi<{ problem: Problem; claims: ClaimWithSubmission[]; canEdit: boolean }>(
    `/problems/${encodeURIComponent(id)}`,
  );
  const [claiming, setClaiming] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const home = me.role === "partner" ? "/projectum" : "/projectum?view=board";

  const back = (
    <Link href={home} className={`${buttonVariants({ variant: "ghost", size: "sm" })} justify-self-start`}>
      <ArrowLeft />
      {P.problem.back}
    </Link>
  );

  if (error && !data) {
    return (
      <div className="mx-auto grid w-full max-w-4xl content-start gap-4 p-6">
        {back}
        <LoadError retry={retry} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto grid w-full max-w-4xl content-start gap-4 p-6">
        {back}
        <Loading />
      </div>
    );
  }

  const { problem, claims, canEdit } = data;
  const myClaim = claims.find((c) => c.team.some((t) => t.id === me.id) && (c.status === "pending" || c.status === "approved"));
  const canClaim = me.role === "member" && problem.status === "open" && !myClaim;

  const setStatus = async (status: "open" | "closed") => {
    setBusy(true);
    try {
      await send(`/problems/${problem.id}`, "PATCH", { status });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl content-start gap-6 p-6" data-problem-view="">
      {back}

      <header className="grid gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-medium">{problem.title}</h1>
            <p className="text-sm text-muted-foreground">{P.problem.postedBy(problem.owner.name)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {problem.status === "closed" && <Badge variant="outline">{P.card.closed}</Badge>}
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil />
                  {P.problem.edit}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void setStatus(problem.status === "open" ? "closed" : "open")}
                >
                  {problem.status === "open" ? P.problem.close : P.problem.reopen}
                </Button>
              </>
            )}
            {canClaim && <Button onClick={() => setClaiming(true)}>{P.problem.claim}</Button>}
            {myClaim && <Badge>{P.problem.claimed}</Badge>}
          </div>
        </div>
        <p className="text-base">{problem.summary}</p>
        <FieldTags fields={problem.fields} />
      </header>

      <div className={problem.deliverable || problem.deadline ? "grid gap-4 sm:grid-cols-[1fr_16rem]" : "grid gap-4"}>
        <section className="grid content-start gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">{P.problem.details}</h2>
          <p className="text-sm whitespace-pre-line">{problem.details || problem.summary}</p>
        </section>
        {(problem.deliverable || problem.deadline) && (
        <aside className="grid content-start gap-4 rounded-lg border p-4 text-sm">
          {problem.deliverable && (
            <section className="grid gap-1">
              <h2 className="text-xs font-medium text-muted-foreground">{P.problem.deliverable}</h2>
              <p className="whitespace-pre-line">{problem.deliverable}</p>
            </section>
          )}
          {problem.deadline && (
            <section className="grid gap-1">
              <h2 className="text-xs font-medium text-muted-foreground">{P.problem.deadline}</h2>
              <p className="flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                {formatDate(problem.deadline)}
              </p>
            </section>
          )}
        </aside>
        )}
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-medium">{P.problem.teams}</h2>
        {claims.length ? (
          <div className="grid gap-3">
            {claims.map((c) => (
              <ClaimCard key={c.id} claim={c} ownsProblem={problem.owner.id === me.id} approver={me.approver} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {me.role === "partner" ? P.problem.noTeamsPartner : P.problem.noTeams}
          </p>
        )}
      </section>

      <ClaimFormDialog open={claiming} onOpenChange={setClaiming} problem={problem} />
      {canEdit && <ProblemFormDialog open={editing} onOpenChange={setEditing} problem={problem} />}
    </div>
  );
}
