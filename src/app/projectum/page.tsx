// Projectum: the one signed-in page (2026-09-11). Officer and member are one
// kind of account now, and this is all an account opens onto. Stock shadcn
// (Base UI, base-nova, neutral) from here on: the sidebar layout from its
// docs with no top bar, the Lab's purple left out.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import { getSessionUser } from "@/lib/auth";
import { AgentsPanel } from "@/components/projectum/agents-panel";
import { AllProjects } from "@/components/projectum/all-projects";
import { AppSidebar, type ProjectumView } from "@/components/projectum/app-sidebar";
import { ProjectBoard } from "@/components/projectum/project-board";
import { SettingsPanel } from "@/components/projectum/settings-panel";
import { DARK_FIRST_PAINT, THEME_COOKIE } from "@/components/projectum/theme";
import { ThemeSync } from "@/components/projectum/theme-switch";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.projectum.title} | ${copy.meta.title}`,
};

export default async function ProjectumPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; project?: string | string[] }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/projectum");

  // Still one page: the sidebar sets ?project= or ?view= and marks the active
  // entry. Anything unknown falls back to All Projects, the first tab.
  // Settings is a dialog over whichever view is open.
  const params = await searchParams;
  const projectId = typeof params.project === "string" && params.project ? params.project : null;
  const view: ProjectumView = projectId ? "project" : params.view === "agents" ? "agents" : "projects";

  // shadcn's sidebar remembers open or collapsed in this cookie. Reading it
  // here renders the right state on the first paint instead of snapping to
  // it after hydration.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const dark = cookieStore.get(THEME_COOKIE)?.value === "dark";
  const name = user.full_name ?? user.email.split("@")[0];

  return (
    <TooltipProvider>
      {dark && <script dangerouslySetInnerHTML={{ __html: DARK_FIRST_PAINT }} />}
      <ThemeSync dark={dark} />
      <SidebarProvider defaultOpen={defaultOpen} className="projectum-ui">
        <AppSidebar
          name={name}
          email={user.email}
          view={view}
          projectId={projectId}
          settings={<SettingsPanel name={name} email={user.email} dark={dark} />}
        />
        {/* No top bar: the sidebar carries the controls. Each view fades
            and rises in as it opens, keyed so a different project replays
            it too and starts its board fresh. Opacity and transform only,
            so it stays smooth while the view renders. */}
        <SidebarInset>
          <div
            key={view === "project" ? `project-${projectId}` : view}
            data-view={view}
            className="flex min-h-0 flex-1 flex-col animate-in duration-300 ease-out fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {view === "project" && projectId ? (
              <ProjectBoard email={user.email} projectId={projectId} />
            ) : view === "agents" ? (
              <AgentsPanel />
            ) : (
              <AllProjects email={user.email} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
