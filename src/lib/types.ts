// Data model. Timestamps are ISO strings (timestamptz in Supabase), always
// displayed in America/Denver.
//
// 2026-08-17: the RSVP layer is gone (Kylar: everything is show-up, no
// sign-ups). Events gained `room_confirmed` so the site can show the room we
// expect while flagging it until an officer confirms the booking.

export type EventType = "meeting" | "social" | "showcase" | "other";

export interface LabEvent {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  // False renders the room with a "to be confirmed" note. Officers flip it
  // in admin once the booking is certain.
  room_confirmed: boolean;
  location_note: string | null;
  description: string | null;
  created_at: string;
}

export type InquiryStatus = "new" | "contacted" | "archived";

// Which door the inquiry came through. One table, one API, different form
// shapes on the front end, because the asks (casework, live project, faculty
// review) need different questions but the same follow-up workflow.
// `casework` is the default so existing rows stay valid.
export type InquiryKind = "casework" | "project" | "representative";

export const INQUIRY_KINDS: InquiryKind[] = ["casework", "project", "representative"];

export const INQUIRY_KIND_LABELS: Record<InquiryKind, string> = {
  casework: "Casework offer",
  project: "Live project interest",
  representative: "Faculty Representative",
};

export interface PartnerInquiry {
  id: string;
  kind: InquiryKind;
  org_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  problem: string;
  anything_else: string | null;
  how_heard: string | null;
  status: InquiryStatus;
  notes_internal: string | null;
  created_at: string;
  updated_at: string;
}

// Showcase entries are data, not code, so publishing December's member work
// is an admin action (succession rule: content changes never require a code
// change). Field names match the Postgres columns; "by"/"when" are reserved
// words in SQL, hence by_line and when_label.
export type ShowcaseKind = "founder" | "casework" | "project";

export const SHOWCASE_KINDS: ShowcaseKind[] = ["founder", "casework", "project"];

export const SHOWCASE_KIND_LABELS: Record<ShowcaseKind, string> = {
  founder: "Founder work",
  casework: "Member casework",
  project: "Live project",
};

export interface ShowcaseEntry {
  id: string;
  kind: ShowcaseKind;
  title: string;
  /** One line: what the tool does. Not what it is built with. */
  does: string;
  by_line: string;
  affiliation: string | null;
  /** The organization the work was for. Null when it cannot be named. */
  partner: string | null;
  when_label: string;
  /** Both set, or both null. Null means not faculty rated. */
  rating_average: number | null;
  rating_count: number | null;
  /** Still in use, or not. The bar for Lab work is that it runs. */
  running: boolean;
  /** Before/after, where one is real and known. All three set, or none. */
  metric_label: string | null;
  metric_before: string | null;
  metric_after: string | null;
  /** Paragraphs. Edited in admin as text with blank lines between. */
  story: string[];
  /** Stated limits. Required on every entry. */
  limits: string;
  /** Drafts stay invisible to the public site. */
  published: boolean;
  /** Lower renders first. */
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Student capture (2026-08-19): membership is still showing up; the signup
// keeps a student in the loop (kickoff reminder, each week's room). One row
// per email.
export interface StudentSignup {
  id: string;
  name: string;
  email: string;
  major: string | null;
  created_at: string;
}

export type Role = "officer" | "member" | "partner";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: "active" | "removed";
  created_at: string;
}

export interface Settings {
  tagline: string;
  meeting_line: string;
  meeting_schedule: string;
  followup_days: number;
  offseason_line: string;
  chat_invite_url: string;
}

export const DEFAULT_SETTINGS: Settings = {
  tagline: "",
  meeting_schedule: "Thursdays, 1:30 pm",
  meeting_line: "",
  followup_days: 5,
  offseason_line:
    "Meetings are done for the semester. Email ailab@weber.edu and we'll point you at the next one.",
  chat_invite_url: "",
};
