"use client";

// The account's own settings under Profile. Members see their level and what
// it means, whether their Lab-funded Claude account is ready (from
// Sponsored), and the switch that makes their profile page public, with its
// link. Partners get the switch that keeps their name off student profiles.

import * as React from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { copy } from "@/content/copy";
import { updateAccount, useAccount } from "@/lib/account";
import { LevelBadge, useTaxonomy } from "@/components/projectum/pipeline-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const P = copy.projectum.pipeline;
const F = P.profile;

// A row like Dark mode's: a label and help at the left, the switch at the
// right.
function SwitchRow({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">{help}</span>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// The fields a member wants to work in, from the live taxonomy. One that
// has since been retired stays ticked until they untick it.
function InterestsPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const ids = React.useId();
  const { taxonomy, name } = useTaxonomy();
  const offered = taxonomy?.disciplines.map((d) => d.slug) ?? [];
  const slugs = [...offered, ...value.filter((v) => !offered.includes(v))];
  return (
    <section className="grid gap-1.5" data-interests="">
      <h3 className="text-xs font-medium text-muted-foreground">{F.interestsHeading}</h3>
      <p className="text-xs text-muted-foreground">{F.interestsHelp}</p>
      {!taxonomy ? (
        <p className="text-sm text-muted-foreground">{F.interestsLoading}</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {slugs.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <Checkbox
                id={`${ids}-${s}`}
                checked={value.includes(s)}
                onCheckedChange={(on) => onChange(on ? [...value, s] : value.filter((v) => v !== s))}
              />
              <Label htmlFor={`${ids}-${s}`}>{name(s)}</Label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProfileSettings() {
  const me = useAccount();
  const ids = React.useId();
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const save = (patch: Parameters<typeof updateAccount>[0]) => {
    setFailed(false);
    updateAccount(patch).catch(() => setFailed(true));
  };

  if (me.role === "partner") {
    return (
      <div className="grid gap-2" data-profile-settings="">
        {me.org && (
          <Link href="/projectum?view=org" className="text-sm underline-offset-4 hover:underline" data-org-link="">
            {me.org.name}
          </Link>
        )}
        <SwitchRow
          id={`${ids}-hide`}
          label={F.hideNameLabel}
          help={F.hideNameHelp}
          checked={me.hideName}
          onChange={(on) => save({ hideName: on })}
        />
        {failed && <p className="text-sm text-destructive">{P.phase.failed}</p>}
      </div>
    );
  }
  if (me.role !== "member" || !me.level) return null;

  const path = me.handle ? `/profile?u=${encodeURIComponent(me.handle)}` : null;
  return (
    <div className="grid gap-4" data-profile-settings="">
      <section className="grid gap-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">{F.levelHeading}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge level={me.level} />
          <span className="text-sm text-muted-foreground">{P.levels[me.level].meaning}</span>
        </div>
      </section>
      {me.level !== "affiliate" && (
        <section className="grid gap-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">{F.claudeHeading}</h3>
          <p className="text-sm">{me.claudeAccess ? F.claudeReady : F.claudeWaiting}</p>
        </section>
      )}
      <InterestsPicker value={me.interests} onChange={(interests) => save({ interests })} />
      <SwitchRow
        id={`${ids}-public`}
        label={F.publicLabel}
        help={F.publicHelp}
        checked={me.profilePublic}
        onChange={(on) => save({ profilePublic: on })}
      />
      {me.profilePublic && path && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="truncate rounded-md bg-muted px-2 py-1 text-xs">appliedlab.ai{path}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}${path}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // The link stays on screen to copy by hand.
              }
            }}
          >
            <Copy />
            {copied ? F.copied : F.copyLink}
          </Button>
          <Link href={path} target="_blank" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ExternalLink />
            {F.view}
          </Link>
        </div>
      )}
      {failed && <p className="text-sm text-destructive">{P.phase.failed}</p>}
    </div>
  );
}
