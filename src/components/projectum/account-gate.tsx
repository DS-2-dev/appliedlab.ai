"use client";

// Projectum opens only for a signed-in account. Signed out, it goes to Log
// in and comes back here after. A partner organization the Lab has not yet
// approved sees a note instead, with Log out.

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { copy } from "@/content/copy";
import { logout, useAccountState } from "@/lib/account";
import { clearPipeline } from "@/components/projectum/pipeline-store";
import { Button } from "@/components/ui/button";

const P = copy.auth.pending;

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await logout();
        clearPipeline();
        router.replace("/login");
      }}
    >
      <LogOut />
      {copy.projectum.logout}
    </Button>
  );
}

export function AccountGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const state = useAccountState();
  React.useEffect(() => {
    if (state.status !== "signed-out") return;
    const here = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [state.status, router]);

  if (state.status !== "signed-in") return null;
  if (state.account.status === "pending") {
    return (
      <main className="projectum-ui grid min-h-svh place-items-center p-6">
        <div className="grid max-w-md gap-3 text-center">
          <h1 className="text-xl font-medium">{P.heading}</h1>
          <p className="text-muted-foreground">{P.body}</p>
          <p className="text-sm text-muted-foreground">{state.account.email}</p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </main>
    );
  }
  return children;
}
