"use client";

// The shell's live numbers, from GET /shell (worker/src/shell.ts): what is in
// this account's court, open reviews for staff, a primary's join requests,
// and the bell. Asked every 30 seconds while the tab is in view, at once
// when it comes back into view or the window gets focus, and after every
// change made through send() (pollShell). One store, read through
// useSyncExternalStore, so every badge agrees.

import * as React from "react";
import { api, currentAccountState, watchAccount } from "@/lib/account";

export type NotificationOut = {
  id: string;
  kind: string;
  title: string;
  href: string;
  // Whether it asks this person to act ("in your court").
  court: boolean;
  read: boolean;
  createdAt: string;
};

export type Shell = {
  court: number;
  reviews: number;
  unread: number;
  requests: number;
  notifications: NotificationOut[];
  // False until the first answer arrives.
  loaded: boolean;
};

const EVERY = 30_000;
const EMPTY: Shell = { court: 0, reviews: 0, unread: 0, requests: 0, notifications: [], loaded: false };

let state: Shell = EMPTY;
// The account the numbers are for; null signed out.
let owner: string | null = null;
let inflight: Promise<void> | null = null;
let again = false;
const listeners = new Set<() => void>();

function set(next: Shell) {
  state = next;
  listeners.forEach((l) => l());
}

// Asks for fresh numbers now. A call while one is on its way asks once more
// after it, so a change made meanwhile still shows.
export function pollShell(): Promise<void> {
  if (!owner) return Promise.resolve();
  if (inflight) {
    again = true;
    return inflight;
  }
  const forId = owner;
  inflight = api<Omit<Shell, "loaded">>("/shell")
    .then((data) => {
      if (owner === forId) set({ ...data, loaded: true });
    })
    .catch(() => {
      // Offline or signed out: the numbers stay as they were.
    })
    .finally(() => {
      inflight = null;
      if (again) {
        again = false;
        void pollShell();
      }
    });
  return inflight;
}

// Marks notifications read, here at once and then on the Worker.
export async function markRead(ids: string[] | "all"): Promise<void> {
  const hit = (n: NotificationOut) => !n.read && (ids === "all" || ids.includes(n.id));
  const cleared = state.notifications.filter(hit).length;
  if (cleared || ids === "all") {
    set({
      ...state,
      unread: ids === "all" ? 0 : Math.max(0, state.unread - cleared),
      notifications: state.notifications.map((n) => (hit(n) ? { ...n, read: true } : n)),
    });
  }
  try {
    await api("/notifications/read", { method: "POST", body: JSON.stringify(ids === "all" ? { all: true } : { ids }) });
  } finally {
    void pollShell();
  }
}

const visible = () => document.visibilityState === "visible";
const onVisible = () => {
  if (visible()) void pollShell();
};
let timer: number | undefined;

// Follows the account itself, so signing out empties the numbers and
// signing in (as anyone) asks at once, whether or not a badge is on screen.
function syncAccount() {
  const s = currentAccountState();
  const id = s.status === "signed-in" ? s.account.id : null;
  if (id === owner) return;
  owner = id;
  set(EMPTY);
  void pollShell();
}
let watching = false;

// The clock and the listeners run while anything reads the store; the
// account is followed from the first read on.
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!watching) {
    watching = true;
    watchAccount(syncAccount);
    syncAccount();
  }
  if (listeners.size === 1) {
    timer = window.setInterval(onVisible, EVERY);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    }
  };
}

// The numbers for the signed-in account, empty while signed out.
export function useShell(): Shell {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}
