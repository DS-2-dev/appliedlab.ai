// Small pure rules the project views share (My Projects, the board's header
// and the plan editor): where a project opens, the notes it came back with,
// and the plan editor's draft. Pure, so scripts/project-helpers.test.mjs
// runs them.

import type { ProjectStatus } from "@/lib/pipeline/domain";
import type { Milestone, PlanDraft } from "@/lib/problems";
import { latestReturnNotes } from "@/components/projectum/posting-helpers";

type Gate = "posting" | "action_plan" | "submission" | "completion";

// The statuses the team writes its action plan in.
export function isPlanning(status: ProjectStatus): boolean {
  return status === "claimed" || status === "plan_returned";
}

// The project's board when it has one, otherwise the project's own page.
export function projectHref(p: { id: string; boardId: string | null }): string {
  return p.boardId ? `/projectum?project=${encodeURIComponent(p.boardId)}` : `/projectum?view=project&id=${encodeURIComponent(p.id)}`;
}

// The notes a returned plan or submission came back with: the newest round
// at that gate, when it was a return. "" for any other status.
export function returnNotes(
  status: ProjectStatus,
  reviews: readonly { gate: Gate; round: number; status: string; feedback: string }[],
): string {
  const gate: Gate | null = status === "plan_returned" ? "action_plan" : status === "submission_returned" ? "submission" : null;
  return gate ? latestReturnNotes(reviews.filter((r) => r.gate === gate)) : "";
}

export const emptyMilestone = (): Milestone => ({ title: "", criterion: "" });

// The plan editor's starting draft: the saved plan, with one empty
// milestone row to fill when it has none.
export function draftFrom(plan: PlanDraft): PlanDraft {
  return { approach: plan.approach, milestones: plan.milestones.length ? plan.milestones : [emptyMilestone()], finishBy: plan.finishBy };
}

// The draft as it is sent: trimmed, with rows left wholly empty dropped
// (the Worker drops them too).
export function draftToPlan(draft: PlanDraft): PlanDraft {
  return {
    approach: draft.approach.trim(),
    milestones: draft.milestones
      .map((m) => ({ title: m.title.trim(), criterion: m.criterion.trim() }))
      .filter((m) => m.title || m.criterion),
    finishBy: draft.finishBy,
  };
}

// Whether the draft says something the saved plan does not.
export function planChanged(draft: PlanDraft, saved: PlanDraft): boolean {
  return JSON.stringify(draftToPlan(draft)) !== JSON.stringify(draftToPlan(saved));
}
