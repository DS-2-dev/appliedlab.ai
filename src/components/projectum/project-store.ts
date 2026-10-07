"use client";

// Projectum projects, saved to the account on the Worker
// (worker/src/accounts.ts), so they follow the person to any device. The
// Worker decides what each account sees: members and reps get every
// project, partners only their own.
//
// A small external store read through useSyncExternalStore, so every
// component on the page sees the same list. Edits show at once and save in
// the background, one request at a time so they land in order. A failed
// save reloads the list from the Worker.

import * as React from "react";
import { type Account, api, useAccountState } from "@/lib/account";
import { type Project, cleanProjects } from "@/lib/projects";

export type ProjectOwner = { id: string; name: string; email: string; role: Account["role"] };
export type ProjectEntry = { project: Project; owner: ProjectOwner };

const EMPTY: ProjectEntry[] = [];
let entries: ProjectEntry[] = EMPTY;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();

function set(next: ProjectEntry[]) {
  entries = next;
  listeners.forEach((l) => l());
}

async function load(accountId: string) {
  try {
    const { projects } = await api<{ projects: { project: unknown; owner: ProjectOwner }[] }>("/projects");
    if (loadedFor !== accountId) return;
    set(
      projects.flatMap(({ project, owner }) => {
        const [clean] = cleanProjects([project]);
        return clean ? [{ project: clean, owner }] : [];
      }),
    );
  } catch {
    // Signed out or offline: the list stays as it was.
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

// Loads the list once per signed-in account, and empties it on sign-out.
function useEntries(): { entries: ProjectEntry[]; me: Account | null } {
  const s = useAccountState();
  const me = s.status === "signed-in" ? s.account : null;
  const id = me?.id ?? null;
  React.useEffect(() => {
    if (loadedFor === id) return;
    loadedFor = id;
    set(EMPTY);
    if (id) void load(id);
  }, [id]);
  const list = React.useSyncExternalStore(
    subscribe,
    () => entries,
    () => EMPTY,
  );
  return { entries: list, me };
}

function save(accountId: string, before: Project[], after: Project[]) {
  const old = new Map(before.map((p) => [p.id, JSON.stringify(p)]));
  const kept = new Set(after.map((p) => p.id));
  const calls: (() => Promise<unknown>)[] = [];
  for (const p of after) {
    const json = JSON.stringify(p);
    if (old.get(p.id) !== json) {
      calls.push(() => api(`/projects/${encodeURIComponent(p.id)}`, { method: "PUT", body: JSON.stringify({ project: p }) }));
    }
  }
  for (const id of old.keys()) {
    if (!kept.has(id)) calls.push(() => api(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }));
  }
  for (const call of calls) {
    queue = queue.then(call).catch(() => {
      if (loadedFor === accountId) void load(accountId);
    });
  }
}

// The signed-in person's own projects, for the sidebar, the board and the
// project form, and the way to change them.
export function useProjects() {
  const { entries: all, me } = useEntries();
  const own = React.useMemo(() => all.filter((e) => e.owner.id === me?.id).map((e) => e.project), [all, me?.id]);
  const update = React.useCallback(
    (fn: (l: Project[]) => Project[]) => {
      if (!me) return;
      const owner: ProjectOwner = { id: me.id, name: me.name, email: me.email, role: me.role };
      const before = entries.filter((e) => e.owner.id === me.id).map((e) => e.project);
      const after = fn(before);
      set([...entries.filter((e) => e.owner.id !== me.id), ...after.map((project) => ({ project, owner }))]);
      save(me.id, before, after);
    },
    [me],
  );
  return [own, update] as const;
}

// Every project this account can see, with whose it is, for All Projects.
export function useVisibleProjects(): { entries: ProjectEntry[]; me: Account | null } {
  return useEntries();
}
