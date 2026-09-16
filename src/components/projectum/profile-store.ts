"use client";

// The signed-in person's profile picture, kept in this browser's
// localStorage by account until profiles have a place in the database. Read
// through useSyncExternalStore like the projects (project-store.ts): empty on
// the server and the first render, shared by every component on the page,
// and updated from other tabs. Only inline images load back, so a stored
// value can never point the page somewhere else.

import * as React from "react";
import { isThumbnail } from "@/lib/projects";

const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function avatarKey(email: string) {
  return `projectum:avatar:${email.toLowerCase()}`;
}

function load(key: string): string | null {
  let value: string | null = null;
  try {
    const raw = window.localStorage.getItem(key);
    if (isThumbnail(raw)) value = raw;
  } catch {
    // Unreadable or blocked storage shows the initials.
  }
  memory.set(key, value);
  return value;
}

function save(key: string, value: string | null) {
  memory.set(key, value);
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Kept in memory for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key && memory.has(e.key)) {
      memory.delete(e.key);
      onChange();
    }
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAvatar(email: string) {
  const key = avatarKey(email);
  const src = React.useSyncExternalStore(
    subscribe,
    () => (memory.has(key) ? (memory.get(key) ?? null) : load(key)),
    () => null,
  );
  const set = React.useCallback((value: string | null) => save(key, value), [key]);
  return [src, set] as const;
}
