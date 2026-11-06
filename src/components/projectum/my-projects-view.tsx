"use client";

// My Projects (?view=myprojects): every project the member is on, newest
// first, from GET /projects/mine. Each row has its posting, status, how far
// along it is, the team, the next date it is due and a link to its board. A
// project that came back with notes shows them, with what to do next, in
// its row.

import Link from "next/link";
import { copy } from "@/content/copy";
import type { CopyCtx } from "@/lib/pipeline/handoffs";
import { NextSteps } from "@/components/projectum/next-steps";
import { type PipelineProject, useApi } from "@/components/projectum/pipeline-store";
import { Empty, LoadError, Loading, Team, ViewFrame, formatDate } from "@/components/projectum/pipeline-ui";
import { projectHref, returnNotes } from "@/components/projectum/project-helpers";
import { StageBar } from "@/components/projectum/stage-bar";
import { StatusPill } from "@/components/projectum/status-pill";
import { buttonVariants } from "@/components/ui/button";

const P = copy.projectum.pipeline;
const M = P.myProjects;

function Row({ project }: { project: PipelineProject }) {
  const returned = project.status === "plan_returned" || project.status === "submission_returned";
  const notes = returned ? returnNotes(project.status, project.reviews) : "";
  const ctx: CopyCtx = {
    partner: project.posting.org?.name ?? "",
    member: project.lead.name,
    posting: project.posting.title,
    selfDirected: project.posting.kind === "self",
  };
  return (
    <li data-my-project={project.id} className="grid gap-3 rounded-lg border p-4">
      <div className="grid grid-cols-[minmax(0,2fr)_8rem_minmax(0,1.5fr)_minmax(0,1.5fr)_7rem_auto] items-center gap-4">
        <div className="grid min-w-0 gap-1">
          <Link href={projectHref(project)} className="truncate font-medium underline-offset-4 hover:underline">
            {project.posting.title}
          </Link>
          {project.posting.org && <span className="truncate text-xs text-muted-foreground">{project.posting.org.name}</span>}
        </div>
        <StatusPill kind="project" status={project.status} className="justify-self-start" />
        <StageBar status={project.status} self={project.posting.kind === "self"} compact />
        <Team team={project.team} />
        <span className="text-sm text-muted-foreground">{project.plan.finishBy ? formatDate(project.plan.finishBy) : M.noDue}</span>
        <Link href={projectHref(project)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {M.open}
          <span className="sr-only"> {project.posting.title}</span>
        </Link>
      </div>
      {returned && (
        <div className="grid gap-2">
          {notes && (
            <div className="grid gap-1 rounded-lg border p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{P.planEditor.notes}</p>
              <p className="whitespace-pre-line">{notes}</p>
            </div>
          )}
          {project.nextSteps && <NextSteps copyKey={project.nextSteps} ctx={ctx} />}
        </div>
      )}
    </li>
  );
}

export function MyProjects() {
  const { data, error, retry } = useApi<{ projects: PipelineProject[] }>("/projects/mine");
  return (
    <ViewFrame title={M.title} description={M.description}>
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : data.projects.length === 0 ? (
        <Empty>{M.empty}</Empty>
      ) : (
        <div className="grid gap-2">
          <div
            aria-hidden
            className="grid grid-cols-[minmax(0,2fr)_8rem_minmax(0,1.5fr)_minmax(0,1.5fr)_7rem_auto] gap-4 px-4 text-xs font-medium text-muted-foreground"
          >
            <span>{M.columns.project}</span>
            <span>{M.columns.status}</span>
            <span>{M.columns.stage}</span>
            <span>{M.columns.team}</span>
            <span>{M.columns.due}</span>
            <span className="invisible">{M.columns.open}</span>
          </div>
          <ul className="grid gap-2">
            {data.projects.map((p) => (
              <Row key={p.id} project={p} />
            ))}
          </ul>
        </div>
      )}
    </ViewFrame>
  );
}
