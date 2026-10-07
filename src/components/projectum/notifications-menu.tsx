"use client";

// The bell: the first entry in the sidebar's menu, with the unread count as
// its badge, opening a panel beside the bar with what happened that concerns
// this account (worker/src/notify.ts). Folded to icons, it is the bell with
// the count. Clicking a notification marks it read and opens its page.
// Checked every minute while the tab is in view, and again on opening.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  CalendarCheck,
  CircleCheck,
  CircleX,
  FileCheck,
  Handshake,
  Inbox,
  type LucideIcon,
  Undo2,
  UserPlus,
} from "lucide-react";
import { copy } from "@/content/copy";
import { send, useApi } from "@/components/projectum/pipeline-store";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const N = copy.projectum.notifications;

type Notification = { id: string; kind: string; title: string; href: string; read: boolean; createdAt: string };

const ICONS: Record<string, LucideIcon> = {
  "claim-new": Inbox,
  "claim-approved": CircleCheck,
  "claim-denied": CircleX,
  "submission-new": Inbox,
  "submission-accepted": FileCheck,
  "submission-returned": Undo2,
  "team-submitted": FileCheck,
  "partner-new": UserPlus,
  "partner-approved": CircleCheck,
  "meeting-requested": CalendarCheck,
  selected: Handshake,
  complete: CircleCheck,
};

// "5m", "3h", "2d", then the date.
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return N.justNow;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationsMenu() {
  const router = useRouter();
  const { data, retry } = useApi<{ unread: number; notifications: Notification[] }>("/notifications");
  const [open, setOpen] = React.useState(false);
  const unread = data?.unread ?? 0;

  // A fresh look every minute while the tab is visible, and on coming back.
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") retry();
    };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [retry]);

  const openOne = (n: Notification) => {
    setOpen(false);
    if (!n.read) void send("/notifications/read", "POST", { ids: [n.id] }).catch(() => {});
    if (n.href) router.push(n.href);
  };

  return (
    <SidebarMenuItem>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) retry();
        }}
      >
        <SidebarMenuButton
          tooltip={N.label}
          isActive={open}
          aria-label={unread ? `${N.label}, ${N.unread(unread)}` : N.label}
          render={<DropdownMenuTrigger />}
          className="motion-safe:hover:[&>svg]:animate-[projectum-wiggle_500ms_ease-in-out] motion-safe:focus-visible:[&>svg]:animate-[projectum-wiggle_500ms_ease-in-out]"
        >
          {unread ? <BellRing /> : <Bell />}
          <span>{N.label}</span>
        </SidebarMenuButton>
        {unread > 0 && (
          <SidebarMenuBadge data-unread="">{unread > 99 ? "99+" : unread}</SidebarMenuBadge>
        )}
        {/* Folded to icons, the badge hides, so a dot on the bell stands in. */}
        {unread > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 left-5 hidden size-2 rounded-full bg-primary ring-2 ring-sidebar group-data-[collapsible=icon]:block"
          />
        )}
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-96 max-w-[calc(100vw-2rem)] p-0"
          data-notifications=""
        >
          <div className="flex h-11 items-center justify-between gap-2 border-b px-3">
            <span className="text-sm font-medium">{N.label}</span>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void send("/notifications/read", "POST", { all: true }).catch(() => {})}
              >
                {N.markAll}
              </Button>
            )}
          </div>
          {data?.notifications.length ? (
            <ul className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
              {data.notifications.map((n) => {
                const Icon = ICONS[n.kind] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openOne(n)}
                      data-notification={n.read ? "read" : "unread"}
                      className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                    >
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className={`line-clamp-2 ${n.read ? "text-muted-foreground" : "font-medium"}`}>{n.title}</span>
                        <span className="text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                      </span>
                      {!n.read && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-1 px-6 py-10 text-center">
              <Bell className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">{N.empty}</p>
              <p className="text-xs text-muted-foreground">{N.emptyHelp}</p>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
