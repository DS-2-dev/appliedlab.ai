// Projectum's Agents view, the tab below All Projects. Headed like All
// Projects, and empty until agents arrive, so a dashed panel holds the spot.

import { Bot } from "lucide-react";
import { copy } from "@/content/copy";

const A = copy.projectum.agents;

export function AgentsPanel() {
  return (
    <div className="mx-auto grid w-full max-w-6xl content-start gap-6 p-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-medium">{A.title}</h1>
        <p className="text-sm text-muted-foreground">{A.description}</p>
      </div>
      <div
        data-agents-empty=""
        className="grid place-items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground"
      >
        <Bot className="size-6" />
        <p>{A.empty}</p>
      </div>
    </div>
  );
}
