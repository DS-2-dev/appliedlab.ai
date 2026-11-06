"use client";

// Post a problem, or edit a posting: a partner's (or, for the Lab, an
// admin's) form. "Save draft" keeps it to the organization; "Send for
// review" shows the posting.submit hand-off and then sends it to the
// representatives. Checked here with the Worker's own rules
// (src/lib/problems.ts), so mistakes show next to their fields first.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { ApiError, useAccount } from "@/lib/account";
import { HANDOFF } from "@/lib/pipeline/handoffs";
import { EFFORTS, type Effort, LIMITS, type PostingIssue, cleanPosting, postingIssues } from "@/lib/problems";
import { HandoffDialog } from "@/components/projectum/handoff-dialog";
import { type Posting, send } from "@/components/projectum/pipeline-store";
import { useTaxonomy } from "@/components/projectum/pipeline-ui";
import { tagsFromText } from "@/components/projectum/posting-helpers";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const P = copy.projectum.pipeline;
const F = P.postingForm;
const NO_EFFORT = "none";

type Errors = Partial<Record<PostingIssue | "form", string>>;

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="text-sm text-destructive">
      {text}
    </p>
  ) : null;
}

function PostingFormBody({
  posting,
  orgName,
  firstPosting,
  onDone,
}: {
  posting?: Posting;
  orgName: string;
  firstPosting: boolean;
  onDone: () => void;
}) {
  const me = useAccount();
  const router = useRouter();
  const ids = React.useId();
  const { taxonomy } = useTaxonomy();
  const [title, setTitle] = React.useState(posting?.title ?? "");
  const [summary, setSummary] = React.useState(posting?.summary ?? "");
  const [details, setDetails] = React.useState(posting?.details ?? "");
  const [disciplines, setDisciplines] = React.useState<string[]>(posting?.disciplines ?? []);
  const [tags, setTags] = React.useState((posting?.tags ?? []).join(", "));
  const [effort, setEffort] = React.useState<"" | Effort>(posting?.effort ?? "");
  const [deliverable, setDeliverable] = React.useState(posting?.deliverable ?? "");
  const [deadline, setDeadline] = React.useState(posting?.deadline ?? "");
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  // A new posting may be sent at once; an existing one while it is a draft
  // or came back with notes.
  const canSend = !posting || posting.transitions.includes("submit");
  // Kept disciplines stand even if the taxonomy retired them since.
  const allowed = [...(taxonomy?.disciplines.map((d) => d.slug) ?? []), ...(posting?.disciplines ?? [])];
  const draft = () =>
    cleanPosting({ title, summary, details, disciplines, tags: tagsFromText(tags), effort, deliverable, deadline }, allowed);

  const showIssues = (issues: string[]) => {
    const known = issues.filter((i): i is PostingIssue => i === "title" || i === "summary" || i === "disciplines");
    setErrors(Object.fromEntries(known.map((i) => [i, F.errors[i]])));
    if (known[0]) document.getElementById(`${ids}-${known[0]}`)?.focus();
    return known.length > 0;
  };

  const check = (forSubmit: boolean) => {
    const issues = postingIssues(draft(), { forSubmit });
    if (issues.length) {
      showIssues(issues);
      return false;
    }
    setErrors({});
    return true;
  };

  // A refusal from the Worker: field issues go next to their fields.
  const refused = (err: unknown): string => {
    if (err instanceof ApiError && err.code === "plan" && err.issues?.length && showIssues(err.issues)) return "";
    if (err instanceof ApiError && err.code === "state") return F.errors.state;
    return F.errors.failed;
  };

  const finish = (id: string) => {
    onDone();
    if (!posting) router.push(`/projectum?posting=${encodeURIComponent(id)}`);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check(false)) return;
    setPending(true);
    try {
      if (posting) {
        await send(`/postings/${encodeURIComponent(posting.id)}`, "PATCH", draft());
        finish(posting.id);
      } else {
        const { id } = await send<{ id: string }>("/postings", "POST", { ...draft(), send: false });
        finish(id);
      }
    } catch (err) {
      const text = refused(err);
      if (text) setErrors({ form: text });
    } finally {
      setPending(false);
    }
  };

  const sendForReview = async () => {
    setPending(true);
    setSendError(null);
    try {
      if (posting) {
        await send(`/postings/${encodeURIComponent(posting.id)}`, "PATCH", draft());
        await send(`/postings/${encodeURIComponent(posting.id)}/transition`, "POST", { name: "submit" });
        finish(posting.id);
      } else {
        const { id } = await send<{ id: string }>("/postings", "POST", { ...draft(), send: true });
        finish(id);
      }
    } catch (err) {
      const text = refused(err);
      if (text) setSendError(text);
      else setConfirming(false);
    } finally {
      setPending(false);
    }
  };

  const describe = (key: PostingIssue, help?: boolean) =>
    [help ? `${ids}-${key}-help` : "", errors[key] ? `${ids}-${key}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{posting ? F.editTitle : F.postTitle}</DialogTitle>
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

          <fieldset className="grid gap-2" aria-describedby={describe("disciplines", true)}>
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
            <p id={`${ids}-disciplines-help`} className="text-xs text-muted-foreground">
              {F.disciplinesHelp}
            </p>
            <FieldError id={`${ids}-disciplines-error`} text={errors.disciplines} />
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor={`${ids}-tags`}>{F.tags}</Label>
            <Input
              id={`${ids}-tags`}
              value={tags}
              placeholder={F.tagsPlaceholder}
              aria-describedby={`${ids}-tags-help`}
              onChange={(e) => setTags(e.target.value)}
            />
            <p id={`${ids}-tags-help`} className="text-xs text-muted-foreground">
              {F.tagsHelp}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid content-start gap-2">
              <Label htmlFor={`${ids}-effort`}>{F.effort}</Label>
              <Select value={effort || NO_EFFORT} onValueChange={(v) => setEffort(EFFORTS.find((x) => x === v) ?? "")}>
                <SelectTrigger id={`${ids}-effort`} className="w-full">
                  <SelectValue>{(v: string | null) => (v && v !== NO_EFFORT ? P.efforts[v as Effort] : F.effortNone)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EFFORT}>{F.effortNone}</SelectItem>
                  {EFFORTS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {P.efforts[x]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-2">
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
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-details`}>{F.details}</Label>
            <Textarea
              id={`${ids}-details`}
              value={details}
              rows={10}
              className="min-h-52"
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
        <Button type="submit" variant={canSend ? "outline" : "default"} disabled={pending}>
          {posting ? F.save : F.saveDraft}
        </Button>
        {canSend && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setSendError(null);
              if (check(true)) setConfirming(true);
            }}
          >
            {F.send}
          </Button>
        )}
      </DialogFooter>

      {confirming && (
        <HandoffDialog
          open
          copy={HANDOFF["posting.submit"]({ partner: orgName, member: me.name, posting: title.trim(), firstPosting })}
          busy={pending}
          error={sendError}
          onConfirm={() => void sendForReview()}
          onCancel={() => {
            setConfirming(false);
            setSendError(null);
          }}
        />
      )}
    </form>
  );
}

// Controlled by its opener; every open starts the form fresh.
export function PostingFormDialog({
  open,
  onOpenChange,
  posting,
  orgName = "",
  firstPosting = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Given, the form edits it.
  posting?: Posting;
  orgName?: string;
  // Changes the hand-off: a representative reaches out about a first one.
  firstPosting?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(64rem,calc(100vw-4rem))]">
        {open && (
          <PostingFormBody posting={posting} orgName={orgName} firstPosting={firstPosting} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
