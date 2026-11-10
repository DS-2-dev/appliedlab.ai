"use client";

// Boards, from the Worker (GET /boards, worker/src/boards.ts). A claim opens
// its team's board, so boards are never made here: the team edits its own,
// and everyone else reads them. Each entry carries the project it belongs
// to (its id, status and posting), or nulls for a board of the owner's own.
// `editable` marks the boards this account can change now: its team's while
// the project is in the team's court, or any for an admin.
//
// A small external store read through useSyncExternalStore, so every
// component on the page sees the same list. Edits show at once and save in
// the background, one request at a time so they land in order. A failed
// save reloads the list from the Worker.

import * as React from "react";
import { type Account, api, useAccountState } from "@/lib/account";
import { type Project, type Stage, atStage, cleanProjects } from "@/lib/projects";
import type { ProjectStatus } from "@/lib/pipeline/domain";
import { boardStageFor } from "@/lib/pipeline/machines";
import type { Meeting, Selection, Submission } from "@/components/projectum/pipeline-store";

export type BoardOwner = { id: string; name: string; role: Account["role"] };

// The card's fields, sent for every board.
export type BoardBrief = {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
  stage: Stage;
  people: Project["people"];
};

export type BoardEntry = {
  // The whole board, or null when it could not be read.
  project: Project | null;
  brief: BoardBrief;
  owner: BoardOwner;
  // On this account's team (or its own board), and changeable by it now.
  onTeam: boolean;
  editable: boolean;
  // The team's latest submission. Partners only get accepted ones.
  submission: Submission | null;
  // Phase 2, once the partner brings the team on.
  selection: Selection | null;
  // The latest request to meet the team, for the partner and staff.
  meeting: Meeting | null;
  // The project the board belongs to, or nulls for a board of one's own.
  projectId: string | null;
  status: ProjectStatus | null;
  postingId: string | null;
  postingTitle: string | null;
  // The posting's organization.
  postingOrgId: string | null;
  view: "full" | "partner";
};

/** @deprecated use BoardEntry */
export type ProjectEntry = BoardEntry;
/** @deprecated use BoardOwner */
export type ProjectOwner = BoardOwner;

const EMPTY: BoardEntry[] = [];
let entries: BoardEntry[] = EMPTY;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();

function set(next: BoardEntry[]) {
  entries = next;
  listeners.forEach((l) => l());
}

async function load(accountId: string) {
  try {
    const { projects } = await api<{ projects: (Omit<BoardEntry, "project"> & { project: unknown })[] }>("/boards");
    if (loadedFor !== accountId) return;
    set(
      projects.map((e) => {
        const [clean] = e.project ? cleanProjects([e.project]) : [];
        // While the plan is written the board sits in Solidifying, as the
        // Worker holds it, even before the plan is whole.
        const held = clean && e.status && boardStageFor(e.status) === "solidifying" ? atStage(clean, "solidifying") : clean;
        return { ...e, project: held ?? null };
      }),
    );
  } catch {
    // Signed out or offline: the list stays as it was.
  }
}

// A board the Worker already saved, a submission say, put in place here
// without sending it again.
export function setLocalProject(project: Project) {
  set(entries.map((e) => (e.project?.id === project.id ? { ...e, project } : e)));
}

// Settles once every save sent so far has landed (or failed), for a view
// that reads what a save changed on the Worker.
export function whenSaved(): Promise<void> {
  return queue.then(
    () => undefined,
    () => undefined,
  );
}

// Boards appear when a posting is claimed elsewhere, so a view that may show
// a new one asks for a fresh list.
export function reloadProjects() {
  if (loadedFor) void load(loadedFor);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

// Loads the list once per signed-in account, and empties it on sign-out.
function useEntries(): { entries: BoardEntry[]; me: Account | null } {
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
      .then(() => api(`/boards/${encodeURIComponent(p.id)}`, { method: "PUT", body: JSON.stringify({ project: p }) }))
      .catch(() => {
        if (loadedFor === accountId) void load(accountId);
      });
  }
}

const editableBoards = (list: BoardEntry[]): Project[] => list.flatMap((e) => (e.editable && e.project ? [e.project] : []));

// The boards this account can change, for the board itself, and the way to
// change them; `team` is the ones on its own team, for the sidebar. Boards
// are only changed here, never added or removed: a list that comes back with
// one missing or new keeps it as it was.
export function useProjects() {
  const { entries: all, me } = useEntries();
  const own = React.useMemo(() => editableBoards(all), [all]);
  const team = React.useMemo(() => all.flatMap((e) => (e.onTeam && e.project ? [e.project] : [])), [all]);
  const update = React.useCallback(
    (fn: (l: Project[]) => Project[]) => {
      if (!me) return;
      const before = editableBoards(entries);
      const changed = new Map(fn(before).map((p) => [p.id, p]));
      set(
        entries.map((e) =>
          e.editable && e.project && changed.has(e.project.id) ? { ...e, project: changed.get(e.project.id)! } : e,
        ),
      );
      save(me.id, before, [...changed.values()]);
    },
    [me],
  );
  return [own, update, team] as const;
}

// Every board this account can see, with whose it is, for All Projects and
// a posting's teams.
export function useVisibleProjects(): { entries: BoardEntry[]; me: Account | null } {
  return useEntries();
}
