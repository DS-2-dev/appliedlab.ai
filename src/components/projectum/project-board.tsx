"use client";

// A project's view in Projectum, opened from Your Projects in the sidebar. A
// stage track runs across the top with all four stages, the current one
// marked and the ones behind it checked, and the button to move on sits at
// its end. Below it the project is one wide card.
//
// A project moves one stage at a time: Brainstorming to Solidifying, then
// Prototype, then Live, the last. The move button opens the next stage's
// form, and the project only moves once every field in it is filled. A Live
// card leads with where to see the finished project (site, slides, demo)
// and each person's confirmed contribution; its plan and build log are
// final. Past Brainstorming the card shows its plan (thesis, reasoning,
// tech stack, each person ringed in their role's colour with the role's
// meaning on hover, and the steps in a dialog of their own), and in
// Prototype its GitHub link, Supabase answer and builds: a chip ("Build 3")
// that opens the build log, the latest build's note, and New build, which
// asks what changed. The options menu reopens the form behind what the card
// shows: details always, the plan once there is one. At every stage the
// card links the project's meeting notes doc; a project saved before the
// doc was required asks for it, and cannot move on until it has one.
//
// Stages the project has left are buttons in the track. Each opens the
// project as it stood when it left that stage, read only: no options, no
// move, no new build, just the view.

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  Database,
  Ellipsis,
  Eye,
  FileText,
  FolderGit2,
  Globe,
  Hammer,
  ListOrdered,
  MonitorPlay,
  Pencil,
  Presentation,
  Rocket,
} from "lucide-react";
import { copy } from "@/content/copy";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/initials";
import {
  type Launch,
  type Plan,
  type Project,
  type Prototype,
  STAGES,
  type Stage,
  githubRepo,
  replaceProject,
  techStackItems,
  urlLabel,
} from "@/lib/projects";
import { ProjectDetailsDialog } from "@/components/projectum/add-project-dialog";
import { BuildDate, BuildLog, NewBuildDialog, buildNote, formatDay } from "@/components/projectum/build-dialogs";
import { LiveDialog, type LiveMode } from "@/components/projectum/live-dialog";
import { PlanDialog, type PlanMode, type PlanTarget, RoleDot } from "@/components/projectum/plan-dialog";
import { useProjects } from "@/components/projectum/project-store";
import { ROLE_STYLE, projectMeanings, roleName } from "@/components/projectum/roles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const B = copy.projectum.board;

// Where each stage moves next. Live is the last.
const NEXT: Partial<Record<Stage, Exclude<Stage, "brainstorming">>> = {
  brainstorming: "solidifying",
  solidifying: "prototype",
  prototype: "live",
};

// Which form "Edit plan" reopens in each stage. A Live plan is final.
const PLAN_FORM: Partial<Record<Stage, PlanTarget>> = { solidifying: "solidifying", prototype: "prototype" };

// One of the two buttons sharing the top row's action cell (Back to and
// Move to): shown, or faded out, inert and hidden from assistive tech.
function swapProps(shown: boolean) {
  return {
    inert: !shown,
    "aria-hidden": shown ? undefined : true,
    className: cn(
      "duration-200 ease-out motion-reduce:transition-none",
      !shown && "pointer-events-none scale-95 opacity-0 disabled:opacity-0",
    ),
  };
}

function Field({ heading, className, children }: { heading: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("grid content-start gap-1.5", className)}>
      <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>
      {children}
    </section>
  );
}

