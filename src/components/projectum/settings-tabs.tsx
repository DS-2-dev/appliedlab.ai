"use client";

// The inside of the Settings dialog, after shadcn's sidebar-in-a-dialog
// block: the sections down a narrow nav at the left, the chosen one in the
// main area at the right. The sections themselves are made on the server
// (settings-panel.tsx), so this only picks which one shows. It opens on the
// first each time.

import * as React from "react";
import { copy } from "@/content/copy";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const S = copy.projectum;

export type SettingsSection = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

export function SettingsTabs({ sections }: { sections: SettingsSection[] }) {
  const [activeId, setActiveId] = React.useState(sections[0].id);
  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  return (
    <div className="flex h-[min(36rem,calc(100svh-4rem))]">
      <Sidebar collapsible="none" className="w-52 shrink-0 border-r">
        <SidebarHeader className="px-4 pt-4 pb-1">
          <DialogTitle className="text-base">{S.settings}</DialogTitle>
          <DialogDescription className="sr-only">{S.settingsPage.description}</DialogDescription>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label={S.settingsPage.sectionsLabel}>
                {sections.map((section) => (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      data-settings-tab={section.id}
                      isActive={section.id === active.id}
                      aria-current={section.id === active.id ? "true" : undefined}
                      onClick={() => setActiveId(section.id)}
                    >
                      {section.icon}
                      <span>{section.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Keyed so each section starts at the top. Its header clears the
          dialog's close button. */}
      <section key={active.id} data-settings-section={active.id} className="flex min-w-0 flex-1 flex-col">
        <header className="grid shrink-0 gap-1 px-6 pt-4 pr-14 pb-4">
          <h2 className="text-base font-medium">{active.title}</h2>
          <p className="text-sm text-muted-foreground">{active.description}</p>
        </header>
        <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-6 pb-6">{active.content}</div>
      </section>
    </div>
  );
}
