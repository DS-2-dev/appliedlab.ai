"use client";

// The form from Prototype to Live, the last stage: where to see the finished
// project (the live site or portal, the presentation slides and a demo),
// what each person contributed, and a confirmation that the credits are
// accurate. Every field is required. Contributions start from the steps each
// person owned, and the confirmation always starts unticked, on the way in
// and on every edit after.

import * as React from "react";
import { Rocket } from "lucide-react";
import { copy } from "@/content/copy";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/initials";
import { MAX_LINE, MAX_URL, type Project, editLaunch, liveProblems, liveProject } from "@/lib/projects";
import { RoleDot } from "@/components/projectum/plan-dialog";
import { ROLE_STYLE, roleName } from "@/components/projectum/roles";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const L = copy.projectum.live;

// Moving a prototype to Live, or editing a Live project's launch.
export type LiveMode = "move" | "edit";

type UrlKey = "siteUrl" | "slidesUrl" | "demoUrl";

// What the launch has saved, or else the steps each person owned.
function startingContributions(project: Project): Record<string, string> {
  const out: Record<string, string> = {};
  for (const person of project.people) {
    const owned = (project.plan?.steps ?? []).filter((s) => s.ownerId === person.id).map((s) => s.text);
    out[person.id] = project.launch?.contributions[person.id] ?? owned.join(", ").slice(0, MAX_LINE);
  }
  return out;
}

function LiveForm({ project, mode, onSave }: { project: Project; mode: LiveMode; onSave: (next: Project) => void }) {
  const ids = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [urls, setUrls] = React.useState<Record<UrlKey, string>>({
    siteUrl: project.launch?.siteUrl ?? "",
    slidesUrl: project.launch?.slidesUrl ?? "",
    demoUrl: project.launch?.demoUrl ?? "",
  });
  const [contributions, setContributions] = React.useState(() => startingContributions(project));
  const [confirmed, setConfirmed] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);

  const draft = { ...urls, contributions, confirmed };
  const problems = liveProblems(draft, project.people);
  const bad = (key: string) => showErrors && problems.includes(key);
  const errId = (key: string) => `${ids}-err-${key.replace(/[^a-z0-9-]/gi, "-")}`;
  const edit = mode === "edit";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = edit ? editLaunch(project, draft) : liveProject(project, draft);
    if (next) {
      onSave(next);
      return;
    }
    setShowErrors(true);
    // After the errors render, put the cursor on the first field missing.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const urlFields: { key: UrlKey; label: string; placeholder: string }[] = [
    { key: "siteUrl", label: L.site, placeholder: L.sitePlaceholder },
    { key: "slidesUrl", label: L.slides, placeholder: L.slidesPlaceholder },
    { key: "demoUrl", label: L.demo, placeholder: L.demoPlaceholder },
  ];

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{edit ? L.editTitle : L.title}</DialogTitle>
        <DialogDescription>{edit ? L.editDescription : L.description}</DialogDescription>
      </DialogHeader>

      {showErrors && problems.length > 0 && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {L.errors.summary}
        </p>
      )}

      <div className="grid grid-cols-2 gap-8">
        <section aria-labelledby={`${ids}-links`} className="grid content-start gap-4">
          <h3 id={`${ids}-links`} className="text-sm font-medium">
            {L.links}
          </h3>
          {urlFields.map(({ key, label, placeholder }) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={`${ids}-${key}`}>{label}</Label>
              <Input
                id={`${ids}-${key}`}
                type="text"
                inputMode="url"
                value={urls[key]}
                maxLength={MAX_URL}
                placeholder={placeholder}
                aria-invalid={bad(key) ? true : undefined}
                aria-describedby={bad(key) ? errId(key) : undefined}
                onChange={(e) => setUrls((u) => ({ ...u, [key]: e.target.value }))}
              />
              {bad(key) && (
                <p id={errId(key)} className="text-sm text-destructive">
                  {L.errors.url}
                </p>
              )}
            </div>
          ))}
        </section>

        <section aria-labelledby={`${ids}-credits`} className="grid content-start gap-4">
          <div className="grid gap-1">
            <h3 id={`${ids}-credits`} className="text-sm font-medium">
              {L.contributions}
            </h3>
            <p className="text-xs text-muted-foreground">{L.contributionsHelp}</p>
          </div>
          {project.people.map((person) => {
            const key = `contribution:${person.id}`;
            return (
              <div key={person.id} className="grid gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    size="sm"
                    aria-hidden
                    className={cn("ring-2 ring-offset-2 ring-offset-background", person.role ? ROLE_STYLE[person.role].ring : "ring-transparent")}
                  >
                    <AvatarFallback>{initials(person.name)}</AvatarFallback>
                  </Avatar>
                  <Label htmlFor={`${ids}-${errId(key)}`}>
                    <span className="sr-only">{L.contributionFor} </span>
                    {person.name}
                  </Label>
                  {person.role && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RoleDot role={person.role} />
                      {roleName(person.role)}
                    </span>
                  )}
                </div>
                <Input
                  id={`${ids}-${errId(key)}`}
                  value={contributions[person.id] ?? ""}
                  maxLength={MAX_LINE}
                  placeholder={L.contributionPlaceholder}
                  aria-invalid={bad(key) ? true : undefined}
                  aria-describedby={bad(key) ? errId(key) : undefined}
                  onChange={(e) => setContributions((c) => ({ ...c, [person.id]: e.target.value }))}
                />
                {bad(key) && (
                  <p id={errId(key)} className="text-sm text-destructive">
                    {L.errors.contribution}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      </div>

      <div className="grid gap-2 rounded-lg border p-4">
        <label className="flex items-start gap-3 text-sm leading-snug">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked)}
            aria-invalid={bad("confirmed") ? true : undefined}
            aria-describedby={bad("confirmed") ? errId("confirmed") : undefined}
            className="mt-0.5"
          />
          <span>{L.confirm}</span>
        </label>
        {bad("confirmed") && (
          <p id={errId("confirmed")} className="text-sm text-destructive">
            {L.errors.confirmed}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{copy.projectum.cancel}</DialogClose>
        <Button type="submit">
          <Rocket />
          {edit ? L.editSubmit : L.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function LiveDialog({
  project,
  mode,
  open,
  onOpenChange,
  formKey,
  onSave,
}: {
  project: Project;
  mode: LiveMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Changes each time the dialog opens, so the form starts fresh.
  formKey: number;
  onSave: (next: Project) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <LiveForm key={formKey} project={project} mode={mode} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
