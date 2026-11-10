"use client";

// The buttons for the moves a viewer may make on a posting or project. A move
// that hands the ball over, takes notes or has hand-off copy asks first in a
// HandoffDialog; the rest post straight away.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/content/copy";
import { ApiError } from "@/lib/account";
import type { Role } from "@/lib/pipeline/domain";
import { HANDOFF, type CopyCtx, type HandoffCopy } from "@/lib/pipeline/handoffs";
import type { EntityKind } from "@/lib/pipeline/machines";
import { HandoffDialog } from "@/components/projectum/handoff-dialog";
import { refresh, send } from "@/components/projectum/pipeline-store";
import { reloadProjects } from "@/components/projectum/project-store";
import { allowedButtons, errorText, type TransitionButton } from "@/components/projectum/transition-buttons";

const T = copy.projectum.pipeline.transition;

const VARIANT = { primary: "default", danger: "destructive", default: "outline" } as const;

export function TransitionBar({
  kind,
  id,
  status,
  roles,
  ctx,
  allowed,
  exclude,
  onDone,
  onStale,
}: {
  kind: EntityKind;
  id: string;
  status: string;
  roles: readonly Role[];
  ctx: CopyCtx;
  /** Names the server said this viewer may take (postingOut.transitions or projectOut.transitions). */
  allowed?: string[];
  exclude?: string[];
  onDone?: (status: string) => void;
  /** Someone else moved it first; the page is loading the latest. */
  onStale?: () => void;
}) {
  const [pending, setPending] = React.useState<TransitionButton | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const buttons = allowedButtons(kind, status, roles, allowed, { exclude });

  async function post(b: TransitionButton, feedback?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await send<{ status?: string }>(`/${kind}s/${id}/transition`, "POST", {
        name: b.name,
        ...(feedback ? { feedback } : {}),
      });
      setPending(null);
      onDone?.(res?.status ?? status);
    } catch (e) {
      if (e instanceof ApiError && e.code === "state") {
        // Someone else moved it first: close the dialog, load where it
        // stands, and say so beside the buttons.
        setPending(null);
        setError(T.errors.moved);
        refresh();
        reloadProjects();
        onStale?.();
        return;
      }
      setError(e instanceof ApiError ? errorText(e.code, e.issues) : errorText(""));
    } finally {
      setBusy(false);
    }
  }

  function click(b: TransitionButton) {
    setError(null);
    if (b.handsTo || b.feedback || Object.hasOwn(HANDOFF, `${kind}.${b.name}`)) setPending(b);
    else void post(b);
  }

  // The note stays when the latest leaves this viewer no moves.
  if (!buttons.length && !error) return null;
  const handoff: HandoffCopy | null = pending
    ? (HANDOFF[`${kind}.${pending.name}`]?.(ctx) ?? { title: T.confirmTitle, steps: [], confirm: T.confirm })
    : null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <Button key={b.name} variant={VARIANT[b.intent]} disabled={busy} onClick={() => click(b)}>
            {b.label}
          </Button>
        ))}
      </div>
      {error && !pending && (
        <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
          {error}
        </p>
      )}
      {pending && handoff && (
        <HandoffDialog
          open
          copy={handoff}
          feedback={pending.feedback}
          busy={busy}
          error={error}
          onConfirm={(f) => void post(pending, f)}
          onCancel={() => {
            setPending(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
