"use client";

// One review (?view=review&id=), a representative's page, from GET
// /reviews/:id: what was sent for review as it was sent (a posting's
// fields, or an action plan beside the board's brief, or a submission's
// report and credits), every round at the gate, who has it, Take when
// nobody does, and the gate's two decisions. Someone whose work it is gets
// the refusal in place of the decisions. A pending submission from before
// submissions had reviews ("sub:" ids) decides the same way, on its project.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import type { CopyCtx } from "@/lib/pipeline/handoffs";
import { cleanProjects, type Project } from "@/lib/projects";
import { findBoard } from "@/components/projectum/board-mode";
import {
  type PipelineProject,
  type Posting,
  type ReviewDetail,
  type Submission,
  useApi,
} from "@/components/projectum/pipeline-store";
import {
  DisciplineTags,
  LoadError,
  Loading,
  PlanView,
  SubmissionPanel,
  Team,
  formatDate,
  useTaxonomy,
} from "@/components/projectum/pipeline-ui";
import { PostingFields, ReviewHistory } from "@/components/projectum/posting-view";
import { ProjectCard } from "@/components/projectum/project-board";
import { useVisibleProjects } from "@/components/projectum/project-store";
import {
  GATE_MOVES,
  LEGACY,
  decisionMode,
  gateLabel,
  isLegacy,
  planSnapshot,
  postingSnapshot,
  reportSnapshot,
} from "@/components/projectum/review-helpers";
import { takeReview } from "@/components/projectum/reviews-view";
import { StatusPill } from "@/components/projectum/status-pill";
import { TransitionBar } from "@/components/projectum/transition-bar";
import { errorText } from "@/components/projectum/transition-buttons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

const R = copy.projectum.pipeline.review;
const Q = copy.projectum.pipeline.reviews;
const T = copy.projectum.pipeline.transition;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-5xl content-start [overflow-wrap:anywhere] gap-6 p-6" data-review-view="">
      <Link href="/projectum?view=reviews" className={`${buttonVariants({ variant: "ghost", size: "sm" })} justify-self-start`}>
        <ArrowLeft />
        {R.back}
      </Link>
      {children}
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">{heading}</h2>
      {children}
    </section>
  );
}

function Frozen() {
  return <p className="text-xs text-muted-foreground">{R.frozen}</p>;
}

// Who has the review, and Take when nobody does.
function Assignee({ detail }: { detail: ReviewDetail }) {
  const me = useAccount();
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const { review, subject } = detail;
  const open = review.status === "open";
  // Someone whose work it is cannot decide it, so cannot take it either.
  const own = decisionMode({ reviewStatus: review.status, gate: review.gate, me, subject }) === "own";
  const canTake = open && !own && !review.assignedTo && !isLegacy(review.id);
  const take = async () => {
    setBusy(true);
    setFailed(await takeReview(review.id));
    setBusy(false);
  };
  if (!open) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">
        {!review.assignedTo ? R.unassigned : review.assignedTo.id === me.id ? R.assignedYou : R.assignedTo(review.assignedTo.name)}
      </span>
      {canTake && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void take()}>
          {Q.take}
        </Button>
      )}
      {failed && (
        <p role="alert" style={{ color: "var(--tone-red-fg)" }}>
          {failed}
        </p>
      )}
    </div>
  );
}

// The gate's two moves, the own-work refusal, or the closed note.
function Decision({ detail }: { detail: ReviewDetail }) {
  const me = useAccount();
  // Set when another reviewer decided first and the page reloaded the review.
  const [stale, setStale] = React.useState(false);
  const { review, subject } = detail;
  const mode = decisionMode({ reviewStatus: review.status, gate: review.gate, me, subject });
  if (mode === "closed" || review.gate === "completion") {
    return (
      <div className="grid gap-1 text-sm">
        {stale && (
          <p role="alert" style={{ color: "var(--tone-red-fg)" }}>
            {T.errors.moved}
          </p>
        )}
        <p className="text-muted-foreground">{R.closed}</p>
      </div>
    );
  }
  if (mode === "own") {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
        {errorText("own-project")}
      </p>
    );
  }
  const { kind, moves } = GATE_MOVES[review.gate];
  let ctx: CopyCtx;
  if (kind === "posting") {
    const p = subject as Posting;
    ctx = { partner: p.org?.name ?? p.author.name, member: "", posting: p.title };
  } else {
    const p = subject as PipelineProject;
    ctx = { partner: p.posting.org?.name ?? "", member: p.lead.name, posting: p.posting.title, selfDirected: p.posting.kind === "self" };
  }
  return (
    <TransitionBar kind={kind} id={subject.id} status={subject.status} roles={me.roles} ctx={ctx} allowed={moves} onStale={() => setStale(true)} />
  );
}

