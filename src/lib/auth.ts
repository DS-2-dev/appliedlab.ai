// Who is signed in. There is one kind of account now (2026-09-11): officer
// and member were merged into member, and the officer screens were removed.
//
// Two modes, chosen by the same env seam as the data layer:
//
// - Supabase mode: Supabase Auth, by Google or by email and password. Any
//   Weber State address can hold an account (the domain rule is enforced in
//   the database, see supabase/002-member-accounts.sql). A profile marked
//   removed is treated as signed out.
// - Local preview: accounts in data/users.json behind a signed cookie, plus
//   the one-click Projectum demo. Only honored when NODE_ENV is development AND
//   Supabase is absent, so a deployed site can never be entered this way.

import { cookies } from "next/headers";
import { hasSupabase, sessionClient } from "./data/supabase";
import { LOCAL_SESSION_COOKIE, findLocalUserById, readLocalSession } from "./local-accounts";
import type { Profile } from "./types";

export const DEMO_COOKIE = "aail_statur_demo";

export function devAuthAllowed(): boolean {
  return process.env.NODE_ENV === "development" && !hasSupabase();
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
}

const DEMO_USER: SessionUser = {
  id: "statur-demo",
  email: "demo@weber.edu",
  full_name: "Projectum demo",
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (hasSupabase()) {
    const client = await sessionClient();
    const { data } = await client.auth.getUser();
    const user = data.user;
    if (!user?.email) return null;
    const { data: profile } = await client
      .from("profiles")
      .select("full_name, status")
      .eq("id", user.id)
      .maybeSingle();
    const p = profile as Pick<Profile, "full_name" | "status"> | null;
    if (p?.status === "removed") return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName =
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      null;
    return { id: user.id, email: user.email, full_name: p?.full_name ?? metaName };
  }

  if (!devAuthAllowed()) return null;
  const store = await cookies();
  if (store.get(DEMO_COOKIE)?.value === "1") return DEMO_USER;
  const token = store.get(LOCAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = await readLocalSession(token);
  if (!uid) return null;
  const u = await findLocalUserById(uid);
  return u ? { id: u.id, email: u.email, full_name: u.full_name } : null;
}
