"use client";

// The browser half of Projectum on the static site (StaticProjectum). The
// server page reads ?view=, ?project= and the theme and sidebar cookies on
// each request; a static page is built once, so this reads them here
// instead, after the page loads.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/lib/account";
import { AllProjects } from "@/components/projectum/all-projects";
import { Approvals, MyClaims } from "@/components/projectum/claims-view";
import { ProblemView } from "@/components/projectum/problem-view";
import { MyProblems, NoticeBoard } from "@/components/projectum/problems-view";
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

// Which view the address asks for, held to what the account may open. A
// partner's home is My Problems, everyone else's the Notice Board.
function pickView(
  asked: string | null,
  { projectId, problemId, role, approver }: { projectId: string | null; problemId: string | null; role: string; approver: boolean },
): ProjectumView {
  const partner = role === "partner";
  if (problemId) return "problem";
  if (projectId && !partner) return "project";
  if (asked === "claims" && role === "member") return "claims";
  if (asked === "queue" && approver) return "queue";
  if (asked === "projects" && !partner) return "projects";
  return partner ? "mine" : "board";
}

export function ProjectumView({ settings }: { settings: React.ReactNode }) {
  const { name, email, role, approver } = useAccount();
  const params = useSearchParams();
  const projectId = params.get("project") || null;
  const problemId = params.get("problem") || null;
  const view = pickView(params.get("view"), { projectId, problemId, role, approver });

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
            key={view === "project" ? `project-${projectId}` : view === "problem" ? `problem-${problemId}` : view}
            data-view={view}
            className="flex min-h-0 flex-1 flex-col animate-in duration-300 ease-out fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {view === "project" && projectId ? (
              <ProjectBoard projectId={projectId} />
            ) : view === "problem" && problemId ? (
              <ProblemView id={problemId} />
            ) : view === "claims" ? (
              <MyClaims />
            ) : view === "queue" ? (
              <Approvals />
            ) : view === "projects" ? (
              <AllProjects />
            ) : view === "mine" ? (
              <MyProblems />
            ) : (
              <NoticeBoard />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
