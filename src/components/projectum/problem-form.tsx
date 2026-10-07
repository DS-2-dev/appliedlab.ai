"use client";

// Post a problem, or edit one: a partner's (or a rep's) form. Checked here
// with the same rules the Worker uses (src/lib/problems.ts), so mistakes show
// next to their fields before anything is sent.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { FIELDS, type Field, LIMITS, cleanProblem, problemIssues } from "@/lib/problems";
import { type Problem, send } from "@/components/projectum/pipeline-store";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const P = copy.projectum.pipeline;
const F = P.problemForm;

type Errors = Partial<Record<"title" | "summary" | "fields" | "form", string>>;

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="text-sm text-destructive">
      {text}
    </p>
  ) : null;
}

function ProblemFormBody({ problem, onDone }: { problem?: Problem; onDone: () => void }) {
  const router = useRouter();
  const ids = React.useId();
  const [title, setTitle] = React.useState(problem?.title ?? "");
  const [summary, setSummary] = React.useState(problem?.summary ?? "");
  const [details, setDetails] = React.useState(problem?.details ?? "");
  const [fields, setFields] = React.useState<Field[]>(problem?.fields ?? []);
  const [deliverable, setDeliverable] = React.useState(problem?.deliverable ?? "");
  const [deadline, setDeadline] = React.useState(problem?.deadline ?? "");
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft = cleanProblem({ title, summary, details, fields, deliverable, deadline });
    const issues = problemIssues(draft);
    if (issues.length) {
      setErrors(Object.fromEntries(issues.map((i) => [i, F.errors[i]])));
      document.getElementById(`${ids}-${issues[0]}`)?.focus();
      return;
    }
    setPending(true);
    setErrors({});
    try {
      if (problem) {
        await send(`/problems/${problem.id}`, "PATCH", draft);
        onDone();
      } else {
        const { id } = await send<{ id: string }>("/problems", "POST", draft);
        onDone();
        router.push(`/projectum?problem=${encodeURIComponent(id)}`);
      }
    } catch {
      setErrors({ form: F.errors.failed });
    } finally {
      setPending(false);
    }
  };

  const describe = (key: string, help?: boolean) =>
    [help ? `${ids}-${key}-help` : "", errors[key as keyof Errors] ? `${ids}-${key}-error` : ""].filter(Boolean).join(" ") ||
    undefined;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{problem ? F.editTitle : F.postTitle}</DialogTitle>
        <DialogDescription>{F.description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-title`}>{F.title}</Label>
            <Input
              id={`${ids}-title`}
              value={title}
              maxLength={LIMITS.title}
              placeholder={F.titlePlaceholder}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={describe("title")}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldError id={`${ids}-title-error`} text={errors.title} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${ids}-summary`}>{F.summary}</Label>
            <Input
              id={`${ids}-summary`}
              value={summary}
              maxLength={LIMITS.summary}
              placeholder={F.summaryPlaceholder}
              aria-invalid={errors.summary ? true : undefined}
              aria-describedby={describe("summary")}
              onChange={(e) => setSummary(e.target.value)}
            />
            <FieldError id={`${ids}-summary-error`} text={errors.summary} />
          </div>

          <fieldset className="grid gap-2" aria-describedby={describe("fields", true)}>
            <legend className="mb-2 text-sm font-medium">{F.fields}</legend>
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
            <p id={`${ids}-fields-help`} className="text-xs text-muted-foreground">
              {F.fieldsHelp}
            </p>
            <FieldError id={`${ids}-fields-error`} text={errors.fields} />
          </fieldset>

          <div className="grid gap-2 sm:max-w-56">
            <Label htmlFor={`${ids}-deadline`}>{F.deadline}</Label>
            <Input
              id={`${ids}-deadline`}
              type="date"
              value={deadline}
              aria-describedby={`${ids}-deadline-help`}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p id={`${ids}-deadline-help`} className="text-xs text-muted-foreground">
              {F.deadlineHelp}
            </p>
          </div>

        </div>
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-details`}>{F.details}</Label>
            <Textarea
              id={`${ids}-details`}
              value={details}
              rows={9}
              className="min-h-44"
              maxLength={LIMITS.details}
              placeholder={F.detailsPlaceholder}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${ids}-deliverable`}>{F.deliverable}</Label>
            <Textarea
              id={`${ids}-deliverable`}
              value={deliverable}
              rows={4}
              className="min-h-24"
              maxLength={LIMITS.deliverable}
              placeholder={F.deliverablePlaceholder}
              onChange={(e) => setDeliverable(e.target.value)}
            />
          </div>

        </div>
      </div>

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{F.cancel}</DialogClose>
        <Button type="submit" disabled={pending}>
          {problem ? F.save : F.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Controlled by its opener; every open starts the form fresh.
export function ProblemFormDialog({
  open,
  onOpenChange,
  problem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problem?: Problem;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(64rem,calc(100vw-4rem))]">
        {open && <ProblemFormBody problem={problem} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
