// Projectum, for a signed-in account. The site is static (GitHub Pages), so
// the account, the view and the theme are all read in the browser
// (account-gate.tsx, projectum-view.tsx), and the projects come from the
// Worker. A dark theme is set before the first paint by the root layout.

import { Suspense } from "react";
import { AccountGate } from "@/components/projectum/account-gate";
import { ProjectumView } from "@/components/projectum/projectum-view";
import { SettingsPanel } from "@/components/projectum/settings-panel";
import { TooltipProvider } from "@/components/ui/tooltip";

export function StaticProjectum() {
  return (
    <TooltipProvider>
      <AccountGate>
        <Suspense>
          <ProjectumView settings={<SettingsPanel dark={false} />} />
        </Suspense>
      </AccountGate>
    </TooltipProvider>
  );
}
