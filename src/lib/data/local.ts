// Local JSON adapter: the dev/preview store. Reads and writes files under
// data/ at the project root. In production this whole adapter is replaced by
// the Supabase adapter the moment env vars exist (see index.ts); the public
// site never depends on which one is active.

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  DEFAULT_SETTINGS,
  type InquiryKind,
  type LabEvent,
  type PartnerInquiry,
  type Profile,
  type Settings,
  type ShowcaseEntry,
  type StudentSignup,
} from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(
    path.join(DATA_DIR, file),
    JSON.stringify(value, null, 2) + "\n",
    "utf8",
  );
}

let writableCache: boolean | null = null;

export async function localWritable(): Promise<boolean> {
  if (writableCache !== null) return writableCache;
  try {
    // unique name so concurrent probes never collide; cleanup is best-effort
    const probe = path.join(DATA_DIR, `.write-probe-${randomUUID()}`);
    await fs.writeFile(probe, "ok", "utf8");
    fs.unlink(probe).catch(() => {});
    writableCache = true;
  } catch {
    writableCache = false;
  }
  return writableCache;
}

// events

export async function getEvents(): Promise<LabEvent[]> {
  const events = await readJson<LabEvent[]>("events.json", []);
  return events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function getEvent(id: string): Promise<LabEvent | null> {
  return (await getEvents()).find((e) => e.id === id) ?? null;
}

export async function createEvent(
  input: Omit<LabEvent, "id" | "created_at">,
): Promise<LabEvent> {
  const events = await readJson<LabEvent[]>("events.json", []);
  const event: LabEvent = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  events.push(event);
  await writeJson("events.json", events);
  return event;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<LabEvent, "id" | "created_at">>,
): Promise<LabEvent | null> {
  const events = await readJson<LabEvent[]>("events.json", []);
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...patch };
  await writeJson("events.json", events);
  return events[idx];
}

export async function deleteEvent(id: string): Promise<void> {
  const events = await readJson<LabEvent[]>("events.json", []);
  await writeJson(
    "events.json",
    events.filter((e) => e.id !== id),
  );
}

// settings

export async function getSettings(): Promise<Settings> {
  const stored = await readJson<Partial<Settings>>("settings.json", {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await writeJson("settings.json", next);
  return next;
}

// partner inquiries

export async function createInquiry(input: {
  kind: InquiryKind;
  org_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  problem: string;
  anything_else: string | null;
  how_heard: string | null;
}): Promise<{ ok: boolean }> {
  const inquiries = await readJson<PartnerInquiry[]>("partner-inquiries.json", []);
  const now = new Date().toISOString();
  inquiries.push({
    id: randomUUID(),
    ...input,
    status: "new",
    notes_internal: null,
    created_at: now,
    updated_at: now,
  });
  await writeJson("partner-inquiries.json", inquiries);
  return { ok: true };
}

export async function listInquiries(): Promise<PartnerInquiry[]> {
  const inquiries = await readJson<PartnerInquiry[]>("partner-inquiries.json", []);
  return inquiries
    .map((i) => ({ ...i, kind: i.kind ?? "casework" }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function updateInquiry(
  id: string,
  patch: Partial<Pick<PartnerInquiry, "status" | "notes_internal">>,
): Promise<PartnerInquiry | null> {
  const inquiries = await readJson<PartnerInquiry[]>("partner-inquiries.json", []);
  const idx = inquiries.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  inquiries[idx] = {
    ...inquiries[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await writeJson("partner-inquiries.json", inquiries);
  return inquiries[idx];
}

// showcase

function sortShowcase(entries: ShowcaseEntry[]): ShowcaseEntry[] {
  return entries.sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );
}

/** Public read: published entries only. */
export async function listShowcasePublic(): Promise<ShowcaseEntry[]> {
  const entries = await readJson<ShowcaseEntry[]>("showcase.json", []);
  return sortShowcase(entries.filter((e) => e.published));
}

/** Admin read: everything, drafts included. */
export async function listShowcaseAdmin(): Promise<ShowcaseEntry[]> {
  const entries = await readJson<ShowcaseEntry[]>("showcase.json", []);
  return sortShowcase(entries);
}

export async function createShowcaseEntry(
  input: Omit<ShowcaseEntry, "id" | "created_at" | "updated_at">,
): Promise<ShowcaseEntry> {
  const entries = await readJson<ShowcaseEntry[]>("showcase.json", []);
  const now = new Date().toISOString();
  const entry: ShowcaseEntry = { ...input, id: randomUUID(), created_at: now, updated_at: now };
  entries.push(entry);
  await writeJson("showcase.json", entries);
  return entry;
}

export async function updateShowcaseEntry(
  id: string,
  patch: Partial<Omit<ShowcaseEntry, "id" | "created_at" | "updated_at">>,
): Promise<ShowcaseEntry | null> {
  const entries = await readJson<ShowcaseEntry[]>("showcase.json", []);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch, updated_at: new Date().toISOString() };
  await writeJson("showcase.json", entries);
  return entries[idx];
}

export async function deleteShowcaseEntry(id: string): Promise<void> {
  const entries = await readJson<ShowcaseEntry[]>("showcase.json", []);
  await writeJson(
    "showcase.json",
    entries.filter((e) => e.id !== id),
  );
}

// student signups

export async function createStudentSignup(input: {
  name: string;
  email: string;
  major: string | null;
}): Promise<{ ok: boolean; duplicate?: boolean }> {
  const signups = await readJson<StudentSignup[]>("students.json", []);
  const email = input.email.trim().toLowerCase();
  if (signups.some((s) => s.email === email)) {
    return { ok: false, duplicate: true };
  }
  signups.push({
    id: randomUUID(),
    name: input.name.trim(),
    email,
    major: input.major,
    created_at: new Date().toISOString(),
  });
  await writeJson("students.json", signups);
  return { ok: true };
}

export async function listStudentSignups(): Promise<StudentSignup[]> {
  const signups = await readJson<StudentSignup[]>("students.json", []);
  return signups.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// profiles (officers)

export async function listOfficers(): Promise<Profile[]> {
  const profiles = await readJson<Profile[]>("profiles.json", []);
  return profiles.filter((p) => p.role === "officer" && p.status === "active");
}

export async function addOfficer(email: string): Promise<Profile> {
  const profiles = await readJson<Profile[]>("profiles.json", []);
  const existing = profiles.find(
    (p) => p.email.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    existing.role = "officer";
    existing.status = "active";
    await writeJson("profiles.json", profiles);
    return existing;
  }
  const profile: Profile = {
    id: randomUUID(),
    email: email.toLowerCase(),
    full_name: null,
    role: "officer",
    status: "active",
    created_at: new Date().toISOString(),
  };
  profiles.push(profile);
  await writeJson("profiles.json", profiles);
  return profile;
}

export async function removeOfficer(id: string): Promise<void> {
  const profiles = await readJson<Profile[]>("profiles.json", []);
  const target = profiles.find((p) => p.id === id);
  if (target) {
    target.status = "removed";
    await writeJson("profiles.json", profiles);
  }
}
