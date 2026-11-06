// Where a project is on its way: one segment per stage in PROJECT_FLOW. Done
// stages are filled, the current one is marked, later ones are muted. A
// returned state sits on its stage and shows red. A status off the flow
// (withdrawn) marks none, so every segment is muted. `compact` drops the
// names under the segments, for a narrow column: each segment names its
// stage on hover, and the list's label reads them all out.

import { copy } from "@/content/copy";
import type { ProjectStatus } from "@/lib/pipeline/domain";
import { stageBarState, stateOf } from "@/lib/pipeline/machines";
import { cn } from "cn";

const T = copy.projectum.pipeline.transition;

export function StageBar({
  status,
  self,
  compact,
  className,
}: {
  status: ProjectStatus;
  self?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { flow, current: at, returned } = stageBarState(status, self);
  // No segment is current or behind it when the status is off the flow.
  const current = at ?? -1;
  const label = flow
    .map((s, i) => {
      const name = stateOf("project", s).label;
      return i === current ? `${name} (${returned ? T.stageReturned : T.stageCurrent})` : name;
    })
    .join(", ");
  return (
    <ol aria-label={`${T.stageBar}: ${label}`} className={cn("flex gap-1", className)}>
      {flow.map((s, i) => (
        <li key={s} className="min-w-0 flex-1" aria-current={i === current ? "step" : undefined} title={compact ? stateOf("project", s).label : undefined}>
          <div
            className="h-1.5 rounded-full"
            style={{
              backgroundColor:
                i === current && returned
                  ? "var(--tone-red-fg)"
                  : i < current
                    ? "var(--foreground)"
                    : i === current
                      ? "var(--tone-blue-fg)"
                      : "var(--muted)",
            }}
          />
          {!compact && (
            <div
              className={cn(
                "mt-1 truncate text-[0.7rem]",
                i === current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
              style={i === current && returned ? { color: "var(--tone-red-fg)" } : undefined}
            >
              {stateOf("project", s).label}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
