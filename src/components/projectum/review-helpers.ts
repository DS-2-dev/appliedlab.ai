// Small pure rules the reviews queue and the review page share: each gate's
// label and its two decisions, the queue's rows, j/k/Enter on the queue, what
// was sent for review, and whether the viewer may decide. Pure, so
// scripts/reviews-ui.test.mjs runs them.

import { copy } from "@/content/copy";
import { cleanPlan, cleanPosting, type PlanDraft, type PostingDraft } from "@/lib/problems";

export type Gate = "posting" | "action_plan" | "submission" | "completion";
type Person = { id: string; name: string };

const R = copy.projectum.pipeline.reviews;
const D = copy.projectum.pipeline.review.decision;
const PD = copy.projectum.pipeline.posting.decision;

// "sub:<id>" stands for a pending submission from before submissions had
// reviews of their own (worker/src/reviews.ts). It cannot be taken.
export const LEGACY = "sub:";
export const isLegacy = (id: string) => id.startsWith(LEGACY);

export const reviewHref = (id: string) => `/projectum?view=review&id=${encodeURIComponent(id)}`;

export function gateLabel(gate: Gate): string {
  return R.gates[gate] ?? gate;
}

// The entity each gate decides on, and the two moves that decide it
// (machines.ts). Completion is the partner's sign-off, not a rep's review.
export const GATE_MOVES: Record<Exclude<Gate, "completion">, { kind: "posting" | "project"; moves: [string, string] }> = {
  posting: { kind: "posting", moves: ["approve", "return"] },
  action_plan: { kind: "project", moves: ["approvePlan", "returnPlan"] },
  submission: { kind: "project", moves: ["approveWork", "returnWork"] },
};

// How a round ended, in the gate's words: an approved posting is published.
export function decisionLabel(gate: Gate, status: "open" | "approved" | "returned" | "withdrawn"): string {
  return gate === "posting" ? PD[status] : D[status];
}

type QueueEntry = {
  id: string;
  gate: Gate;
  title: string;
  who: string;
  waitingSince: string;
  assignedTo: Person | null;
};

export type QueueRow = {
  id: string;
  href: string;
  gate: string;
  title: string;
  who: string;
  waitingSince: string;
  assignee: string;
  canTake: boolean;
};

// One row per open review, in the Worker's order (oldest first).
export function queueRows(entries: readonly QueueEntry[], meId: string): QueueRow[] {
  return entries.map((e) => ({
    id: e.id,
    href: reviewHref(e.id),
    gate: gateLabel(e.gate),
    title: e.title,
    who: e.who,
    waitingSince: e.waitingSince,
    assignee: !e.assignedTo ? R.unassigned : e.assignedTo.id === meId ? R.you : e.assignedTo.name,
    canTake: !e.assignedTo && !isLegacy(e.id),
  }));
}

// What a key does on the queue: j and k move the selection (from none, j
// picks the first), Enter opens the selected row. Anything else, nothing.
export function queueKey(key: string, index: number, length: number): { move: number } | { open: number } | null {
  if (length === 0) return null;
  if (key === "j") return { move: Math.min(index + 1, length - 1) };
  if (key === "k") return { move: Math.max(index - 1, 0) };
  if (key === "Enter" && index >= 0 && index < length) return { open: index };
  return null;
}

// Keys typed into a field are the field's, not the queue's.
export function isTyping(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  return target.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "");
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((d): d is string => typeof d === "string") : []);

// The posting as it was sent for review.
export function postingSnapshot(snapshot: unknown): PostingDraft {
  const disciplines = strings((snapshot as { disciplines?: unknown } | null)?.disciplines);
  return cleanPosting(snapshot, disciplines);
}

// The action plan as it was sent for review.
export function planSnapshot(snapshot: unknown): PlanDraft {
  return cleanPlan(snapshot);
}

// The report a submission was sent with.
export function reportSnapshot(snapshot: unknown): { reportName: string; reportSize: number; createdAt: string } {
  const s = (snapshot && typeof snapshot === "object" ? snapshot : {}) as Record<string, unknown>;
  return {
    reportName: typeof s.reportName === "string" ? s.reportName : "",
    reportSize: typeof s.reportSize === "number" ? s.reportSize : 0,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : "",
  };
}

// What the review page offers on the decision: nothing once the round is
// closed, the own-work refusal for someone whose work it is (the Worker
// refuses them too), otherwise the gate's two moves.
export function decisionMode(input: {
  reviewStatus: string;
  gate: Gate;
  me: { id: string; orgId: string | null };
  subject: { team?: readonly Person[]; orgId?: string | null; author?: Person };
}): "closed" | "own" | "decide" {
  if (input.reviewStatus !== "open" || input.gate === "completion") return "closed";
  const s = input.subject;
  const own =
    input.gate === "posting"
      ? Boolean((s.orgId && s.orgId === input.me.orgId) || s.author?.id === input.me.id)
      : Boolean(s.team?.some((p) => p.id === input.me.id));
  return own ? "own" : "decide";
}
