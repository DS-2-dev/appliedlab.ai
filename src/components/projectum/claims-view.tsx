"use client";

// My Claims, a member's view: every problem they've claimed, alone or on a
// team, with the plan, where it stands, and the Lab's note. Approvals, the
// approver's view: claims waiting for a decision, and new partner
// organizations waiting to post.

import * as React from "react";
import Link from "next/link";
import { copy } from "@/content/copy";
import { LIMITS } from "@/lib/problems";
import {
  type MyClaim,
  type PendingPartner,
  type QueueClaim,
  send,
  useApi,
} from "@/components/projectum/pipeline-store";
import {
  ClaimStatusBadge,
  Empty,
  FieldTags,
  LoadError,
  Loading,
  PlanView,
  Team,
  ViewFrame,
  formatDate,
} from "@/components/projectum/pipeline-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const P = copy.projectum.pipeline;

const problemHref = (id: string) => `/projectum?problem=${encodeURIComponent(id)}`;

export function MyClaims() {
  const { data, error, retry } = useApi<{ claims: MyClaim[] }>("/claims/mine");
  const [busy, setBusy] = React.useState<string | null>(null);

  const withdraw = async (id: string) => {
    if (!window.confirm(P.myClaims.withdrawConfirm)) return;
    setBusy(id);
    try {
      await send(`/claims/${id}/withdraw`, "POST");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ViewFrame title={P.myClaims.title} description={P.myClaims.description}>
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : data.claims.length ? (
        <div className="grid gap-4">
          {data.claims.map((c) => (
            <Card key={c.id} size="sm" data-my-claim="">
              <CardHeader className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  {c.problem && (
                    <CardTitle>
                      <Link href={problemHref(c.problem.id)} className="hover:underline">
                        {c.problem.title}
                      </Link>
                    </CardTitle>
                  )}
                  {c.problem && <CardDescription>{c.problem.owner}</CardDescription>}
                </div>
                <ClaimStatusBadge status={c.status} />
              </CardHeader>
              <CardContent className="grid gap-4">
                {c.reviewNote && (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">{P.myClaims.note}</p>
                    <p>{c.reviewNote}</p>
                  </div>
                )}
                <div className="grid gap-1">
                  <p className="text-xs font-medium text-muted-foreground">{P.myClaims.team}</p>
                  <Team team={c.team} />
                </div>
                <PlanView plan={c.plan} />
              </CardContent>
              {(c.status === "pending" || c.status === "approved") && (
                <CardFooter className="gap-2">
                  {c.projectId && (
                    <Link href={`/projectum?project=${encodeURIComponent(c.projectId)}`} className={buttonVariants({ size: "sm" })}>
                      {P.myClaims.openBoard}
                    </Link>
                  )}
                  <Button variant="outline" size="sm" disabled={busy === c.id} onClick={() => void withdraw(c.id)}>
                    {P.myClaims.withdraw}
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{P.myClaims.empty}</Empty>
      )}
    </ViewFrame>
  );
}

function QueueClaimCard({ claim }: { claim: QueueClaim }) {
  const ids = React.useId();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const decide = async (decision: "approve" | "deny") => {
    setBusy(true);
    try {
      await send(`/claims/${claim.id}/review`, "POST", { decision, note });
    } catch {
      setBusy(false);
    }
  };
  return (
    <Card size="sm" data-queue-claim="">
      <CardHeader className="gap-1">
        {claim.problem && (
          <>
            <CardTitle>
              <Link href={problemHref(claim.problem.id)} className="hover:underline">
                {claim.problem.title}
              </Link>
            </CardTitle>
            <CardDescription>{claim.problem.owner.name}</CardDescription>
            <div className="flex flex-wrap items-center gap-1">
              {claim.problem.origin === "member" && <Badge>{P.queue.studentProject}</Badge>}
              <FieldTags fields={claim.problem.fields} />
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">{P.myClaims.team}</p>
          <Team team={claim.team} />
        </div>
        <PlanView plan={claim.plan} />
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-note`}>{P.queue.note}</Label>
          <Textarea
            id={`${ids}-note`}
            rows={2}
            value={note}
            maxLength={LIMITS.note}
            placeholder={P.queue.notePlaceholder}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button disabled={busy} onClick={() => void decide("approve")}>
          {P.queue.approve}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void decide("deny")}>
          {P.queue.deny}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PartnerRow({ partner }: { partner: PendingPartner }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3" data-queue-partner="">
      <div className="grid min-w-0">
        <span className="truncate text-sm font-medium">{partner.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {partner.email}, {P.queue.signedUp(formatDate(partner.createdAt))}
        </span>
      </div>
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await send(`/partners/${partner.id}/approve`, "POST");
          } catch {
            setBusy(false);
          }
        }}
      >
        {P.queue.approvePartner}
      </Button>
    </li>
  );
}

export function Approvals() {
  const { data, error, retry } = useApi<{ claims: QueueClaim[]; partners: PendingPartner[] }>("/queue");
  return (
    <ViewFrame title={P.queue.title} description={P.queue.description}>
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid gap-8">
          <section className="grid gap-3">
            <h2 className="text-lg font-medium">{P.queue.claims}</h2>
            {data.claims.length ? (
              <div className="grid gap-4">
                {data.claims.map((c) => (
                  <QueueClaimCard key={c.id} claim={c} />
                ))}
              </div>
            ) : (
              <Empty>{P.queue.noClaims}</Empty>
            )}
          </section>
          <section className="grid gap-3">
            <h2 className="text-lg font-medium">{P.queue.partners}</h2>
            {data.partners.length ? (
              <ul className="grid gap-2">
                {data.partners.map((p) => (
                  <PartnerRow key={p.id} partner={p} />
                ))}
              </ul>
            ) : (
              <Empty>{P.queue.noPartners}</Empty>
            )}
          </section>
        </div>
      )}
    </ViewFrame>
  );
}
