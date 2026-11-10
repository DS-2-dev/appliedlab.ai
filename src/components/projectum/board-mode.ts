// How the board page treats a board from GET /boards: which entry an id
// names, whether this account edits it, finds it locked while a gate
// decides (its own team), or only views it (a partner, staff),
// and when its stage moves are open.
// Pure, for scripts/board-mode.test.mjs.

import type { ProjectStatus } from "@/lib/pipeline/domain";
import type { BoardEntry } from "@/components/projectum/project-store";

export type BoardMode = "edit" | "locked" | "view";

// The statuses a team's board waits in while the Lab or the partner decides
// (worker/src/boards.ts LOCKED).
const LOCKED: readonly ProjectStatus[] = ["plan_review", "submission_review", "delivered", "completion_review"];

// The entry with this board.
export function findBoard<E extends Pick<BoardEntry, "project">>(entries: readonly E[], id: string): E | null {
  return entries.find((e) => e.project?.id === id) ?? null;
}

// Whether the board's own stage moves (Move to Prototype, Submit work) are
// open: always on a board with no project, and on a project's once its plan
// is approved and while the team works it. Before that the plan editor and
// the gate move the project; after, the work is in for review.
export function canMoveStage(status: ProjectStatus | null): boolean {
  return status === null || status === "active" || status === "submission_returned";
}

export function boardMode(entry: Pick<BoardEntry, "editable" | "onTeam" | "status">): BoardMode {
  if (entry.editable) return "edit";
  return entry.onTeam && entry.status && LOCKED.includes(entry.status) ? "locked" : "view";
}
