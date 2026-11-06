"use client";

// A status as a small tinted label. The words and tone come from the machine
// (stateOf); the tooltip says what the status means and whose move it is.

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/content/copy";
import { ROLE_LABEL } from "@/lib/pipeline/domain";
import { stateOf, type EntityKind, type Tone } from "@/lib/pipeline/machines";
import { cn } from "cn";

const T = copy.projectum.pipeline.transition;

/** Inline colors for a tone, from the --tone-* tokens in globals.css. */
export function toneStyle(tone: Tone): React.CSSProperties {
  return { backgroundColor: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` };
}

export function StatusPill({
  kind,
  status,
  size = "md",
  className,
}: {
  kind: EntityKind;
  status: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = stateOf(kind, status);
  const who = s.court === "none" ? T.nobody : ROLE_LABEL[s.court];
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        style={toneStyle(s.tone)}
        className={cn(
          "inline-flex items-center rounded-full font-medium whitespace-nowrap",
          size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-0.5 text-xs",
          className,
        )}
      >
        {s.label}
      </TooltipTrigger>
      <TooltipContent>
        {s.hint ? `${s.hint} ` : ""}
        {T.whoseMove}: {who}
      </TooltipContent>
    </Tooltip>
  );
}
