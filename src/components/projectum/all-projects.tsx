"use client";

// All Projects, Projectum's first view: every project in one grid, filtered
// by stage with a count on each tab. The signed-in person's projects come
// first, marked Yours; the Lab's sample projects fill the list until more
// teams add theirs, marked Sample. Samples are whole projects, with what
// their stage needs. Every card's View opens a brief of its project to view
// only (its stage, links, team, latest build and plan), and your own cards
// also open their board.

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Boxes,
  CalendarDays,
  Car,
  Clock,
  Eye,
  FileText,
  Lightbulb,
  type LucideIcon,
  MapPin,
  ShoppingBasket,
  Users,
} from "lucide-react";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import { type Project, STAGES, type Stage, sampleProject } from "@/lib/projects";
import { ProjectCard } from "@/components/projectum/project-board";
import { useProjects } from "@/components/projectum/project-store";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

const A = copy.projectum.allProjects;
const B = copy.projectum.board;

type Filter = "all" | Stage;
const FILTERS: Filter[] = ["all", ...STAGES];
const SHOWN_PEOPLE = 3;
// How cards move when the filter changes: the ones leaving fade out, the
// ones staying slide to their new places, the ones arriving fade and settle
// in. Off for anyone who asks for reduced motion.
const EASE = [0.22, 1, 0.36, 1] as const;
const TILE_MOTION = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.28, ease: EASE },
};

// Sample cards have no thumbnail; an icon stands in.
const ICONS: Record<string, LucideIcon> = {
  map: MapPin,
  clock: Clock,
  boxes: Boxes,
  calendar: CalendarDays,
  basket: ShoppingBasket,
  users: Users,
  car: Car,
  file: FileText,
};

type Entry = { project: Project; icon: LucideIcon; own: boolean };

const SAMPLES: Entry[] = copy.projectum.demo.samples.flatMap((data) => {
  const project = sampleProject(data);
  return project ? [{ project, icon: ICONS[data.icon] ?? Lightbulb, own: false }] : [];
});

function ProjectTile({ entry, onView }: { entry: Entry; onView: () => void }) {
  const { project, icon: Icon, own } = entry;
  const extra = project.people.length - SHOWN_PEOPLE;
  return (
    <Card data-project-tile="" size="sm" className="h-full gap-0 py-0">
      <div className="relative">
        {project.thumbnail ? (
          <Image
            src={project.thumbnail}
            alt=""
            width={480}
            height={270}
            unoptimized
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
            <Icon className="size-8" />
          </div>
        )}
        <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
          <Badge variant="outline" className="bg-background">
            {B.stages[project.stage]}
          </Badge>
          <Badge variant="outline" className="bg-background">
            {own ? A.yours : A.sample}
          </Badge>
        </div>
      </div>
      <CardHeader className="gap-1 py-3">
        <CardTitle className="truncate">{project.name}</CardTitle>
        {project.description && <CardDescription className="line-clamp-2">{project.description}</CardDescription>}
      </CardHeader>
      <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-3">
        {project.people.length > 0 ? (
          <AvatarGroup aria-label={B.people} className="-space-x-1">
            {project.people.slice(0, SHOWN_PEOPLE).map((person) => (
              <Avatar key={person.id} size="sm" role="img" aria-label={person.name} title={person.name}>
                <AvatarFallback>{initials(person.name)}</AvatarFallback>
              </Avatar>
            ))}
            {extra > 0 && <AvatarGroupCount>+{extra}</AvatarGroupCount>}
          </AvatarGroup>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye data-icon="inline-start" />
            {A.view}
            <span className="sr-only"> {project.name}</span>
          </Button>
          {own && (
            <Link href={`/projectum?project=${encodeURIComponent(project.id)}`} className={buttonVariants({ size: "sm" })}>
              {A.open}
              <span className="sr-only"> {project.name}</span>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

export function AllProjects({ email }: { email: string }) {
  const [list] = useProjects(email);
  const [filter, setFilter] = React.useState<Filter>("all");
  // The project in the overview. Kept after closing so it can animate out.
  const [viewing, setViewing] = React.useState<Project | null>(null);
  const [open, setOpen] = React.useState(false);
  const entries: Entry[] = [...list.map((project) => ({ project, icon: Lightbulb, own: true })), ...SAMPLES];
  const inFilter = (f: Filter) => (f === "all" ? entries : entries.filter((e) => e.project.stage === f));
  const shown = inFilter(filter);

  return (
    <div className="mx-auto grid w-full max-w-6xl content-start gap-6 p-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-medium">{A.title}</h1>
        <p className="text-sm text-muted-foreground">{A.description}</p>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="gap-4">
        {/* One pill slides to the chosen filter, so the tabs drop their own
            active background and sit above it. */}
        <TabsList aria-label={A.filterLabel} className="relative">
          <TabsIndicator />
          {FILTERS.map((f) => (
            <TabsTrigger
              key={f}
              value={f}
              className="z-[1] data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none"
            >
              {f === "all" ? A.all : B.stages[f]}
              <span className="text-muted-foreground tabular-nums">{inFilter(f).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={filter}>
          {shown.length ? (
            <MotionConfig reducedMotion="user">
              {/* Relative so leaving cards can lift out of the grid while
                  they fade. */}
              <div data-project-grid="" className="relative grid grid-cols-3 gap-4 xl:grid-cols-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((entry) => (
                    <motion.div key={entry.project.id} data-tile-motion="" layout {...TILE_MOTION}>
                      <ProjectTile
                        entry={entry}
                        onView={() => {
                          setViewing(entry.project);
                          setOpen(true);
                        }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </MotionConfig>
          ) : (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{A.empty}</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* The card is the dialog, with no frame around it. The close
            button keeps the corner inset every dialog uses. */}
        <DialogContent className="sm:max-w-5xl" bodyClassName="p-0">
          {viewing && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{viewing.name}</DialogTitle>
                <DialogDescription>{A.overview}</DialogDescription>
              </DialogHeader>
              <ProjectCard project={viewing} overview className="bg-transparent ring-0" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
