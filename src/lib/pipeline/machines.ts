// The pipeline, declared once. Every status, whose court it sits in, and every
// move between statuses. The server executes these (transition.ts); the UI
// reads them for labels, colors, buttons and hand-off dialogs. Pure data, safe
// for client bundles.

import type { Court, PostingStatus, ProjectStatus, Role } from "./domain";

export type Tone = "neutral" | "gray" | "amber" | "blue" | "violet" | "green" | "teal" | "red" | "orange" | "ink";

export type StateDef = {
  label: string;
  tone: Tone;
  court: Court;
  /** One line for tooltips: what this status means. */
  hint: string;
};

export type TransitionDef<S extends string> = {
  label: string;
  from: readonly S[];
  to: S;
  by: readonly Role[];
  /** Whose court the ball moves to. Present when it leaves the actor's court. */
  handsTo?: Court;
  /** Review transitions take written feedback. */
  feedback?: "required" | "optional";
  /** Visual weight of the button. */
  intent?: "primary" | "danger" | "default";
  hotkey?: string;
  /** Goes back to the status the entity left (projects.withdrawn_from), `to` when none is kept. */
  restore?: boolean;
  event: string;
};

export type Machine<S extends string> = {
  entity: "posting" | "project";
  states: Record<S, StateDef>;
  transitions: Record<string, TransitionDef<S>>;
};

function machine<S extends string, T extends Record<string, TransitionDef<S>>>(m: {
  entity: Machine<S>["entity"];
  states: Record<S, StateDef>;
  transitions: T;
}) {
  return m;
}

// ---------------------------------------------------------------- postings

export const postingMachine = machine<PostingStatus, Record<string, TransitionDef<PostingStatus>>>({
  entity: "posting",
  states: {
    draft: { label: "Draft", tone: "gray", court: "partner", hint: "Only your organization can see it." },
    in_review: { label: "In review", tone: "amber", court: "rep", hint: "A representative is reviewing it before it goes on the board." },
    returned: { label: "Returned", tone: "red", court: "partner", hint: "A representative sent it back with notes." },
    live: { label: "Live", tone: "blue", court: "none", hint: "On the notice board. Any member can claim it." },
    paused: { label: "Paused", tone: "gray", court: "partner", hint: "Hidden from the board. Work already under way continues." },
    closed: { label: "Closed", tone: "ink", court: "none", hint: "No new claims. Work already under way continues." },
    archived: { label: "Archived", tone: "neutral", court: "none", hint: "Kept for the record." },
  },
  transitions: {
    submit: {
      label: "Send for review",
      from: ["draft", "returned"],
      to: "in_review",
      // Deviation from Gantry: "admin" so an admin can send a Lab posting for
      // review. transition()'s own-work rule still stops them approving it.
      by: ["partner", "admin"],
      handsTo: "rep",
      intent: "primary",
      event: "posting.submitted",
    },
    withdraw: {
      label: "Withdraw to edit",
      from: ["in_review"],
      to: "draft",
      by: ["partner", "admin"],
      event: "posting.withdrawn",
    },
    approve: {
      label: "Publish to board",
      from: ["in_review"],
      to: "live",
      by: ["rep", "admin"],
      handsTo: "none",
      feedback: "optional",
      intent: "primary",
      hotkey: "a",
      event: "posting.published",
    },
    return: {
      label: "Return with notes",
      from: ["in_review"],
      to: "returned",
      by: ["rep", "admin"],
      handsTo: "partner",
      feedback: "required",
      hotkey: "r",
      event: "posting.returned",
    },
    pause: { label: "Pause", from: ["live"], to: "paused", by: ["partner", "admin"], event: "posting.paused" },
    resume: { label: "Put back on board", from: ["paused"], to: "live", by: ["partner", "admin"], event: "posting.resumed" },
    close: {
      label: "Close to new claims",
      from: ["live", "paused"],
      to: "closed",
      by: ["partner", "admin"],
      intent: "danger",
      event: "posting.closed",
    },
    reopen: { label: "Reopen", from: ["closed"], to: "live", by: ["partner", "admin"], event: "posting.reopened" },
    archive: { label: "Archive", from: ["draft", "closed", "returned"], to: "archived", by: ["partner", "admin"], event: "posting.archived" },
  },
});

