"use client";

// Claim a posting: pick teammates, read what happens next (the
// project.claim hand-off), then claim. The project opens with its board,
// and the team lands on it to write the action plan.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { ApiError, api, useAccount } from "@/lib/account";
import { HANDOFF } from "@/lib/pipeline/handoffs";
import { HandoffDialog } from "@/components/projectum/handoff-dialog";
import { type PipelineProject, type Person, type Posting, send } from "@/components/projectum/pipeline-store";
import { TeammatePicker } from "@/components/projectum/pipeline-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const C = copy.projectum.pipeline.claim;

function claimError(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "already-claimed") return C.alreadyClaimed;
  if (code === "state") return C.closed;
  if (code === "teammates") return C.teammates;
  return C.failed;
}

// Controlled by its opener; every open starts with no teammates.
export function ClaimDialog({
  open,
  onOpenChange,
  posting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posting: Pick<Posting, "id" | "title" | "org">;
}) {
  const me = useAccount();
  const router = useRouter();
  const [team, setTeam] = React.useState<Person[]>([]);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const close = () => {
    setTeam([]);
    setConfirming(false);
    setError(null);
    onOpenChange(false);
  };

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await send<{ id: string }>(`/postings/${encodeURIComponent(posting.id)}/claim`, "POST", {
        teammates: team.map((t) => t.id),
      });
      // The claim answers with the project's id; its board comes with it.
      const project = await api<PipelineProject>(`/projects/${encodeURIComponent(id)}`).catch(() => null);
      close();
      router.push(
        project?.boardId
          ? `/projectum?project=${encodeURIComponent(project.boardId)}`
          : `/projectum?view=project&id=${encodeURIComponent(id)}`,
      );
    } catch (err) {
      setError(claimError(err));
    } finally {
      setBusy(false);
    }
  };

  const handoff = HANDOFF["project.claim"]({
    posting: posting.title,
    partner: posting.org?.name ?? "",
    member: me.name,
    affiliate: me.level === "affiliate",
  });

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{C.title}</DialogTitle>
            <DialogDescription>{`${posting.title}. ${C.description}`}</DialogDescription>
          </DialogHeader>
          <TeammatePicker value={team} onChange={setTeam} />
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {C.cancel}
            </Button>
            <Button onClick={() => setConfirming(true)}>{C.next}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HandoffDialog
        open={open && confirming}
        copy={handoff}
        busy={busy}
        error={error}
        onConfirm={() => void claim()}
        onCancel={close}
      />
    </>
  );
}
