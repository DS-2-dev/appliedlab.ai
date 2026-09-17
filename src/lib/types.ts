// Data model. Timestamps are ISO strings (timestamptz in Supabase), always
// displayed in America/Denver.
//
// Events carry `room_confirmed` so the schedule can name the room we expect
// while flagging it until the booking is certain.

export type EventType = "meeting" | "social" | "showcase" | "other";

export interface LabEvent {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  // False marks the room as still to be confirmed.
  room_confirmed: boolean;
  location_note: string | null;
  description: string | null;
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
