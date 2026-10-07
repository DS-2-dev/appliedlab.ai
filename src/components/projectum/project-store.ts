"use client";

// Project boards, from the Worker (worker/src/pipeline.ts). An approved claim
// opens its team's board, so boards are never made here: the team edits its
// own, and everyone else reads them. Partners see only the boards on their
// own problems. `editable` marks the boards this account can change: its
// team's, or any for an approver.
//
// A small external store read through useSyncExternalStore, so every
// component on the page sees the same list. Edits show at once and save in
// the background, one request at a time so they land in order. A failed
// save reloads the list from the Worker.

import * as React from "react";
import { type Account, api, useAccountState } from "@/lib/account";
import { type Project, cleanProjects } from "@/lib/projects";
import type { Submission } from "@/components/projectum/pipeline-store";

export type ProjectOwner = { id: string; name: string; email: string; role: Account["role"] };
export type ProjectEntry = {
  project: Project;
  owner: ProjectOwner;
  problemId: string;
  // On this account's team, and changeable by it (its team's, or any for
  // an approver).
  onTeam: boolean;
  editable: boolean;
  // The team's latest submission. Partners only get accepted ones.
  submission: Submission | null;
};

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
    const { projects } = await api<{ projects: (Omit<ProjectEntry, "project"> & { project: unknown })[] }>("/projects");
    if (loadedFor !== accountId) return;
    set(
      projects.flatMap((e) => {
        const [clean] = cleanProjects([e.project]);
        return clean ? [{ ...e, project: clean }] : [];
      }),
    );
  } catch {
    // Signed out or offline: the list stays as it was.
  }
}

// A board the Worker already saved, a submission say, put in place here
// without sending it again.
export function setLocalProject(project: Project) {
  set(entries.map((e) => (e.project.id === project.id ? { ...e, project } : e)));
}

// Boards appear when a claim is approved elsewhere, so a view that may show
// a new one asks for a fresh list.
export function reloadProjects() {
  if (loadedFor) void load(loadedFor);
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
  for (const p of after) {
    if (!old.has(p.id) || old.get(p.id) === JSON.stringify(p)) continue;
    queue = queue
      .then(() => api(`/projects/${encodeURIComponent(p.id)}`, { method: "PUT", body: JSON.stringify({ project: p }) }))
      .catch(() => {
        if (loadedFor === accountId) void load(accountId);
      });
  }
}

// The boards this account can change, for the board itself, and the way to
// change them; `team` is the ones on its own team, for the sidebar. Boards are only changed here, never added or
// removed: a list that comes back with one missing or new keeps it as it was.
export function useProjects() {
  const { entries: all, me } = useEntries();
  const own = React.useMemo(() => all.filter((e) => e.editable).map((e) => e.project), [all]);
  const team = React.useMemo(() => all.filter((e) => e.onTeam).map((e) => e.project), [all]);
  const update = React.useCallback(
    (fn: (l: Project[]) => Project[]) => {
      if (!me) return;
      const before = entries.filter((e) => e.editable).map((e) => e.project);
      const changed = new Map(fn(before).map((p) => [p.id, p]));
      set(entries.map((e) => (e.editable && changed.has(e.project.id) ? { ...e, project: changed.get(e.project.id)! } : e)));
      save(me.id, before, [...changed.values()]);
    },
    [me],
  );
  return [own, update, team] as const;
}

// Every board this account can see, with whose it is, for All Projects and
// a problem's teams.
export function useVisibleProjects(): { entries: ProjectEntry[]; me: Account | null } {
  return useEntries();
}
