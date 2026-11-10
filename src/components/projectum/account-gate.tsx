"use client";

// Projectum opens only for a signed-in account. Signed out, it goes to Log
// in and comes back here after. A partner organization the Lab has not yet
// approved sees a note instead, with Log out, in the site's frame.

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { copy } from "@/content/copy";
import { logout, useAccountState } from "@/lib/account";
import { watchErrors } from "@/lib/report-error";
import { clearPipeline } from "@/components/projectum/pipeline-store";
import { Button } from "@/components/ui/button";
import { MessagePage, onward } from "@/components/home/MessagePage";

const P = copy.auth.pending;

// `plain` is the site's ↳ link look, for the pages in the site's frame.
export function LogoutButton({ plain = false }: { plain?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const out = async () => {
    setPending(true);
    await logout();
    clearPipeline();
    router.replace("/login");
  };
  if (plain) {
    return (
      <button type="button" className={onward} disabled={pending} onClick={out}>
        ↳ {copy.projectum.logout}
      </button>
    );
  }
  return (
    <Button type="button" variant="outline" disabled={pending} onClick={out}>
      <LogOut />
      {copy.projectum.logout}
    </Button>
  );
}

export function AccountGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const state = useAccountState();
  // Errors in Projectum that nothing caught reach the Lab as alerts.
  React.useEffect(() => watchErrors(), []);
  React.useEffect(() => {
    if (state.status !== "signed-out") return;
    const here = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [state.status, router]);

  if (state.status !== "signed-in") return null;
  if (state.account.status === "pending") {
    // A partner who asked an organization to let them in sees whose answer it is.
    const org = state.account.pendingOrgName;
    return (
      <MessagePage kicker={state.account.email} title={org ? P.waitingFor(org) : P.heading} body={org ? P.waitingForBody : state.account.role === "rep" ? P.repBody : P.body}>
        <LogoutButton plain />
      </MessagePage>
    );
  }
  return children;
}
