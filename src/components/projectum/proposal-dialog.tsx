"use client";

// Add Project: a member proposes a project of their own (POST /proposals).
// What the project is and who is on it; the project opens claimed with its
// board, where the team writes the action plan and sends it for review, as
// after a claim. Checked with the Worker's rules for a posting sent for
// review (src/lib/problems.ts) before it is sent.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { ApiError, api } from "@/lib/account";
import { LIMITS, type PostingIssue, cleanPosting, postingIssues } from "@/lib/problems";
import { type PipelineProject, type Person, send } from "@/components/projectum/pipeline-store";
import { TeammatePicker, useTaxonomy } from "@/components/projectum/pipeline-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const P = copy.projectum.pipeline;
const F = P.postingForm;
const R = P.proposal;

function ProposalBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const ids = React.useId();
  const { taxonomy } = useTaxonomy();
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [disciplines, setDisciplines] = React.useState<string[]>([]);
  const [team, setTeam] = React.useState<Person[]>([]);
  const [error, setError] = React.useState<{ field?: PostingIssue; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const posting = cleanPosting({ title, summary, details, disciplines }, taxonomy?.disciplines.map((d) => d.slug) ?? []);
    const [issue] = postingIssues(posting, { forSubmit: true });
    if (issue) {
      setError({ field: issue, text: F.errors[issue] });
      document.getElementById(`${ids}-${issue}`)?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { id } = await send<{ id: string }>("/proposals", "POST", { posting, teammates: team.map((t) => t.id) });
      const project = await api<PipelineProject>(`/projects/${encodeURIComponent(id)}`).catch(() => null);
      onDone();
      router.push(
        project?.boardId
          ? `/projectum?project=${encodeURIComponent(project.boardId)}`
          : `/projectum?view=project&id=${encodeURIComponent(id)}`,
      );
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError({ text: code === "teammates" ? P.claim.teammates : R.failed });
    } finally {
      setPending(false);
    }
  };

  const invalid = (f: PostingIssue) => (error?.field === f ? true : undefined);
  const fieldError = (f: PostingIssue) =>
    error?.field === f ? (
      <p id={`${ids}-${f}-error`} className="text-sm text-destructive">
        {error.text}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{R.title}</DialogTitle>
        <DialogDescription>{R.description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-title`}>{F.title}</Label>
            <Input
              id={`${ids}-title`}
              value={title}
              maxLength={LIMITS.title}
              aria-invalid={invalid("title")}
              onChange={(e) => setTitle(e.target.value)}
            />
            {fieldError("title")}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-summary`}>{F.summary}</Label>
            <Input
              id={`${ids}-summary`}
              value={summary}
              maxLength={LIMITS.summary}
              aria-invalid={invalid("summary")}
              onChange={(e) => setSummary(e.target.value)}
            />
            {fieldError("summary")}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{F.disciplines}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(taxonomy?.disciplines ?? []).map((d, i) => (
                <label key={d.slug} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={i === 0 ? `${ids}-disciplines` : undefined}
                    checked={disciplines.includes(d.slug)}
                    onCheckedChange={(on) =>
                      setDisciplines((list) => (on ? [...list, d.slug] : list.filter((x) => x !== d.slug)))
                    }
                  />
                  {d.name}
                </label>
              ))}
            </div>
            {fieldError("disciplines")}
          </fieldset>
          <TeammatePicker value={team} onChange={setTeam} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${ids}-details`}>{F.details}</Label>
          <Textarea
            id={`${ids}-details`}
            rows={10}
            className="min-h-52"
            value={details}
            maxLength={LIMITS.details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
      </div>

      {error && !error.field && (
        <p role="alert" className="text-sm text-destructive">
          {error.text}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{R.cancel}</DialogClose>
        <Button type="submit" disabled={pending}>
          {R.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Controlled by its opener; every open starts the form fresh.
export function ProposalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(64rem,calc(100vw-4rem))]">
        {open && <ProposalBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
