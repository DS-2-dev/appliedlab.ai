// Projectum on the static site: the demo, open to anyone. There are no
// accounts on a static site, so it opens as the demo account and keeps its
// projects in this browser, as the signed-in page does today. The view and
// theme are read in the browser (projectum-view.tsx).

import { Suspense } from "react";
import { AgentsPanel } from "@/components/projectum/agents-panel";
import { ProjectumView } from "@/components/projectum/projectum-view";
import { SettingsPanel } from "@/components/projectum/settings-panel";
import { DARK_FIRST_PAINT, THEME_COOKIE } from "@/components/projectum/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

const DEMO = { name: "Projectum demo", email: "demo@weber.edu" };

// The server page adds the dark class before paint when the cookie says so;
// here the check runs in the browser, still ahead of paint.
const DARK_IF_SAVED = `if(document.cookie.split("; ").includes("${THEME_COOKIE}=dark")){${DARK_FIRST_PAINT}}`;

export function StaticProjectum() {
  return (
    <TooltipProvider>
      <script dangerouslySetInnerHTML={{ __html: DARK_IF_SAVED }} />
      <Suspense>
        <ProjectumView
          name={DEMO.name}
          email={DEMO.email}
          settings={<SettingsPanel name={DEMO.name} email={DEMO.email} dark={false} />}
          agents={<AgentsPanel />}
        />
      </Suspense>
    </TooltipProvider>
  );
}
