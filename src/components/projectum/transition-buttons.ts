// Which buttons a viewer gets on a posting or project, and what an API error
// from the transition endpoint says. Pure, so tests can run it.

import { copy } from "@/content/copy";
import type { Court, Role } from "@/lib/pipeline/domain";
import { transitionsFrom, type EntityKind } from "@/lib/pipeline/machines";

export type TransitionButton = {
  name: string;
  label: string;
  intent: "primary" | "danger" | "default";
  feedback: "required" | "optional" | undefined;
  handsTo: Court | undefined;
  hotkey: string | undefined;
};

/** The viewer's transitions out of a status, in machine order. */
export function buttonsFor(
  kind: EntityKind,
  status: string,
  roles: readonly Role[],
  opts?: { exclude?: string[] },
): TransitionButton[] {
  return transitionsFrom(kind, status, roles)
    .filter((t) => !opts?.exclude?.includes(t.name))
    .map((t) => ({
      name: t.name,
      label: t.label,
      intent: t.intent ?? "default",
      feedback: t.feedback,
      handsTo: t.handsTo,
      hotkey: t.hotkey,
    }));
}

/** buttonsFor, narrowed to the names the server said are allowed (when it said). */
export function allowedButtons(
  kind: EntityKind,
  status: string,
  roles: readonly Role[],
  allowed?: readonly string[],
  opts?: { exclude?: string[] },
): TransitionButton[] {
  const all = buttonsFor(kind, status, roles, opts);
  return allowed ? all.filter((b) => allowed.includes(b.name)) : all;
}

const E = copy.projectum.pipeline.transition.errors;

/** The sentence for an API error code from POST .../transition. */
export function errorText(code: string, issues?: readonly string[]): string {
  switch (code) {
    case "state":
      return E.state;
    case "feedback":
      return E.feedback;
    case "own-project":
      return E.ownProject;
    case "forbidden":
      return E.forbidden;
    case "plan":
      return issues?.length ? `${E.plan} ${issues.join(", ")}` : E.plan;
    case "effects":
      return E.effects;
    default:
      return E.fallback;
  }
}
