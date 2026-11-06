"use client";

// The pipeline's data from the Worker: postings, projects, reviews,
// organizations and the taxonomy. Each path is fetched once and shared by
// every component that reads it. After a change, refresh() reloads every
// path loaded so far, and the shell's counts (shell-store.ts) are asked for
// again, so lists, badges and the bell agree.
//
// The types mirror the Worker's output field for field: postingOut
// (worker/src/postings.ts), projectOut (projects.ts), the review queue and
// page (reviews.ts), the organization page (orgs.ts) and GET /taxonomy.

import * as React from "react";
import { ACCOUNT_URL } from "@/lib/site";
import { ApiError, api, sessionToken } from "@/lib/account";
import type { Project } from "@/lib/projects";
import type { PostingStatus, ProjectStatus } from "@/lib/pipeline/domain";
import type { ClaimStatus, Field, Milestone, PhaseMilestone, PlanDraft, PostingDraft, ProblemStatus } from "@/lib/problems";
import { reloadProjects } from "@/components/projectum/project-store";
import { pollShell } from "@/components/projectum/shell-store";

export type Person = { id: string; name: string };

// One round at a gate (ReviewOut in worker/src/reviews.ts).
export type Review = {
  id: string;
  gate: "posting" | "action_plan" | "submission" | "completion";
  subjectId: string;
  round: number;
  status: "open" | "approved" | "returned" | "withdrawn";
  assignedTo: Person | null;
  decidedBy: Person | null;
  decidedAt: string | null;
  feedback: string;
  score: number | null;
  openedAt: string;
};

// GET /postings?scope=board|mine|all, GET /postings/:id.
export type Posting = PostingDraft & {
  id: string;
  orgId: string | null;
  org: { id: string; name: string; slug: string } | null;
  author: Person;
  status: PostingStatus;
  kind: "partner" | "self";
  sealed: boolean;
  showOnProfile: boolean;
  submittedAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  // Projects still working toward a submission, and delivered ones.
  counts: { open: number; delivered: number };
  // The viewer's own project on it, the newest.
  myProject: { id: string; status: ProjectStatus; boardId: string | null } | null;
  // The transition names the viewer may take now.
  transitions: string[];
  // A NEXT_STEPS key (src/lib/pipeline/handoffs.ts), or null.
  nextSteps: string | null;
  reviews: Review[];
};

// GET /projects/mine, /projects?posting=, /projects/:id. A colleague gets
// the outline: an empty plan, no board, no transitions and no reviews.
export type PipelineProject = {
  id: string;
  postingId: string;
  posting: { id: string; title: string; kind: "partner" | "self"; org: { id: string; name: string } | null };
  status: ProjectStatus;
  phase: "parallel" | "integrated";
  plan: PlanDraft;
  lead: Person;
  team: Person[];
  boardId: string | null;
  plannedTerms: number;
  claimedAt: string;
  activatedAt: string | null;
  submittedAt: string | null;
  deliveredAt: string | null;
  transitions: string[];
  nextSteps: string | null;
  reviews: Review[];
  view: "full" | "partner" | "colleague";
};

// GET /reviews: an open review and what it is about. Ids starting "sub:"
// stand for pending submissions from before submissions had reviews.
export type ReviewRow = Review & {
  title: string;
  who: string;
  posting: { id: string; title: string };
  project: { id: string; status: string; lead: Person; team: Person[] } | null;
  waitingSince: string;
  href: string;
};

// GET /reviews/:id: the review, every round, its subject now, what was sent
// for review (frozen), and the project's board.
export type ReviewDetail = {
  review: Review;
  history: Review[];
  subject: Posting | PipelineProject;
  snapshot: unknown;
  board: Project | null;
};

// GET /orgs/mine, GET /orgs/:id (staff).
export type Org = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  domain: string;
  industry: string;
  location: string;
  website: string;
  description: string;
  isPublic: boolean;
  showcaseConsentDefault: boolean;
  primaryUserId: string | null;
};
export type OrgPerson = { id: string; name: string; email: string; primary: boolean };
export type OrgRequest = { id: string; user: { id: string; name: string; email: string }; message: string; createdAt: string };
// Requests are filled only for the primary and staff.
export type OrgPage = { org: Org; people: OrgPerson[]; requests: OrgRequest[] };

