// The notifications a person can choose about, one per event type that
// emit() notifies on (worker/src: the transitions in pipeline/machines.ts
// plus the literal types emit() is called with). Transitions that notify no
// one (a posting withdrawn, paused, resumed, reopened or archived) are left
// out. Pure data, safe for the site and the Worker: the Worker checks
// PUT /me/notification-prefs against it, and Settings lists it.
//
// court marks a kind that can land in someone's court (action needed). Those
// always show in the app, since the court list and the bell's count read
// them, so only their email can be switched.
//
// Every role starts with the app on and email off: sign-in codes, account
// approvals, meeting requests and the like already send their own emails.

import { copy } from "@/content/copy";
import { ROLES, type Role } from "@/lib/pipeline/domain";

export type NotificationGroup = keyof typeof copy.projectum.settingsPage.notificationGroups;
export type Channels = { inApp: boolean; email: boolean };

export type NotificationKind = {
  kind: keyof typeof copy.projectum.settingsPage.notificationKinds;
  label: string;
  group: NotificationGroup;
  court: boolean;
  defaults: Record<Role, Channels>;
};

const ON_IN_APP: Channels = { inApp: true, email: false };
const DEFAULTS = Object.fromEntries(ROLES.map((r) => [r, ON_IN_APP])) as Record<Role, Channels>;

const KINDS: [NotificationKind["kind"], NotificationGroup, boolean][] = [
  ["posting.submitted", "postings", true],
  ["posting.published", "postings", false],
  ["posting.returned", "postings", true],
  ["posting.closed", "postings", false],
  ["project.claimed", "projects", false],
  ["project.plan_approved", "projects", true],
  ["project.plan_returned", "projects", true],
  ["project.work_approved", "projects", true],
  ["project.work_returned", "projects", true],
  ["project.integrated", "projects", true],
  ["project.completion_requested", "projects", true],
  ["project.completion_returned", "projects", true],
  ["project.completed", "projects", false],
  ["project.withdrawn", "projects", false],
  ["project.reopened", "projects", false],
  ["meeting.requested", "projects", true],
  ["meeting.scheduled", "projects", false],
  ["reminder", "projects", false],
  ["project.plan_submitted", "reviews", true],
  ["project.work_submitted", "reviews", true],
  ["review.assigned", "reviews", true],
  ["account.pending", "accounts", true],
  ["account.approved", "accounts", false],
  ["member.level_changed", "accounts", false],
  ["org.join_requested", "organizations", true],
  ["org.join_approved", "organizations", false],
  ["org.join_declined", "organizations", false],
  ["org.primary_transferred", "organizations", false],
  ["org.member_removed", "organizations", false],
];

export const notificationKinds: NotificationKind[] = KINDS.map(([kind, group, court]) => ({
  kind,
  label: copy.projectum.settingsPage.notificationKinds[kind],
  group,
  court,
  defaults: DEFAULTS,
}));

export function notificationKind(kind: string): NotificationKind | undefined {
  return notificationKinds.find((k) => k.kind === kind);
}

/** Every kind's starting channels for a role, before any saved pref. */
export function defaultsFor(role: Role): Record<string, Channels> {
  return Object.fromEntries(notificationKinds.map((k) => [k.kind, { ...k.defaults[role] }]));
}
