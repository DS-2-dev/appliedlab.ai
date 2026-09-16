"use client";

// A prototype's builds. The chip on its card names the build it is on and
// opens the build log, newest first. New build asks what changed and the
// tech stack now, and the build number only goes up once both are filled.

import * as React from "react";
import { Hammer, History } from "lucide-react";
import { copy } from "@/content/copy";
import { cn } from "@/lib/utils";
import {
  type Build,
  type Project,
  MAX_DESCRIPTION,
  MAX_LINE,
  buildProblems,
  currentBuild,
  startBuild,
  techStackItems,
} from "@/lib/projects";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const B = copy.projectum.board;
const N = copy.projectum.build;

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

// "Sep 12, 2026" from an ISO timestamp.
export const formatDay = (iso: string) => DATE.format(new Date(iso));

export function BuildDate({ build, className }: { build: Build; className?: string }) {
  if (!build.at) return null;
  return (
    <time dateTime={build.at} className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      {formatDay(build.at)}
    </time>
  );
}

// Build 1 has no note of its own.
export function buildNote(build: Build): string {
  return build.note || (build.number === 1 ? B.firstBuild : "");
}

// The chip, which opens the log.
export function BuildLog({ project }: { project: Project }) {
  const number = currentBuild(project);
  const builds = [...project.builds].reverse();
  return (
    <Dialog>
      <DialogTrigger data-build-chip="" className={cn(badgeVariants({ variant: "outline" }), "cursor-pointer hover:bg-muted")}>
        <History />
        {B.build} {number}
        <span className="sr-only">, {B.openBuildLog}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{B.buildLog}</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2">
          {builds.map((build) => {
            const stack = techStackItems(build.techStack);
            return (
              <li key={build.number} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={build.number === number ? "default" : "secondary"}>
                    {B.build} {build.number}
                  </Badge>
                  <BuildDate build={build} />
                </div>
                <p className="text-sm whitespace-pre-line">{buildNote(build)}</p>
                {stack.length > 0 && (
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">{N.techStack}</span>
                    <ul className="flex flex-wrap gap-1">
                      {stack.map((item, i) => (
                        <li key={`${item}-${i}`}>
                          <Badge variant="outline">{item}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function BuildForm({ project, onSave }: { project: Project; onSave: (next: Project) => void }) {
  const ids = React.useId();
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const stackRef = React.useRef<HTMLInputElement>(null);
  const [note, setNote] = React.useState("");
  const [techStack, setTechStack] = React.useState(project.plan?.techStack ?? "");
  const [showErrors, setShowErrors] = React.useState(false);
  const next = currentBuild(project) + 1;
  const problems = buildProblems({ note, techStack });
  const bad = (key: string) => showErrors && problems.includes(key);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = startBuild(project, { note, techStack });
    if (saved) {
      onSave(saved);
      return;
    }
    setShowErrors(true);
    (problems[0] === "note" ? noteRef : stackRef).current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>
          {N.title} {next}
        </DialogTitle>
        <DialogDescription>{N.description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-note`}>{N.note}</Label>
        <Textarea
          ref={noteRef}
          id={`${ids}-note`}
          value={note}
          rows={5}
          maxLength={MAX_DESCRIPTION}
          placeholder={N.notePlaceholder}
          aria-invalid={bad("note") ? true : undefined}
          aria-describedby={bad("note") ? `${ids}-note-error` : undefined}
          onChange={(e) => setNote(e.target.value)}
        />
        {bad("note") && (
          <p id={`${ids}-note-error`} className="text-sm text-destructive">
            {N.errors.note}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-stack`}>{N.techStack}</Label>
        <Input
          ref={stackRef}
          id={`${ids}-stack`}
          value={techStack}
          maxLength={MAX_LINE}
          aria-invalid={bad("techStack") ? true : undefined}
          aria-describedby={`${ids}-stack-help${bad("techStack") ? ` ${ids}-stack-error` : ""}`}
          onChange={(e) => setTechStack(e.target.value)}
        />
        <p id={`${ids}-stack-help`} className="text-xs text-muted-foreground">
          {N.techStackHelp}
        </p>
        {bad("techStack") && (
          <p id={`${ids}-stack-error`} className="text-sm text-destructive">
            {N.errors.techStack}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{copy.projectum.cancel}</DialogClose>
        <Button type="submit">
          <Hammer />
          {N.submit} {next}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewBuildDialog({
  project,
  open,
  onOpenChange,
  formKey,
  onSave,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Changes each time the dialog opens, so the form starts fresh.
  formKey: number;
  onSave: (next: Project) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <BuildForm key={formKey} project={project} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
