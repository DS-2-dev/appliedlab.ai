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
  detail: 2000,
  driveUrl: 500,
  approach: 2000,
  milestoneTitle: 120,
  milestoneCriterion: 200,
  milestones: 8,
  teammates: 6,
  note: 1000,
  phaseMilestones: 12,
  tags: 10,
  tag: 40,
  feedback: 2000,
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

// Postings: a partner's problem on the notice board (pipeline/machines.ts).
// A draft needs only a title; sending it for review needs enough for a
// member to decide whether to claim it.

export const EFFORTS = ["small", "medium", "large", "multi"] as const;
export type Effort = (typeof EFFORTS)[number];
const isEffort = (value: unknown): value is Effort => EFFORTS.includes(value as Effort);

export type PostingDraft = {
  title: string;
  summary: string;
  details: string;
  // Discipline slugs from the taxonomy.
  disciplines: string[];
  // Free-text slugs.
  tags: string[];
  effort: "" | Effort;
  deliverable: string;
  // YYYY-MM-DD, or "" for none.
  deadline: string;
  // The optional "more detail".
  businessModel: string;
  why: string;
  dependencies: string;
  achieves: string;
  goal: string;
  keyMilestones: string;
  // An https:// link, or "" for none.
  driveUrl: string;
};

function cleanTag(value: unknown): string {
  return str(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.tag)
    .replace(/-+$/, "");
}

// Disciplines not in `allowedDisciplines` (the live taxonomy) are dropped.
export function cleanPosting(value: unknown, allowedDisciplines: readonly string[]): PostingDraft {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const disciplines = Array.isArray(v.disciplines)
    ? [...new Set(v.disciplines.filter((d): d is string => typeof d === "string" && allowedDisciplines.includes(d)))]
    : [];
  const tags = Array.isArray(v.tags) ? [...new Set(v.tags.map(cleanTag).filter(Boolean))].slice(0, LIMITS.tags) : [];
  return {
    title: cleanLine(v.title, LIMITS.title),
    summary: cleanLine(v.summary, LIMITS.summary),
    details: cleanText(v.details, LIMITS.details),
    disciplines,
    tags,
    effort: isEffort(v.effort) ? v.effort : "",
    deliverable: cleanText(v.deliverable, LIMITS.deliverable),
    deadline: cleanDate(v.deadline),
    businessModel: cleanText(v.businessModel, LIMITS.detail),
    why: cleanText(v.why, LIMITS.detail),
    dependencies: cleanText(v.dependencies, LIMITS.detail),
    achieves: cleanText(v.achieves, LIMITS.detail),
    goal: cleanText(v.goal, LIMITS.detail),
    keyMilestones: cleanText(v.keyMilestones, LIMITS.detail),
    driveUrl: cleanLine(v.driveUrl, LIMITS.driveUrl),
  };
}

// Only a web link over https: javascript:, data:, http: and the rest are out.
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:" && /^https:\/\/[^\s]+$/i.test(value);
  } catch {
    return false;
  }
}

export type PostingIssue = "title" | "summary" | "disciplines" | "driveUrl";

// What a posting still needs: a draft only a title; sending it for review a
// title of at least 4 characters, a summary of at least 20 and a discipline.
// A Drive link, when given, must be https either way.
export function postingIssues(draft: PostingDraft, { forSubmit }: { forSubmit: boolean }): PostingIssue[] {
  const link = draft.driveUrl && !isHttpsUrl(draft.driveUrl);
  if (!forSubmit) return [...(draft.title ? [] : ["title" as const]), ...(link ? ["driveUrl" as const] : [])];
  const issues: PostingIssue[] = [];
  if (link) issues.push("driveUrl");
  if (draft.title.length < 4) issues.push("title");
  if (draft.summary.length < 20) issues.push("summary");
  if (!draft.disciplines.length) issues.push("disciplines");
  return issues;
}

// A project's action plan (pipeline/machines.ts): how the team means to
// solve the posting, the milestones that show progress, and a finish date.
export type PlanDraft = {
  approach: string;
  milestones: Milestone[];
  // YYYY-MM-DD, or "" for none.
  finishBy: string;
};

export function cleanPlan(value: unknown): PlanDraft {
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
  return { approach: cleanText(v.approach, LIMITS.approach), milestones, finishBy: cleanDate(v.finishBy) };
}

export type PlanIssue = "approach" | "milestones" | "milestone";

// An action plan needs an approach and at least one milestone, and every
// milestone needs both what it is and how its success is judged.
export function planIssues(draft: PlanDraft): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (!draft.approach) issues.push("approach");
  if (!draft.milestones.length) issues.push("milestones");
  else if (draft.milestones.some((m) => !m.title || !m.criterion)) issues.push("milestone");
  return issues;
}

// The account ids of the other members on a team, at most six.
export function cleanTeammates(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((t): t is string => typeof t === "string" && /^[\w-]{1,64}$/.test(t)))].slice(0, LIMITS.teammates)
    : [];
}

export function cleanClaim(value: unknown): ClaimDraft {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { ...cleanPlan(v), teammates: cleanTeammates(v.teammates) };
}

export type ClaimIssue = PlanIssue;

export const claimIssues = (draft: ClaimDraft): ClaimIssue[] => planIssues(draft);

// A claim still in play: it holds the member's place on the problem, so
// they cannot open a second one there.
export const isActiveClaim = (status: ClaimStatus) => status === "pending" || status === "approved";

// Phase 2: once a partner selects a team for an internship, the team tracks
// implementation milestones, each just what it is and whether it's done.
export type PhaseMilestone = { title: string; done: boolean };

export function cleanPhaseMilestones(value: unknown): PhaseMilestone[] {
  return (Array.isArray(value) ? value : [])
    .map((m) => {
      const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
      return { title: cleanLine(o.title, LIMITS.milestoneTitle), done: o.done === true };
    })
    .filter((m) => m.title)
    .slice(0, LIMITS.phaseMilestones);
}
