// Supabase adapter. Activates automatically when NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY exist (see index.ts). Public writes go through
// the anon client and rely on the RLS policies in supabase/migration.sql:
// anonymous users can insert partner_inquiries and read events and
// settings, nothing else. Officer operations use the signed-in user's session
// so RLS enforces the officer role server-side.
//
// WIRED BUT UNVERIFIED: there is no Supabase project yet. When the club
// project exists (owned by ailab@weber.edu), run supabase/migration.sql,
// set the env vars, and walk docs/SUPABASE.md.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

// Server client bound to the request's auth cookies (officer session).
export async function sessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components cannot set cookies; refresh happens in route handlers.
          }
        },
      },
    },
  );
}

export async function getEvents(): Promise<LabEvent[]> {
  const { data, error } = await anonClient()
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LabEvent[];
}

export async function getEvent(id: string): Promise<LabEvent | null> {
  const { data } = await anonClient().from("events").select("*").eq("id", id).maybeSingle();
  return (data as LabEvent) ?? null;
}

export async function createEvent(
  input: Omit<LabEvent, "id" | "created_at">,
): Promise<LabEvent> {
  const client = await sessionClient();
  const { data, error } = await client.from("events").insert(input).select().single();
  if (error) throw error;
  return data as LabEvent;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<LabEvent, "id" | "created_at">>,
): Promise<LabEvent | null> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("events")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as LabEvent) ?? null;
}

export async function deleteEvent(id: string): Promise<void> {
  const client = await sessionClient();
  const { error } = await client.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await anonClient().from("settings").select("key, value");
  if (error) throw error;
  const out: Record<string, unknown> = {};
  for (const row of data ?? []) out[row.key] = row.value;
  return { ...DEFAULT_SETTINGS, ...(out as Partial<Settings>) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const client = await sessionClient();
  for (const [key, value] of Object.entries(patch)) {
    const { error } = await client
      .from("settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  return getSettings();
}

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
  const { error } = await anonClient().from("partner_inquiries").insert(input);
  if (error) throw error;
  return { ok: true };
}

export async function listInquiries(): Promise<PartnerInquiry[]> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("partner_inquiries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PartnerInquiry[];
}

export async function updateInquiry(
  id: string,
  patch: Partial<Pick<PartnerInquiry, "status" | "notes_internal">>,
): Promise<PartnerInquiry | null> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("partner_inquiries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as PartnerInquiry) ?? null;
}

/** Public read: RLS also restricts anonymous select to published rows. */
export async function listShowcasePublic(): Promise<ShowcaseEntry[]> {
  const { data, error } = await anonClient()
    .from("showcase_entries")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShowcaseEntry[];
}

export async function listShowcaseAdmin(): Promise<ShowcaseEntry[]> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("showcase_entries")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShowcaseEntry[];
}

export async function createShowcaseEntry(
  input: Omit<ShowcaseEntry, "id" | "created_at" | "updated_at">,
): Promise<ShowcaseEntry> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("showcase_entries")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as ShowcaseEntry;
}

export async function updateShowcaseEntry(
  id: string,
  patch: Partial<Omit<ShowcaseEntry, "id" | "created_at" | "updated_at">>,
): Promise<ShowcaseEntry | null> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("showcase_entries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as ShowcaseEntry) ?? null;
}

export async function deleteShowcaseEntry(id: string): Promise<void> {
  const client = await sessionClient();
  const { error } = await client.from("showcase_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function createStudentSignup(input: {
  name: string;
  email: string;
  major: string | null;
}): Promise<{ ok: boolean; duplicate?: boolean }> {
  const { error } = await anonClient()
    .from("student_signups")
    .insert({ ...input, email: input.email.trim().toLowerCase() });
  if (error) {
    if (error.code === "23505") return { ok: false, duplicate: true };
    throw error;
  }
  return { ok: true };
}

export async function listStudentSignups(): Promise<StudentSignup[]> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("student_signups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentSignup[];
}

export async function listOfficers(): Promise<Profile[]> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("role", "officer")
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function addOfficer(email: string): Promise<Profile> {
  const client = await sessionClient();
  const { data, error } = await client
    .from("profiles")
    .upsert(
      { email: email.toLowerCase(), role: "officer", status: "active" },
      { onConflict: "email" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function removeOfficer(id: string): Promise<void> {
  const client = await sessionClient();
  const { error } = await client
    .from("profiles")
    .update({ status: "removed" })
    .eq("id", id);
  if (error) throw error;
}
