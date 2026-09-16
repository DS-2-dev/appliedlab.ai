"use client";

// Where Projectum projects live for now: this browser's localStorage, keyed by
// account, until projects have a place in the database. A small external
// store read through useSyncExternalStore, so the server and the first
// client render agree (empty), every component on the page sees the same
// list, and other tabs' edits arrive through the storage event. Memory is
// the source of truth for this tab, so the list still works when
// localStorage refuses a write (a full quota, a private window).

import * as React from "react";
import { type Project, cleanProjects } from "@/lib/projects";

const EMPTY: Project[] = [];
const memory = new Map<string, Project[]>();
const listeners = new Set<() => void>();

// The key predates thumbnails, when projects were only folder names. Kept
// so those saves still load.
function projectsKey(email: string) {
  return `statur:folders:${email.toLowerCase()}`;
}

function load(key: string): Project[] {
  let list = EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) list = cleanProjects(JSON.parse(raw));
  } catch {
    // Unreadable or blocked storage starts from an empty list.
  }
  memory.set(key, list);
  return list;
}

function save(key: string, list: Project[]) {
  memory.set(key, list);
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
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

export function useProjects(email: string) {
  const key = projectsKey(email);
  const list = React.useSyncExternalStore(
    subscribe,
    () => memory.get(key) ?? load(key),
    () => EMPTY,
  );
  const update = React.useCallback(
    (fn: (l: Project[]) => Project[]) => save(key, fn(memory.get(key) ?? load(key))),
    [key],
  );
  return [list, update] as const;
}
