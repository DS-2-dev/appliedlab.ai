// The Join the Lab form's rules, shared by the form, the local route
// (/api/interest) and the Worker, so all three check a submission the same
// way. Dependency-free apart from the copy, and imported by relative path
// with extensions so scripts/interest.test.mjs can load it straight into
// Node.
//
// Three kinds of people join: students and faculty with a Weber State email,
// and organizations with any email. Each kind gives its own details, and a
// note is optional for all three.

import { copy } from "../content/copy.ts";
import { isWeberEmail, looksLikeEmail, normalizeEmail } from "./email-rules.ts";

export const ROLES = ["student", "faculty", "organization"] as const;
export type Role = (typeof ROLES)[number];

export const YEARS = copy.join.years;

export const SHORT_MAX = 120;
export const NOTE_MAX = 1500;

export interface Interest {
  role: Role;
  name: string;
  email: string;
  major?: string;
  year?: string;
  department?: string;
  organization?: string;
  title?: string;
  note?: string;
}

export type InterestField = Exclude<keyof Interest, "role">;
export type InterestErrors = Partial<Record<InterestField | "form", string>>;

// The fields each kind of person fills in, in order, after name and email.
export const ROLE_FIELDS: Record<Role, readonly InterestField[]> = {
  student: ["major", "year"],
  faculty: ["department"],
  organization: ["organization", "title"],
};

// Fields a kind of person must fill in. The note and an organization's
// title are optional.
const REQUIRED: Record<Role, readonly InterestField[]> = {
  student: ["name", "email", "major", "year"],
  faculty: ["name", "email", "department"],
  organization: ["name", "email", "organization"],
};

const E = copy.join.errors;
const MISSING: Partial<Record<InterestField, string>> = {
  name: E.name,
  email: E.email,
  major: E.major,
  year: E.year,
  department: E.department,
  organization: E.organization,
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Checks a submission from anywhere (form state or a request body) and
// returns either the cleaned value, with only its role's fields, or an
// error per field.
export function checkInterest(input: unknown): { value: Interest } | { errors: InterestErrors } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const role = ROLES.find((r) => r === raw.role);
  if (!role) return { errors: { form: E.failed } };

  const keep: InterestField[] = ["name", "email", ...ROLE_FIELDS[role], "note"];
  const value: Interest = { role, name: "", email: "" };
  const errors: InterestErrors = {};

  for (const field of keep) {
    const v = str(raw[field]);
    const max = field === "note" ? NOTE_MAX : SHORT_MAX;
    if (v.length > max) errors[field] = E.tooLong.replace("{n}", String(max));
    else if (!v && REQUIRED[role].includes(field)) errors[field] = MISSING[field];
    if (v) value[field] = v;
  }

  if (!errors.email) {
    value.email = normalizeEmail(value.email);
    if (!looksLikeEmail(value.email)) errors.email = E.email;
    else if (role !== "organization" && !isWeberEmail(value.email)) errors.email = E.weber;
  }
  if (value.year && !(YEARS as readonly string[]).includes(value.year)) errors.year = E.year;

  return Object.keys(errors).length ? { errors } : { value };
}
