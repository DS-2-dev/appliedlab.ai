"use client";

// "Your Projects": the Projectum sidebar's list of projects, after All
// Projects, drawn with the branching tree nav (components/ui/
// branching-tree-nav): a collapsible section with a branch line to each
// project and a pill that slides to the open one. One level only. Clicking
// a project opens its board, and each has a hover menu to rename or delete
// it. The list is hidden while the bar is folded to icons, where the open
// project stays as its open folder, as it shows in the list, and Add
// Project as its + icon.
//
// A click selects the project at once, before its board loads, and its
// folder fades open while the one it left fades shut.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis, Folder as FolderIcon, FolderOpen, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { copy } from "@/content/copy";
import { cn } from "@/lib/utils";
import {
  FOLDER_COLORS,
  type FolderColor,
  MAX_NAME,
  cleanName,
  recolorProject,
  removeProject,
  renameProject,
} from "@/lib/projects";
import { ProjectDetailsDialog } from "@/components/projectum/add-project-dialog";
import { useProjects } from "@/components/projectum/project-store";
import { TreeItem, TreeSection, TreeView } from "@/components/ui/branching-tree-nav";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarGroup, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const S = copy.projectum;

// Inline name field for renaming a project. Enter or leaving the field
// saves, Escape cancels. The ref stops Enter and the blur that can follow it
// from saving twice.
function NameField({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const done = React.useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <SidebarInput
      autoFocus
      defaultValue={initial}
      maxLength={MAX_NAME}
      aria-label={S.projectName}
      placeholder={S.projectName}
      className="h-7"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => finish(cleanName(e.currentTarget.value) || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(cleanName(e.currentTarget.value) || null);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
    />
  );
}

// Each preset's tint for the folder, and the dot beside it in the menu.
const TONE: Record<FolderColor, string> = {
  blue: "text-blue-500",
  green: "text-emerald-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
};
const SWATCH: Record<FolderColor, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

// A tree item's folder: shut and open stacked, crossfading on the item's
// aria-selected, so the swap is a fade rather than a jump. The tree gives it
// the size and colour. The fade and scale sit on plain wrappers, never the
// SVGs: Chrome can only run them off the main thread on HTML elements, and
// a project's folder opens just as its board starts loading. Hovered or
// focused, in the list or the folded bar, it hops like All Projects' folder
// (globals.css).
const HOP =
  "motion-safe:group-hover/tree:animate-[projectum-hop_450ms_ease-out] motion-safe:group-focus-visible/tree:animate-[projectum-hop_450ms_ease-out] motion-safe:group-hover/menu-button:animate-[projectum-hop_450ms_ease-out] motion-safe:group-focus-visible/menu-button:animate-[projectum-hop_450ms_ease-out]";

function FolderGlyph({ className, open, color = null }: { className?: string; open?: boolean; color?: FolderColor | null }) {
  const tone = color ? TONE[color] : undefined;
  const layer = "col-start-1 row-start-1 flex transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none";
  // In the tree the item's aria-selected opens it; in the folded bar, `open`.
  const shut =
    open === undefined ? "group-aria-selected/tree:scale-90 group-aria-selected/tree:opacity-0" : open ? "scale-90 opacity-0" : "";
  const opened =
    open === undefined
      ? "scale-90 opacity-0 group-aria-selected/tree:scale-100 group-aria-selected/tree:opacity-100"
      : open
        ? ""
        : "scale-90 opacity-0";
  return (
    <span className={cn("grid place-items-center", HOP, className)}>
      <span data-folder="shut" className={cn(layer, shut)}>
        <FolderIcon className={cn("size-4", tone)} />
      </span>
      <span data-folder="open" className={cn(layer, opened)}>
        <FolderOpen className={cn("size-4", tone)} />
      </span>
    </span>
  );
}

// The tree takes an icon component, so each preset gets its own, made once
// so a project's folder keeps its identity between renders.
function tinted(color: FolderColor) {
  function TintedFolderGlyph(props: { className?: string }) {
    return <FolderGlyph {...props} color={color} />;
  }
  return TintedFolderGlyph;
}
const TINTED = Object.fromEntries(FOLDER_COLORS.map((c) => [c, tinted(c)])) as Record<
  FolderColor,
  React.ComponentType<{ className?: string }>
>;

// The "…" beside a project, shown on hover or focus: rename, the folder's
// colour, delete.
function ProjectActions({
  color,
  onRename,
  onColor,
  onDelete,
}: {
  color: FolderColor | null;
  onRename: () => void;
  onColor: (color: FolderColor | null) => void;
  onDelete: () => void;
}) {
  // Rename opens a name field that takes focus. The menu would hand focus
  // back to its trigger on close and steal it from the field, so after
  // Rename it keeps its hands off.
  const fieldOpening = React.useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={S.projectActions}
            className="absolute top-1/2 right-0.5 z-20 -translate-y-1/2 opacity-0 group-hover/project:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-44 rounded-lg"
        side="right"
        align="start"
        finalFocus={() => {
          const skip = fieldOpening.current;
          fieldOpening.current = false;
          return !skip;
        }}
      >
        <DropdownMenuItem
          onClick={() => {
            fieldOpening.current = true;
            onRename();
          }}
        >
          <Pencil />
          {S.rename}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette />
            {S.folderColor}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-36">
            <DropdownMenuRadioGroup
              value={color ?? "default"}
              onValueChange={(value) => onColor(value === "default" ? null : (value as FolderColor))}
            >
              <DropdownMenuRadioItem value="default">
                <span aria-hidden className="size-2.5 rounded-full border border-muted-foreground/50" />
                {S.colors.default}
              </DropdownMenuRadioItem>
              {FOLDER_COLORS.map((c) => (
                <DropdownMenuRadioItem key={c} value={c}>
                  <span aria-hidden className={cn("size-2.5 rounded-full", SWATCH[c])} />
                  {S.colors[c]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          {S.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectFolders({ email, activeId }: { email: string; activeId: string | null }) {
  const router = useRouter();
  const [list, update] = useProjects(email);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  // The project just clicked, shown selected until the address catches up.
  // Any change of open project (that one, another, or a page with none)
  // clears it, so it never outlives the click.
  const [pending, setPending] = React.useState<string | null>(null);
  const [seenActive, setSeenActive] = React.useState(activeId);
  if (seenActive !== activeId) {
    setSeenActive(activeId);
    setPending(null);
  }
  const selectedId = pending ?? activeId;

  return (
    <>
      {/* Shown once there is a project to list. The selected pill uses the
          sidebar's active grey, so the open project reads like All Projects
          does when it is open. */}
      {list.length > 0 && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <TreeView
            selectedId={selectedId ?? ""}
            onSelect={(id) => {
              if (id !== activeId) setPending(id);
              router.push(`/projectum?project=${encodeURIComponent(id)}`);
            }}
            className="px-0 [--secondary:var(--sidebar-accent)]"
          >
            <TreeSection title={S.yourProjects}>
              {list.map((project) => (
                <div key={project.id} data-project-item="" className="group/project relative">
                  {renaming === project.id ? (
                    <div className="flex h-8 items-center pr-1 pl-8">
                      <NameField
                        initial={project.name}
                        onDone={(name) => {
                          setRenaming(null);
                          if (name) update((l) => renameProject(l, project.id, name));
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Regular weight when selected: the open project reads
                          darker, never bolder. */}
                      <TreeItem
                        id={project.id}
                        label={project.name}
                        icon={project.color ? TINTED[project.color] : FolderGlyph}
                        className="w-full pr-9 font-normal"
                      />
                      <ProjectActions
                        color={project.color}
                        onColor={(color) => update((l) => recolorProject(l, project.id, color))}
                        onRename={() => setRenaming(project.id)}
                        onDelete={() => {
                          update((l) => removeProject(l, project.id));
                          // Deleting the open project leaves its board.
                          if (activeId === project.id) router.replace("/projectum");
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </TreeSection>
          </TreeView>
        </SidebarGroup>
      )}

      {/* Folded bar: Your Projects as folder icons, in the list's order,
          the open one open and each named on hover, so the folded bar gets
          around like the open one. A click selects at once, as in the tree. */}
      {list.length > 0 && (
        <SidebarGroup className="hidden pb-0 group-data-[collapsible=icon]:flex">
          <SidebarMenu>
            {list.map((project) => {
              const open = project.id === selectedId;
              return (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    isActive={open}
                    tooltip={project.name}
                    data-folded-project=""
                    aria-current={project.id === activeId ? "page" : undefined}
                    onClick={() => {
                      if (project.id !== activeId) setPending(project.id);
                    }}
                    render={<Link href={`/projectum?project=${encodeURIComponent(project.id)}`} />}
                  >
                    <FolderGlyph open={open} color={project.color} className="size-4 shrink-0" />
                    <span>{project.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {/* Add Project sits after the list, a full group's gap below it, and
          opens the project form. It stays in the folded bar as its + icon,
          which turns a quarter on hover or focus, overshooting a little. */}
      <SidebarGroup className={list.length > 0 ? "pt-1" : "pt-0"}>
        <SidebarMenu>
          <SidebarMenuItem>
            <ProjectDetailsDialog email={email}>
              <SidebarMenuButton
                tooltip={S.addProject}
                render={<DialogTrigger />}
                className="[&>svg]:transition-[rotate] [&>svg]:duration-300 [&>svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-safe:hover:[&>svg]:rotate-90 motion-safe:focus-visible:[&>svg]:rotate-90"
              >
                <Plus />
                <span>{S.addProject}</span>
              </SidebarMenuButton>
            </ProjectDetailsDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
