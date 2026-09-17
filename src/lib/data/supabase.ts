// Supabase adapter. Activates automatically when NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY exist (see index.ts). Events and settings are
// public reads through the anon client under the RLS policies in
// supabase/migration.sql; accounts use the signed-in session (sessionClient).
//
// WIRED BUT UNVERIFIED: there is no Supabase project yet. When the club
// project exists (owned by ailab@weber.edu), run supabase/migration.sql,
// set the env vars, and walk docs/SUPABASE.md.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "../types";

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

// Server client bound to the request's auth cookies (the signed-in session).
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

export async function getSettings(): Promise<Settings> {
  const { data, error } = await anonClient().from("settings").select("key, value");
  if (error) throw error;
  const out: Record<string, unknown> = {};
  for (const row of data ?? []) out[row.key] = row.value;
  return { ...DEFAULT_SETTINGS, ...(out as Partial<Settings>) };
}
