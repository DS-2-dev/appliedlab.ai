"use client";

// The organization page (?view=org). A partner sees their own; staff open
// another with ?id=. The primary (or an admin) edits the profile, hands over
// the primary role, removes people and answers join requests; other partners
// and reps look. The Worker enforces all of it (worker/src/orgs.ts).

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { canManageOrg, orgActionPath, orgPagePath } from "@/components/projectum/org-helpers";
import { errorText, PeopleAndRequests } from "@/components/projectum/org-people";
import { type Org, type OrgPage, send, useApi } from "@/components/projectum/pipeline-store";
import { LoadError, Loading, ViewFrame } from "@/components/projectum/pipeline-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const O = copy.projectum.pipeline.org;
const TEXT_FIELDS = ["name", "industry", "location", "website"] as const;

function ProfileForm({ org, orgId }: { org: Org; orgId: string | null }) {
  const me = useAccount();
  const ids = React.useId();
  const editable = canManageOrg(me, org);
  const ownOrg = me.roles.includes("partner") && me.orgId === org.id;
  const [draft, setDraft] = React.useState({
    name: org.name,
    industry: org.industry,
    location: org.location,
    website: org.website,
    description: org.description,
    isPublic: org.isPublic,
    showcaseConsentDefault: org.showcaseConsentDefault,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof draft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send(orgActionPath("", orgId), "PATCH", draft);
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4" data-org-profile="">
      <h2 className="text-lg font-medium">{O.profile}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((k) => (
          <div key={k} className="grid gap-1.5">
            <Label htmlFor={`${ids}-${k}`}>{O.fields[k]}</Label>
            <Input id={`${ids}-${k}`} value={draft[k]} disabled={!editable} onChange={(e) => set({ [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-description`}>{O.fields.description}</Label>
        <Textarea id={`${ids}-description`} value={draft.description} disabled={!editable} onChange={(e) => set({ description: e.target.value })} />
      </div>
      {(
        [
          // Partner voice for the org's own partners; staff read it about them.
          ["isPublic", O.fields.isPublic, ownOrg ? O.fields.isPublicHelp : O.fields.isPublicHelpStaff],
          ["showcaseConsentDefault", O.fields.consent, O.fields.consentHelp],
        ] as const
      ).map(([k, label, help]) => (
        <div key={k} className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor={`${ids}-${k}`}>{label}</Label>
            <span className="text-xs text-muted-foreground">{help}</span>
          </div>
          <Switch id={`${ids}-${k}`} checked={draft[k]} disabled={!editable} onCheckedChange={(on) => set({ [k]: on })} />
        </div>
      ))}
      {editable ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !draft.name.trim()}>
            {O.save}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">{O.saved}</span>}
          {error && (
            <span role="alert" className="text-sm" style={{ color: "var(--tone-red-fg)" }}>
              {error}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{O.readOnly}</p>
      )}
    </form>
  );
}

// A partner removed from their organization: no page, but they may ask the
// one at their email domain to take them back.
function NoOrg() {
  const [state, setState] = React.useState<"idle" | "busy" | "asked">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const ask = async () => {
    setState("busy");
    setError(null);
    try {
      await send("/orgs/requests", "POST", {});
      setState("asked");
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  };
  return (
    <ViewFrame title={O.title} description={O.description}>
      <div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-6 text-sm" data-no-org="">
        <p>{state === "asked" ? O.asked : O.noOrg}</p>
        {state !== "asked" && (
          <Button variant="outline" size="sm" disabled={state === "busy"} onClick={ask}>
            {O.askToJoin}
          </Button>
        )}
        {error && (
          <p role="alert" style={{ color: "var(--tone-red-fg)" }}>
            {error}
          </p>
        )}
      </div>
    </ViewFrame>
  );
}

function Page({ orgId }: { orgId: string | null }) {
  const { data, error, retry } = useApi<OrgPage>(orgPagePath(orgId));
  const staffView = Boolean(orgId);
  return (
    <ViewFrame
      title={data?.org.name ?? O.title}
      description={staffView ? O.staffDescription : O.description}
      action={
        staffView ? (
          <Link href="/projectum" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft />
            {O.back}
          </Link>
        ) : undefined
      }
    >
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid gap-8" data-org-view="">
          <ProfileForm key={JSON.stringify(data.org)} org={data.org} orgId={orgId} />
          <PeopleAndRequests page={data} orgId={orgId} />
        </div>
      )}
    </ViewFrame>
  );
}

export function OrgView({ id }: { id: string | null }) {
  const me = useAccount();
  // A partner without an organization has no page to load.
  if (!id && !me.orgId) return <NoOrg />;
  return <Page orgId={id} />;
}