// ---------------------------------------------------------------- projects

export const projectMachine = machine<ProjectStatus, Record<string, TransitionDef<ProjectStatus>>>({
  entity: "project",
  states: {
    claimed: { label: "Claimed", tone: "violet", court: "member", hint: "Claimed. Writing the action plan and milestones." },
    plan_review: { label: "Plan in review", tone: "amber", court: "rep", hint: "The action plan is with a representative." },
    plan_returned: { label: "Plan returned", tone: "red", court: "member", hint: "The action plan came back with notes." },
    active: { label: "Active", tone: "green", court: "member", hint: "Plan approved. Working the milestones." },
    submission_review: { label: "Submission in review", tone: "amber", court: "rep", hint: "The final submission is with a representative." },
    submission_returned: { label: "Submission returned", tone: "red", court: "member", hint: "The submission came back with notes." },
    delivered: { label: "Delivered", tone: "teal", court: "partner", hint: "Approved and delivered to the partner. Follow-up is at their discretion." },
    integrated: { label: "Integrated", tone: "orange", court: "member", hint: "Phase 2. The member is implementing inside the partner organization." },
    completion_review: { label: "Completion sign-off", tone: "amber", court: "partner", hint: "Waiting for the partner to confirm the implementation is done." },
    complete: { label: "Complete", tone: "ink", court: "none", hint: "Implemented and signed off." },
    withdrawn: { label: "Withdrawn", tone: "neutral", court: "none", hint: "The member released the claim. History is kept." },
  },
  transitions: {
    submitPlan: {
      label: "Submit action plan",
      from: ["claimed", "plan_returned"],
      to: "plan_review",
      // Deviation from Gantry: "admin" so admins can do everything; the
      // engine still applies the own-work rule to gates.
      by: ["member", "admin"],
      handsTo: "rep",
      intent: "primary",
      event: "project.plan_submitted",
    },
    approvePlan: {
      label: "Approve plan",
      from: ["plan_review"],
      to: "active",
      by: ["rep", "admin"],
      handsTo: "member",
      feedback: "optional",
      intent: "primary",
      hotkey: "a",
      event: "project.plan_approved",
    },
    returnPlan: {
      label: "Return with notes",
      from: ["plan_review"],
      to: "plan_returned",
      by: ["rep", "admin"],
      handsTo: "member",
      feedback: "required",
      hotkey: "r",
      event: "project.plan_returned",
    },
    submitWork: {
      label: "Submit project",
      from: ["active", "submission_returned"],
      to: "submission_review",
      // Deviation from Gantry: "admin" so admins can do everything; the
      // engine still applies the own-work rule to gates.
      by: ["member", "admin"],
      handsTo: "rep",
      intent: "primary",
      event: "project.work_submitted",
    },
    approveWork: {
      label: "Approve & deliver",
      from: ["submission_review"],
      to: "delivered",
      by: ["rep", "admin"],
      handsTo: "partner",
      feedback: "optional",
      intent: "primary",
      hotkey: "a",
      event: "project.work_approved",
    },
    returnWork: {
      label: "Return with notes",
      from: ["submission_review"],
      to: "submission_returned",
      by: ["rep", "admin"],
      handsTo: "member",
      feedback: "required",
      hotkey: "r",
      event: "project.work_returned",
    },
    integrate: {
      label: "Bring on to implement",
      from: ["delivered"],
      to: "integrated",
      // Deviation from Gantry: "admin" so admins can do everything; the
      // engine still applies the own-work rule to gates.
      by: ["partner", "admin"],
      handsTo: "member",
      intent: "primary",
      event: "project.integrated",
    },
    requestCompletion: {
      label: "Request completion sign-off",
      from: ["integrated"],
      to: "completion_review",
      // Deviation from Gantry: "partner" and "admin" so the partner (or an
      // admin) can sign off in one request (POST /projects/:id/complete)
      // and admins can do everything. The engine still org-checks partners.
      by: ["member", "partner", "admin"],
      handsTo: "partner",
      intent: "primary",
      event: "project.completion_requested",
    },
    confirmCompletion: {
      label: "Confirm complete",
      from: ["completion_review"],
      to: "complete",
      by: ["partner", "admin"],
      handsTo: "none",
      feedback: "optional",
      intent: "primary",
      event: "project.completed",
    },
    returnCompletion: {
      label: "Not yet",
      from: ["completion_review"],
      to: "integrated",
      by: ["partner", "admin"],
      handsTo: "member",
      feedback: "required",
      event: "project.completion_returned",
    },
    withdraw: {
      label: "Release claim",
      from: ["claimed", "plan_returned", "active", "submission_returned"],
      to: "withdrawn",
      by: ["member", "admin"],
      handsTo: "none",
      feedback: "required",
      intent: "danger",
      event: "project.withdrawn",
    },
    reopen: {
      label: "Reopen",
      from: ["withdrawn"],
      to: "claimed",
      by: ["admin"],
      restore: true,
      event: "project.reopened",
    },
  },
});

