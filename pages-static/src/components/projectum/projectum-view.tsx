"use client";

// The browser half of Projectum on the GitHub Pages build. The server page
// (src/app/projectum/page.tsx) reads ?view=, ?project= and the theme and
// sidebar cookies on each request; a static page is built once, so this
// reads them here instead, after the page loads.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AllProjects } from "@/components/projectum/all-projects";
import { AppSidebar, type ProjectumView } from "@/components/projectum/app-sidebar";
import { ProjectBoard } from "@/components/projectum/project-board";
import { THEME_COOKIE } from "@/components/projectum/theme";
import { ThemeSync } from "@/components/projectum/theme-switch";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const subscribeNever = () => () => {};

export function ProjectumView({
  name,
  email,
  settings,
  agents,
}: {
  name: string;
  email: string;
  settings: React.ReactNode;
  agents: React.ReactNode;
}) {
  const params = useSearchParams();
  const project = params.get("project");
  const projectId = project ? project : null;
  const view: ProjectumView = projectId ? "project" : params.get("view") === "agents" ? "agents" : "projects";

  // Cookies only exist in the browser; the build renders the defaults.
  const dark = React.useSyncExternalStore(
    subscribeNever,
    () => readCookie(THEME_COOKIE) === "dark",
    () => false,
  );
  const defaultOpen = React.useSyncExternalStore(
    subscribeNever,
    () => readCookie("sidebar_state") !== "false",
    () => true,
  );

  return (
    <>
      <ThemeSync dark={dark} />
      <SidebarProvider key={String(defaultOpen)} defaultOpen={defaultOpen} className="projectum-ui">
        <AppSidebar name={name} email={email} view={view} projectId={projectId} settings={settings} />
        <SidebarInset>
          <div
            key={view === "project" ? `project-${projectId}` : view}
            data-view={view}
            className="flex min-h-0 flex-1 flex-col animate-in duration-300 ease-out fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {view === "project" && projectId ? (
              <ProjectBoard email={email} projectId={projectId} />
            ) : view === "agents" ? (
              agents
            ) : (
              <AllProjects email={email} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
