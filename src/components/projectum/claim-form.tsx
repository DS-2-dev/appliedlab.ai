"use client";

// Claim a problem: a member's action plan, with an approach, milestones that
// each say how success is judged, an optional finish date and teammates.
// The same form proposes a project of the member's own (Add Project), with
// what the project is above the plan. Checked with the Worker's rules
// (src/lib/problems.ts) before it is sent.

import * as React from "react";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
import { copy } from "@/content/copy";
import { ApiError, useAccount } from "@/lib/account";
import { initials } from "@/lib/initials";
import { FIELDS, type Field, LIMITS, type Milestone, claimIssues, cleanClaim, cleanProblem, problemIssues } from "@/lib/problems";
import { usePeople } from "@/components/projectum/people-store";
import { type Problem, send } from "@/components/projectum/pipeline-store";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const P = copy.projectum.pipeline;
const F = P.claimForm;
const PF = P.problemForm;
const PR = P.proposal;

type ErrorField = "approach" | "milestones" | "title" | "summary" | "fields";

// With a problem, a claim on it; without one, a proposal of the member's
// own project.
function ClaimFormBody({ problem, onDone }: { problem?: Problem; onDone: () => void }) {
  const me = useAccount();
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [fields, setFields] = React.useState<Field[]>([]);
  const [details, setDetails] = React.useState("");
  const ids = React.useId();
  const people = usePeople();
  const [approach, setApproach] = React.useState("");
  const [milestones, setMilestones] = React.useState<Milestone[]>([{ title: "", criterion: "" }]);
  const [finishBy, setFinishBy] = React.useState("");
  const [teammates, setTeammates] = React.useState<{ id: string; name: string }[]>([]);
  const [error, setError] = React.useState<{ field?: ErrorField; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  const available = (people ?? []).filter(
    (p) => p.role === "member" && p.id !== me.id && !teammates.some((t) => t.id === p.id),
  );

  const setMilestone = (i: number, patch: Partial<Milestone>) =>
    setMilestones((list) => list.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft = cleanClaim({ approach, milestones, finishBy, teammates: teammates.map((t) => t.id) });
    const project = cleanProblem({ title, summary, fields, details });
    const [projectIssue] = problem ? [] : problemIssues(project);
    if (projectIssue) {
      setError({ field: projectIssue, text: PF.errors[projectIssue] });
      document.getElementById(`${ids}-${projectIssue}`)?.focus();
      return;
    }
    const [issue] = claimIssues(draft);
    if (issue) {
      setError({ field: issue === "approach" ? "approach" : "milestones", text: F.errors[issue] });
      document.getElementById(issue === "approach" ? `${ids}-approach` : `${ids}-m0-title`)?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (problem) {
        await send(`/problems/${problem.id}/claims`, "POST", draft);
        onDone();
      } else {
        await send("/proposals", "POST", { problem: project, plan: draft });
        onDone();
        router.push("/projectum?view=claims");
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError({
        text: code === "already-claimed" ? F.errors.alreadyClaimed : code === "closed" ? F.errors.closed : F.errors.failed,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{problem ? F.title : PR.title}</DialogTitle>
        <DialogDescription>{problem ? `${problem.title}. ${F.description}` : PR.description}</DialogDescription>
      </DialogHeader>

      {!problem && (
        <section aria-labelledby={`${ids}-h-project`} className="grid gap-4 rounded-lg border p-4">
          <h3 id={`${ids}-h-project`} className="text-base font-medium">
            {PR.heading}
          </h3>
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-title`}>{PF.title}</Label>
            <Input
              id={`${ids}-title`}
              value={title}
              maxLength={LIMITS.title}
              aria-invalid={error?.field === "title" ? true : undefined}
              onChange={(e) => setTitle(e.target.value)}
            />
            {error?.field === "title" && <p className="text-sm text-destructive">{error.text}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-summary`}>{PF.summary}</Label>
            <Input
              id={`${ids}-summary`}
              value={summary}
              maxLength={LIMITS.summary}
              aria-invalid={error?.field === "summary" ? true : undefined}
              onChange={(e) => setSummary(e.target.value)}
            />
            {error?.field === "summary" && <p className="text-sm text-destructive">{error.text}</p>}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{PF.fields}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FIELDS.map((f, i) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={i === 0 ? `${ids}-fields` : undefined}
                    checked={fields.includes(f)}
                    onCheckedChange={(on) => setFields((list) => (on ? [...list, f] : list.filter((x) => x !== f)))}
                  />
                  {P.fields[f]}
                </label>
              ))}
            </div>
            {error?.field === "fields" && <p className="text-sm text-destructive">{error.text}</p>}
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-details`}>{PF.details}</Label>
            <Textarea
              id={`${ids}-details`}
              rows={3}
              value={details}
              maxLength={LIMITS.details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </section>
      )}

      {!problem && <h3 className="-mb-2 text-base font-medium">{PR.planHeading}</h3>}

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-approach`}>{F.approach}</Label>
        <Textarea
          id={`${ids}-approach`}
          value={approach}
          rows={4}
          maxLength={LIMITS.approach}
          placeholder={F.approachPlaceholder}
          aria-invalid={error?.field === "approach" ? true : undefined}
          aria-describedby={error?.field === "approach" ? `${ids}-approach-error` : undefined}
          onChange={(e) => setApproach(e.target.value)}
        />
        {error?.field === "approach" && (
          <p id={`${ids}-approach-error`} className="text-sm text-destructive">
            {error.text}
          </p>
        )}
      </div>

      <fieldset className="grid gap-3" aria-describedby={`${ids}-m-help`}>
        <legend className="mb-1 text-sm font-medium">{F.milestones}</legend>
        <p id={`${ids}-m-help`} className="-mt-2 text-xs text-muted-foreground">
          {F.milestonesHelp}
        </p>
        <ol className="grid gap-3">
          {milestones.map((m, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr_auto] items-start gap-2 rounded-lg border p-3">
              <span className="pt-2 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
              <div className="grid gap-2">
                <Input
                  id={`${ids}-m${i}-title`}
                  aria-label={`${F.milestoneTitle} ${i + 1}`}
                  value={m.title}
                  maxLength={LIMITS.milestoneTitle}
                  placeholder={i === 0 ? F.milestoneTitlePlaceholder : F.milestoneTitle}
                  aria-invalid={error?.field === "milestones" && !m.title.trim() ? true : undefined}
                  onChange={(e) => setMilestone(i, { title: e.target.value })}
                />
                <Input
                  aria-label={`${F.milestoneCriterion} ${i + 1}`}
                  value={m.criterion}
                  maxLength={LIMITS.milestoneCriterion}
                  placeholder={i === 0 ? F.milestoneCriterionPlaceholder : F.milestoneCriterion}
                  aria-invalid={error?.field === "milestones" && !m.criterion.trim() ? true : undefined}
                  onChange={(e) => setMilestone(i, { criterion: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${F.removeMilestone} ${i + 1}`}
                disabled={milestones.length === 1}
                onClick={() => setMilestones((list) => list.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        {error?.field === "milestones" && <p className="text-sm text-destructive">{error.text}</p>}
        {milestones.length < LIMITS.milestones && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setMilestones((list) => [...list, { title: "", criterion: "" }])}
          >
            <Plus />
            {F.addMilestone}
          </Button>
        )}
      </fieldset>

      <div className="grid gap-2 sm:max-w-56">
        <Label htmlFor={`${ids}-finish`}>{F.finishBy}</Label>
        <Input id={`${ids}-finish`} type="date" value={finishBy} onChange={(e) => setFinishBy(e.target.value)} />
        <p className="text-xs text-muted-foreground">{F.finishByHelp}</p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span id={`${ids}-team`} className="text-sm font-medium">
            {F.teammates}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!available.length || teammates.length >= LIMITS.teammates}
                />
              }
            >
              <UserPlus />
              {F.addTeammate}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
              {available.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => setTeammates((t) => [...t, { id: p.id, name: p.name }])}>
                  <Avatar size="sm">
                    <AvatarFallback>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {teammates.length ? (
          <ul aria-labelledby={`${ids}-team`} className="grid gap-1 rounded-lg border p-1">
            {teammates.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                <Avatar size="sm">
                  <AvatarFallback>{initials(t.name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{t.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${F.removeTeammate} ${t.name}`}
                  onClick={() => setTeammates((list) => list.filter((x) => x.id !== t.id))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{F.teammatesHelp}</p>
        )}
      </div>

      {error && !error.field && (
        <p role="alert" className="text-sm text-destructive">
          {error.text}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{F.cancel}</DialogClose>
        <Button type="submit" disabled={pending}>
          {problem ? F.submit : PR.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ClaimFormDialog({
  open,
  onOpenChange,
  problem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problem: Problem;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && <ClaimFormBody problem={problem} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

// Add Project: a member proposes a project of their own with a plan.
export function ProposalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && <ClaimFormBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
