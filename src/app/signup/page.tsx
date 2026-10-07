// Sign up is the same form as Log in (login/page.tsx): a new address is
// asked for a name and gets its account.

import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/content/copy";
import { AuthShell } from "@/components/auth/AuthShell";
import { CodeLoginRoute } from "@/components/auth/CodeLoginRoute";

export const metadata: Metadata = {
  title: `${copy.join.title} | ${copy.meta.title}`,
};

export default function SignupPage() {
  return (
    <AuthShell heading={copy.auth.code.signupHeading} body={copy.auth.code.body}>
      <Suspense>
        <CodeLoginRoute />
      </Suspense>
    </AuthShell>
  );
}
