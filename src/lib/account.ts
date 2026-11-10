"use client";

// The signed-in Projectum account, in the browser. Accounts live on the
// Worker (worker/src/accounts.ts), which the static site reaches across
// domains, so the session is a bearer token kept in localStorage rather
// than a cookie. A small external store read through useSyncExternalStore,
// so every component sees the same account, and signing in or out in
// another tab arrives through the storage event.

import * as React from "react";
import type { AccountRole } from "@/lib/email-rules";
import type { Level, Role } from "@/lib/pipeline/domain";
import { ACCOUNT_URL } from "@/lib/site";

export type { AccountRole } from "@/lib/email-rules";

export interface Account {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  status: "active" | "pending";
  avatar: string | null;
  // Every role held, with "admin" when the account is one.
  roles: Role[];
  admin: boolean;
  // Members: their stored level. Everyone else: null.
  level: Level | null;
  levelLocked: boolean;
  orgId: string | null;
  org: { id: string; slug: string; name: string; primary: boolean } | null;
  // A pending partner who asked an organization to let them in: its name.
  pendingOrgName: string | null;
  // Members: whether their profile page is public and its address, and
  // whether the Lab has given them a funded Claude account. Partners:
  // whether their name stays off student profiles.
  profilePublic: boolean;
  handle: string | null;
  claudeAccess: boolean;
  hideName: boolean;
  interests: string[];
}

export type AccountState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; account: Account };

const TOKEN_KEY = "projectum:session";
const LOADING: AccountState = { status: "loading" };
const SIGNED_OUT: AccountState = { status: "signed-out" };

let state: AccountState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A blocked store keeps the session for this page only.
  }
}

// Kept in memory too, so a store that refuses writes still works until the
// page closes.
let memoryToken: string | null = null;
const token = () => memoryToken ?? readToken();

// For a request api() can't make, a file download.
export const sessionToken = token;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public issues?: string[],
  ) {
    super(code);
  }
}

// A call to the Worker as the signed-in person. A 401 means the session
// ended elsewhere, so the page signs out.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const t = token();
  if (t) headers.set("authorization", `Bearer ${t}`);
  // JSON, unless it is a form, which the browser labels itself.
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${ACCOUNT_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: string[] };
  if (res.status === 401 && t) {
    memoryToken = null;
    writeToken(null);
    set(SIGNED_OUT);
  }
  if (!res.ok) throw new ApiError(res.status, body.error ?? "error", body.issues);
  return body as T;
}

async function refresh() {
  if (!token()) return set(SIGNED_OUT);
  try {
    const { user } = await api<{ user: Account }>("/me");
    set({ status: "signed-in", account: user });
  } catch {
    // Refused, offline, or the Worker is down. Only a refused session drops
    // the token (in api), so a later visit can still use it.
    set(SIGNED_OUT);
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!started) {
    started = true;
    void refresh();
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY) {
      memoryToken = null;
      void refresh();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// For stores outside React (shell-store.ts): the account now, and a call on
// every change to it, sign-in and sign-out included.
export function currentAccountState(): AccountState {
  return state;
}
export function watchAccount(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useAccountState(): AccountState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

// For components that only render once someone is signed in.
export function useAccount(): Account {
  const s = useAccountState();
  if (s.status !== "signed-in") throw new Error("useAccount needs a signed-in account");
  return s.account;
}

// --- Sign in and out ---------------------------------------------------------

export async function startLogin(email: string): Promise<{ devCode?: string }> {
  return api("/auth/start", { method: "POST", body: JSON.stringify({ email }) });
}

// What a right code still lacks: a name for a new address, and a password
// for any account without one, or one being reset (`reset`). The form asks
// and sends the code again with them.
export interface StillNeeds {
  name: boolean;
  password: boolean;
}

export async function verifyLogin(
  email: string,
  code: string,
  more: { name?: string; password?: string; reset?: boolean } = {},
): Promise<"signed-in" | StillNeeds> {
  const res = await api<{ needsName?: boolean; needsPassword?: boolean; token?: string; user?: Account }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code, ...more }),
  });
  if (!res.token || !res.user) return { name: Boolean(res.needsName), password: Boolean(res.needsPassword) };
  adopt(res.token, res.user);
  return "signed-in";
}

// Whether the address signs in with a password.
export async function hasPassword(email: string): Promise<boolean> {
  return (await api<{ password: boolean }>("/auth/check", { method: "POST", body: JSON.stringify({ email }) })).password;
}

export async function passwordLogin(email: string, password: string): Promise<void> {
  const res = await api<{ token: string; user: Account }>("/auth/password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  adopt(res.token, res.user);
}

function adopt(token: string, account: Account) {
  memoryToken = token;
  writeToken(token);
  set({ status: "signed-in", account });
}

// Whether a session handed back by Google sign-in is one this tab asked for.
// The nonce is used once.
export function takeGoogleSession(nonce: string | null): boolean {
  let expected: string | null = null;
  try {
    expected = window.sessionStorage.getItem(GOOGLE_NONCE);
    window.sessionStorage.removeItem(GOOGLE_NONCE);
  } catch {
    return false;
  }
  return Boolean(nonce && expected && nonce === expected);
}

// A session handed over by Google sign-in (the login page reads it from the
// URL fragment). Kept like any other, then checked with the Worker.
export async function adoptToken(t: string): Promise<boolean> {
  memoryToken = t;
  writeToken(t);
  await refresh();
  return state.status === "signed-in";
}

// Where "Continue with Google" starts: the Worker sends the browser on to
// Google and back to this site's login page.
const GOOGLE_NONCE = "projectum:google-nonce";

export function googleStartUrl(next: string, role: AccountRole | null = null): string {
  // Remembered for the return trip: the login page only takes a session
  // that comes back with this nonce (takeGoogleSession).
  const nonce = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(GOOGLE_NONCE, nonce);
  } catch {
    // Without storage the return is refused, and the code still works.
  }
  const params = new URLSearchParams({ origin: window.location.origin, next, nonce });
  if (role) params.set("role", role);
  return `${ACCOUNT_URL}/auth/google/start?${params}`;
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Signed out on this device either way.
  }
  memoryToken = null;
  writeToken(null);
  set(SIGNED_OUT);
}

export async function updateAccount(patch: {
  name?: string;
  avatar?: string | null;
  profilePublic?: boolean;
  hideName?: boolean;
  interests?: string[];
}): Promise<void> {
  const { user } = await api<{ user: Account }>("/me", { method: "PATCH", body: JSON.stringify(patch) });
  set({ status: "signed-in", account: user });
}
