"use client";

// The people and join requests on the organization page. Each destructive
// move (hand over the primary, remove, decline) asks first, in the same
// dialog the hand-offs use.

import * as React from "react";
import { Check, Crown, UserMinus, X } from "lucide-react";
import { copy } from "@/content/copy";
import { ApiError, useAccount } from "@/lib/account";
import type { HandoffCopy } from "@/lib/pipeline/handoffs";
import { HandoffDialog } from "@/components/projectum/handoff-dialog";
import { canActOnPerson, canManageOrg, hasNoPrimary, orgActionPath } from "@/components/projectum/org-helpers";
import { type OrgPage, send } from "@/components/projectum/pipeline-store";
import { formatDate } from "@/components/projectum/pipeline-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const O = copy.projectum.pipeline.org;

export function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "";
  return (O.errors as Record<string, string>)[code] ?? O.errors.fallback;
}

type Pending =
  | { kind: "transfer" | "remove"; id: string; name: string }
  | { kind: "decline"; id: string; name: string };

function dialogCopy(p: Pending): HandoffCopy {
  switch (p.kind) {
    case "transfer":
      return { title: O.transferTitle(p.name), lead: O.transferLead, steps: [], confirm: O.transferConfirm };
    case "remove":
      return { title: O.removeTitle(p.name), lead: O.removeLead, steps: [], confirm: O.removeConfirm };
    case "decline":
      return { title: O.declineTitle(p.name), lead: O.declineLead, steps: [], confirm: O.declineConfirm };
  }
}

// `orgId` is set when staff look at another organization (?id=).
export function PeopleAndRequests({ page, orgId }: { page: OrgPage; orgId: string | null }) {
  const me = useAccount();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const manage = canManageOrg(me, page.org);

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPending(null);
      done?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = (note: string) => {
    if (!pending) return;
    if (pending.kind === "transfer") return run(() => send(orgActionPath("/transfer", orgId), "POST", { userId: pending.id }));
    if (pending.kind === "remove") return run(() => send(orgActionPath("/remove", orgId), "POST", { userId: pending.id }));
    return run(() => send(`/orgs/requests/${encodeURIComponent(pending.id)}/decline`, "POST", { note }));
  };

  const approve = (id: string) => run(() => send(`/orgs/requests/${encodeURIComponent(id)}/approve`, "POST", {}));

  return (
    <>
      <section className="grid gap-3" data-org-people="">
        <h2 className="text-lg font-medium">{O.people}</h2>
        <ul className="grid gap-2">
          {page.people.map((p) => (
            <li key={p.id} data-person={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {p.name}
                  {p.primary && (
                    <Badge variant="secondary">
                      <Crown />
                      {O.primary}
                    </Badge>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{p.email}</span>
              </div>
              {canActOnPerson(me, page.org, p) && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPending({ kind: "transfer", id: p.id, name: p.name })}>
                    <Crown />
                    {O.makePrimary}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPending({ kind: "remove", id: p.id, name: p.name })}>
                    <UserMinus />
                    {O.remove}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" data-org-requests="">
        <h2 className="text-lg font-medium">{O.requests}</h2>
        {hasNoPrimary(page.org) && <p className="text-sm text-muted-foreground">{O.noPrimary}</p>}
        {error && !pending && (
          <p role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
            {error}
          </p>
        )}
        {page.requests.length ? (
          <ul className="grid gap-2">
            {page.requests.map((r) => (
              <li key={r.id} data-request={r.id} className="grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-medium">{r.user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.user.email}, {formatDate(r.createdAt)}
                    </span>
                  </div>
                  {manage && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={busy} onClick={() => approve(r.id)}>
                        <Check />
                        {O.approve}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setPending({ kind: "decline", id: r.id, name: r.user.name })}>
                        <X />
                        {O.decline}
                      </Button>
                    </div>
                  )}
                </div>
                {r.message && <p className="text-sm text-muted-foreground">{O.wrote(r.message)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{O.noRequests}</p>
        )}
      </section>

      <HandoffDialog
        open={Boolean(pending)}
        copy={pending ? dialogCopy(pending) : { title: "", steps: [], confirm: "" }}
        feedback={pending?.kind === "decline" ? "optional" : undefined}
        onConfirm={confirm}
        onCancel={() => {
          setPending(null);
          setError(null);
        }}
        busy={busy}
        error={pending ? error : null}
      />
    </>
  );
}