// GET /taxonomy.
export type TaxonomyItem = { slug: string; name: string };
export type Taxonomy = { disciplines: TaxonomyItem[]; tags: TaxonomyItem[] };

// A team's latest submission. Partners only ever get accepted ones.
export type Submission = {
  id: string;
  status: "pending" | "accepted" | "returned";
  reviewNote: string;
  reportName: string;
  reportSize: number;
  createdAt: string;
};

// Once the partner brings the team on: its message and phase 2's milestones.
export type Selection = {
  message: string;
  milestones: PhaseMilestone[];
  completedAt: string | null;
  createdAt: string;
};

// A partner's request to meet a team (worker/src/phase2.ts). "arranged" is
// the older name for "scheduled".
export type Meeting = { id: string; status: "requested" | "scheduled" | "arranged"; message: string; createdAt: string };

// --- Deprecated: the older problem and claim shapes. The Worker no longer
// serves them; the overview's problems list and PlanView still read these.

/** @deprecated use Posting */
export type Problem = {
  id: string;
  title: string;
  summary: string;
  details: string;
  fields: Field[];
  deliverable: string;
  deadline: string;
  status: ProblemStatus;
  origin: "partner" | "member";
  createdAt: string;
  owner: Person;
  counts: { approved: number; pending: number };
  myClaim?: ClaimStatus | null;
};

/** @deprecated use PipelineProject */
export type Claim = {
  id: string;
  problemId: string;
  ownerId: string;
  status: ClaimStatus;
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
  plan: { approach: string; milestones: Milestone[]; finishBy: string };
  projectId: string | null;
  team: Person[];
};


type Entry = { data?: unknown; error?: boolean; loading?: Promise<void> };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l());
}

function load(path: string) {
  const entry = cache.get(path) ?? {};
  if (entry.loading) return;
  entry.loading = api(path)
    .then((data) => {
      cache.set(path, { data });
    })
    .catch(() => {
      cache.set(path, { data: entry.data, error: true });
    })
    .finally(notify);
  cache.set(path, entry);
}

export function refresh() {
  for (const path of cache.keys()) {
    const entry = cache.get(path)!;
    entry.loading = undefined;
    load(path);
  }
}

// Forgets everything, on sign-out, so the next account starts clean.
export function clearPipeline() {
  cache.clear();
  notify();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

// The data at a Worker path: undefined while it loads, and `error` when the
// last load failed.
export function useApi<T>(path: string | null): { data: T | undefined; error: boolean; retry: () => void } {
  React.useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  React.useEffect(() => {
    if (path && !cache.has(path)) load(path);
  }, [path]);
  const entry = path ? cache.get(path) : undefined;
  const retry = React.useCallback(() => {
    if (!path) return;
    cache.delete(path);
    load(path);
  }, [path]);
  return { data: entry?.data as T | undefined, error: Boolean(entry?.error), retry };
}

// A change on the Worker, then everything that may show it loads again: the
// paths read so far, the boards and the shell's counts.
export async function send<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  refresh();
  // A claim opens a board, and a status change moves one.
  reloadProjects();
  void pollShell();
  return res;
}

// Submits a board: the board moved to its last stage, and the final report.
// Sent as a form, since it carries a file.
export async function submitWork(board: Project, report: File): Promise<void> {
  const body = new FormData();
  body.set("project", JSON.stringify(board));
  body.set("report", report);
  await api(`/boards/${encodeURIComponent(board.id)}/submissions`, { method: "POST", body });
  refresh();
  reloadProjects();
  void pollShell();
}

// Downloads a submission's report as the signed-in person, then hands the
// file to the browser under its own name.
export async function downloadReport(submission: Pick<Submission, "id" | "reportName">): Promise<void> {
  const token = sessionToken();
  let res: Response;
  try {
    res = await fetch(`${ACCOUNT_URL}/submissions/${encodeURIComponent(submission.id)}/report`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (!res.ok) throw new ApiError(res.status, "report");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = submission.reportName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
