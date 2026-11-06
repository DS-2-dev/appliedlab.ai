"use client";

// A view that is not built yet: its title and a short note, so every
// address in the new routing opens something. Tasks 16 to 21 replace each.

import { copy } from "@/content/copy";
import { ViewFrame } from "@/components/projectum/pipeline-ui";

const P = copy.projectum.pipeline.placeholder;

export function Placeholder({ title }: { title?: string }) {
  return (
    <ViewFrame title={title || P.title}>
      <p data-placeholder="" className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        {P.body}
      </p>
    </ViewFrame>
  );
}
