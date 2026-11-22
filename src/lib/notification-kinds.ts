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

import { ROLES, type Role } from "./pipeline/domain";

const notificationLabels = {
  notificationGroups: {
    postings: "Postings",
    projects: "Projects",
    reviews: "Reviews",
    accounts: "Accounts",
    organizations: "Organizations",
  },
  notificationKinds: {
    "posting.submitted": "A posting is sent for review",
    "posting.published": "A posting goes on the board",
    "posting.returned": "A posting comes back with notes",
    "posting.closed": "A posting closes to new claims",
    "project.claimed": "Someone claims a posting",
    "project.plan_approved": "An action plan is approved",
    "project.plan_returned": "An action plan comes back with notes",
    "project.work_approved": "Work is approved and delivered",
    "project.work_returned": "Work comes back with notes",
    "project.integrated": "A team is brought on to implement",
    "project.completion_requested": "A team asks for sign-off",
    "project.completion_returned": "Sign-off is held back",
    "project.completed": "A project is complete",
    "project.withdrawn": "A team releases its claim",
    "project.reopened": "A project is reopened",
    "meeting.requested": "A partner asks to meet a team",
    "meeting.scheduled": "A meeting is being arranged",
    reminder: "Reminders about due dates and quiet boards",
    "project.plan_submitted": "An action plan is ready for review",
    "project.work_submitted": "Work is ready for review",
    "review.assigned": "A review is assigned to you",
    "account.pending": "A new account waits for approval",
    "account.approved": "Your account is approved",
    "member.level_changed": "Your level changes",
    "org.join_requested": "Someone asks to join your organization",
    "org.join_approved": "Your request to join is approved",
    "org.join_declined": "Your request to join is declined",
    "org.primary_transferred": "Your organization has a new primary contact",
    "org.member_removed": "Someone is removed from your organization",
  },
} as const;

export type NotificationGroup = keyof typeof notificationLabels.notificationGroups;
export type Channels = { inApp: boolean; email: boolean };

export type NotificationKind = {
  kind: keyof typeof notificationLabels.notificationKinds;
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
  label: notificationLabels.notificationKinds[kind],
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
