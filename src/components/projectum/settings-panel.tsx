// Projectum's Settings, a dialog opened from the profile at the bottom of
// the sidebar (app-sidebar.tsx). settings-tabs.tsx lays the sections out, a
// nav at the left and the chosen one at the right. The account's name,
// email, picture, level and profile switches are read in the browser
// (profile-fields.tsx, profile-photo.tsx, profile-settings.tsx), and so is
// Log out (account-gate.tsx), since the account lives on the Worker.

import { KeyRound, SlidersHorizontal, UserRound } from "lucide-react";
import { copy } from "@/content/copy";
import { LogoutButton } from "@/components/projectum/account-gate";
import { ProfileFields } from "@/components/projectum/profile-fields";
import { ProfilePhoto } from "@/components/projectum/profile-photo";
import { ProfileSettings } from "@/components/projectum/profile-settings";
import { type SettingsSection, SettingsTabs } from "@/components/projectum/settings-tabs";
import { DarkModeSwitch } from "@/components/projectum/theme-switch";
import { Label } from "@/components/ui/label";

const P = copy.projectum.settingsPage;

export function SettingsPanel({ dark }: { dark: boolean }) {
  const sections: SettingsSection[] = [
    {
      id: "profile",
      title: P.profileTitle,
      description: P.profileDescription,
      icon: <UserRound />,
      content: (
        <>
          <ProfilePhoto />
          <ProfileFields />
          <ProfileSettings />
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
      id: "account",
      title: P.accountTitle,
      description: P.accountDescription,
      icon: <KeyRound />,
      content: <LogoutButton />,
    },
  ];

  return <SettingsTabs sections={sections} />;
}
