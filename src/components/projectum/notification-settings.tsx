"use client";

// Settings' Notifications section: every kind in notification-kinds.ts,
// under its group, with a switch for the bell and one for email. A kind
// that can need the person's action always shows in the app, so its first
// switch stays on. Email goes out for what is in the app only, so it waits
// on the first switch. The daily digest switch sits above them. Each change saves at once to
// /me/notification-prefs (notify.ts) and shows before the Worker answers.

import * as React from "react";
import { Bell, Mail } from "lucide-react";
import { copy } from "@/content/copy";
import { type Channels, type NotificationGroup, notificationKinds } from "@/lib/notification-kinds";
import { updateAccount, useAccount } from "@/lib/account";
import { send, useApi } from "@/components/projectum/pipeline-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const P = copy.projectum.settingsPage;
const PATH = "/me/notification-prefs";

type Pref = Channels & { kind: string };

const GROUPS = Object.keys(P.notificationGroups) as NotificationGroup[];

// The daily digest switch, saved at once to /me (accounts.ts).
function DigestSwitch() {
  const me = useAccount();
  const id = React.useId();
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="grid gap-2" data-digest="">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-0.5">
          <Label htmlFor={id}>{P.digestLabel}</Label>
          <span className="text-xs text-muted-foreground">{P.digestHelp}</span>
        </div>
        <Switch
          id={id}
          checked={me.digest}
          onCheckedChange={(on) => {
            setFailed(false);
            updateAccount({ digest: on }).catch(() => setFailed(true));
          }}
        />
      </div>
      {failed && <p className="text-sm text-destructive">{P.notificationsSaveFailed}</p>}
    </div>
  );
}

export function NotificationSettings() {
  const { data, error, retry } = useApi<{ prefs: Pref[] }>(PATH);
  const [changed, setChanged] = React.useState<Record<string, Channels>>({});
  const [failed, setFailed] = React.useState(false);

  if (!data) {
    return (
      <div className="grid gap-5">
        <DigestSwitch />
        {!error ? (
          <p className="text-sm text-muted-foreground">{P.notificationsLoading}</p>
        ) : (
          <div className="grid justify-items-start gap-2">
            <p className="text-sm text-destructive">{P.notificationsFailed}</p>
            <Button variant="outline" size="sm" onClick={retry}>
              {P.notificationsRetry}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const saved = new Map(data.prefs.map((p) => [p.kind, p]));
  const current = (kind: string): Channels => changed[kind] ?? saved.get(kind) ?? { inApp: true, email: false };
  const save = (kind: string, next: Channels) => {
    const before = changed[kind];
    setFailed(false);
    setChanged((c) => ({ ...c, [kind]: next }));
    send(PATH, "PUT", { prefs: [{ kind, ...next }] }).catch(() => {
      setFailed(true);
      setChanged((c) => {
        const rest = { ...c };
        delete rest[kind];
        return before ? { ...rest, [kind]: before } : rest;
      });
    });
  };

  return (
    <div className="grid gap-5" data-notification-settings="">
      <DigestSwitch />
      {GROUPS.map((group) => {
        const kinds = notificationKinds.filter((k) => k.group === group);
        return (
          <section key={group} className="grid gap-1">
            <div className="flex items-center justify-between gap-4 px-3 text-xs font-medium text-muted-foreground">
              <h3>{P.notificationGroups[group]}</h3>
              <div className="flex shrink-0 gap-4">
                <span className="flex w-9 justify-center" title={P.notificationsInApp}>
                  <Bell className="size-3.5" aria-hidden />
                  <span className="sr-only">{P.notificationsInApp}</span>
                </span>
                <span className="flex w-9 justify-center" title={P.notificationsEmail}>
                  <Mail className="size-3.5" aria-hidden />
                  <span className="sr-only">{P.notificationsEmail}</span>
                </span>
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {kinds.map((k) => {
                const c = current(k.kind);
                const inApp = k.court || c.inApp;
                return (
                  <div key={k.kind} className="flex items-center justify-between gap-4 p-3" data-kind={k.kind}>
                    <div className="grid gap-0.5">
                      <span className="text-sm">{k.label}</span>
                      {k.court && <span className="text-xs text-muted-foreground">{P.notificationsCourtHelp}</span>}
                    </div>
                    <div className="flex shrink-0 gap-4">
                      <Switch
                        aria-label={`${k.label}, ${P.notificationsInApp}`}
                        checked={inApp}
                        disabled={k.court}
                        onCheckedChange={(on) => save(k.kind, { inApp: on, email: on && c.email })}
                      />
                      <Switch
                        aria-label={`${k.label}, ${P.notificationsEmail}`}
                        checked={inApp && c.email}
                        disabled={!inApp}
                        onCheckedChange={(on) => save(k.kind, { inApp, email: on })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {failed && <p className="text-sm text-destructive">{P.notificationsSaveFailed}</p>}
    </div>
  );
}
