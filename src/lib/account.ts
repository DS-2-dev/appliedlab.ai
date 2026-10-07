"use client";

// The signed-in Projectum account, in the browser. Accounts live on the
// Worker (worker/src/accounts.ts), which the static site reaches across
// domains, so the session is a bearer token kept in localStorage rather
// than a cookie. A small external store read through useSyncExternalStore,
// so every component sees the same account, and signing in or out in
// another tab arrives through the storage event.

import * as React from "react";
import type { AccountRole } from "@/lib/email-rules";
import { ACCOUNT_URL } from "@/lib/site";

export type { AccountRole } from "@/lib/email-rules";

export interface Account {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  status: "active" | "pending";
  avatar: string | null;
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

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
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
  if (init.body) headers.set("content-type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${ACCOUNT_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && t) {
    memoryToken = null;
    writeToken(null);
    set(SIGNED_OUT);
  }
  if (!res.ok) throw new ApiError(res.status, body.error ?? "error");
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

// Resolves to "needs-name" for a new address, which is asked for a name and
// sent again with it.
export async function verifyLogin(email: string, code: string, name?: string): Promise<"signed-in" | "needs-name"> {
  const res = await api<{ needsName?: boolean; token?: string; user?: Account }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code, name }),
  });
  if (res.needsName || !res.token || !res.user) return "needs-name";
  memoryToken = res.token;
  writeToken(res.token);
  set({ status: "signed-in", account: res.user });
  return "signed-in";
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
export function googleStartUrl(next: string, role: AccountRole | null = null): string {
  const params = new URLSearchParams({ origin: window.location.origin, next });
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

export async function updateAccount(patch: { name?: string; avatar?: string | null }): Promise<void> {
  const { user } = await api<{ user: Account }>("/me", { method: "PATCH", body: JSON.stringify(patch) });
  set({ status: "signed-in", account: user });
}
