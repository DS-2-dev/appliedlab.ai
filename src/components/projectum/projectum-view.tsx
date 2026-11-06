"use client";

// The browser half of Projectum on the static site (StaticProjectum). The
// server page reads ?view=, ?project= and the theme and sidebar cookies on
// each request; a static page is built once, so this reads them here
// instead, after the page loads. Which view an address opens is nav.ts's
// pickView. Views still being built show a placeholder.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { AllProjects } from "@/components/projectum/all-projects";
import { AppSidebar } from "@/components/projectum/app-sidebar";
import { MyProjects } from "@/components/projectum/my-projects-view";
import { type ProjectumView as View, pickView } from "@/components/projectum/nav";
import { OrgView } from "@/components/projectum/org-view";
import { OverviewView } from "@/components/projectum/overview-view";
import { type PipelineProject, useApi } from "@/components/projectum/pipeline-store";
import { LoadError, Loading } from "@/components/projectum/pipeline-ui";
import { InboxView } from "@/components/projectum/inbox-view";
import { Placeholder } from "@/components/projectum/placeholder-view";
import { PostingView } from "@/components/projectum/posting-view";
import { MyPostings, NoticeBoard } from "@/components/projectum/postings-view";
import { ProjectBoard } from "@/components/projectum/project-board";
import { ReviewView } from "@/components/projectum/review-view";
import { ReviewsView } from "@/components/projectum/reviews-view";
import { THEME_COOKIE } from "@/components/projectum/theme";
import { ThemeSync } from "@/components/projectum/theme-switch";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const T = copy.projectum.pipeline.placeholder;

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const subscribeNever = () => () => {};

// ?view=project&id=<project>: the project's board, once it has one.
function ProjectById({ id }: { id: string }) {
  const { data, error, retry } = useApi<PipelineProject>(`/projects/${encodeURIComponent(id)}`);
  if (error && !data) return <LoadError retry={retry} />;
  if (!data) return <Loading />;
  return data.boardId ? <ProjectBoard projectId={data.boardId} /> : <Placeholder title={data.posting.title || T.project} />;
}

function Content({ view, id, posting, board }: { view: View; id: string | null; posting: string | null; board: string | null }) {
  switch (view) {
    case "project":
      if (board) return <ProjectBoard projectId={board} />;
      return id ? <ProjectById id={id} /> : <Placeholder title={T.project} />;
    case "projects":
      return <AllProjects />;
    case "overview":
      return <OverviewView />;
    case "posting": {
      const postingId = posting ?? id;
      return postingId ? <PostingView key={postingId} id={postingId} /> : <NoticeBoard />;
    }
    case "postings":
      return <MyPostings />;
    case "myprojects":
      return <MyProjects />;
    case "reviews":
      return <ReviewsView />;
    case "review":
      return id ? <ReviewView key={id} id={id} /> : <ReviewsView />;
    case "inbox":
      return <InboxView />;
    case "org":
      return <OrgView id={id} />;
    default:
      return <NoticeBoard />;
  }
}

export function ProjectumView({ settings }: { settings: React.ReactNode }) {
  const me = useAccount();
  const params = useSearchParams();
  const board = params.get("project") || null;
  const posting = params.get("posting") || null;
  const id = params.get("id") || null;
  const view = pickView(params.get("view"), { role: me.role, roles: me.roles, admin: me.admin, id, posting, project: board });
  // ?view=project&id= names the project; its board lights up in the
  // sidebar's folders as ?project= does. The same request ProjectById reads.
  const byId = useApi<PipelineProject>(view === "project" && !board && id ? `/projects/${encodeURIComponent(id)}` : null).data;
  const activeBoard = board ?? byId?.boardId ?? null;

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

  // One key per subject, so moving between two of the same view animates.
  const subject = board ?? posting ?? id;
  return (
    <>
      <ThemeSync dark={dark} />
      <SidebarProvider key={String(defaultOpen)} defaultOpen={defaultOpen} className="projectum-ui">
        <AppSidebar name={me.name} email={me.email} view={view} projectId={activeBoard} settings={settings} />
        <SidebarInset>
          <div
            key={subject ? `${view}-${subject}` : view}
            data-view={view}
            className="flex min-h-0 flex-1 flex-col animate-in duration-300 ease-out fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <Content view={view} id={id} posting={posting} board={board} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
