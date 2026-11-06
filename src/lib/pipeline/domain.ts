// Shared vocabulary for the pipeline. Pure data, safe for the site and the Worker.
//
// Posting  - a problem a partner puts on the notice board.
// Project  - one member's (or team's) work on a posting.
// Court    - whose move it is. Every stateful thing has exactly one court.

export const ROLES = ["member", "partner", "rep", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  partner: "Partner",
  rep: "Representative",
  admin: "Admin",
};

export const LEVELS = ["affiliate", "sponsored", "builder"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_INFO: Record<Level, { n: 1 | 2 | 3; label: string; blurb: string; earned: string }> = {
  affiliate: {
    n: 1,
    label: "Affiliate",
    blurb: "Registered with the Lab. Comes to meetings and events.",
    earned: "Everyone starts here.",
  },
  sponsored: {
    n: 2,
    label: "Sponsored",
    blurb: "Working an approved project with a Lab-funded AI account.",
    earned: "Earned when a representative approves your action plan.",
  },
  builder: {
    n: 3,
    label: "Builder",
    blurb: "Implementing their project inside a partner organization.",
    earned: "Earned when a partner brings you on to implement your work.",
  },
};

export type Court = "member" | "partner" | "rep" | "admin" | "none";

export const POSTING_STATUSES = ["draft", "in_review", "returned", "live", "paused", "closed", "archived"] as const;
export type PostingStatus = (typeof POSTING_STATUSES)[number];

export const PROJECT_STATUSES = [
  "claimed",
  "plan_review",
  "plan_returned",
  "active",
  "submission_review",
  "submission_returned",
  "delivered",
  "integrated",
  "completion_review",
  "complete",
  "withdrawn",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
