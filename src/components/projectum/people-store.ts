"use client";

// The Lab's people for "Add person": active member and rep accounts from the
// Worker, loaded once per visit and shared by every form that asks.

import * as React from "react";
import { api } from "@/lib/account";

export type LabPerson = { id: string; name: string; role: "member" | "rep" };

let people: LabPerson[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loading ??= api<{ people: LabPerson[] }>("/people")
    .then((res) => {
      people = res.people;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      // Tried again the next time a form opens.
      loading = null;
    });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  load();
  return () => listeners.delete(onChange);
}

// Null until loaded.
export function usePeople(): LabPerson[] | null {
  return React.useSyncExternalStore(
    subscribe,
    () => people,
    () => null,
  );
}
