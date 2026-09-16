"use client";

// The project details dialog: a name, a thumbnail (required), a description
// of the idea, a Google Doc for meeting notes (required), and the people
// involved, picked from the demo directory until accounts can be searched. It adds a project from the sidebar's Add
// Project, and creating a project opens it in Brainstorming. It also edits a project from its card's
// options, filled in with what the project has. Past Brainstorming, people
// are edited with the plan instead.
//
// Stock shadcn parts only. Adding is uncontrolled, with the trigger passed
// in as children; editing is controlled by the board.

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import {
  MAX_DESCRIPTION,
  MAX_NAME,
  MAX_URL,
  type Person,
  type Project,
  addProject,
  cleanDescription,
  cleanName,
  editDetails,
  isNotesUrl,
  normalizeUrl,
  projectProblem,
  replaceProject,
} from "@/lib/projects";
import { AddPersonMenu } from "@/components/projectum/people-menu";
import { useProjects } from "@/components/projectum/project-store";
import { readThumbnail } from "@/components/projectum/read-image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

const S = copy.projectum;
const F = copy.projectum.form;

type Errors = { name?: string; thumbnail?: string; notes?: string };

function DetailsForm({ email, project, onDone }: { email: string; project?: Project; onDone: () => void }) {
  const router = useRouter();
  const [, update] = useProjects(email);
  const editing = Boolean(project);
  const peopleLocked = project ? project.stage !== "brainstorming" : false;
  const [name, setName] = React.useState(project?.name ?? "");
  const [description, setDescription] = React.useState(project?.description ?? "");
  const [thumbnail, setThumbnail] = React.useState<string | null>(project?.thumbnail ?? null);
  const [notesUrl, setNotesUrl] = React.useState(project?.notesUrl ?? "");
  const [people, setPeople] = React.useState<Person[]>(project?.people ?? []);
  const [errors, setErrors] = React.useState<Errors>({});
  const fileRef = React.useRef<HTMLInputElement>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const notesRef = React.useRef<HTMLInputElement>(null);
  const ids = React.useId();

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, thumbnail: F.errors.thumbnailType }));
      return;
    }
    try {
      setThumbnail(await readThumbnail(file));
      setErrors((e) => ({ ...e, thumbnail: undefined }));
    } catch {
      setErrors((e) => ({ ...e, thumbnail: F.errors.thumbnailRead }));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = projectProblem({ name, thumbnail, notesUrl });
    if (problem) {
      setErrors({
        name: cleanName(name) ? undefined : F.errors.name,
        thumbnail: thumbnail ? undefined : F.errors.thumbnail,
        notes: isNotesUrl(notesUrl) ? undefined : F.errors.notes,
      });
      if (problem === "name") nameRef.current?.focus();
      else if (problem === "thumbnail") fileRef.current?.focus();
      else notesRef.current?.focus();
      return;
    }
    if (project) {
      const next = editDetails(project, { name, description, thumbnail, notesUrl, people });
      if (next) update((l) => replaceProject(l, next));
      onDone();
      return;
    }
    const id = crypto.randomUUID();
    update((l) =>
      addProject(l, {
        id,
        name: cleanName(name),
        description: cleanDescription(description),
        thumbnail,
        notesUrl: normalizeUrl(notesUrl),
        color: null,
        people,
        stage: "brainstorming",
        plan: null,
        prototype: null,
        builds: [],
        history: {},
        launch: null,
        roleMeanings: {},
      }),
    );
    onDone();
    router.push(`/projectum?project=${encodeURIComponent(id)}`);
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{editing ? F.editTitle : S.addProject}</DialogTitle>
        <DialogDescription>{editing ? F.editDescription : S.addProjectDescription}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-name`}>{S.projectName}</Label>
        <Input
          ref={nameRef}
          id={`${ids}-name`}
          value={name}
          maxLength={MAX_NAME}
          placeholder={F.namePlaceholder}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${ids}-name-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
          }}
        />
        {errors.name && (
          <p id={`${ids}-name-error`} className="text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-thumb`}>{F.thumbnail}</Label>
        {/* The file input stays in the tab order, visually replaced by the
            drop area or the preview below it. */}
        <input
          ref={fileRef}
          id={`${ids}-thumb`}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          aria-invalid={errors.thumbnail ? true : undefined}
          aria-describedby={`${ids}-thumb-help${errors.thumbnail ? ` ${ids}-thumb-error` : ""}`}
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {thumbnail ? (
          <div className="grid gap-2">
            <Image
              src={thumbnail}
              alt=""
              width={640}
              height={360}
              unoptimized
              className="h-36 w-full rounded-lg border object-cover"
            />
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => fileRef.current?.click()}>
              <ImagePlus />
              {F.thumbnailChange}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => fileRef.current?.click()}
            data-invalid={errors.thumbnail ? "" : undefined}
            className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 data-invalid:border-destructive"
          >
            <ImagePlus className="size-5" />
            {F.thumbnailPick}
          </button>
        )}
        <p id={`${ids}-thumb-help`} className="text-xs text-muted-foreground">
          {F.thumbnailHelp}
        </p>
        {errors.thumbnail && (
          <p id={`${ids}-thumb-error`} className="text-sm text-destructive">
            {errors.thumbnail}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-desc`}>{F.description}</Label>
        <Textarea
          id={`${ids}-desc`}
          value={description}
          rows={3}
          maxLength={MAX_DESCRIPTION}
          placeholder={F.descriptionPlaceholder}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-notes`}>{F.notes}</Label>
        <Input
          ref={notesRef}
          id={`${ids}-notes`}
          type="text"
          inputMode="url"
          value={notesUrl}
          maxLength={MAX_URL}
          placeholder={F.notesPlaceholder}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={`${ids}-notes-help${errors.notes ? ` ${ids}-notes-error` : ""}`}
          onChange={(e) => {
            setNotesUrl(e.target.value);
            if (errors.notes) setErrors((x) => ({ ...x, notes: undefined }));
          }}
        />
        <p id={`${ids}-notes-help`} className="text-xs text-muted-foreground">
          {F.notesHelp}
        </p>
        {errors.notes && (
          <p id={`${ids}-notes-error`} className="text-sm text-destructive">
            {errors.notes}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium" id={`${ids}-people`}>
            {F.people}
          </span>
          {!peopleLocked && <AddPersonMenu people={people} onAdd={(person) => setPeople((p) => [...p, person])} />}
        </div>
        {peopleLocked ? (
          <p className="text-sm text-muted-foreground">{F.peopleInPlan}</p>
        ) : people.length ? (
          <ul aria-labelledby={`${ids}-people`} className="grid gap-1 rounded-lg border p-1">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                <Avatar size="sm">
                  <AvatarFallback>{initials(person.name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{person.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${F.removePerson} ${person.name}`}
                  onClick={() => setPeople((p) => p.filter((x) => x.id !== person.id))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{F.noPeople}</p>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{S.cancel}</DialogClose>
        <Button type="submit">{editing ? F.save : S.createProject}</Button>
      </DialogFooter>
    </form>
  );
}

export function ProjectDetailsDialog({
  email,
  project,
  open: openProp,
  onOpenChange,
  formKey,
  children,
}: {
  email: string;
  // Present when editing; absent when adding.
  project?: Project;
  // Controlled when editing, from the board.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Changes each time a controlled dialog opens, so the form starts fresh.
  formKey?: number;
  // The trigger when adding.
  children?: React.ReactNode;
}) {
  const [innerOpen, setInnerOpen] = React.useState(false);
  const [innerKey, setInnerKey] = React.useState(0);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : innerOpen;
  const setOpen = (next: boolean) => {
    if (controlled) {
      onOpenChange?.(next);
      return;
    }
    if (next) setInnerKey((k) => k + 1);
    setInnerOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children}
      <DialogContent className="sm:max-w-lg">
        <DetailsForm key={controlled ? formKey : innerKey} email={email} project={project} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
