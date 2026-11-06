"use client";

// After the Lab accepts a team's submission: the partner asks to meet the
// team and brings it on to implement the work (PartnerActions, the
// integrate transition, which first shows what happens next). That starts
// phase 2, a checklist of implementation milestones (PhasePanel). The team
// edits the checklist on its board; the partner follows it on its problem
// and marks the project complete.

import * as React from "react";
import { CalendarCheck, CircleCheck, Handshake, Plus, Trash2 } from "lucide-react";
import { copy } from "@/content/copy";
import { projectMachine } from "@/lib/pipeline/machines";
import { HANDOFF, type CopyCtx, type HandoffCopy } from "@/lib/pipeline/handoffs";
import { LIMITS, type PhaseMilestone } from "@/lib/problems";
import { ApiError } from "@/lib/account";
import { type Meeting, type Selection, refresh, send } from "@/components/projectum/pipeline-store";
import { formatDate } from "@/components/projectum/pipeline-ui";
import { errorText } from "@/components/projectum/transition-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const F = copy.projectum.pipeline.phase;

// A short message and a send button, for the meeting request and the
// selection.
function MessageDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  submit,
  path,
  body = (message) => ({ message }),
  handoff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  placeholder: string;
  submit: string;
  path: string;
  body?: (message: string) => unknown;
  // A hand-off: what happens next, shown above the message.
  handoff?: HandoffCopy;
}) {
  const ids = React.useId();
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setFailed(false);
            try {
              await send(path, "POST", body(message));
              onOpenChange(false);
            } catch {
              setFailed(true);
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription id={`${ids}-d`}>{description}</DialogDescription>
          </DialogHeader>
          {handoff && (
            <div className="grid gap-2 text-sm">
              {handoff.lead && <p className="text-muted-foreground">{handoff.lead}</p>}
              <ol className="grid list-decimal gap-1.5 pl-5">
                {handoff.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {handoff.note && <p className="text-muted-foreground">{handoff.note}</p>}
            </div>
          )}
          <Textarea
            aria-label={title}
            aria-describedby={`${ids}-d`}
            rows={3}
            maxLength={LIMITS.note}
            placeholder={placeholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {F.failed}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{F.cancel}</DialogClose>
            <Button type="submit" disabled={pending}>
              {submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// The partner's buttons on a team whose submission the Lab accepted, or
// where each step stands once taken. Bringing the team on shows only while
// the Worker allows it (`canIntegrate`).
export function PartnerActions({
  projectId,
  meeting,
  selection,
  canIntegrate,
  ctx,
}: {
  projectId: string;
  meeting: Meeting | null | undefined;
  selection: Selection | null | undefined;
  canIntegrate: boolean;
  ctx: CopyCtx;
}) {
  const integrate = HANDOFF["project.integrate"](ctx);
  const [asking, setAsking] = React.useState(false);
  const [selecting, setSelecting] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2" data-partner-actions="">
      {meeting ? (
        <Badge variant="outline">
          <CalendarCheck />
          {meeting.status !== "requested" ? F.meetingArranged : F.meetingRequested}
        </Badge>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAsking(true)}>
          <CalendarCheck />
          {F.requestMeeting}
        </Button>
      )}
      {selection ? (
        <Badge>
          <Handshake />
          {selection.completedAt ? F.complete : F.selected}
        </Badge>
      ) : (
        canIntegrate && (
          <Button size="sm" onClick={() => setSelecting(true)}>
            <Handshake />
            {projectMachine.transitions.integrate.label}
          </Button>
        )
      )}
      <MessageDialog
        open={asking}
        onOpenChange={setAsking}
        title={F.meetingTitle}
        description={F.meetingDescription}
        placeholder={F.meetingPlaceholder}
        submit={F.meetingSend}
        path={`/projects/${encodeURIComponent(projectId)}/meeting`}
      />
      <MessageDialog
        open={selecting}
        onOpenChange={setSelecting}
        title={integrate.title}
        description={F.selectDescription}
        placeholder={F.selectPlaceholder}
        submit={integrate.confirm}
        path={`/projects/${encodeURIComponent(projectId)}/transition`}
        body={(message) => ({ name: "integrate", ...(message.trim() ? { message: message.trim() } : {}) })}
        handoff={integrate}
      />
    </div>
  );
}

// Staff, on a board whose partner asked to meet the team: the request and
// Mark arranged, once the Lab has introduced them by email.
export function StaffMeeting({ meeting }: { meeting: Meeting }) {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  return (
    <div data-staff-meeting="" className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          <CalendarCheck />
          {F.meetingRequested}
        </Badge>
        <span className="text-muted-foreground">{F.meetingSince(formatDate(meeting.createdAt))}</span>
      </div>
      {meeting.message && (
        <div className="grid gap-0.5">
          <p className="text-xs font-medium text-muted-foreground">{F.meetingMessage}</p>
          <p>{meeting.message}</p>
        </div>
      )}
      <p className="text-muted-foreground">{F.meetingHint}</p>
      <Button
        className="justify-self-start"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await send(`/meetings/${encodeURIComponent(meeting.id)}/arranged`, "POST");
          } catch (e) {
            // Someone else marked it first: load the latest instead.
            if (e instanceof ApiError && e.code === "state") refresh();
            else setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {F.markArranged}
      </Button>
      {failed && (
        <p role="alert" className="text-destructive">
          {F.failed}
        </p>
      )}
    </div>
  );
}

// The meeting and internship steps on a project's board: the posting's
// partner asks to meet the team and brings it on; staff mark a requested
// meeting arranged.
const MEETING_STATUSES: readonly string[] = ["delivered", "integrated", "completion_review", "complete"];

export function MeetingActions({
  projectId,
  status,
  meeting,
  selection,
  partner,
  staff,
  canIntegrate,
  ctx,
}: {
  projectId: string;
  status: string;
  meeting: Meeting | null;
  selection: Selection | null;
  partner: boolean;
  staff: boolean;
  canIntegrate: boolean;
  ctx: CopyCtx;
}) {
  if (partner && MEETING_STATUSES.includes(status)) {
    return <PartnerActions projectId={projectId} meeting={meeting} selection={selection} canIntegrate={canIntegrate} ctx={ctx} />;
  }
  if (staff && meeting?.status === "requested") return <StaffMeeting meeting={meeting} />;
  return null;
}

// Phase 2's checklist. The team edits it (`editable`); the partner or the
// approver can mark the project complete (`canComplete`). Once complete it
// locks.
export function PhasePanel({
  projectId,
  selection,
  editable,
  canComplete,
}: {
  projectId: string;
  selection: Selection;
  editable: boolean;
  canComplete: boolean;
}) {
  const [items, setItems] = React.useState<PhaseMilestone[]>(selection.milestones);
  const [seen, setSeen] = React.useState(selection.milestones);
  const [draft, setDraft] = React.useState("");
  const [failed, setFailed] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [completeError, setCompleteError] = React.useState<string | null>(null);
  // A fresh load from the Worker replaces what's shown.
  if (seen !== selection.milestones) {
    setSeen(selection.milestones);
    setItems(selection.milestones);
  }
  const locked = Boolean(selection.completedAt);
  const canEdit = editable && !locked;
  const done = items.filter((m) => m.done).length;

  const save = async (next: PhaseMilestone[]) => {
    setItems(next);
    setFailed(false);
    try {
      await send(`/projects/${projectId}/phase`, "PUT", { milestones: next });
    } catch {
      setFailed(true);
    }
  };

  return (
    <section data-phase-two="" className="grid gap-3 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="text-base font-medium">{F.heading}</h3>
          <p className="text-muted-foreground">{F.intro}</p>
        </div>
        {locked ? (
          <Badge>
            <CircleCheck />
            {F.completedOn(formatDate(selection.completedAt ?? ""))}
          </Badge>
        ) : (
          items.length > 0 && <Badge variant="outline">{F.progress(done, items.length)}</Badge>
        )}
      </div>
      {selection.message && (
        <div className="rounded-md bg-muted p-2.5">
          <p className="text-xs font-medium text-muted-foreground">{F.message}</p>
          <p>{selection.message}</p>
        </div>
      )}
      {items.length ? (
        <ul className="grid gap-1.5">
          {items.map((m, i) => (
            <li key={`${m.title}-${i}`} className="flex items-center gap-2.5">
              <Checkbox
                aria-label={m.title}
                checked={m.done}
                disabled={!canEdit}
                onCheckedChange={(on) => void save(items.map((x, j) => (j === i ? { ...x, done: on === true } : x)))}
              />
              <span className={m.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{m.title}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${F.remove} ${m.title}`}
                  onClick={() => void save(items.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{F.empty}</p>
      )}
      {canEdit && items.length < LIMITS.phaseMilestones && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = draft.trim();
            if (!title) return;
            setDraft("");
            void save([...items, { title, done: false }]);
          }}
        >
          <Input
            aria-label={F.add}
            value={draft}
            maxLength={LIMITS.milestoneTitle}
            placeholder={F.addPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Plus />
            {F.add}
          </Button>
        </form>
      )}
      {failed && <p className="text-destructive">{F.failed}</p>}
      {canComplete && !locked && (
        <Button
          className="justify-self-start"
          size="sm"
          disabled={completing}
          onClick={async () => {
            if (!window.confirm(F.completeConfirm)) return;
            setCompleting(true);
            setCompleteError(null);
            try {
              await send(`/projects/${encodeURIComponent(projectId)}/complete`, "POST");
            } catch (e) {
              const code = e instanceof ApiError ? e.code : "";
              setCompleteError(code === "forbidden" ? errorText("forbidden") : code === "state" ? errorText("state") : F.completeFailed);
              if (code === "state") refresh();
            } finally {
              setCompleting(false);
            }
          }}
        >
          <CircleCheck />
          {F.markComplete}
        </Button>
      )}
      {completeError && (
        <p role="alert" className="text-destructive">
          {completeError}
        </p>
      )}
    </section>
  );
}
