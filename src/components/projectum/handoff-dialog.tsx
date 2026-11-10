"use client";

// The confirmation before a hand-off: what will happen, in order, and (for
// review moves) a box for notes. Cmd or Ctrl+Enter confirms; Escape cancels.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/content/copy";
import type { HandoffCopy } from "@/lib/pipeline/handoffs";

const T = copy.projectum.pipeline.transition;

type Props = {
  open: boolean;
  copy: HandoffCopy;
  feedback?: "required" | "optional";
  onConfirm: (feedback: string) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
};

export function HandoffDialog(p: Props) {
  return (
    <Dialog open={p.open} onOpenChange={(o) => !o && !p.busy && p.onCancel()}>
      {/* The popup only mounts while open, so the notes box starts empty each time. */}
      <DialogContent className="sm:max-w-md">
        <Body {...p} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ copy: c, feedback, onConfirm, onCancel, busy, error }: Props) {
  const [notes, setNotes] = React.useState("");
  const id = React.useId();
  const blocked = busy || (feedback === "required" && !notes.trim());
  const confirm = () => {
    if (!blocked) onConfirm(notes.trim());
  };
  return (
    <div
      className="contents"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          confirm();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{c.title}</DialogTitle>
      </DialogHeader>
      {c.lead && <p className="text-muted-foreground">{c.lead}</p>}
      {c.steps.length > 0 && (
        <ol className="grid list-decimal gap-1.5 pl-5">
          {c.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {c.note && <p className="text-muted-foreground">{c.note}</p>}
      {feedback && (
        <div className="grid gap-1.5">
          <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
            {c.prompt ?? (feedback === "required" ? T.notesRequired : T.notesOptional)}
          </label>
          <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          {T.cancel}
        </Button>
        <Button onClick={confirm} disabled={blocked}>
          {c.confirm}
        </Button>
      </DialogFooter>
    </div>
  );
}