// All four stages in order: the ones behind the project checked, its own
// marked as the current step. On the board, checked stages open their
// read-only view and, while one is open, the current stage leads back.
function StageTrack({
  stage,
  shown = stage,
  onShow,
}: {
  stage: Stage;
  shown?: Stage;
  onShow?: (stage: Stage) => void;
}) {
  const current = STAGES.indexOf(stage);
  return (
    <ol aria-label={B.stageTrack} className="flex flex-1 items-center gap-3">
      {STAGES.map((s, i) => {
        const done = i < current;
        const here = i === current;
        const viewed = s === shown;
        const inner = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-shadow",
                here && "border-primary bg-primary text-primary-foreground",
                done && "border-primary text-primary",
                done && viewed && "ring-3 ring-primary/20",
                !here && !done && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm whitespace-nowrap underline-offset-4",
                viewed ? "font-medium" : "text-muted-foreground",
                (done || here) && !viewed && "group-hover:text-foreground group-hover:underline",
              )}
            >
              {B.stages[s]}
              {done && <span className="sr-only">, {B.stageDone}</span>}
            </span>
          </>
        );
        return (
          <li
            key={s}
            aria-current={here ? "step" : undefined}
            data-done={done ? "" : undefined}
            className="flex flex-1 items-center gap-3 last:flex-none"
          >
            {onShow && (done || (here && !viewed)) ? (
              <button
                type="button"
                aria-pressed={viewed}
                onClick={() => onShow(s)}
                className="group flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {inner}
              </button>
            ) : (
              <span className="flex items-center gap-2">{inner}</span>
            )}
            {i < STAGES.length - 1 && <span aria-hidden className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

// Everyone on the project by name. Past Brainstorming each person is ringed
// in their role's colour, with the role under their name and its meaning on
// hover or focus.
function People({ project }: { project: Project }) {
  if (project.people.length === 0) return null;
  const withRoles = project.stage !== "brainstorming";
  const meanings = projectMeanings(project);
  return (
    <Field heading={withRoles ? B.roles : B.people}>
      <ul aria-label={B.people} className="grid gap-2.5 p-0.5">
        {project.people.map((person) => (
          <li key={person.id} className="flex items-center gap-2.5">
            {withRoles && person.role ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      tabIndex={0}
                      aria-label={`${person.name}, ${roleName(person.role)}`}
                      className="block rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <Avatar
                    size="sm"
                    data-role={person.role}
                    className={cn("ring-2 ring-offset-2 ring-offset-card", ROLE_STYLE[person.role].ring)}
                  >
                    <AvatarFallback>{initials(person.name)}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent className="max-w-56">
                  {/* The stock popup lays children in a row; stack the
                      role over its meaning. */}
                  <div className="grid gap-0.5">
                    <span className="font-medium">{roleName(person.role)}</span>
                    <span className="opacity-80">{meanings[person.role]}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Avatar size="sm" aria-hidden>
                <AvatarFallback>{initials(person.name)}</AvatarFallback>
              </Avatar>
            )}
            <div className="grid min-w-0 leading-tight">
              <span className="truncate">{person.name}</span>
              {withRoles && person.role && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RoleDot role={person.role} />
                  {roleName(person.role)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Field>
  );
}

function PrototypeDetails({ prototype }: { prototype: Prototype }) {
  return (
    <Field heading={B.prototype}>
      <a
        href={prototype.githubUrl}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
      >
        <FolderGit2 className="size-4 shrink-0" />
        <span className="truncate">{githubRepo(prototype.githubUrl)}</span>
      </a>
      <Badge variant="secondary" className="justify-self-start">
        <Database />
        {prototype.supabase ? copy.projectum.prototype.supabaseYes : copy.projectum.prototype.supabaseNo}
      </Badge>
    </Field>
  );
}

// Where to see the finished project: the site, the slides and the demo,
// each opening in a new tab.
function LaunchPanel({ launch }: { launch: Launch }) {
  const links = [
    { href: launch.siteUrl, label: B.visitSite, Icon: Globe, variant: "default" as const },
    { href: launch.slidesUrl, label: B.slides, Icon: Presentation, variant: "outline" as const },
    { href: launch.demoUrl, label: B.demo, Icon: MonitorPlay, variant: "outline" as const },
  ];
  return (
    <section aria-label={B.launch} data-launch="" className="grid gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge>
          <Rocket />
          {B.launch}
        </Badge>
        {launch.at && (
          <span className="text-xs text-muted-foreground">
            {B.liveSince} <time dateTime={launch.at}>{formatDay(launch.at)}</time>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {links.map(({ href, label, Icon, variant }) => (
          <a key={label} href={href} target="_blank" rel="noreferrer" className={buttonVariants({ variant })}>
            <Icon data-icon="inline-start" />
            {label}
          </a>
        ))}
      </div>
      <p className="truncate text-xs text-muted-foreground">{urlLabel(launch.siteUrl)}</p>
    </section>
  );
}

// Who did what, as confirmed on the way to Live.
function Contributions({ project, launch }: { project: Project; launch: Launch }) {
  return (
    <Field heading={B.contributions}>
      <ul className="grid gap-2">
        {project.people.map((person) => (
          <li key={person.id} className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 rounded-lg border px-3 py-2">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              {person.role && <RoleDot role={person.role} />}
              <span className="truncate">{person.name}</span>
            </span>
            <span>{launch.contributions[person.id]}</span>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BadgeCheck className="size-3.5" />
        {B.contributionsConfirmed}
      </p>
    </Field>
  );
}

// The build chip, which opens the log, over the latest build's note.
function BuildSummary({ project }: { project: Project }) {
  const latest = project.builds[project.builds.length - 1];
  if (!latest) return null;
  return (
    <section aria-label={B.buildLog} className="grid gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <BuildLog project={project} />
        <BuildDate build={latest} />
      </div>
      <p className="whitespace-pre-line">{buildNote(latest)}</p>
    </section>
  );
}

// The thesis beside its reasoning, over the tech stack. Brief drops the
// reasoning.
function PlanDetails({ plan, brief = false }: { plan: Plan; brief?: boolean }) {
  const stack = techStackItems(plan.techStack);
  return (
    <>
      <div className={cn("grid gap-6", !brief && "grid-cols-2")}>
        <Field heading={B.thesis}>
          <p className="whitespace-pre-line">{plan.thesis}</p>
        </Field>
        {!brief && (
          <Field heading={B.reasoning}>
            <p className="whitespace-pre-line">{plan.reasoning}</p>
          </Field>
        )}
      </div>
      <Field heading={B.techStack}>
        <ul className="flex flex-wrap gap-1">
          {stack.map((item, i) => (
            <li key={`${item}-${i}`}>
              <Badge variant="secondary">{item}</Badge>
            </li>
          ))}
        </ul>
      </Field>
    </>
  );
}

// The steps, in their own dialog: each with who does it and their role.
function StepsDialog({ project, plan }: { project: Project; plan: Plan }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <ListOrdered />
        {B.viewSteps} ({plan.steps.length})
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{B.stepsTitle}</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2">
          {plan.steps.map((step, i) => {
            const owner = project.people.find((p) => p.id === step.ownerId);
            return (
              <li key={step.id} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="grid flex-1 gap-2">
                  <p className="text-sm font-medium">{step.text}</p>
                  {owner && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="flex items-center gap-2">
                        <Avatar
                          size="sm"
                          className={cn("ring-2 ring-offset-2 ring-offset-background", owner.role ? ROLE_STYLE[owner.role].ring : "ring-transparent")}
                        >
                          <AvatarFallback>{initials(owner.name)}</AvatarFallback>
                        </Avatar>
                        {owner.name}
                      </span>
                      {owner.role && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <RoleDot role={owner.role} />
                          {roleName(owner.role)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function CardOptions({
  onEditDetails,
  onEditPlan,
  onEditLaunch,
}: {
  onEditDetails: () => void;
  onEditPlan: (() => void) | null;
  onEditLaunch: (() => void) | null;
}) {
  // Each option opens a dialog, which takes focus. The menu would hand focus
  // back to its trigger on close and pull it out from under the dialog, so
  // after an option it keeps its hands off.
  const opening = React.useRef(false);
  const pick = (fn: () => void) => () => {
    opening.current = true;
    fn();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={B.options} />}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-40"
        finalFocus={() => {
          const skip = opening.current;
          opening.current = false;
          return !skip;
        }}
      >
        <DropdownMenuItem onClick={pick(onEditDetails)}>
          <Pencil />
          {B.editDetails}
        </DropdownMenuItem>
        {onEditPlan && (
          <DropdownMenuItem onClick={pick(onEditPlan)}>
            <ClipboardList />
            {B.editPlan}
          </DropdownMenuItem>
        )}
        {onEditLaunch && (
          <DropdownMenuItem onClick={pick(onEditLaunch)}>
            <Rocket />
            {B.editLaunch}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The project, wide: the thumbnail, prototype links and people down the
// left, the name, builds and plan across the rest. Read only for a past
// stage, which drops everything that edits. The overview, from All
// Projects, is read only and briefer: its stage in place of the options,
// and no contributions, reasoning or steps.
export function ProjectCard({
  project,
  readOnly: readOnlyProp = false,
  overview = false,
  className,
  onEditDetails = () => {},
  onEditPlan = null,
  onEditLaunch = null,
  onNewBuild = () => {},
}: {
  project: Project;
  readOnly?: boolean;
  overview?: boolean;
  className?: string;
  onEditDetails?: () => void;
  onEditPlan?: (() => void) | null;
  onEditLaunch?: (() => void) | null;
  onNewBuild?: () => void;
}) {
  const readOnly = readOnlyProp || overview;
  const plan = project.stage !== "brainstorming" ? project.plan : null;
  const prototype = project.stage === "prototype" || project.stage === "live" ? project.prototype : null;
  const launch = project.stage === "live" ? project.launch : null;
  return (
    <Card data-project-card="" data-read-only={readOnly ? "" : undefined} className={cn("py-6", className)}>
      <div className="grid grid-cols-[minmax(0,17rem)_minmax(0,1fr)] gap-8 px-6">
        <aside className="grid content-start gap-6">
          {project.thumbnail && (
            <Image
              src={project.thumbnail}
              alt=""
              width={640}
              height={360}
              unoptimized
              className="aspect-video w-full rounded-lg border object-cover"
            />
          )}
          {project.notesUrl ? (
            <Field heading={B.notes}>
              <a
                href={project.notesUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{B.openNotes}</span>
              </a>
            </Field>
          ) : (
            !readOnly && (
              <section data-notes-missing="" className="grid gap-2 rounded-lg border border-dashed p-3">
                <p className="text-muted-foreground">{B.notesMissing}</p>
                <Button variant="outline" size="sm" className="justify-self-start" onClick={onEditDetails}>
                  <FileText data-icon="inline-start" />
                  {B.addNotes}
                </Button>
              </section>
            )
          )}
          {prototype && <PrototypeDetails prototype={prototype} />}
          <People project={project} />
        </aside>

        <div className="grid min-w-0 content-start gap-6">
          {/* In the overview the dialog's close button sits at the end of
              this row, so the stage follows the name. */}
          <div className={cn("flex items-start gap-4", overview && "pr-10")}>
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="min-w-0 text-xl">
                  <h2>{project.name}</h2>
                </CardTitle>
                {overview && (
                  <Badge variant="outline" data-stage={project.stage} className="shrink-0">
                    <span className="sr-only">{B.stageTrack}: </span>
                    {B.stages[project.stage]}
                  </Badge>
                )}
              </div>
              {project.description && (
                <CardDescription className="whitespace-pre-line">{project.description}</CardDescription>
              )}
            </div>
            {!readOnly && (
              <CardOptions
                onEditDetails={onEditDetails}
                onEditPlan={plan ? onEditPlan : null}
                onEditLaunch={launch ? onEditLaunch : null}
              />
            )}
          </div>
          {launch && <LaunchPanel launch={launch} />}
          {launch && !overview && <Contributions project={project} launch={launch} />}
          {prototype && <BuildSummary project={project} />}
          {plan ? (
            <PlanDetails plan={plan} brief={overview} />
          ) : (
            !readOnly && <p className="rounded-lg border border-dashed p-4 text-muted-foreground">{B.planPending}</p>
          )}
        </div>
      </div>
      {plan && !overview && (
        <CardFooter className="justify-end gap-2 px-6">
          <StepsDialog project={project} plan={plan} />
          {project.stage === "prototype" && !readOnly && (
            <Button onClick={onNewBuild}>
              <Hammer />
              {B.newBuild}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export function ProjectBoard({ email, projectId }: { email: string; projectId: string }) {
  const [list, update] = useProjects(email);
  const project = list.find((p) => p.id === projectId) ?? null;
  const [planOpen, setPlanOpen] = React.useState(false);
  const [planTarget, setPlanTarget] = React.useState<PlanTarget>("solidifying");
  const [planMode, setPlanMode] = React.useState<PlanMode>("move");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [buildOpen, setBuildOpen] = React.useState(false);
  const [liveOpen, setLiveOpen] = React.useState(false);
  const [liveMode, setLiveMode] = React.useState<LiveMode>("move");
  // Bumped on every open so each form starts from what the project has.
  const [formKey, setFormKey] = React.useState(0);
  // A past stage open in the track, or null for the current one.
  const [viewing, setViewing] = React.useState<Stage | null>(null);
  // Back to hands focus to Move to, since Back to fades out once clicked.
  const moveRef = React.useRef<HTMLButtonElement>(null);

  if (!project) return null;
  const next = NEXT[project.stage];
  const planForm = PLAN_FORM[project.stage];
  const past = viewing && STAGES.indexOf(viewing) < STAGES.indexOf(project.stage) ? viewing : null;
  const record = past ? project.history[past] : undefined;
  // The past stage's record laid over the project, for the read-only card.
  const pastProject: Project | null =
    past && record
      ? {
          ...project,
          name: record.name,
          description: record.description,
          people: record.people,
          plan: record.plan,
          roleMeanings: record.roleMeanings,
          stage: past,
          prototype: record.prototype,
          // The log is final once Live, so it stands as it did in Prototype.
          builds: past === "prototype" ? project.builds : [],
          launch: null,
        }
      : null;

  const openPlan = (target: PlanTarget, mode: PlanMode) => {
    setFormKey((k) => k + 1);
    setPlanTarget(target);
    setPlanMode(mode);
    setPlanOpen(true);
  };
  const openDetails = () => {
    setFormKey((k) => k + 1);
    setDetailsOpen(true);
  };
  const openBuild = () => {
    setFormKey((k) => k + 1);
    setBuildOpen(true);
  };
  const openLive = (mode: LiveMode) => {
    setFormKey((k) => k + 1);
    setLiveMode(mode);
    setLiveOpen(true);
  };
  const save = (saved: Project) => update((l) => replaceProject(l, saved));

  return (
    <div data-board="" data-stage={project.stage} className="mx-auto grid w-full max-w-6xl content-start gap-6 p-6">
      <div className="flex min-h-9 items-center gap-8">
        <StageTrack
          stage={project.stage}
          shown={pastProject ? pastProject.stage : project.stage}
          onShow={(s) => setViewing(s === project.stage ? null : s)}
        />
        {/* Back to and Move to share one cell, as wide as the wider of
            the two, so the track holds still while they crossfade. A new
            project has no stage behind it, so no Back to. */}
        <div data-stage-actions="" className="grid justify-items-end *:col-start-1 *:row-start-1">
          {STAGES.indexOf(project.stage) > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setViewing(null);
                requestAnimationFrame(() => {
                  if (moveRef.current && !moveRef.current.disabled) moveRef.current.focus();
                });
              }}
              {...swapProps(Boolean(pastProject))}
            >
              <ArrowLeft data-icon="inline-start" />
              {B.backTo} {B.stages[project.stage]}
            </Button>
          )}
          {next && (
            <Button
              ref={moveRef}
              disabled={!project.notesUrl}
              onClick={() => (next === "live" ? openLive("move") : openPlan(next, "move"))}
              {...swapProps(!pastProject)}
            >
              {B.moveTo[next]}
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>

      {/* Keyed by the stage on show, so opening a past stage or going back
          fades the card in. */}
      <div
        key={pastProject ? pastProject.stage : "current"}
        data-stage-view=""
        className="grid gap-6 animate-in duration-300 ease-out fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
      >
        {pastProject && record ? (
          <>
            <p className="-mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <Eye className="size-4 shrink-0" />
              <span>
                {B.pastView} {B.stages[pastProject.stage]}.
              </span>
              {record.at && (
                <span>
                  {B.completed} <time dateTime={record.at}>{formatDay(record.at)}</time>
                </span>
              )}
            </p>
            <ProjectCard project={pastProject} readOnly />
          </>
        ) : (
          <ProjectCard
            project={project}
            onEditDetails={openDetails}
            onEditPlan={planForm ? () => openPlan(planForm, "edit") : null}
            onEditLaunch={() => openLive("edit")}
            onNewBuild={openBuild}
          />
        )}
      </div>

      <PlanDialog
        project={project}
        target={planTarget}
        mode={planMode}
        open={planOpen}
        onOpenChange={setPlanOpen}
        formKey={formKey}
        onSave={(saved) => {
          save(saved);
          setPlanOpen(false);
        }}
      />
      <ProjectDetailsDialog email={email} project={project} open={detailsOpen} onOpenChange={setDetailsOpen} formKey={formKey} />
      <NewBuildDialog
        project={project}
        open={buildOpen}
        onOpenChange={setBuildOpen}
        formKey={formKey}
        onSave={(saved) => {
          save(saved);
          setBuildOpen(false);
        }}
      />
      <LiveDialog
        project={project}
        mode={liveMode}
        open={liveOpen}
        onOpenChange={setLiveOpen}
        formKey={formKey}
        onSave={(saved) => {
          save(saved);
          setLiveOpen(false);
        }}
      />
    </div>
  );
}
