// Problems and claims, the Lab's pipeline (the GSBE board deck): a partner
// organization posts a problem, members claim it with an action plan, and
// the approver (a rep, or the Lab's approver) approves or denies the claim.
// Pure functions over plain data, shared by the forms and the Worker, so
// the rules are checked in both places and tested without either.

export const FIELDS = [
  "finance",
  "accounting",
  "business",
  "computer-science",
  "design",
  "mathematics",
  "marketing",
  "other",
] as const;
export type Field = (typeof FIELDS)[number];
export const isField = (value: unknown): value is Field => FIELDS.includes(value as Field);

export const PROBLEM_STATUSES = ["open", "closed"] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

export const CLAIM_STATUSES = ["pending", "approved", "denied", "withdrawn"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const LIMITS = {
  title: 100,
  summary: 280,
  details: 4000,
  deliverable: 500,
  approach: 2000,
  milestoneTitle: 120,
  milestoneCriterion: 200,
  milestones: 8,
  teammates: 6,
  note: 1000,
} as const;

export type ProblemDraft = {
  title: string;
  summary: string;
  details: string;
  fields: Field[];
  deliverable: string;
  // YYYY-MM-DD, or "" for none.
  deadline: string;
};

export type Milestone = { title: string; criterion: string };

export type ClaimDraft = {
  approach: string;
  milestones: Milestone[];
  // YYYY-MM-DD, or "" for none.
  finishBy: string;
  // Account ids of the other members on the team.
  teammates: string[];
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function cleanLine(text: unknown, max: number): string {
  return str(text).replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanText(text: unknown, max: number): string {
  return str(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

// A calendar date, YYYY-MM-DD, that exists. Anything else is no date.
export function cleanDate(value: unknown): string {
  const text = str(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
}

export function cleanProblem(value: unknown): ProblemDraft {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const fields = Array.isArray(v.fields) ? [...new Set(v.fields.filter(isField))] : [];
  return {
    title: cleanLine(v.title, LIMITS.title),
    summary: cleanLine(v.summary, LIMITS.summary),
    details: cleanText(v.details, LIMITS.details),
    fields,
    deliverable: cleanText(v.deliverable, LIMITS.deliverable),
    deadline: cleanDate(v.deadline),
  };
}

export type ProblemIssue = "title" | "summary" | "fields";

// What a problem still needs before it can be posted. Details, the
// deliverable and a deadline help, but a title, a one-line summary and at
// least one field are enough to start.
export function problemIssues(draft: ProblemDraft): ProblemIssue[] {
  const issues: ProblemIssue[] = [];
  if (!draft.title) issues.push("title");
  if (!draft.summary) issues.push("summary");
  if (!draft.fields.length) issues.push("fields");
  return issues;
}

export function cleanClaim(value: unknown): ClaimDraft {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const milestones = (Array.isArray(v.milestones) ? v.milestones : [])
    .map((m) => {
      const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
      return {
        title: cleanLine(o.title, LIMITS.milestoneTitle),
        criterion: cleanLine(o.criterion, LIMITS.milestoneCriterion),
      };
    })
    .filter((m) => m.title || m.criterion)
    .slice(0, LIMITS.milestones);
  const teammates = Array.isArray(v.teammates)
    ? [...new Set(v.teammates.filter((t): t is string => typeof t === "string" && /^[\w-]{1,64}$/.test(t)))].slice(
        0,
        LIMITS.teammates,
      )
    : [];
  return {
    approach: cleanText(v.approach, LIMITS.approach),
    milestones,
    finishBy: cleanDate(v.finishBy),
    teammates,
  };
}

export type ClaimIssue = "approach" | "milestones" | "milestone";

// An action plan needs an approach and at least one milestone, and every
// milestone needs both what it is and how its success is judged.
export function claimIssues(draft: ClaimDraft): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  if (!draft.approach) issues.push("approach");
  if (!draft.milestones.length) issues.push("milestones");
  else if (draft.milestones.some((m) => !m.title || !m.criterion)) issues.push("milestone");
  return issues;
}

// A claim still in play: it holds the member's place on the problem, so
// they cannot open a second one there.
export const isActiveClaim = (status: ClaimStatus) => status === "pending" || status === "approved";
