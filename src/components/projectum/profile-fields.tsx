"use client";

// The signed-in account's name and email in Settings, headed like the
// project card's fields.

import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";

const P = copy.projectum.settingsPage;

function Field({ heading, value }: { heading: string; value: string }) {
  return (
    <section className="grid content-start gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>
      <p className="truncate">{value}</p>
    </section>
  );
}

export function ProfileFields() {
  const { name, email } = useAccount();
  return (
    <div className="grid grid-cols-2 gap-6">
      <Field heading={P.nameLabel} value={name} />
      <Field heading={P.emailLabel} value={email} />
    </div>
  );
}
