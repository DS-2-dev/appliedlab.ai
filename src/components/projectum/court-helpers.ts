// Small pure rules for "in your court": which items the strip shows, and
// which dot a notification wears. Pure, so scripts/court-ui.test.mjs runs them.

import type { CourtItem } from "@/lib/pipeline/court";

export const STRIP_LIMIT = 5;

// The strip shows the person's moves (action items), in the Worker's order
// (oldest first), up to the limit; `more` counts the rest of the court so
// the strip can point at the inbox.
export function courtStrip(items: readonly CourtItem[], limit: number = STRIP_LIMIT): { shown: CourtItem[]; more: number } {
  const action = items.filter((i) => i.urgency === "action");
  return { shown: action.slice(0, limit), more: Math.max(0, action.length - limit) };
}

// A court notification asks the person to act and has not been read: it
// wears the court dot. Any other unread one wears the plain dot.
export function notificationDot(n: { court: boolean; read: boolean }): "court" | "unread" | null {
  if (n.read) return null;
  return n.court ? "court" : "unread";
}
