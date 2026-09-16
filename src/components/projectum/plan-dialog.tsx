"use client";

// The plan form: the gate from one stage to the next, and the way back into
// a plan once a project is past a gate.
//
// - Solidifying: Move to Solidifying on a brainstorming project opens this
//   form, and the project only moves once every field is filled: the idea thesis expanded with its reasoning, a plan
//   (tech stack and steps, each with who does it), a role for everyone on
//   the project, and what each role means.
// - Prototype: the same from Solidifying to Prototype, with a Prototype
//   section on top (the GitHub link and a yes or no on Supabase) and the
//   whole plan brought over from last time to edit again.
//
// Closing the form leaves the card where it was. Wide and in columns so the
// whole form fits on one desktop screen without scrolling.

import * as React from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { copy } from "@/content/copy";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/initials";
import {
  MAX_LINE,
  MAX_LONG_TEXT,
  MAX_URL,
  ROLE_IDS,
  type Person,
  type Project,
  type RoleId,
  type Step,
  editPlan,
  editPrototype,
  isRoleId,
  prototypeProblems,
  prototypeProject,
  solidifyProblems,
  solidifyProject,
} from "@/lib/projects";
import { AddPersonMenu } from "@/components/projectum/people-menu";
import { ROLE_STYLE, defaultMeanings, projectMeanings, roleName } from "@/components/projectum/roles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const C = copy.projectum.solidify;
const P = copy.projectum.prototype;
const F = copy.projectum.form;

// The stage the form leads to, and whether it moves a card there or edits a
// card already there.
export type PlanTarget = "solidifying" | "prototype";
export type PlanMode = "move" | "edit";

const TEXT = {
  solidifying: {
    move: { title: C.title, description: C.description, submit: C.submit },
    edit: { title: C.editTitle, description: C.editDescription, submit: C.editSubmit },
  },
  prototype: {
    move: { title: P.title, description: P.description, submit: P.submit },
    edit: { title: P.editTitle, description: P.editDescription, submit: P.editSubmit },
  },
} as const;

const newStep = (): Step => ({ id: crypto.randomUUID(), text: "", ownerId: "" });

function FieldError({ id, show, children }: { id: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {children}
    </p>
  );
}

export function RoleDot({ role }: { role: RoleId }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", ROLE_STYLE[role].dot)} />;
}

