"use client";

// The Projectum sidebar, assembled only from shadcn's Base UI sidebar parts
// (components/ui/sidebar.tsx, avatar). Neutral throughout, no brand purple,
// lucide icons only.
//
// Just the bar: the mark and the collapse toggle at the top, then the
// account's views, which depend on its role. Partners get My Problems.
// Members get the Notice Board, My Claims and All Projects with Your
// Projects under it; reps get the Notice Board and All Projects; and
// approvers also get Approvals, with how many are waiting, and Overview. At the bottom sits
// the profile, which opens Settings in a dialog, where Log out also lives.

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, FolderKanban, Inbox, LayoutDashboard, type LucideIcon, Megaphone, PanelLeft } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { initials } from "@/lib/initials";
import { useApi } from "@/components/projectum/pipeline-store";
import { useAvatar } from "@/components/projectum/profile-store";
import { ProjectFolders } from "@/components/projectum/project-folders";
import { ProjectumLogo } from "@/components/projectum/projectum-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const S = copy.projectum;

export type ProjectumView = "board" | "mine" | "problem" | "claims" | "queue" | "overview" | "projects" | "project";

// The collapse toggle, one for each state of the bar. Open, it sits at the
// right as the sidebar icon. Folded, a second one takes the mark's own spot
// at the left, so the mark stays exactly where it was while the bar
// narrows, and turns back into the sidebar icon on hover or focus. It only
// exists folded, so it shows the mark at once rather than fading in.
function SidebarToggle({ folded }: { folded: boolean }) {
  const { toggleSidebar } = useSidebar();
  if (!folded) {
    return (
      <Button
        data-sidebar="trigger"
        variant="ghost"
        size="icon-sm"
        aria-label={S.toggle}
        onClick={toggleSidebar}
        className="[--nudge:-3px] group-data-[collapsible=icon]:hidden motion-safe:hover:[&>svg]:animate-[projectum-nudge_450ms_ease-out] motion-safe:focus-visible:[&>svg]:animate-[projectum-nudge_450ms_ease-out]"
      >
        <PanelLeft />
      </Button>
    );
  }
  const face = "transition-opacity duration-200 ease-out motion-reduce:transition-none";
  return (
    <Button
      data-sidebar="trigger"
      data-folded-toggle=""
      variant="ghost"
      size="icon-sm"
      aria-label={S.toggle}
      onClick={toggleSidebar}
      className="group/toggle relative hidden size-8 group-data-[collapsible=icon]:flex"
    >
      <PanelLeft
        className={`${face} opacity-0 [--nudge:3px] group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100 motion-safe:group-hover/toggle:animate-[projectum-nudge_450ms_ease-out] motion-safe:group-focus-visible/toggle:animate-[projectum-nudge_450ms_ease-out]`}
      />
      <ProjectumLogo
        className={`${face} pointer-events-none absolute inset-0 m-auto size-5 w-auto group-hover/toggle:opacity-0 group-focus-visible/toggle:opacity-0`}
      />
    </Button>
  );
}

const P = copy.projectum.pipeline;

// Hovered or focused, the folder hops once (globals.css).
const HOP =
  "motion-safe:hover:[&>svg]:animate-[projectum-hop_450ms_ease-out] motion-safe:focus-visible:[&>svg]:animate-[projectum-hop_450ms_ease-out]";

type NavItem = { view: ProjectumView; label: string; href: string; icon: LucideIcon; badge?: number; className?: string };

function navItems(role: string, approver: boolean, waiting: number): NavItem[] {
  if (role === "partner") return [{ view: "mine", label: P.nav.myProblems, href: "/projectum", icon: Megaphone }];
  const items: NavItem[] = [{ view: "board", label: P.nav.board, href: "/projectum", icon: Megaphone }];
  if (role === "member") items.push({ view: "claims", label: P.nav.myClaims, href: "/projectum?view=claims", icon: ClipboardCheck });
  if (approver) {
    items.push({ view: "queue", label: P.nav.queue, href: "/projectum?view=queue", icon: Inbox, badge: waiting });
    items.push({ view: "overview", label: P.overview.nav, href: "/projectum?view=overview", icon: LayoutDashboard });
  }
  items.push({ view: "projects", label: S.projects, href: "/projectum?view=projects", icon: FolderKanban, className: HOP });
  return items;
}

// How many meetings, claims, submissions and partners wait for an approver.
function useWaiting(approver: boolean): number {
  const { data } = useApi<{ meetings: unknown[]; claims: unknown[]; submissions: unknown[]; partners: unknown[] }>(
    approver ? "/queue" : null,
  );
  return data ? data.meetings.length + data.claims.length + data.submissions.length + data.partners.length : 0;
}

export function AppSidebar({
  name,
  email,
  view,
  projectId,
  settings,
}: {
  name: string;
  email: string;
  view: ProjectumView;
  projectId: string | null;
  // The Settings dialog's inside, made on the server (settings-panel.tsx).
  settings: React.ReactNode;
}) {
  const [avatar] = useAvatar();
  const me = useAccount();
  const waiting = useWaiting(me.approver);
  const items = navItems(me.role, me.approver, waiting);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  return (
    <Sidebar collapsible="icon">
      {/* Top left: the Projectum mark and name, leading to All Projects,
          then the collapse toggle. Folded to icons, only the toggle stays,
          wearing the mark, there to open the bar again. */}
      <SidebarHeader>
        {/* Left aligned in both states. The mark is 20px tall either way,
            and 5px in it lands where the folded toggle centres it in its
            32px, so collapsing neither moves nor shrinks it. */}
        <div className="flex items-center gap-1">
          <SidebarToggle folded />
          <Link
            href="/projectum"
            data-brand=""
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-[5px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
          >
            <ProjectumLogo className="h-5 w-auto shrink-0" />
            <span className="truncate font-paplane text-base">{S.brandName}</span>
          </Link>
          <SidebarToggle folded={false} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.view}>
                <SidebarMenuButton
                  tooltip={item.label}
                  isActive={view === item.view}
                  render={<Link href={item.href} />}
                  className={item.className}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {me.role !== "partner" && <ProjectFolders activeId={projectId} />}
      </SidebarContent>

      {/* The profile is the way into Settings, a dialog over the view. */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Already tucked in: the avatar sits where the folded bar puts
                it, so folding only narrows the bar and the avatar never
                moves. The highlight reaches 4px past it on every side (a
                matching negative margin keeps the row's space), open and
                folded alike. It stays lit while Settings is open. */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SidebarMenuButton
                size="lg"
                tooltip={S.settings}
                isActive={settingsOpen}
                aria-label={`${name}, ${S.settings}`}
                render={<DialogTrigger />}
                className="-m-1 h-10 w-[calc(100%+0.5rem)] rounded-lg p-1 pr-3 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1!"
              >
                {/* Round like its outline: squaring the corners left the
                    round border showing inside a square. */}
                <Avatar data-profile-avatar="" className="size-8">
                  {avatar && <AvatarImage src={avatar} alt="" />}
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm">
                  <span className="truncate leading-4 font-medium">{name}</span>
                  <span className="truncate text-xs leading-4 text-muted-foreground">{email}</span>
                </div>
              </SidebarMenuButton>
              <DialogContent className="sm:max-w-4xl" bodyClassName="p-0">
                {settings}
              </DialogContent>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