function PostingReview({ snapshot }: { snapshot: unknown }) {
  const { name } = useTaxonomy();
  const draft = postingSnapshot(snapshot);
  return (
    <Section heading={R.posting}>
      <Frozen />
      <div className="grid gap-2">
        <h3 className="text-base font-medium">{draft.title}</h3>
        {draft.summary && <p>{draft.summary}</p>}
        <DisciplineTags slugs={draft.disciplines} name={name} />
      </div>
      <PostingFields draft={draft} />
    </Section>
  );
}

function PlanReview({ project, snapshot, board }: { project: PipelineProject; snapshot: unknown; board: Project | null }) {
  return (
    <>
      <Section heading={R.plan}>
        <Frozen />
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">{R.team}</p>
          <Team team={project.team} />
        </div>
        <PlanView plan={planSnapshot(snapshot)} />
      </Section>
      {board && (
        <Section heading={R.board}>
          <ProjectCard project={board} overview />
        </Section>
      )}
    </>
  );
}

// The submission review controls (once in the old claims page): the team, the
// report to download, the launch's links and each person's credit. The
// decision is the gate's TransitionBar above.
function SubmissionReview({ detail, board }: { detail: ReviewDetail; board: Project | null }) {
  const project = detail.subject as PipelineProject;
  // A review's own submission is the board's latest, which GET /boards carries.
  const entry = findBoard(useVisibleProjects().entries, board?.id ?? "");
  const report = reportSnapshot(detail.snapshot);
  const submission: Submission | null = isLegacy(detail.review.id)
    ? {
        id: detail.review.id.slice(LEGACY.length),
        status: "pending",
        reviewNote: "",
        reportName: report.reportName,
        reportSize: report.reportSize,
        createdAt: report.createdAt,
      }
    : (entry?.submission ?? null);
  return (
    <Section heading={R.submission}>
      <div className="grid gap-1">
        <p className="text-xs font-medium text-muted-foreground">{R.team}</p>
        <Team team={project.team} />
      </div>
      {submission && <SubmissionPanel submission={submission} launch={board?.launch} people={board?.people} />}
      {board && <ProjectCard project={board} overview />}
    </Section>
  );
}

export function ReviewView({ id }: { id: string }) {
  const { data, error, retry } = useApi<ReviewDetail>(`/reviews/${encodeURIComponent(id)}`);
  const board = React.useMemo(() => (data?.board ? (cleanProjects([data.board])[0] ?? null) : null), [data]);

  if (error && !data) {
    return (
      <Frame>
        <LoadError retry={retry} />
      </Frame>
    );
  }
  if (!data) {
    return (
      <Frame>
        <Loading />
      </Frame>
    );
  }

  const { review, subject, history, snapshot } = data;
  const posting = review.gate === "posting" ? (subject as Posting) : null;
  const project = posting ? null : (subject as PipelineProject);
  const title = posting ? posting.title : project!.posting.title;
  const who = posting ? (posting.org?.name ?? posting.author.name) : project!.lead.name;

  return (
    <Frame>
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{gateLabel(review.gate)}</Badge>
          <h1 className="text-2xl font-medium">{title}</h1>
          <StatusPill kind={posting ? "posting" : "project"} status={subject.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {copy.projectum.pipeline.posting.from(who)}. {R.sent(formatDate(review.openedAt))}
        </p>
        <Assignee detail={data} />
        <Decision detail={data} />
      </header>

      {posting ? (
        <PostingReview snapshot={snapshot} />
      ) : review.gate === "action_plan" ? (
        <PlanReview project={project!} snapshot={snapshot} board={board} />
      ) : (
        <SubmissionReview detail={data} board={board} />
      )}

      {isLegacy(review.id) ? (
        <Section heading={copy.projectum.pipeline.posting.history}>
          <p className="text-sm text-muted-foreground">{R.legacy}</p>
        </Section>
      ) : (
        history.length > 0 && <ReviewHistory reviews={history} />
      )}
    </Frame>
  );
}
