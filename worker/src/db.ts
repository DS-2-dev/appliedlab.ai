// Row types for the pipeline tables (migration 0010) and the small helpers
// every module that writes them shares.

import type { PostingStatus, ProjectStatus } from "@/lib/pipeline/domain";

export const now = (): string => new Date().toISOString();

export const uuid = (): string => crypto.randomUUID();

// Parses JSON text from a column, or returns the fallback when it is empty or
// not valid JSON.
export function json<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// "?, ?, ?" for an IN list of n values.
export function marks(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

export interface PostingRow {
  id: string;
  org_id: string | null;
  author_id: string;
  title: string;
  summary: string;
  details: string;
  // JSON arrays of strings.
  disciplines: string;
  tags: string;
  effort: "" | "small" | "medium" | "large" | "multi";
  deliverable: string;
  deadline: string;
  status: PostingStatus;
  kind: "partner" | "self";
  sealed: number;
  show_on_profile: number;
  submitted_at: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  posting_id: string;
  lead_id: string;
  status: ProjectStatus;
  phase: "parallel" | "integrated";
  // JSON: { approach, milestones, finishBy }.
  plan: string;
  ai_disclosure: string;
  planned_terms: number;
  claimed_at: string;
  plan_submitted_at: string | null;
  activated_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  integrated_at: string | null;
  completed_at: string | null;
  withdrawn_at: string | null;
  updated_at: string;
}