function PlanForm({
  project,
  target,
  mode,
  onSave,
}: {
  project: Project;
  target: PlanTarget;
  mode: PlanMode;
  onSave: (next: Project) => void;
}) {
  const ids = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const withPrototype = target === "prototype";
  const [thesis, setThesis] = React.useState(project.plan?.thesis ?? "");
  const [reasoning, setReasoning] = React.useState(project.plan?.reasoning ?? "");
  const [techStack, setTechStack] = React.useState(project.plan?.techStack ?? "");
  const [steps, setSteps] = React.useState<Step[]>(() => (project.plan?.steps.length ? project.plan.steps : [newStep()]));
  const [people, setPeople] = React.useState<Person[]>(project.people);
  const [meanings, setMeanings] = React.useState<Record<RoleId, string>>(() => projectMeanings(project));
  const [githubUrl, setGithubUrl] = React.useState(project.prototype?.githubUrl ?? "");
  const [supabase, setSupabase] = React.useState<boolean | null>(project.prototype?.supabase ?? null);
  const [meaningsOpen, setMeaningsOpen] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);

  const draft = { thesis, reasoning, techStack, steps, people, meanings, githubUrl, supabase };
  const problems = withPrototype ? prototypeProblems(draft) : solidifyProblems(draft);
  const bad = (key: string) => showErrors && problems.includes(key);
  const invalid = (key: string) => (bad(key) ? true : undefined);
  const errId = (key: string) => `${ids}-err-${key.replace(/[^a-z0-9-]/gi, "-")}`;
  const described = (key: string) => (bad(key) ? errId(key) : undefined);
  const text = TEXT[target][mode];

  const setStep = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removePerson = (id: string) => {
    setPeople((p) => p.filter((x) => x.id !== id));
    // Their steps need a new owner.
    setSteps((s) => s.map((x) => (x.ownerId === id ? { ...x, ownerId: "" } : x)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaults = defaultMeanings();
    const next = withPrototype
      ? (mode === "edit" ? editPrototype : prototypeProject)(project, draft, defaults)
      : (mode === "edit" ? editPlan : solidifyProject)(project, draft, defaults);
    if (next) {
      onSave(next);
      return;
    }
    setShowErrors(true);
    if (problems.some((p) => p.startsWith("meaning:"))) setMeaningsOpen(true);
    // After the errors render, put the cursor on the first field missing.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const personName = (id: string | null) => people.find((p) => p.id === id)?.name;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{text.title}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
      </DialogHeader>

      {showErrors && problems.length > 0 && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {C.errors.summary}
        </p>
      )}

      {withPrototype && (
        <section aria-labelledby={`${ids}-h-proto`} className="grid gap-x-6 gap-y-3 rounded-lg border p-4 lg:grid-cols-2">
          <h3 id={`${ids}-h-proto`} className="text-base font-medium lg:col-span-2">
            {P.heading}
          </h3>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${ids}-github`}>{P.github}</Label>
            <Input
              id={`${ids}-github`}
              type="text"
              inputMode="url"
              value={githubUrl}
              maxLength={MAX_URL}
              placeholder={P.githubPlaceholder}
              aria-invalid={invalid("githubUrl")}
              aria-describedby={described("githubUrl")}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <FieldError id={errId("githubUrl")} show={bad("githubUrl")}>{P.errors.githubUrl}</FieldError>
          </div>
          <div className="grid content-start gap-2">
            <span id={`${ids}-supabase`} className="text-sm font-medium">
              {P.supabase}
            </span>
            {/* No answer is picked for the member: yes or no is a choice they
                confirm. */}
            <RadioGroup
              aria-labelledby={`${ids}-supabase`}
              aria-describedby={described("supabase")}
              value={supabase === null ? "" : supabase ? "yes" : "no"}
              onValueChange={(v) => setSupabase(v === "yes")}
              className="flex h-8 items-center gap-6"
            >
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="yes" aria-invalid={invalid("supabase")} />
                {P.supabaseYes}
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="no" aria-invalid={invalid("supabase")} />
                {P.supabaseNo}
              </Label>
            </RadioGroup>
            <FieldError id={errId("supabase")} show={bad("supabase")}>{P.errors.supabase}</FieldError>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-0 lg:[&>*+*]:border-l lg:[&>*+*]:pl-6 lg:[&>*:not(:last-child)]:pr-6">
        {/* Idea */}
        <section aria-labelledby={`${ids}-h-idea`} className="grid content-start gap-4">
          <h3 id={`${ids}-h-idea`} className="text-base font-medium">
            {C.ideaHeading}
          </h3>
          {project.description && !withPrototype && (
            <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
              <span className="font-medium">{C.idea}</span>
              <p className="line-clamp-4 whitespace-pre-line text-muted-foreground">{project.description}</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-thesis`}>{C.thesis}</Label>
            <Textarea
              id={`${ids}-thesis`}
              value={thesis}
              rows={withPrototype ? 5 : 6}
              maxLength={MAX_LONG_TEXT}
              placeholder={C.thesisPlaceholder}
              aria-invalid={invalid("thesis")}
              aria-describedby={described("thesis")}
              onChange={(e) => setThesis(e.target.value)}
            />
            <FieldError id={errId("thesis")} show={bad("thesis")}>{C.errors.thesis}</FieldError>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-reasoning`}>{C.reasoning}</Label>
            <Textarea
              id={`${ids}-reasoning`}
              value={reasoning}
              rows={4}
              maxLength={MAX_LONG_TEXT}
              placeholder={C.reasoningPlaceholder}
              aria-invalid={invalid("reasoning")}
              aria-describedby={described("reasoning")}
              onChange={(e) => setReasoning(e.target.value)}
            />
            <FieldError id={errId("reasoning")} show={bad("reasoning")}>{C.errors.reasoning}</FieldError>
          </div>
        </section>

        {/* Plan */}
        <section aria-labelledby={`${ids}-h-plan`} className="grid content-start gap-4">
          <h3 id={`${ids}-h-plan`} className="text-base font-medium">
            {C.plan}
          </h3>
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-stack`}>{C.techStack}</Label>
            <Input
              id={`${ids}-stack`}
              value={techStack}
              maxLength={MAX_LINE}
              placeholder={C.techStackPlaceholder}
              aria-invalid={invalid("techStack")}
              aria-describedby={described("techStack")}
              onChange={(e) => setTechStack(e.target.value)}
            />
            <FieldError id={errId("techStack")} show={bad("techStack")}>{C.errors.techStack}</FieldError>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">{C.steps}</span>
            <ol className="grid gap-2">
              {steps.map((step, i) => (
                <li key={step.id} className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                    <Input
                      className="min-w-0 flex-1"
                      value={step.text}
                      maxLength={MAX_LINE}
                      placeholder={C.stepPlaceholder}
                      aria-label={`${C.step} ${i + 1}`}
                      aria-invalid={invalid(`step-text:${step.id}`)}
                      aria-describedby={described(`step-text:${step.id}`)}
                      onChange={(e) => setStep(step.id, { text: e.target.value })}
                    />
                    <Select
                      value={step.ownerId || null}
                      onValueChange={(v) => setStep(step.id, { ownerId: typeof v === "string" ? v : "" })}
                    >
                      <SelectTrigger
                        className="w-40 shrink-0"
                        aria-label={`${C.stepOwner} (${C.step} ${i + 1})`}
                        aria-invalid={invalid(`step-owner:${step.id}`)}
                        aria-describedby={described(`step-owner:${step.id}`)}
                        disabled={people.length === 0}
                      >
                        <SelectValue>{(v: string | null) => personName(v) ?? C.stepOwner}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${C.removeStep} ${i + 1}`}
                      onClick={() => setSteps((s) => s.filter((x) => x.id !== step.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="pl-7">
                    <FieldError id={errId(`step-text:${step.id}`)} show={bad(`step-text:${step.id}`)}>{C.errors.stepText}</FieldError>
                    <FieldError id={errId(`step-owner:${step.id}`)} show={bad(`step-owner:${step.id}`)}>{C.errors.stepOwner}</FieldError>
                  </div>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              aria-invalid={invalid("steps")}
              aria-describedby={described("steps")}
              onClick={() => setSteps((s) => [...s, newStep()])}
            >
              <Plus />
              {C.addStep}
            </Button>
            <FieldError id={errId("steps")} show={bad("steps")}>{C.errors.steps}</FieldError>
          </div>
        </section>

        {/* People and roles */}
        <section aria-labelledby={`${ids}-h-roles`} className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${ids}-h-roles`} className="text-base font-medium">
              {C.roles}
            </h3>
            <AddPersonMenu people={people} onAdd={(person) => setPeople((p) => [...p, person])} />
          </div>
          {people.length ? (
            <ul aria-labelledby={`${ids}-h-roles`} className="grid gap-1 rounded-lg border p-1">
              {people.map((person) => (
                <li key={person.id} className="grid gap-1 rounded-md px-2 py-1.5">
                  <div className="flex items-center gap-2.5 text-sm">
                    <Avatar
                      size="sm"
                      className={cn("ring-2 ring-offset-2 ring-offset-background", person.role ? ROLE_STYLE[person.role].ring : "ring-transparent")}
                    >
                      <AvatarFallback>{initials(person.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    <Select
                      value={person.role}
                      onValueChange={(v) =>
                        setPeople((p) => p.map((x) => (x.id === person.id ? { ...x, role: isRoleId(v) ? v : null } : x)))
                      }
                    >
                      <SelectTrigger
                        className="w-36 shrink-0"
                        aria-label={`${C.roleFor} ${person.name}`}
                        aria-invalid={invalid(`role:${person.id}`)}
                        aria-describedby={described(`role:${person.id}`)}
                      >
                        <SelectValue>
                          {(v: string | null) =>
                            isRoleId(v) ? (
                              <>
                                <RoleDot role={v} />
                                {roleName(v)}
                              </>
                            ) : (
                              C.rolePlaceholder
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_IDS.map((role) => (
                          <SelectItem key={role} value={role}>
                            <RoleDot role={role} />
                            {roleName(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${F.removePerson} ${person.name}`}
                      onClick={() => removePerson(person.id)}
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="pl-9">
                    <FieldError id={errId(`role:${person.id}`)} show={bad(`role:${person.id}`)}>{C.errors.role}</FieldError>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p id={errId("people")} className={cn("text-sm", bad("people") ? "text-destructive" : "text-muted-foreground")}>
              {bad("people") ? C.errors.people : F.noPeople}
            </p>
          )}

          <Collapsible open={meaningsOpen} onOpenChange={setMeaningsOpen}>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="sm" className="justify-self-start [&[data-panel-open]>svg]:rotate-180" />}
            >
              {C.editMeanings}
              <ChevronDown className="transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 grid gap-2.5 rounded-lg border p-3">
                {ROLE_IDS.map((role) => (
                  <div key={role} className="grid gap-1">
                    <Label htmlFor={`${ids}-meaning-${role}`} className="flex items-center gap-2 text-xs">
                      <RoleDot role={role} />
                      {roleName(role)}
                    </Label>
                    <Input
                      id={`${ids}-meaning-${role}`}
                      value={meanings[role]}
                      maxLength={MAX_LINE}
                      className="h-7 text-xs"
                      aria-invalid={invalid(`meaning:${role}`)}
                      aria-describedby={described(`meaning:${role}`)}
                      onChange={(e) => setMeanings((m) => ({ ...m, [role]: e.target.value }))}
                    />
                    <FieldError id={errId(`meaning:${role}`)} show={bad(`meaning:${role}`)}>{C.errors.meaning}</FieldError>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{copy.projectum.cancel}</DialogClose>
        <Button type="submit">{text.submit}</Button>
      </DialogFooter>
    </form>
  );
}

export function PlanDialog({
  project,
  target,
  mode,
  open,
  onOpenChange,
  formKey,
  onSave,
}: {
  project: Project;
  target: PlanTarget;
  mode: PlanMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Changes each time the dialog opens, so the form starts from what the
  // project has.
  formKey: number;
  onSave: (next: Project) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(80rem,calc(100vw-4rem))]">
        <PlanForm key={formKey} project={project} target={target} mode={mode} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
