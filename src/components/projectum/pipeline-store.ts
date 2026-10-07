"use client";

// The pipeline's data from the Worker (worker/src/pipeline.ts), for the
// Notice Board, a problem, My Claims, My Problems and Approvals. Each path is
// fetched once and shared by every component that reads it. After a change,
// refresh() reloads every path loaded so far, so lists and counts agree.

import * as React from "react";
import { ACCOUNT_URL } from "@/lib/site";
import { ApiError, api, sessionToken } from "@/lib/account";
import type { Project } from "@/lib/projects";
import { reloadProjects } from "@/components/projectum/project-store";
import type { ClaimStatus, Field, Milestone, ProblemStatus } from "@/lib/problems";

export type Person = { id: string; name: string };

export type Problem = {
  id: string;
  title: string;
  summary: string;
  details: string;
  fields: Field[];
  deliverable: string;
  deadline: string;
  status: ProblemStatus;
  // Posted by a partner, or proposed by a member as their own project.
  origin: "partner" | "member";
  createdAt: string;
  owner: Person;
  counts: { approved: number; pending: number };
  myClaim?: ClaimStatus | null;
};

export type Claim = {
  id: string;
  problemId: string;
  ownerId: string;
  status: ClaimStatus;
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
  plan: { approach: string; milestones: Milestone[]; finishBy: string };
  // The board an approved claim opened, or null.
  projectId: string | null;
  team: Person[];
};

// A team's latest submission. Partners only ever get accepted ones.
export type Submission = {
  id: string;
  status: "pending" | "accepted" | "returned";
  reviewNote: string;
  reportName: string;
  reportSize: number;
  createdAt: string;
};

export type ClaimWithSubmission = Claim & { submission?: Submission | null };
export type MyClaim = ClaimWithSubmission & { problem: { id: string; title: string; owner: string } | null };
export type QueueClaim = Claim & { problem: Problem | null };
export type QueueSubmission = Submission & { problem: Problem | null; project: Project | null };
export type PendingPartner = { id: string; email: string; name: string; createdAt: string };

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

export async function send<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  refresh();
  // An approval opens a board, and a withdrawal closes one.
  reloadProjects();
  return res;
}

// Submits a board: the board moved to its last stage, and the final report.
// Sent as a form, since it carries a file.
export async function submitWork(project: Project, report: File): Promise<void> {
  const body = new FormData();
  body.set("project", JSON.stringify(project));
  body.set("report", report);
  await api(`/projects/${encodeURIComponent(project.id)}/submissions`, { method: "POST", body });
  refresh();
  reloadProjects();
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
