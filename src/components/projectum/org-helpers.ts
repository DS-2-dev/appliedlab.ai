// What the organization page asks the Worker and who may do what on it. Pure,
// so scripts/org-ui.test.mjs checks every case without rendering. The Worker
// decides for real (worker/src/orgs.ts); this only hides what would be refused.

import type { Account } from "@/lib/account";
import type { Org, OrgPerson } from "@/components/projectum/pipeline-store";

type Who = Pick<Account, "id" | "roles" | "admin">;

// The page's data: the caller's own org, or (staff, ?id=) another by id.
export function orgPagePath(orgId: string | null): string {
  return orgId ? `/orgs/${encodeURIComponent(orgId)}` : "/orgs/mine";
}

// A change to the org. Only an admin may name another org, with ?org=.
export function orgActionPath(action: "" | "/transfer" | "/remove", orgId: string | null): string {
  return `/orgs/mine${action}${orgId ? `?org=${encodeURIComponent(orgId)}` : ""}`;
}

// The primary and admins manage an org; other partners and reps only look.
export function canManageOrg(me: Who, org: Pick<Org, "primaryUserId">): boolean {
  return me.admin || me.roles.includes("admin") || org.primaryUserId === me.id;
}

// The primary stays until the role is handed over.
export function canActOnPerson(me: Who, org: Pick<Org, "primaryUserId">, person: Pick<OrgPerson, "primary">): boolean {
  return canManageOrg(me, org) && !person.primary;
}

// An org with nobody to decide: its requests go to the admins.
export function hasNoPrimary(org: Pick<Org, "primaryUserId">): boolean {
  return !org.primaryUserId;
}
