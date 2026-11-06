// "In your court": the one list of things waiting on a person. Pure data,
// shared by the Worker (which builds it) and the site (which shows it).

import type { Role } from "./domain";

export type CourtItem = {
  role: Role;
  kind: "project" | "posting" | "review" | "org_request" | "meeting" | "submission" | "partner";
  id: string;
  title: string;
  subtitle: string;
  status: string;
  // "action" is the person's move now; "work" is theirs but in progress.
  urgency: "action" | "work";
  // ISO time the item entered its present state.
  since: string;
  href: string;
};

// Action before work, then oldest first. Stable for equal keys.
export function courtSort(items: readonly CourtItem[]): CourtItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      if (a.item.urgency !== b.item.urgency) return a.item.urgency === "action" ? -1 : 1;
      if (a.item.since !== b.item.since) return a.item.since < b.item.since ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.item);
}
