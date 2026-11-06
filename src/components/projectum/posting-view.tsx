"use client";

// One posting (?posting=<id>): what the organization posted, where it
// stands and the moves the viewer may make, what to do next when it is the
// organization's turn, every review round, and the teams on it. The
// organization (or an admin) edits it here unless it is in review; members
// claim it here.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Pencil } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import type { CopyCtx } from "@/lib/pipeline/handoffs";
import type { PostingDraft } from "@/lib/problems";
import { ClaimDialog } from "@/components/projectum/claim-dialog";
import { NextSteps } from "@/components/projectum/next-steps";
import { type PipelineProject, type Posting, type Review, useApi } from "@/components/projectum/pipeline-store";
import { DisciplineTags, LoadError, Loading, Team, formatDate, useTaxonomy } from "@/components/projectum/pipeline-ui";
import { PostingFormDialog } from "@/components/projectum/posting-form";
import { latestReturnNotes } from "@/components/projectum/posting-helpers";
import { decisionLabel } from "@/components/projectum/review-helpers";
import { StatusPill } from "@/components/projectum/status-pill";
import { TransitionBar } from "@/components/projectum/transition-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

const P = copy.projectum.pipeline;
const V = P.posting;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-4xl content-start [overflow-wrap:anywhere] gap-6 p-6" data-posting-view="">
      <Link href="/projectum" className={`${buttonVariants({ variant: "ghost", size: "sm" })} justify-self-start`}>
        <ArrowLeft />
        {V.back}
      </Link>
      {children}
    </div>
  );
}

function Notes({ text }: { text: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{V.latestNotes}</p>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  );
}

// Every round at a gate, newest first. The review page shows it too.
export function ReviewHistory({ reviews }: { reviews: Review[] }) {
  const rounds = [...reviews].sort((a, b) => b.round - a.round);
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">{V.history}</h2>
      <ol className="grid gap-2">
        {rounds.map((r) => (
          <li key={r.id} data-review-round={r.round} className="grid gap-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {V.round(r.round)}. {decisionLabel(r.gate, r.status)}
              </span>
              {r.decidedBy && (
                <span className="text-xs text-muted-foreground">
                  {V.decidedBy(r.decidedBy.name, r.decidedAt ? formatDate(r.decidedAt) : "")}
                </span>
              )}
            </div>
            {r.status !== "open" && (
              <p className={r.feedback ? "whitespace-pre-line" : "text-muted-foreground"}>{r.feedback || V.noNotes}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

// The details beside what the organization wants back, the deadline, the
// effort and the tags. The review page shows the posting as it was sent.
export function PostingFields({ draft }: { draft: PostingDraft }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
      <section className="grid content-start gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">{V.details}</h2>
        <p className="text-sm whitespace-pre-line">{draft.details || draft.summary}</p>
      </section>
      <aside className="grid content-start gap-4 rounded-lg border p-4 text-sm">
        {draft.deliverable && (
          <section className="grid gap-1">
            <h2 className="text-xs font-medium text-muted-foreground">{V.deliverable}</h2>
            <p className="whitespace-pre-line">{draft.deliverable}</p>
          </section>
        )}
        {draft.deadline && (
          <section className="grid gap-1">
            <h2 className="text-xs font-medium text-muted-foreground">{V.deadline}</h2>
            <p className="flex items-center gap-1.5">
              <CalendarClock className="size-4" />
              {formatDate(draft.deadline)}
            </p>
          </section>
        )}
        {draft.effort && (
          <section className="grid gap-1">
            <h2 className="text-xs font-medium text-muted-foreground">{V.effort}</h2>
            <p>{P.efforts[draft.effort]}</p>
          </section>
        )}
        {draft.tags.length > 0 && (
          <section className="grid gap-1">
            <h2 className="text-xs font-medium text-muted-foreground">{V.tags}</h2>
            <div className="flex flex-wrap gap-1">
              {draft.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

function Projects({ postingId, partner }: { postingId: string; partner: boolean }) {
  const { data, error, retry } = useApi<{ projects: PipelineProject[] }>(`/projects?posting=${encodeURIComponent(postingId)}`);
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">{V.projects}</h2>
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : data.projects.length ? (
        <ul className="grid gap-2">
          {data.projects.map((p) => (
            <li key={p.id} data-project-row="" className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="grid min-w-0 gap-1">
                <p className="text-xs text-muted-foreground">{V.lead(p.lead.name)}</p>
                <Team team={p.team} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill kind="project" status={p.status} size="sm" />
                {p.boardId && (
                  <Link
                    href={`/projectum?project=${encodeURIComponent(p.boardId)}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {V.openBoard}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {partner ? V.noProjectsPartner : V.noProjects}
        </p>
      )}
    </section>
  );
}

export function PostingView({ id }: { id: string }) {
  const me = useAccount();
  const { data: posting, error, retry } = useApi<Posting>(`/postings/${encodeURIComponent(id)}`);
  const { name } = useTaxonomy();
  const [editing, setEditing] = React.useState(false);
  const [claiming, setClaiming] = React.useState(false);

  if (error && !posting) {
    return (
      <Frame>
        <LoadError retry={retry} />
      </Frame>
    );
  }
  if (!posting) {
    return (
      <Frame>
        <Loading />
      </Frame>
    );
  }

  const ours = Boolean(posting.orgId && posting.orgId === me.orgId);
  const canEdit = (ours || me.admin) && posting.status !== "in_review" && posting.status !== "archived";
  const canClaim = me.roles.includes("member") && me.status === "active" && posting.status === "live" && !posting.myProject;
  const ctx: CopyCtx = { partner: posting.org?.name ?? posting.author.name, member: me.name, posting: posting.title };
  const notes = posting.status === "returned" ? latestReturnNotes(posting.reviews) : "";

  return (
    <Frame>
      <header className="grid gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-medium">{posting.title}</h1>
              <StatusPill kind="posting" status={posting.status} />
            </div>
            <p className="text-sm text-muted-foreground">{V.from(posting.org?.name ?? posting.author.name)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                {V.edit}
              </Button>
            )}
            {posting.myProject ? (
              <Link
                href={
                  posting.myProject.boardId
                    ? `/projectum?project=${encodeURIComponent(posting.myProject.boardId)}`
                    : `/projectum?view=project&id=${encodeURIComponent(posting.myProject.id)}`
                }
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {P.board.onIt}
              </Link>
            ) : (
              canClaim && (
                <Button size="sm" onClick={() => setClaiming(true)}>
                  {P.board.claim}
                </Button>
              )
            )}
          </div>
        </div>
        <TransitionBar
          kind="posting"
          id={posting.id}
          status={posting.status}
          roles={me.roles}
          ctx={ctx}
          allowed={posting.transitions}
        />
        {notes && <Notes text={notes} />}
        {posting.nextSteps && <NextSteps copyKey={posting.nextSteps} ctx={ctx} />}
        {posting.summary && <p className="text-base">{posting.summary}</p>}
        <DisciplineTags slugs={posting.disciplines} name={name} />
      </header>

      <PostingFields draft={posting} />

      {posting.reviews.length > 0 && <ReviewHistory reviews={posting.reviews} />}

      <Projects postingId={posting.id} partner={ours} />

      {canEdit && (
        <PostingFormDialog open={editing} onOpenChange={setEditing} posting={posting} orgName={posting.org?.name ?? ""} />
      )}
      {claiming && <ClaimDialog open onOpenChange={setClaiming} posting={posting} />}
    </Frame>
  );
}