export const MACHINES = {
  posting: postingMachine,
  project: projectMachine,
} as const;

export type EntityKind = keyof typeof MACHINES;

export function stateOf(kind: EntityKind, status: string): StateDef {
  const states = MACHINES[kind].states as Record<string, StateDef>;
  return states[status] ?? { label: status, tone: "neutral", court: "none", hint: "" };
}

/** Transitions out of a status. With roles, only those any of the viewer's roles may take. */
export function transitionsFrom(kind: EntityKind, status: string, roles?: readonly Role[]) {
  const all = MACHINES[kind].transitions as Record<string, TransitionDef<string>>;
  return Object.entries(all)
    .filter(([, t]) => t.from.includes(status) && (!roles || t.by.some((r) => roles.includes(r))))
    .map(([name, t]) => ({ name, ...t }));
}

/** Statuses in pipeline order, for progress bars and grouping. */
export const PROJECT_FLOW: ProjectStatus[] = [
  "claimed",
  "plan_review",
  "active",
  "submission_review",
  "delivered",
  "integrated",
  "complete",
];

/** Collapse a project status onto the flow (returned states sit with their stage). */
export function projectStage(status: ProjectStatus): ProjectStatus {
  if (status === "plan_returned") return "plan_review";
  if (status === "submission_returned") return "submission_review";
  if (status === "completion_review") return "integrated";
  return status;
}

/**
 * The stage bar for a status: its segments, which one is current (null for
 * a status off the flow, withdrawn say, which shows every segment muted) and
 * whether the work came back. A self-directed project skips the partner's
 * stages; a status on one of those sits on the last segment.
 */
export function stageBarState(status: string, self = false): { flow: ProjectStatus[]; current: number | null; returned: boolean } {
  const flow = self ? PROJECT_FLOW.filter((s) => s !== "delivered" && s !== "integrated") : PROJECT_FLOW;
  const known = (MACHINES.project.states as Record<string, StateDef>)[status] !== undefined;
  const stage = known ? projectStage(status as ProjectStatus) : null;
  const at = stage ? flow.indexOf(stage) : -1;
  const current = at !== -1 ? at : stage && PROJECT_FLOW.includes(stage) ? flow.length - 1 : null;
  return { flow, current, returned: status === "plan_returned" || status === "submission_returned" };
}

export const OPEN_PROJECT_STATUSES: ProjectStatus[] = [
  "claimed",
  "plan_review",
  "plan_returned",
  "active",
  "submission_review",
  "submission_returned",
  "integrated",
  "completion_review",
];

/**
 * Where the work sits on the project board for a project status, or null to
 * leave the board's stage as it is.
 */
export function boardStageFor(status: ProjectStatus): "solidifying" | "prototype" | "live" | null {
  switch (status) {
    case "claimed":
    case "plan_review":
    case "plan_returned":
      return "solidifying";
    case "submission_returned":
      return "prototype";
    case "submission_review":
    case "delivered":
    case "integrated":
    case "completion_review":
    case "complete":
      return "live";
    default:
      return null; // active, withdrawn
  }
}
