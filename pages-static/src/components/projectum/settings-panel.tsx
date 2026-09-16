// Projectum's Settings, a dialog opened from the profile at the bottom of
// the sidebar (app-sidebar.tsx). Each section is made here, on the server,
// and settings-tabs.tsx lays them out, a nav at the left and the chosen one
// at the right. The profile picture can be uploaded (profile-photo.tsx).
//
// The GitHub Pages build's copy of src/components/projectum/settings-panel.tsx.
// The demo has no account to leave, so Account and its Log out are gone.

import { Bot, CalendarCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { copy } from "@/content/copy";
import { getSettings } from "@/lib/data";
import { AttendanceGraph } from "@/components/projectum/attendance-graph";
import { CONNECTOR_LOGOS } from "@/components/projectum/connector-logos";
import { ProfilePhoto } from "@/components/projectum/profile-photo";
import { type SettingsSection, SettingsTabs } from "@/components/projectum/settings-tabs";
import { DarkModeSwitch } from "@/components/projectum/theme-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const P = copy.projectum.settingsPage;

// Headed like the project card's fields.
function Field({ heading, value }: { heading: string; value: string }) {
  return (
    <section className="grid content-start gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>
      <p className="truncate">{value}</p>
    </section>
  );
}

export async function SettingsPanel({ name, email, dark }: { name: string; email: string; dark: boolean }) {
  const { meeting_schedule: schedule } = await getSettings();

  const sections: SettingsSection[] = [
    {
      id: "profile",
      title: P.profileTitle,
      description: P.profileDescription,
      icon: <UserRound />,
      content: (
        <>
          <ProfilePhoto name={name} email={email} />
          <div className="grid grid-cols-2 gap-6">
            <Field heading={P.nameLabel} value={name} />
            <Field heading={P.emailLabel} value={email} />
          </div>
        </>
      ),
    },
    {
      id: "preferences",
      title: P.preferencesTitle,
      description: P.preferencesDescription,
      icon: <SlidersHorizontal />,
      content: (
        <div data-dark-mode="" className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor="settings-dark-mode">{P.darkMode}</Label>
            <span className="text-xs text-muted-foreground">{P.darkModeHelp}</span>
          </div>
          <DarkModeSwitch id="settings-dark-mode" initial={dark} />
        </div>
      ),
    },
    {
      // A row per connector with its real mark, each marked Planned with its
      // Connect button off until the connector exists.
      id: "agents",
      title: P.agentsTitle,
      description: P.agentsDescription,
      icon: <Bot />,
      content: (
        <div data-agent-access="" className="grid gap-2">
          {P.connectors.map((connector) => {
            const Logo = CONNECTOR_LOGOS[connector.id];
            return (
              <div
                key={connector.id}
                data-connector={connector.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-foreground">
                  <Logo data-connector-logo="" className="size-5" />
                </div>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-medium">{connector.name}</span>
                  <span className="text-xs text-muted-foreground">{connector.description}</span>
                </div>
                <Badge variant="outline">{P.planned}</Badge>
                <Button variant="outline" size="sm" disabled aria-label={`${P.connect} ${connector.name}`}>
                  {P.connect}
                </Button>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: "attendance",
      title: P.attendanceTitle,
      description: schedule
        ? `${P.attendanceDescription} ${P.attendanceSchedule(schedule)}`
        : P.attendanceDescription,
      icon: <CalendarCheck />,
      content: <AttendanceGraph schedule={schedule} />,
    },
  ];

  return <SettingsTabs sections={sections} />;
}
