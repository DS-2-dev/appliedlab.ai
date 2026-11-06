"use client";

// The action plan, on the project's board while the team writes it (claimed,
// or back with notes): the approach, the milestones (each with what success
// looks like) and a finish date. Save plan stores it (PUT /projects/:id/plan)
// and the Worker writes it into the board's Solidifying steps as well.
// Submit action plan checks it is whole, shows what happens next, then saves
// any changes and hands it to the representatives.

import * as React from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { copy } from "@/content/copy";
import { ApiError } from "@/lib/account";
import { HANDOFF, type CopyCtx } from "@/lib/pipeline/handoffs";
import { projectMachine } from "@/lib/pipeline/machines";
import { LIMITS, type PlanDraft, planIssues } from "@/lib/problems";
import { HandoffDialog } from "@/components/projectum/handoff-dialog";
import { type PipelineProject, send } from "@/components/projectum/pipeline-store";
import { draftFrom, draftToPlan, emptyMilestone, planChanged } from "@/components/projectum/project-helpers";
import { errorText } from "@/components/projectum/transition-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const P = copy.projectum.pipeline;
const E = P.planEditor;

export function PlanEditor({ project, ctx }: { project: PipelineProject; ctx: CopyCtx }) {
  const ids = React.useId();
  const [draft, setDraft] = React.useState<PlanDraft>(() => draftFrom(project.plan));
  const [seen, setSeen] = React.useState(project.plan);
  const [showIssues, setShowIssues] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // A fresh load (the board's plan form saved, say) replaces the draft,
  // unless there are changes here not yet saved.
  if (seen !== project.plan) {
    setSeen(project.plan);
    if (!planChanged(draft, seen)) setDraft(draftFrom(project.plan));
  }
  const dirty = planChanged(draft, project.plan);
  const issues = planIssues(draftToPlan(draft));

  const setMilestone = (i: number, patch: Partial<PlanDraft["milestones"][number]>) =>
    setDraft((d) => ({ ...d, milestones: d.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  async function save(): Promise<boolean> {
    try {
      await send(`/projects/${encodeURIComponent(project.id)}/plan`, "PUT", draftToPlan(draft));
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.code === "state" ? E.errors.state : E.errors.failed);
      return false;
    }
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    await save();
    setBusy(false);
  }

  function onSubmit() {
    setError(null);
    if (issues.length) {
      setShowIssues(true);
      return;
    }
    setConfirming(true);
  }

  async function confirmSubmit() {
    setBusy(true);
    setError(null);
    try {
      if (dirty && !(await save())) return;
      await send(`/projects/${encodeURIComponent(project.id)}/transition`, "POST", { name: "submitPlan" });
      setConfirming(false);
    } catch (e) {
      setError(e instanceof ApiError ? errorText(e.code, e.issues) : errorText(""));
    } finally {
      setBusy(false);
    }
  }

  const issueText = showIssues ? issues.map((i) => E.errors[i]) : [];

  return (
    <section data-plan-editor="" aria-labelledby={`${ids}-h`} className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 id={`${ids}-h`} className="text-base font-medium">
          {E.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{E.description}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-approach`}>{P.plan.approach}</Label>
        <Textarea
          id={`${ids}-approach`}
          rows={4}
          value={draft.approach}
          maxLength={LIMITS.approach}
          placeholder={E.approachPlaceholder}
          aria-invalid={showIssues && issues.includes("approach") ? true : undefined}
          onChange={(e) => setDraft((d) => ({ ...d, approach: e.target.value }))}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{P.plan.milestones}</legend>
        <ol className="grid gap-2">
          {draft.milestones.map((m, i) => {
            const bad = showIssues && issues.includes("milestone") && (!m.title.trim() || !m.criterion.trim());
            return (
              <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2">
                <span className="text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                <Input
                  value={m.title}
                  maxLength={LIMITS.milestoneTitle}
                  placeholder={E.titlePlaceholder}
                  aria-label={E.milestone(i + 1)}
                  aria-invalid={bad && !m.title.trim() ? true : undefined}
                  onChange={(e) => setMilestone(i, { title: e.target.value })}
                />
                <Input
                  value={m.criterion}
                  maxLength={LIMITS.milestoneCriterion}
                  placeholder={E.criterionPlaceholder}
                  aria-label={`${P.plan.criterion} (${E.milestone(i + 1)})`}
                  aria-invalid={bad && !m.criterion.trim() ? true : undefined}
                  onChange={(e) => setMilestone(i, { criterion: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={E.remove(i + 1)}
                  onClick={() => setDraft((d) => ({ ...d, milestones: d.milestones.filter((_, j) => j !== i) }))}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ol>
        {draft.milestones.length < LIMITS.milestones && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setDraft((d) => ({ ...d, milestones: [...d.milestones, emptyMilestone()] }))}
          >
            <Plus />
            {E.add}
          </Button>
        )}
      </fieldset>

      <div className="grid max-w-56 gap-2">
        <Label htmlFor={`${ids}-finish`}>{P.plan.finishBy}</Label>
        <Input
          id={`${ids}-finish`}
          type="date"
          value={draft.finishBy}
          aria-describedby={`${ids}-finish-help`}
          onChange={(e) => setDraft((d) => ({ ...d, finishBy: e.target.value }))}
        />
        <p id={`${ids}-finish-help`} className="text-xs text-muted-foreground">
          {E.finishByHelp}
        </p>
      </div>

      {issueText.length > 0 && (
        <ul role="alert" className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {issueText.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {error && !confirming && (
        <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {dirty ? E.unsaved : E.saved}
        </span>
        <Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => void onSave()}>
          {E.save}
        </Button>
        <Button type="button" disabled={busy} onClick={onSubmit}>
          <Send data-icon="inline-start" />
          {projectMachine.transitions.submitPlan.label}
        </Button>
      </div>

      {confirming && (
        <HandoffDialog
          open
          copy={HANDOFF["project.submitPlan"](ctx)}
          busy={busy}
          error={error}
          onConfirm={() => void confirmSubmit()}
          onCancel={() => {
            setConfirming(false);
            setError(null);
          }}
        />
      )}
    </section>
  );
}
