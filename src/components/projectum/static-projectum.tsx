// Projectum, for a signed-in account. The site is static (GitHub Pages), so
// the account, the view and the theme are all read in the browser
// (account-gate.tsx, projectum-view.tsx), and the projects come from the
// Worker.

import { Suspense } from "react";
import { AccountGate } from "@/components/projectum/account-gate";
import { AgentsPanel } from "@/components/projectum/agents-panel";
import { ProjectumView } from "@/components/projectum/projectum-view";
import { SettingsPanel } from "@/components/projectum/settings-panel";
import { DARK_FIRST_PAINT, THEME_COOKIE } from "@/components/projectum/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

// The server page adds the dark class before paint when the cookie says so;
// here the check runs in the browser, still ahead of paint.
const DARK_IF_SAVED = `if(document.cookie.split("; ").includes("${THEME_COOKIE}=dark")){${DARK_FIRST_PAINT}}`;

export function StaticProjectum() {
  return (
    <TooltipProvider>
      <script dangerouslySetInnerHTML={{ __html: DARK_IF_SAVED }} />
      <AccountGate>
        <Suspense>
          <ProjectumView settings={<SettingsPanel dark={false} />} agents={<AgentsPanel />} />
        </Suspense>
      </AccountGate>
    </TooltipProvider>
  );
}
